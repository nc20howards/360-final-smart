
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, School, CanteenShop, DeliveryNotification, CanteenOrder, CanteenSettings, CanteenTable } from '../types';
import * as canteenService from '../services/canteenService';
import UserAvatar from './UserAvatar';
import BarcodeScanner from './BarcodeScanner';

interface CarrierPageProps {
    user: User;
    school: School;
}

// --- POS Modal Sub-component ---
interface POSModalProps {
    data: { notification: DeliveryNotification; order?: CanteenOrder };
    currentUser: User;
    onClose: () => void;
    onComplete: () => void;
}

const POSModal: React.FC<POSModalProps> = ({ data, currentUser, onClose, onComplete }) => {
    const [verificationId, setVerificationId] = useState('');
    const [error, setError] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const { notification, order } = data;

    const handleVerifyAndComplete = async () => {
        setError('');
        if (!order) {
            setError("Order details are missing.");
            return;
        }
        if (!verificationId.trim()) {
            setError("Please enter or scan the student's ID.");
            return;
        }

        setIsCompleting(true);
        try {
            if (verificationId.trim().toLowerCase() !== notification.studentId.toLowerCase()) {
                throw new Error("Student ID does not match the order.");
            }
            await canteenService.completeScannedOrder(order.id, currentUser.studentId);
            canteenService.updateNotificationStatus(notification.id, 'served');
            onComplete();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsCompleting(false);
        }
    };
    
    const handleScanSuccess = (decodedText: string) => {
        setVerificationId(decodedText);
        setIsScanning(false);
    };

    if (!order) {
        return (
             <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm text-center">
                    <p className="text-red-400">Error: Could not load order details for this delivery.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-600 rounded">Close</button>
                </div>
            </div>
        );
    }

    return (
        <>
            {isScanning && (
                <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    onScanError={(err) => {
                        setError(`Scan failed: ${err.message}`);
                        setIsScanning(false);
                    }}
                    onClose={() => setIsScanning(false)}
                />
            )}
            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                    <h3 className="text-xl font-bold">Verify & Complete Order</h3>
                    <div className="bg-gray-700 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between"><span className="text-gray-400">Student:</span> <strong>{notification.studentName}</strong></div>
                        <div className="flex justify-between"><span className="text-gray-400">Table:</span> <strong>{notification.tableNumber}</strong></div>
                        <div className="flex justify-between font-bold text-lg border-t border-gray-600 pt-2"><span className="text-gray-400">Total:</span> <span>UGX {order.totalAmount.toLocaleString()}</span></div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-300 mb-1 block">Verify Student ID</label>
                        <div className="flex gap-2">
                            <input
                                value={verificationId}
                                onChange={(e) => setVerificationId(e.target.value)}
                                placeholder="Enter or Scan Student ID"
                                className="w-full p-2 bg-gray-900 rounded-md"
                            />
                            <button onClick={() => setIsScanning(true)} className="p-2 bg-gray-600 rounded-md">Scan</button>
                        </div>
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                        <button onClick={handleVerifyAndComplete} disabled={isCompleting} className="px-4 py-2 bg-green-600 rounded disabled:bg-gray-500">
                            {isCompleting ? 'Processing...' : 'Verify & Complete'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};


const CarrierPage: React.FC<CarrierPageProps> = ({ user, school }) => {
    const [assignedShop, setAssignedShop] = useState<CanteenShop | null>(null);
    const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
    const [orders, setOrders] = useState<CanteenOrder[]>([]);
    const [activeOrders, setActiveOrders] = useState<CanteenOrder[]>([]);
    const [posModalData, setPosModalData] = useState<{ notification: DeliveryNotification; order?: CanteenOrder } | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [canteenSettings, setCanteenSettings] = useState<CanteenSettings | null>(null);


    const refreshData = useCallback(() => {
        if (assignedShop) {
            setNotifications(canteenService.getDeliveryNotificationsForShop(assignedShop.id));
            const allShopOrders = canteenService.getOrdersForShop(assignedShop.id);
            setOrders(allShopOrders);
            setActiveOrders(allShopOrders.filter(o => ['pending', 'preparing', 'packaged', 'out_for_delivery'].includes(o.status)));
        }
    }, [assignedShop]);

    useEffect(() => {
        const shop = canteenService.getShopsForSchool(school.id).find(s => s.carrierIds?.includes(user.studentId));
        setAssignedShop(shop || null);
        setCanteenSettings(canteenService.getCanteenSettings(school.id));
    }, [school.id, user.studentId]);
    
    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000); // Poll for new notifications
        return () => clearInterval(interval);
    }, [refreshData]);

    const handleUpdateStatus = (orderId: string, newStatus: CanteenOrder['status']) => {
        try {
            canteenService.updateOrderStatus(orderId, newStatus);
            refreshData();
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleOpenPosModal = (data: { notification: DeliveryNotification; order?: CanteenOrder }) => {
        setPosModalData(data);
    };
    
    const handleOrderComplete = () => {
        setPosModalData(null);
        refreshData();
        setSuccessMessage('Order completed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleClearSeat = (notificationId: string) => {
        canteenService.clearServedNotification(notificationId);
        refreshData();
    };
    
    const OrderCard: React.FC<{ order: CanteenOrder }> = ({ order }) => {
        // FIX: Replaced the direct object indexing with a typed map to resolve the TypeScript error
        // where string literals for statuses were incorrectly inferred as `string` instead of `CanteenOrderStatus`.
        const nextActionMap: Partial<Record<CanteenOrder['status'], { label: string; status: CanteenOrder['status'], buttonClass: string }>> = {
            'pending': { label: 'Start Preparing', status: 'preparing', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
            'preparing': { label: 'Mark as Packaged', status: 'packaged', buttonClass: 'bg-indigo-600 hover:bg-indigo-700' },
            'packaged': { label: 'Ready for Delivery', status: 'out_for_delivery', buttonClass: 'bg-green-600 hover:bg-green-700' },
        };
        const nextAction = nextActionMap[order.status];

        return (
            <div className="bg-gray-700 p-3 rounded-lg space-y-2 flex flex-col">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-white">{order.studentName}</p>
                        <p className="text-xs text-gray-400">Order #{order.id.slice(-6)}</p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-300">UGX {order.totalAmount.toLocaleString()}</span>
                </div>
                <ul className="text-xs text-gray-300 list-disc list-inside flex-grow">
                    {order.items.map(item => <li key={item.itemId}>{item.quantity}x {item.name}</li>)}
                </ul>
                {nextAction && (
                    <button 
                        onClick={() => handleUpdateStatus(order.id, nextAction.status)}
                        className={`w-full mt-2 py-1.5 ${nextAction.buttonClass} text-xs font-semibold rounded-md transition-colors`}
                    >
                        {nextAction.label}
                    </button>
                )}
            </div>
        );
    };

    const ordersByStatus = useMemo(() => {
        const grouped: Record<string, CanteenOrder[]> = {
            pending: [],
            preparing: [],
            packaged: [],
            out_for_delivery: [],
        };
        activeOrders.forEach(order => {
            if (grouped[order.status]) {
                grouped[order.status].push(order);
            }
        });
        return grouped;
    }, [activeOrders]);


    const VacantSeat = () => (
        <div className="flex flex-col items-center justify-center aspect-square bg-gray-700/50 border border-gray-600 rounded-lg text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
            <span className="text-xs mt-1">Vacant</span>
        </div>
    );

    const PendingSeat: React.FC<{ notification: DeliveryNotification; order: CanteenOrder | undefined }> = ({ notification, order }) => (
        <div 
            onClick={() => handleOpenPosModal({ notification, order })}
            className="flex flex-col items-center justify-center aspect-square bg-red-500/20 border-2 border-red-500 rounded-lg text-red-300 cursor-pointer relative"
            title={`Serve ${notification.studentName}`}
        >
            <div className="absolute inset-0 animate-ripple rounded-lg" style={{ animation: 'ripple 1.5s infinite', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' }}></div>
            <UserAvatar name={notification.studentName} className="w-8 h-8 rounded-full mb-1" />
            <span className="text-xs font-semibold text-center truncate w-full px-1">{notification.studentName}</span>
        </div>
    );

    const ServedSeat: React.FC<{ notification: DeliveryNotification }> = ({ notification }) => (
        <div className="group relative flex flex-col items-center justify-center aspect-square bg-green-500/20 border-2 border-green-500 rounded-lg text-green-300">
             <UserAvatar name={notification.studentName} className="w-8 h-8 rounded-full mb-1" />
            <span className="text-xs font-semibold text-center truncate w-full px-1">{notification.studentName}</span>
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <button onClick={() => handleClearSeat(notification.id)} className="px-3 py-1 bg-gray-600 text-white rounded-md text-xs font-semibold">Clear</button>
            </div>
        </div>
    );

    const tables = canteenSettings?.seatSettings?.tables || [];
    
    if (!assignedShop) {
        return <div className="text-center p-8 text-gray-400">You are not assigned to any shop as a carrier.</div>;
    }

    return (
        <div>
            {posModalData && (
                <POSModal
                    data={posModalData}
                    currentUser={user}
                    onClose={() => setPosModalData(null)}
                    onComplete={handleOrderComplete}
                />
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Carrier Dashboard</h2>
            <p className="text-gray-400 mb-6">Serving for: <span className="font-bold text-white">{assignedShop.name}</span></p>

            {successMessage && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4">{successMessage}</div>}

            <section className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Order Preparation Flow</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-yellow-300 mb-3 text-center flex-shrink-0">Pending ({ordersByStatus.pending.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.pending.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                    <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-blue-300 mb-3 text-center flex-shrink-0">Preparing ({ordersByStatus.preparing.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.preparing.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                    <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-indigo-300 mb-3 text-center flex-shrink-0">Packaged ({ordersByStatus.packaged.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.packaged.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                    <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-green-300 mb-3 text-center flex-shrink-0">Ready for Delivery ({ordersByStatus.out_for_delivery.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.out_for_delivery.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-white mb-4">Delivery Queue</h3>
                {tables.length === 0 ? (
                    <div className="text-center py-16 bg-gray-800 rounded-lg">
                        <p className="text-gray-400">No tables have been configured for this canteen.</p>
                        <p className="text-sm text-gray-500 mt-2">The school administrator needs to set up tables in the E-Canteen settings.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {tables.map(table => {
                            const notificationsForTable = notifications.filter(n => n.tableNumber === table.label);
                            const seats = [];
                            for(let i = 0; i < table.capacity; i++) {
                                const notification = notificationsForTable[i];
                                if (notification) {
                                    if (notification.status === 'pending') {
                                        const orderForNotification = orders.find(o => o.id === notification.orderId);
                                        seats.push(<PendingSeat key={notification.id} notification={notification} order={orderForNotification} />);
                                    } else {
                                        seats.push(<ServedSeat key={notification.id} notification={notification} />);
                                    }
                                } else {
                                    seats.push(<VacantSeat key={`vacant-${table.id}-${i}`} />);
                                }
                            }

                            return (
                                <div key={table.id} className="bg-gray-800 p-4 rounded-lg shadow-xl">
                                    <h3 className="text-xl font-bold mb-4">Table {table.label}</h3>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                                        {seats}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CarrierPage;
