
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, School, CanteenShop, CanteenOrder, CanteenMenuItem } from '../types';
import * as canteenService from '../services/canteenService';
import ProfilePage from './ProfilePage';
import NotificationBell from './NotificationBell';
import UserAvatar from './UserAvatar';
import { APP_TITLE } from '../constants';

// --- ICONS ---
const OrdersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
const HamburgerIcon = () => (<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);

interface ECanteenSellerPageProps {
    user: User;
    school: School;
    onLogout: () => void;
}

const ECanteenSellerPage: React.FC<ECanteenSellerPageProps> = ({ user, school, onLogout }) => {
    const [shop, setShop] = useState<CanteenShop | null>(null);
    const [view, setView] = useState<'orders' | 'menu'>('orders');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (user.shopId) {
            const assignedShop = canteenService.getShops().find(s => s.id === user.shopId);
            setShop(assignedShop || null);
        }
    }, [user.shopId]);

    if (!user.shopId || !shop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
                <h2 className="text-2xl font-bold">Not Assigned to a Shop</h2>
                <p className="text-gray-400 mt-2">Please contact the school administrator to be assigned to a canteen shop.</p>
                <button onClick={onLogout} className="mt-6 px-4 py-2 bg-red-600 rounded-md">Logout</button>
            </div>
        );
    }

    const OrdersView: React.FC<{ shopId: string }> = ({ shopId }) => {
        const [orders, setOrders] = useState<CanteenOrder[]>([]);
        const refreshOrders = useCallback(() => {
            const activeOrders = canteenService.getOrdersForShop(shopId).filter(o => ['pending', 'preparing', 'packaged', 'out_for_delivery'].includes(o.status));
            setOrders(activeOrders);
        }, [shopId]);

        useEffect(() => {
            refreshOrders();
            const interval = setInterval(refreshOrders, 3000);
            return () => clearInterval(interval);
        }, [refreshOrders]);

        const handleUpdateStatus = (orderId: string, status: CanteenOrder['status']) => {
            canteenService.updateOrderStatus(orderId, status);
            refreshOrders();
        };

        const OrderCard: React.FC<{ order: CanteenOrder }> = ({ order }) => {
            const nextActionMap: Partial<Record<CanteenOrder['status'], { label: string; status: CanteenOrder['status'], buttonClass: string }>> = {
                'pending': { label: 'Start Preparing', status: 'preparing', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
                'preparing': { label: 'Mark as Packaged', status: 'packaged', buttonClass: 'bg-indigo-600 hover:bg-indigo-700' },
                'packaged': { label: 'Ready for Delivery/Pickup', status: 'out_for_delivery', buttonClass: 'bg-green-600 hover:bg-green-700' },
            };
            const nextAction = nextActionMap[order.status];

            return (
                <div className="bg-gray-700 p-3 rounded-lg space-y-2 flex flex-col animate-fade-in-up">
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
            const grouped: Record<string, CanteenOrder[]> = { pending: [], preparing: [], packaged: [], out_for_delivery: [] };
            orders.forEach(order => {
                if (grouped[order.status]) grouped[order.status].push(order);
            });
            return grouped;
        }, [orders]);

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-yellow-300 mb-3 text-center flex-shrink-0 border-b border-gray-700 pb-2">Pending ({ordersByStatus.pending.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.pending.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-blue-300 mb-3 text-center flex-shrink-0 border-b border-gray-700 pb-2">Preparing ({ordersByStatus.preparing.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.preparing.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-indigo-300 mb-3 text-center flex-shrink-0 border-b border-gray-700 pb-2">Packaged ({ordersByStatus.packaged.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.packaged.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col"><h4 className="font-bold text-green-300 mb-3 text-center flex-shrink-0">Ready ({ordersByStatus.out_for_delivery.length})</h4><div className="space-y-3 overflow-y-auto">{ordersByStatus.out_for_delivery.map(order => <OrderCard key={order.id} order={order} />)}</div></div>
            </div>
        );
    };

    const MenuManagementView: React.FC<{ shopId: string }> = ({ shopId }) => {
        const [menu, setMenu] = useState<CanteenMenuItem[]>([]);
        const refreshMenu = useCallback(() => setMenu(canteenService.getMenuItemsForShop(shopId)), [shopId]);

        useEffect(() => { refreshMenu(); }, [refreshMenu]);
        
        const handleAvailabilityToggle = (itemId: string, isAvailable: boolean) => {
            canteenService.updateMenuItem(itemId, { isAvailable: !isAvailable });
            refreshMenu();
        };
        
        return (
             <div className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Manage Menu Availability</h3>
                <div className="space-y-3">
                    {menu.map(item => (
                        <div key={item.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-center">
                             <div className="flex items-center space-x-3">
                                <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded object-cover"/>
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-gray-400">UGX {item.price.toLocaleString()}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer" title={item.isAvailable ? 'Mark as Unavailable' : 'Mark as Available'}>
                                <input type="checkbox" checked={item.isAvailable} onChange={() => handleAvailabilityToggle(item.id, item.isAvailable)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-800 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const navItems = [
        { id: 'orders', name: 'Orders', icon: <OrdersIcon /> },
        { id: 'menu', name: 'Menu', icon: <MenuIcon /> },
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

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <aside className="w-64 h-full bg-gray-800 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h1 className="text-xl font-bold text-cyan-400">{APP_TITLE}</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon /></button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setView(item.id as any); setIsMobileMenuOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 transition-colors ${view === item.id ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    <span className="mr-3">{item.icon}</span>
                                    <span className="text-sm font-medium">{item.name}</span>
                                </button>
                            ))}
                        </nav>
                        <footer className="p-4 border-t border-gray-700">
                             <button onClick={onLogout} className="flex items-center space-x-3 text-red-400 hover:text-red-300 w-full px-4 py-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                <span className="font-medium">Logout</span>
                            </button>
                        </footer>
                    </aside>
                </div>
            )}

            <aside className="bg-gray-800 shadow-xl flex-col w-64 hidden md:flex">
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                    <h1 className="text-xl font-bold text-cyan-400 truncate">{APP_TITLE}</h1>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => setView(item.id as any)} className={`w-full flex items-center p-3 transition-colors ${view === item.id ? 'bg-cyan-600' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                            <span className="mr-3">{item.icon}</span>{item.name}
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 shadow-md z-10">
                     <div className="flex items-center">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-gray-400 hover:text-white mr-2"><HamburgerIcon /></button>
                        <h2 className="text-lg font-semibold text-white truncate">{view === 'orders' ? 'Order Dashboard' : 'Menu Management'}</h2>
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationBell userId={currentUser.studentId} />
                        <div className="relative cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-9 h-9 rounded-full border-2 border-gray-600" />
                        </div>
                        <button onClick={() => onLogout()} className="text-gray-400 hover:text-red-400 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-gray-900">
                    <h2 className="text-2xl font-bold text-white mb-2">Shop: {shop.name}</h2>
                    <p className="text-gray-400 mb-6">{shop.description}</p>
                    {view === 'orders' && <OrdersView shopId={shop.id} />}
                    {view === 'menu' && <MenuManagementView shopId={shop.id} />}
                </main>
            </div>
        </div>
    );
};

export default ECanteenSellerPage;
