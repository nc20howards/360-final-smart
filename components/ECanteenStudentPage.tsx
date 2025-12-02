
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { School, User, CanteenShop, CanteenCategory, CanteenMenuItem, CanteenOrder, CanteenSettings, DecodedQrOrder, CanteenTimeSlot, StagedCanteenOrder } from '../types';
import * as canteenService from '../services/canteenService';
import PinStrengthIndicator from './PinStrengthIndicator';
import * as eWalletService from '../services/eWalletService';
import { findUserById } from '../services/groupService';
import * as studentService from '../services/studentService';

// --- ICONS ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>;
const CartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;

// Make TypeScript aware of the globally loaded libraries
declare var JsBarcode: any;
declare var QRCode: any;
declare var ZXingBrowser: any;

/**
 * Extracts a student ID from a new 10-character barcode or an old plain ID.
 * @param barcodeValue The full string from the barcode scanner or input.
 * @param schoolId The ID of the school to search for students in.
 * @returns The extracted student ID, or null if no match is found.
 */
const extractStudentIdFromBarcode = (barcodeValue: string, schoolId: string): string | null => {
    if (!barcodeValue) {
        return null;
    }
    const usersInSchool = studentService.getSchoolUsersBySchoolIds([schoolId]);

    // Handle new 10-char format (e.g., OLS001XYZ1)
    if (barcodeValue.length >= 3) {
        const potentialIdPart = barcodeValue.substring(2);

        // Sort by studentId length, descending, to match longer IDs first (e.g., "S100" before "S10").
        usersInSchool.sort((a, b) => b.studentId.length - a.studentId.length);

        const foundUser = usersInSchool.find(user => potentialIdPart.startsWith(user.studentId));
        if (foundUser) {
            return foundUser.studentId;
        }
    }
    
    // Fallback for old system or if new format parse fails: check if the raw value is a student ID
    const fallbackUser = usersInSchool.find(user => user.studentId.toLowerCase() === barcodeValue.toLowerCase());
    if (fallbackUser) {
        return fallbackUser.studentId;
    }

    return null; // No match found
};


// --- SELLER DASHBOARD ---
export const CanteenSellerDashboard = ({ user, school }: { user: User; school: School }) => {
    // This is a placeholder as the full implementation is in ECanteenAdminPage
    return <div>Seller Dashboard Placeholder</div>;
};


// --- STUDENT PAGE ---
interface ECanteenStudentPageProps {
    school: School;
    user: User;
    onOrderStaged?: (order: StagedCanteenOrder) => void;
    stagedOrder?: StagedCanteenOrder | null;
    onStagedOrderConsumed?: () => void;
}

const ECanteenStudentPage = ({ school, user, onOrderStaged, stagedOrder, onStagedOrderConsumed }: ECanteenStudentPageProps) => {
    const [shops, setShops] = useState<CanteenShop[]>([]);
    const [selectedShop, setSelectedShop] = useState<CanteenShop | null>(null);
    const [categories, setCategories] = useState<CanteenCategory[]>([]);
    const [menu, setMenu] = useState<CanteenMenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<CanteenCategory | null>(null);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [view, setView] = useState<'menu' | 'orders'>('menu');
    const [studentOrders, setStudentOrders] = useState<CanteenOrder[]>([]);
    const [canteenSettings, setCanteenSettings] = useState<CanteenSettings | null>(null);
    const [canteenStatus, setCanteenStatus] = useState<{
        isOpen: boolean;
        closesIn: number | null;
        nextOpening: { opensIn: number; window: CanteenTimeSlot; } | null;
        activeWindow: CanteenTimeSlot | null;
        windowName: string | null;
    } | null>(null);
    
    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');

    // Cancel Order Modal State
    const [orderToCancel, setOrderToCancel] = useState<CanteenOrder | null>(null);

    const refreshStudentOrders = useCallback(() => {
        setStudentOrders(canteenService.getOrdersForStudent(user.studentId));
    }, [user.studentId]);

    useEffect(() => {
        const updateStatus = () => {
            const status = canteenService.getCurrentCanteenStatus(school.id);
            setCanteenStatus(status);
        };

        updateStatus(); // Initial call
        const intervalId = setInterval(updateStatus, 1000); // Update every second

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [school.id]);

    useEffect(() => {
        setShops(canteenService.getShopsForSchool(school.id));
        setCanteenSettings(canteenService.getCanteenSettings(school.id));
        refreshStudentOrders();
    }, [school.id, refreshStudentOrders]);
    
    // Polling for order status updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (view === 'orders') {
                refreshStudentOrders();
            }
        }, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [view, refreshStudentOrders]);

    useEffect(() => {
        if (selectedShop) {
            const shopCategories = canteenService.getCategoriesForShop(selectedShop.id);
            setCategories(shopCategories);
            if (shopCategories.length > 0) {
                setSelectedCategory(shopCategories[0]);
            } else {
                setSelectedCategory(null);
            }
        } else {
            setCategories([]);
            setSelectedCategory(null);
        }
    }, [selectedShop]);

    useEffect(() => {
        if (selectedCategory) {
            setMenu(canteenService.getMenuItemsForCategory(selectedCategory.id));
        } else if (selectedShop) {
            // Show all items if no category is selected
            setMenu(canteenService.getMenuItemsForShop(selectedShop.id));
        } else {
            setMenu([]);
        }
    }, [selectedCategory, selectedShop]);
    
    // Reset cart if shop changes
    useEffect(() => {
        if (!stagedOrder) {
            setCart({});
        }
    }, [selectedShop, stagedOrder]);

    // UseEffect for restoring staged order
    useEffect(() => {
        if (stagedOrder) {
            // Find the shop from the staged order to set context
            const shop = shops.find(s => s.id === stagedOrder.shopId);
            if (shop) {
                setSelectedShop(shop);
                setCart(stagedOrder.cart);
                setDeliveryMethod(stagedOrder.deliveryMethod);
                // We don't set view to 'menu' because we want to show the payment modal.
                // The user context is "finishing up".
                setIsPaymentModalOpen(true); 
                setIsCartOpen(false);
            }
        }
    }, [stagedOrder, shops]);


    const addToCart = (itemId: string) => {
        setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            const quantity = newCart[itemId];
            if (typeof quantity === 'number' && quantity > 1) {
                newCart[itemId] = quantity - 1;
            } else {
                delete newCart[itemId];
            }
            return newCart;
        });
    };
    
    const handlePlaceOrder = () => {
        setPinError('');
        if (!selectedShop) {
            setPinError("No shop selected.");
            return;
        }
        
        const cartItems = Object.keys(cart).map(itemId => ({ itemId, quantity: cart[itemId] }));
        
        // Calculate total for pre-check
        const items = canteenService.getMenuItems();
        const totalAmount = cartItems.reduce((sum, cartItem) => {
            const menuItem = items.find(i => i.id === cartItem.itemId);
            return sum + (menuItem ? menuItem.price * cartItem.quantity : 0);
        }, 0);

        if (eWalletService.getAvailableBalance(user.studentId) < totalAmount) {
             if (onOrderStaged) {
                onOrderStaged({
                    shopId: selectedShop.id,
                    cart: cart,
                    deliveryMethod: deliveryMethod,
                    totalAmount: totalAmount
                });
                // Close modal as we redirect
                setIsPaymentModalOpen(false);
             } else {
                 setPinError("Insufficient funds.");
             }
             return;
        }

        try {
            canteenService.placeOrder(selectedShop.id, user.studentId, cartItems, pin, deliveryMethod);
            
            if (onStagedOrderConsumed) {
                onStagedOrderConsumed();
                canteenService.clearStagedCanteenOrder();
            }

            setPaymentSuccess(true);
            setTimeout(() => {
                setIsPaymentModalOpen(false);
                setPaymentSuccess(false);
                setCart({});
                setPin('');
                setIsCartOpen(false);
                setView('orders');
                refreshStudentOrders();
                setDeliveryMethod('pickup');
            }, 2000);
            
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    const handleConfirmCancelOrder = () => {
        if (!orderToCancel) return;
        try {
            canteenService.cancelStudentOrder(orderToCancel.id, user.studentId);
            refreshStudentOrders();
            setOrderToCancel(null);
        } catch (error) {
            alert((error as Error).message);
            setOrderToCancel(null);
        }
    };
    
    // Helper for rendering cart items logic...
    const getCartItems = () => {
        if (!selectedShop) return [];
        return Object.entries(cart).map(([itemId, quantity]) => {
            const item = canteenService.getMenuItemsForShop(selectedShop.id).find(i => i.id === itemId);
            return item ? { ...item, quantity } : null;
        }).filter((i): i is (CanteenMenuItem & { quantity: number }) => !!i);
    };

    const cartItemsArray = getCartItems();
    const cartTotal = cartItemsArray.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCartItems = cartItemsArray.reduce((sum, item) => sum + item.quantity, 0);


    const formatTime = (ms: number | null): string => {
        if (ms === null || ms < 0) return '00:00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const renderCanteenStatusBanner = () => {
        if (!canteenStatus) return null;

        if (canteenStatus.isOpen) {
            return (
                <div className="bg-green-500/10 border border-green-500/30 text-white p-4 rounded-lg shadow-lg mb-6 text-center animate-fade-in-up">
                    <h3 className="text-lg font-bold text-green-300">
                        Canteen is Open {canteenStatus.windowName && `(${canteenStatus.windowName})`}
                    </h3>
                    {canteenStatus.closesIn !== null && (
                        <p className="text-sm text-green-200 mt-2">
                            Closes in: <span className="font-mono font-bold">{formatTime(canteenStatus.closesIn)}</span>
                        </p>
                    )}
                </div>
            );
        } else {
            return (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-white p-4 rounded-lg shadow-lg mb-6 text-center animate-fade-in-up">
                    <h3 className="text-lg font-bold text-yellow-300">Canteen is Currently Closed</h3>
                    {canteenStatus.nextOpening !== null && (
                         <p className="text-sm text-yellow-200 mt-2">
                            Next opening ({canteenStatus.nextOpening.window.name}) in: <span className="font-mono font-bold">{formatTime(canteenStatus.nextOpening.opensIn)}</span>
                        </p>
                    )}
                </div>
            );
        }
    };

    const getOrderStatusColor = (status: CanteenOrder['status']) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-300';
            case 'preparing': return 'bg-blue-500/20 text-blue-300';
            case 'packaged': return 'bg-indigo-500/20 text-indigo-300';
            case 'out_for_delivery': return 'bg-green-500/20 text-green-300';
            case 'delivered': return 'bg-gray-500/20 text-gray-300';
            case 'cancelled': return 'bg-red-500/20 text-red-300';
            default: return 'bg-gray-600';
        }
    };
    
    if (!selectedShop) {
        return (
            <div>
                 <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Choose a Canteen</h2>
                {renderCanteenStatusBanner()}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shops.map(shop => (
                        <button key={shop.id} onClick={() => setSelectedShop(shop)} className="bg-gray-800 p-6 rounded-lg shadow-xl text-left hover:bg-gray-700 transition-colors">
                            <h3 className="text-xl font-bold text-white mb-2">{shop.name}</h3>
                            <p className="text-gray-400 text-sm">{shop.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            {isCartOpen && (
                <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsCartOpen(false)}></div>
            )}
            <div className={`fixed bottom-0 sm:top-20 sm:bottom-auto inset-x-0 sm:left-auto sm:right-4 bg-gray-800 shadow-2xl z-50 rounded-lg transform transition-all duration-300 ease-in-out ${isCartOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} sm:max-w-md sm:w-full flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[70vh] mx-4 sm:mx-0`}>
                 <div className="p-4 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Your Order</h3>
                    <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-white transition-colors" aria-label="Close cart">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {cartItemsArray.length > 0 ? (
                    <>
                        <div className="flex-grow overflow-y-auto space-y-3 p-4">
                            {cartItemsArray.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-md object-cover"/>
                                    <div className="flex-grow mx-3">
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm text-gray-400">UGX {item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => removeFromCart(item.id)} className="p-1 bg-gray-600 rounded-full"><MinusIcon/></button>
                                        <span className="w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => addToCart(item.id)} className="p-1 bg-gray-600 rounded-full"><PlusIcon/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-700 p-4 mt-auto flex-shrink-0">
                            <div className="flex justify-between font-bold text-xl">
                                <span>Total</span>
                                <span>UGX {cartTotal.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={() => setIsPaymentModalOpen(true)}
                                disabled={!canteenStatus?.isOpen}
                                className="w-full mt-4 py-3 bg-cyan-600 rounded-lg font-semibold hover:bg-cyan-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            >
                                {canteenStatus?.isOpen ? 'Proceed to Payment' : 'Canteen Closed'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-gray-400 text-center">Your cart is empty.</p>
                    </div>
                )}
            </div>
            
            {isPaymentModalOpen && (
                 <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[100] p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4">
                       {paymentSuccess ? (
                           <div className="text-center">
                                <h3 className="text-xl font-bold text-green-400">Payment Authorized!</h3>
                                <p className="text-gray-300 mt-2">Your order has been placed successfully.</p>
                           </div>
                       ) : (
                           <>
                                <h3 className="text-xl font-bold text-center">Confirm Your Order</h3>
                                
                                <div className="space-y-3">
                                    <p className="text-sm text-center text-gray-400">Total: <strong className="text-white">UGX {cartTotal.toLocaleString()}</strong></p>
                                    <div>
                                        <label className="text-sm font-semibold text-gray-300 block mb-2">Delivery Method</label>
                                        <div className="flex gap-2 p-1 bg-gray-700 rounded-lg">
                                            <button onClick={() => setDeliveryMethod('pickup')} className={`w-full py-2 rounded-md text-sm ${deliveryMethod === 'pickup' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Pickup</button>
                                            <button onClick={() => setDeliveryMethod('delivery')} className={`w-full py-2 rounded-md text-sm ${deliveryMethod === 'delivery' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Local Delivery</button>
                                        </div>
                                         {deliveryMethod === 'delivery' && <p className="text-xs text-gray-400 mt-2">A table and time slot will be automatically assigned to you upon payment.</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-300 block text-center">Enter PIN to Authorize</label>
                                    <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-700 rounded-md" />
                                    <PinStrengthIndicator pin={pin} />
                                    {pinError && <p className="text-red-400 text-sm mt-2 text-center">{pinError}</p>}
                                </div>
                                <div className="flex justify-center space-x-2 pt-2">
                                     <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded-md">Cancel</button>
                                     <button onClick={handlePlaceOrder} className="px-4 py-2 bg-cyan-600 rounded-md">Confirm Order</button>
                                </div>
                           </>
                       )}
                    </div>
                </div>
            )}

            {orderToCancel && (
                 <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[100] p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4 text-center">
                         <h3 className="text-xl font-bold">Cancel Order?</h3>
                         <p className="text-sm text-gray-300">Are you sure you want to cancel this order? The held funds of <strong className="text-white">UGX {orderToCancel.totalAmount.toLocaleString()}</strong> will be returned to your available balance.</p>
                         <div className="flex justify-center space-x-2 pt-2">
                             <button onClick={() => setOrderToCancel(null)} className="px-4 py-2 bg-gray-600 rounded-md">Nevermind</button>
                             <button onClick={handleConfirmCancelOrder} className="px-4 py-2 bg-red-600 rounded-md">Yes, Cancel</button>
                        </div>
                    </div>
                 </div>
            )}

            <header className="flex justify-between items-start mb-6">
                <div>
                     <button onClick={() => setSelectedShop(null)} className="text-sm text-cyan-400 hover:underline mb-2">&larr; Back to Shops</button>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">{selectedShop.name}</h2>
                    <p className="text-gray-400 mt-1">{selectedShop.description}</p>
                </div>
                <button onClick={() => setIsCartOpen(true)} className="relative p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                    <CartIcon/>
                    {totalCartItems > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-white">{totalCartItems}</span>}
                </button>
            </header>
            
            {renderCanteenStatusBanner()}

            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6">
                <button onClick={() => setView('menu')} className={`w-full py-2 text-sm font-semibold rounded-md ${view === 'menu' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Menu</button>
                <button onClick={() => setView('orders')} className={`w-full py-2 text-sm font-semibold rounded-md ${view === 'orders' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>My Orders</button>
            </div>

            {view === 'menu' && (
                <>
                    <nav className="flex items-center space-x-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap ${selectedCategory?.id === cat.id ? 'bg-cyan-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                                {cat.name} ({cat.itemCount})
                            </button>
                        ))}
                    </nav>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {menu.map(item => (
                            <div key={item.id} className={`bg-gray-800 rounded-lg shadow-xl flex flex-col ${!item.isAvailable ? 'opacity-50' : ''}`}>
                                <img src={item.imageUrl} alt={item.name} className="w-full h-32 object-cover rounded-t-lg"/>
                                <div className="p-4 flex-grow flex flex-col">
                                    <h4 className="font-bold text-lg flex-grow">{item.name}</h4>
                                    <p className="text-sm text-gray-400 mb-2 min-h-[40px]">{item.description}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="font-bold text-cyan-400">UGX {item.price.toLocaleString()}</span>
                                        <button
                                            onClick={() => addToCart(item.id)}
                                            disabled={!item.isAvailable || !canteenStatus?.isOpen}
                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
                                        >
                                            {cart[item.id] ? `Add More (${cart[item.id]})` : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {view === 'orders' && (
                <div className="space-y-4">
                    {studentOrders.map(order => (
                        <div key={order.id} className="bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">Order #{order.id.slice(-6)}</p>
                                    <p className="text-sm text-gray-400">{new Date(order.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                     <p className="font-bold text-lg text-cyan-400">UGX {order.totalAmount.toLocaleString()}</p>
                                     <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${getOrderStatusColor(order.status)}`}>
                                        {order.status === 'out_for_delivery' ? 'Ready for Pickup' : order.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            <ul className="mt-2 border-t border-gray-700 pt-2 space-y-1">
                                {order.items.map(item => (
                                    <li key={item.itemId} className="text-sm flex justify-between">
                                        <span>{item.quantity} x {item.name}</span>
                                        <span className="text-gray-400">UGX {(item.quantity * item.price).toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                            {order.deliveryMethod === 'delivery' && (order.assignedTable || order.assignedSlotStart) && (
                                <div className="mt-3 p-3 bg-indigo-500/10 rounded-lg text-left border-l-4 border-indigo-400">
                                    <p className="font-semibold text-indigo-300">Your Schedule</p>
                                    <p className="text-sm text-gray-300">Table: <strong className="text-white">{order.assignedTable || 'TBA'}</strong></p>
                                    <p className="text-sm text-gray-300">Time: <strong className="text-white">{order.assignedSlotStart ? `${new Date(order.assignedSlotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(order.assignedSlotEnd!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'TBA'}</strong></p>
                                    {canteenSettings?.seatSettings?.timePerStudentPerSlotMinutes > 0 && (
                                        <p className="text-sm text-gray-300">Slot Duration: <strong className="text-white">{canteenSettings.seatSettings.timePerStudentPerSlotMinutes} minutes</strong></p>
                                    )}
                                </div>
                            )}
                            {order.status === 'out_for_delivery' && canteenSettings?.activePaymentMethod === 'barcode' && (
                                <div className="mt-3 p-3 bg-green-500/10 rounded-lg text-center">
                                    <p className="font-semibold text-green-300">Ready for Pickup!</p>
                                    <p className="text-sm text-gray-300">Please present your Student ID card at the canteen to complete your order.</p>
                                </div>
                            )}
                             {order.status === 'pending' && (
                                <div className="flex justify-end mt-3">
                                    <button 
                                        onClick={() => setOrderToCancel(order)} 
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md text-sm"
                                    >
                                        Cancel Order
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {studentOrders.length === 0 && <p className="text-gray-400 text-center py-8">You haven't placed any orders yet.</p>}
                </div>
            )}
        </div>
    );
};

export default ECanteenStudentPage;
