
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { School, CanteenShop, CanteenCategory, CanteenMenuItem, AdminUser, CanteenOrder, CanteenSettings, PaymentMethod, User, CanteenTable, CanteenTimeSlot } from '../types';
import * as canteenService from '../services/canteenService';
import ECanteenAdminPage from './ECanteenAdminPage';
import ConfirmationModal from './ConfirmationModal';
import { assignCarrierToShop, getSchoolUsersBySchoolIds, unassignCarrierFromShop, assignSellerToShop, unassignSellerFromShop } from '../services/studentService';

interface ECanteenManagementPageProps {
    school: School;
    user: AdminUser;
}

const ECanteenManagementPage = ({ school, user }: ECanteenManagementPageProps) => {
    const [shops, setShops] = useState<CanteenShop[]>([]);
    const [selectedShop, setSelectedShop] = useState<CanteenShop | null>(null);
    const [modal, setModal] = useState<'addShop' | 'editShop' | 'manageCarriers' | 'manageSellers' | null>(null);
    const [formData, setFormData] = useState<{ id?: string; name: string; description: string }>({ name: '', description: '' });
    const [error, setError] = useState('');
    
    const [activeTab, setActiveTab] = useState<'shops' | 'settings' | 'attendance'>('shops');
    const [settings, setSettings] = useState<CanteenSettings | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ title: string, message: React.ReactNode; onConfirm: () => void; } | null>(null);
    
    // --- State for Attendance Tab ---
    const [allOrders, setAllOrders] = useState<CanteenOrder[]>([]);
    const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
    const [attendanceFilterShopId, setAttendanceFilterShopId] = useState('all');
    const [expandedAttendanceOrderId, setExpandedAttendanceOrderId] = useState<string | null>(null);
    const [schoolUsers, setSchoolUsers] = useState<User[]>([]);
    const [shopForCarrierManagement, setShopForCarrierManagement] = useState<CanteenShop | null>(null);
    const [shopForSellerManagement, setShopForSellerManagement] = useState<CanteenShop | null>(null);
    const [selectedNewSellerId, setSelectedNewSellerId] = useState<string>('');


    // --- State for Seating Configuration ---
    const [tableModal, setTableModal] = useState<'add' | 'edit' | null>(null);
    const [editingTable, setEditingTable] = useState<CanteenTable | null>(null);
    const [tableForm, setTableForm] = useState<{ label: string; capacity: number }>({ label: '', capacity: 4 });
    const [isSyncDropdownOpen, setIsSyncDropdownOpen] = useState(false);
    const syncDropdownRef = useRef<HTMLDivElement>(null);
    const [activeSyncedWindow, setActiveSyncedWindow] = useState<{ name: string; startTime: string; endTime: string } | null>(null);


    // --- State for Ordering Time Windows ---
    const [timeWindowForm, setTimeWindowForm] = useState({ name: '', startTime: '', endTime: '' });


    const refreshData = useCallback(() => {
        setShops(canteenService.getShopsForSchool(school.id));
        setSettings(canteenService.getCanteenSettings(school.id));
        const schoolOrders = canteenService.getOrdersForSchool(school.id);
        setAllOrders(schoolOrders);
        setSchoolUsers(getSchoolUsersBySchoolIds([school.id]));
    }, [school.id]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const showFeedback = (message: string, isSuccess: boolean = true) => {
        if (isSuccess) {
            setFeedbackMessage(message);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } else {
            setError(message);
            setTimeout(() => setError(''), 3000);
        }
    };
    
    // This effect will automatically calculate and update the time per slot.
    useEffect(() => {
        if (!settings) return;

        const { totalStudents, tables, syncWindowIds, breakfastMinutes } = settings.seatSettings;
        const { orderingWindows } = settings;

        // Calculate total available table capacity
        const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

        // Calculate total duration from synced windows, or fall back to breakfastMinutes
        const syncedWindows = (syncWindowIds || []).map(id => orderingWindows.find(w => w.id === id)).filter((w): w is CanteenTimeSlot => !!w);
        
        let totalDurationMinutes = 0;
        if (syncedWindows.length > 0) {
            totalDurationMinutes = syncedWindows.reduce((sum, window) => {
                const [startH, startM] = window.startTime.split(':').map(Number);
                const [endH, endM] = window.endTime.split(':').map(Number);
                const duration = (endH * 60 + endM) - (startH * 60 + startM);
                return sum + (duration > 0 ? duration : 0);
            }, 0);
        } else {
            totalDurationMinutes = breakfastMinutes;
        }

        let calculatedTime = 0;
        if (totalCapacity > 0 && totalStudents > 0 && totalDurationMinutes > 0) {
            const numberOfBatches = Math.ceil(totalStudents / totalCapacity);
            if (numberOfBatches > 0) {
                calculatedTime = totalDurationMinutes / numberOfBatches;
            }
        }
        
        const newTimePerSlot = Math.round(calculatedTime * 10) / 10;

        // Only update state if the calculated value is different from the one in state to prevent infinite loops
        if (settings.seatSettings.timePerStudentPerSlotMinutes !== newTimePerSlot) {
            setSettings(prev => prev ? ({
                ...prev,
                seatSettings: {
                    ...prev.seatSettings,
                    timePerStudentPerSlotMinutes: newTimePerSlot
                }
            }) : null);
        }
    }, [settings]);

    const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMethod = e.target.value as PaymentMethod;
        if (settings) {
            const updatedSettings = { ...settings, activePaymentMethod: newMethod };
            canteenService.saveCanteenSettings(updatedSettings);
            setSettings(updatedSettings);
            showFeedback('Payment method updated successfully!');
        }
    };

    const handleModalSubmit = () => {
        setError('');
        if (!formData.name) {
            setError("Shop name is required.");
            return;
        }
        try {
            if (modal === 'addShop') {
                canteenService.addShop(school.id, formData.name, formData.description);
            } else if (modal === 'editShop' && formData.id) {
                canteenService.updateShop(formData.id, formData.name, formData.description);
            }
            refreshData();
            setModal(null);
            setFormData({ name: '', description: '' });
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const handleDeleteShop = (shop: CanteenShop) => {
        setConfirmModal({
            title: 'Delete Shop',
            message: `Are you sure you want to delete the shop "${shop.name}"? This will delete all its categories and menu items.`,
            onConfirm: () => {
                canteenService.deleteShop(shop.id);
                refreshData();
                setConfirmModal(null);
            }
        });
    };
    
    const completedOrders = useMemo(() => {
        return allOrders.filter(o => o.status === 'delivered');
    }, [allOrders]);

    const filteredAttendanceOrders = useMemo(() => {
        return completedOrders
            .filter(order => attendanceFilterShopId === 'all' || order.shopId === attendanceFilterShopId)
            .filter(order => 
                attendanceSearchTerm === '' ||
                order.studentName.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                order.studentId.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                order.id.toLowerCase().includes(attendanceSearchTerm.toLowerCase())
            );
    }, [completedOrders, attendanceSearchTerm, attendanceFilterShopId]);

    const renderAttendanceView = () => {
        return (
            <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <input
                        type="text"
                        value={attendanceSearchTerm}
                        onChange={e => setAttendanceSearchTerm(e.target.value)}
                        placeholder="Search by Student, Student ID, or Order ID..."
                        className="w-full sm:flex-grow p-2 bg-gray-700 rounded-md"
                    />
                    <select
                        value={attendanceFilterShopId}
                        onChange={e => setAttendanceFilterShopId(e.target.value)}
                        className="p-2 bg-gray-700 rounded-md"
                    >
                        <option value="all">All Shops</option>
                        {shops.map(shop => (
                            <option key={shop.id} value={shop.id}>{shop.name}</option>
                        ))}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-3 text-left text-xs font-medium text-white uppercase tracking-wider">Order / Student</th>
                                <th className="p-3 text-left text-xs font-medium text-white uppercase tracking-wider">Shop</th>
                                <th className="p-3 text-left text-xs font-medium text-white uppercase tracking-wider">Completed At</th>
                                <th className="p-3 text-left text-xs font-medium text-white uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredAttendanceOrders.length > 0 ? filteredAttendanceOrders.map(order => (
                                <React.Fragment key={order.id}>
                                    <tr className="hover:bg-gray-900/50">
                                        <td className="p-3">
                                            <p className="font-bold text-white">#{order.id.slice(-6)} - {order.studentName}</p>
                                            <p className="text-sm text-gray-400">{order.studentId}</p>
                                            <button onClick={() => setExpandedAttendanceOrderId(prev => prev === order.id ? null : order.id)} className="text-xs text-cyan-400 hover:underline mt-1">
                                                {expandedAttendanceOrderId === order.id ? 'Hide Items' : 'Show Items'}
                                            </button>
                                        </td>
                                        <td className="p-3 text-white">
                                            {shops.find(s => s.id === order.shopId)?.name || 'N/A'}
                                        </td>
                                        <td className="p-3 text-sm text-gray-400">
                                            {new Date(order.timestamp).toLocaleString()}
                                        </td>
                                        <td className="p-3 font-semibold text-white">
                                            UGX {order.totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                    {expandedAttendanceOrderId === order.id && (
                                        <tr className="bg-gray-700/50">
                                            <td colSpan={4} className="p-4 border-t border-gray-700">
                                                <h4 className="font-semibold text-sm mb-2 text-white">Order Items:</h4>
                                                <ul className="space-y-1">
                                                    {order.items.map(item => (
                                                        <li key={item.itemId} className="text-sm flex justify-between text-white">
                                                            <span>{item.quantity} x {item.name}</span>
                                                            <span className="text-gray-300">UGX {(item.quantity * item.price).toLocaleString()}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )) : (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No completed orders found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // --- Handlers for Time Windows ---
    const handleTimeWindowChange = (field: keyof typeof timeWindowForm, value: string) => {
        setTimeWindowForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddTimeWindow = () => {
        if (!timeWindowForm.name || !timeWindowForm.startTime || !timeWindowForm.endTime || !settings) {
            setError("All time window fields are required.");
            return;
        }
        const newWindow: CanteenTimeSlot = {
            id: `slot_${Date.now()}`,
            name: timeWindowForm.name,
            startTime: timeWindowForm.startTime,
            endTime: timeWindowForm.endTime,
        };
        const updatedSettings = { ...settings, orderingWindows: [...settings.orderingWindows, newWindow] };
        canteenService.saveCanteenSettings(updatedSettings);
        setSettings(updatedSettings);
        setTimeWindowForm({ name: '', startTime: '', endTime: '' });
        showFeedback('Ordering window added successfully!');
    };

    const handleDeleteTimeWindow = (id: string) => {
        if (!settings) return;
        const updatedSettings = { ...settings, orderingWindows: settings.orderingWindows.filter(w => w.id !== id) };
        canteenService.saveCanteenSettings(updatedSettings);
        setSettings(updatedSettings);
        showFeedback('Ordering window removed.');
    };

    // --- Handlers for Seating Configuration ---
    const handleSeatSettingsChange = (field: keyof CanteenSettings['seatSettings'], value: any) => {
        if (settings) {
            const newSettings = { ...settings, seatSettings: { ...settings.seatSettings, [field]: value } };
            setSettings(newSettings);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (syncDropdownRef.current && !syncDropdownRef.current.contains(event.target as Node)) {
                setIsSyncDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSyncToggle = (windowId: string) => {
        if (!settings) return;
        const currentIds = settings.seatSettings.syncWindowIds || [];
        const newIds = currentIds.includes(windowId) ? currentIds.filter(id => id !== windowId) : [...currentIds, windowId];
        handleSeatSettingsChange('syncWindowIds', newIds);
    };
    
    useEffect(() => {
        const syncIds = settings?.seatSettings?.syncWindowIds || [];
        if (syncIds.length === 0) {
            setActiveSyncedWindow(null);
            return;
        }
    
        const checkActiveWindow = () => {
            const now = new Date();
            const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
            const availableWindows = settings?.orderingWindows || [];
    
            const activeWindow = availableWindows.find(window => {
                if (!syncIds.includes(window.id)) return false;
                
                const [startH, startM] = window.startTime.split(':').map(Number);
                const startTimeInMinutes = startH * 60 + startM;
                const [endH, endM] = window.endTime.split(':').map(Number);
                const endTimeInMinutes = endH * 60 + endM;
                
                return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
            });
    
            setActiveSyncedWindow(activeWindow || null);
        };
    
        checkActiveWindow();
        const interval = setInterval(checkActiveWindow, 1000 * 30); // Check every 30 seconds
    
        return () => clearInterval(interval);
    }, [settings?.seatSettings?.syncWindowIds, settings?.orderingWindows]);


    const handleSaveSeatSettings = () => {
        if (settings) {
            canteenService.saveCanteenSettings(settings);
            showFeedback("Seating settings saved successfully!");
        }
    };

    const handleTableSubmit = () => {
        if (!settings || !tableForm.label || tableForm.capacity <= 0) return;
        
        let newTables = [...settings.seatSettings.tables];
        if (tableModal === 'add') {
            const newTable: CanteenTable = { id: `table_${Date.now()}`, label: tableForm.label, capacity: tableForm.capacity };
            newTables.push(newTable);
        } else if (tableModal === 'edit' && editingTable) {
            newTables = newTables.map(t => t.id === editingTable.id ? { ...t, label: tableForm.label, capacity: tableForm.capacity } : t);
        }

        handleSeatSettingsChange('tables', newTables);
        setTableModal(null);
    };

    const handleDeleteTable = (tableId: string) => {
        if (settings) {
            const newTables = settings.seatSettings.tables.filter(t => t.id !== tableId);
            handleSeatSettingsChange('tables', newTables);
        }
    };
    
    const isSynced = (settings?.seatSettings?.syncWindowIds?.length || 0) > 0;
    let displayedStartTime = settings?.seatSettings.breakfastStartTime || '00:00';
    let displayedDuration = settings?.seatSettings.breakfastMinutes || 0;

    if (isSynced && activeSyncedWindow) {
        displayedStartTime = activeSyncedWindow.startTime;
        const [startH, startM] = activeSyncedWindow.startTime.split(':').map(Number);
        const [endH, endM] = activeSyncedWindow.endTime.split(':').map(Number);
        const durationInMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        displayedDuration = durationInMinutes > 0 ? durationInMinutes : 0;
    } else if (isSynced && !activeSyncedWindow) {
        displayedStartTime = "--:--";
        displayedDuration = 0;
    }


    if (selectedShop) {
        return <ECanteenAdminPage shop={selectedShop} onBack={() => setSelectedShop(null)} user={user} />;
    }

    const renderModal = () => {
        if (!modal) return null;

        if (modal === 'manageCarriers' && shopForCarrierManagement) {
            const currentCarriers = schoolUsers.filter(u => shopForCarrierManagement.carrierIds?.includes(u.studentId));
            const potentialCarriers = schoolUsers.filter(u => !shopForCarrierManagement.carrierIds?.includes(u.studentId) && (u.role === 'student' || u.role === 'carrier'));

            return (
                 <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl space-y-4 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold">Manage Carriers for {shopForCarrierManagement.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-hidden">
                            <div className="bg-gray-900/50 p-3 rounded-lg flex flex-col">
                                <h4 className="font-semibold mb-2 flex-shrink-0">Assigned Carriers ({currentCarriers.length})</h4>
                                <div className="space-y-2 overflow-y-auto">
                                    {currentCarriers.map(carrier => (
                                        <div key={carrier.studentId} className="flex justify-between items-center p-2 bg-gray-700 rounded-md">
                                            <span>{carrier.name}</span>
                                            <button onClick={() => {unassignCarrierFromShop(carrier.studentId, shopForCarrierManagement.id); refreshData();}} className="px-2 py-1 text-xs bg-red-600 rounded-md">Unassign</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div className="bg-gray-900/50 p-3 rounded-lg flex flex-col">
                                <h4 className="font-semibold mb-2 flex-shrink-0">Available Users ({potentialCarriers.length})</h4>
                                <div className="space-y-2 overflow-y-auto">
                                     {potentialCarriers.map(u => (
                                        <div key={u.studentId} className="flex justify-between items-center p-2 bg-gray-700 rounded-md">
                                            <span>{u.name} <span className="text-xs text-gray-400">({u.role})</span></span>
                                            <button onClick={() => {assignCarrierToShop(u.studentId, shopForCarrierManagement.id); refreshData();}} className="px-2 py-1 text-xs bg-green-600 rounded-md">Assign</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Close</button></div>
                    </div>
                </div>
            )
        }

        if (modal === 'manageSellers' && shopForSellerManagement) {
            const currentSeller = schoolUsers.find(u => u.studentId === shopForSellerManagement.ownerId);
            const eligibleSellers = schoolUsers.filter(u => u.role === 'student' || (u.role === 'canteen_seller' && !u.shopId));

            const handleAssign = () => {
                if (!selectedNewSellerId) return;
                assignSellerToShop(selectedNewSellerId, shopForSellerManagement.id);
                refreshData();
                setModal(null);
            };

            const handleUnassign = () => {
                unassignSellerFromShop(shopForSellerManagement.id);
                refreshData();
                setModal(null);
            };

            return (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold">Manage Seller for {shopForSellerManagement.name}</h3>
                        
                        <div className="bg-gray-700/50 p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">Current Seller</h4>
                            {currentSeller ? (
                                <div className="flex justify-between items-center">
                                    <span>{currentSeller.name}</span>
                                    <button onClick={handleUnassign} className="px-3 py-1 text-xs bg-red-600 rounded-md">Unassign</button>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">No seller assigned.</p>
                            )}
                        </div>

                        <div className="border-t border-gray-600 pt-4">
                             <h4 className="font-semibold mb-2">Assign New Seller</h4>
                             <div className="flex items-center gap-2">
                                 <select 
                                    value={selectedNewSellerId} 
                                    onChange={e => setSelectedNewSellerId(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded-md"
                                >
                                    <option value="">-- Select a User --</option>
                                    {eligibleSellers.map(user => (
                                        <option key={user.studentId} value={user.studentId}>{user.name} ({user.studentId})</option>
                                    ))}
                                </select>
                                <button onClick={handleAssign} disabled={!selectedNewSellerId} className="px-4 py-2 bg-cyan-600 rounded disabled:bg-gray-500">Assign</button>
                             </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Close</button>
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
                    <h3 className="text-xl font-bold">{modal === 'addShop' ? 'Create New Shop' : 'Edit Shop'}</h3>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Shop Name" className="w-full p-2 bg-gray-700 rounded" />
                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Description" rows={3} className="w-full p-2 bg-gray-700 rounded" />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => { setModal(null); setError(''); setFormData({ name: '', description: '' }); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                        <button onClick={handleModalSubmit} className="px-4 py-2 bg-cyan-600 rounded">Save</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full">
            {renderModal()}
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmButtonVariant="danger"
                    confirmText="Delete"
                />
            )}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">E-Canteen Management</h2>
                    <p className="text-gray-400 mt-1">Manage all canteen shops and settings in your school.</p>
                </div>
                {activeTab === 'shops' && (
                    <button onClick={() => setModal('addShop')} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">
                        + Add New Shop
                    </button>
                )}
            </div>
            
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6">
                <button onClick={() => setActiveTab('shops')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'shops' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Shops</button>
                <button onClick={() => setActiveTab('settings')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'settings' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Settings</button>
                <button onClick={() => setActiveTab('attendance')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'attendance' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Attendance</button>
            </div>
            
            {feedbackMessage && <div className="bg-green-500/20 text-green-300 p-3 rounded-md mb-4">{feedbackMessage}</div>}
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}

            {activeTab === 'shops' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shops.map(shop => (
                            <div key={shop.id} className="bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">{shop.name}</h3>
                                    <p className="text-gray-400 text-sm mb-4 min-h-[40px]">{shop.description}</p>
                                    <p className="text-xs text-gray-400">Carriers: {shop.carrierIds?.length || 0}</p>
                                </div>
                                <div className="flex justify-end flex-wrap gap-2 border-t border-gray-700 pt-4 mt-4">
                                     <button onClick={() => { setShopForSellerManagement(shop); setSelectedNewSellerId(''); setModal('manageSellers'); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-xs font-semibold">Seller</button>
                                     <button onClick={() => { setShopForCarrierManagement(shop); setModal('manageCarriers');}} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-md text-xs font-semibold">Carriers</button>
                                     <button onClick={() => { setModal('editShop'); setFormData(shop); }} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-xs font-semibold">Edit</button>
                                    <button onClick={() => handleDeleteShop(shop)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-xs font-semibold">Delete</button>
                                    <button onClick={() => setSelectedShop(shop)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-md text-xs font-semibold">Manage</button>
                                </div>
                            </div>
                        ))}
                    </div>
                     {shops.length === 0 && (
                        <div className="text-center py-16 bg-gray-800 rounded-lg">
                            <p className="text-gray-400">No canteen shops have been created yet.</p>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'settings' && settings && (
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-4xl mx-auto">
                        <h3 className="text-xl font-bold mb-4">General Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-300 mb-1">
                                    Select Payment Method
                                </label>
                                <select
                                    id="paymentMethod"
                                    value={settings.activePaymentMethod}
                                    onChange={handlePaymentMethodChange}
                                    className="w-full max-w-sm p-2 bg-gray-700 rounded-md"
                                >
                                    <option value="e_wallet">E-Wallet (Default App)</option>
                                    <option value="rfid">RFID</option>
                                    <option value="nfc">NFC</option>
                                    <option value="barcode">Barcode</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-2">This setting determines the primary method students will use for payments at the canteen.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg max-w-4xl mx-auto">
                        <h3 className="text-xl font-bold mb-4">Ordering Time Windows</h3>
                        <p className="text-sm text-gray-400 mb-4">Define specific time intervals when the canteen is open for online orders. If no windows are set, the canteen is open all day.</p>
                        <div className="space-y-3 mb-6">
                            {settings.orderingWindows.map(window => (
                                <div key={window.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white">{window.name}</p>
                                        <p className="text-sm text-gray-300">{window.startTime} - {window.endTime}</p>
                                    </div>
                                    <button onClick={() => handleDeleteTimeWindow(window.id)} className="text-red-400 hover:text-red-300">&times;</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 p-3 border-t border-gray-700">
                            <input value={timeWindowForm.name} onChange={e => handleTimeWindowChange('name', e.target.value)} placeholder="Window Name (e.g., Lunch)" className="p-2 bg-gray-700 rounded-md flex-grow"/>
                            <div className="flex gap-2">
                                <input type="time" value={timeWindowForm.startTime} onChange={e => handleTimeWindowChange('startTime', e.target.value)} className="p-2 bg-gray-700 rounded-md"/>
                                <input type="time" value={timeWindowForm.endTime} onChange={e => handleTimeWindowChange('endTime', e.target.value)} className="p-2 bg-gray-700 rounded-md"/>
                            </div>
                            <button onClick={handleAddTimeWindow} className="px-4 py-2 bg-cyan-600 rounded-md font-semibold">Add</button>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg max-w-4xl mx-auto">
                        <h3 className="text-xl font-bold mb-4">Seating Configuration for Local Delivery</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Total Students for Delivery</label>
                                    <input type="number" value={settings.seatSettings.totalStudents} onChange={e => handleSeatSettingsChange('totalStudents', parseInt(e.target.value, 10) || 0)} className="w-full p-2 bg-gray-700 rounded-md" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Time Per Student Slot (Minutes)</label>
                                    <div className="w-full p-2 bg-gray-900/50 rounded-md text-cyan-400 font-bold text-lg">
                                        {settings.seatSettings.timePerStudentPerSlotMinutes.toFixed(1)}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Automatically calculated based on total students, table capacity, and active time windows.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Sync Seating Times with Ordering Windows</label>
                                    <div className="relative" ref={syncDropdownRef}>
                                        <button type="button" onClick={() => setIsSyncDropdownOpen(p => !p)} className="w-full p-2 bg-gray-700 rounded text-left flex justify-between items-center">
                                            <span>{(settings.seatSettings.syncWindowIds?.length || 0)} window(s) selected</span>
                                            <span className={`transform transition-transform ${isSyncDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                                        </button>
                                        {isSyncDropdownOpen && (
                                            <div className="absolute top-full left-0 w-full bg-gray-900/90 border border-gray-700 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto p-2">
                                                {settings.orderingWindows.map(window => (
                                                    <label key={window.id} className="flex items-center gap-2 p-2 hover:bg-gray-700 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={settings.seatSettings.syncWindowIds?.includes(window.id)}
                                                            onChange={() => handleSyncToggle(window.id)}
                                                            className="form-checkbox bg-gray-800 border-gray-500 text-cyan-600"
                                                        />
                                                        {window.name} ({window.startTime} - {window.endTime})
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Period Start Time</label>
                                        <input type="time" value={displayedStartTime} onChange={e => handleSeatSettingsChange('breakfastStartTime', e.target.value)} disabled={isSynced} className="w-full p-2 bg-gray-700 rounded-md disabled:bg-gray-900/50 disabled:cursor-not-allowed disabled:text-gray-400" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Period Duration (Mins)</label>
                                        <input type="number" value={displayedDuration} onChange={e => handleSeatSettingsChange('breakfastMinutes', parseInt(e.target.value, 10) || 0)} disabled={isSynced} className="w-full p-2 bg-gray-700 rounded-md disabled:bg-gray-900/50 disabled:cursor-not-allowed disabled:text-gray-400" />
                                    </div>
                                </div>
                                {isSynced && !activeSyncedWindow && <p className="text-xs text-yellow-400 col-span-2">No synced window is currently active. The system will update automatically when one begins.</p>}

                                <button onClick={handleSaveSeatSettings} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Seating Settings</button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-lg">Manage Tables</h4>
                                    <button onClick={() => { setTableForm({ label: '', capacity: 4 }); setTableModal('add'); }} className="px-3 py-1 bg-cyan-600 text-sm font-semibold rounded-md">+ Add</button>
                                </div>
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {settings.seatSettings.tables.map(table => (
                                        <div key={table.id} className="bg-gray-700 p-2 rounded-md flex justify-between items-center">
                                            <span>Table <strong className="text-white">{table.label}</strong> (Capacity: <strong className="text-white">{table.capacity}</strong>)</span>
                                            <div className="space-x-2">
                                                <button onClick={() => { setEditingTable(table); setTableForm({ label: table.label, capacity: table.capacity }); setTableModal('edit'); }} className="text-xs text-cyan-400">Edit</button>
                                                <button onClick={() => handleDeleteTable(table.id)} className="text-xs text-red-400">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {tableModal && (
                            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                                <div className="bg-gray-900 rounded-lg p-6 w-full max-w-sm space-y-4">
                                    <h3 className="text-xl font-bold">{tableModal === 'add' ? 'Add Table' : 'Edit Table'}</h3>
                                    <div><label className="text-sm">Label</label><input value={tableForm.label} onChange={e => setTableForm({...tableForm, label: e.target.value})} className="w-full p-2 bg-gray-700 rounded mt-1" /></div>
                                    <div><label className="text-sm">Capacity</label><input type="number" value={tableForm.capacity} onChange={e => setTableForm({...tableForm, capacity: parseInt(e.target.value, 10) || 0})} className="w-full p-2 bg-gray-700 rounded mt-1" /></div>
                                    <div className="flex justify-end gap-2"><button onClick={() => setTableModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handleTableSubmit} className="px-4 py-2 bg-cyan-600 rounded">Save</button></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'attendance' && renderAttendanceView()}
        </div>
    );
};

export default ECanteenManagementPage;
