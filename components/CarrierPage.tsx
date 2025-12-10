
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, School, CanteenShop, DeliveryNotification, CanteenOrder, CanteenSettings, CanteenTable } from '../types';
import * as canteenService from '../services/canteenService';
import UserAvatar from './UserAvatar';
import BarcodeScanner from './BarcodeScanner';
import ProfilePage from './ProfilePage';
import NotificationBell from './NotificationBell';
import { APP_TITLE } from '../constants';

interface CarrierPageProps {
    user: User;
    school: School;
    onLogout: () => void;
}

// ICONS
const QueueIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>;
const HamburgerIcon = () => (<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);

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


const CarrierPage: React.FC<CarrierPageProps> = ({ user, school, onLogout }) => {
    const [assignedShop, setAssignedShop] = useState<CanteenShop | null>(null);
    const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
    const [orders, setOrders] = useState<CanteenOrder[]>([]);
    const [posModalData, setPosModalData] = useState<{ notification: DeliveryNotification; order?: CanteenOrder } | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [canteenSettings, setCanteenSettings] = useState<CanteenSettings | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);

    const refreshData = useCallback(() => {
        if (assignedShop) {
            setNotifications(canteenService.getDeliveryNotificationsForShop(assignedShop.id));
            setOrders(canteenService.getOrdersForShop(assignedShop.id));
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
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
                <h2 className="text-2xl font-bold">Not Assigned to a Shop</h2>
                <p className="text-gray-400 mt-2">Please contact the school administrator to be assigned as a carrier for a canteen shop.</p>
                <button onClick={onLogout} className="mt-6 px-4 py-2 bg-red-600 rounded-md">Logout</button>
            </div>
        );
    }
    
    const navItems = [
        { id: 'queue', name: 'Delivery Queue', icon: <QueueIcon /> },
    ];

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as User);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                />
            )}
            {posModalData && (
                <POSModal
                    data={posModalData}
                    currentUser={user}
                    onClose={() => setPosModalData(null)}
                    onComplete={handleOrderComplete}
                />
            )}

            <aside className="bg-gray-800 shadow-xl flex-col w-64 hidden md:flex">
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                    <h1 className="text-xl font-bold text-cyan-400 truncate">{APP_TITLE}</h1>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                    {navItems.map(item => (
                        <button key={item.id} className="w-full flex items-center p-3 text-white bg-cyan-600">
                            <span className="mr-3">{item.icon}</span>{item.name}
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 shadow-md z-10">
                     <div className="flex items-center">
                        <button className="md:hidden p-2 text-gray-400 hover:text-white mr-2"><HamburgerIcon /></button>
                        <h2 className="text-lg font-semibold text-white truncate">Delivery Queue</h2>
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationBell userId={currentUser.studentId} />
                        <div className="relative cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-9 h-9 rounded-full border-2 border-gray-600" />
                        </div>
                        <button onClick={onLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </header>
                
                <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-gray-900">
                     <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Carrier Dashboard</h2>
                    <p className="text-gray-400 mb-6">Serving for: <span className="font-bold text-white">{assignedShop.name}</span></p>

                    {successMessage && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4">{successMessage}</div>}

                    <section>
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
                </main>
            </div>
        </div>
    );
};

export default CarrierPage;
