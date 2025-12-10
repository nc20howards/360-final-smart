
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { School, User, CanteenShop, CanteenCategory, CanteenMenuItem, CanteenOrder, CanteenSettings, DecodedQrOrder, CanteenTimeSlot, StagedCanteenOrder } from '../types';
import * as canteenService from '../services/canteenService';
import PinStrengthIndicator from './PinStrengthIndicator';
import * as eWalletService from '../services/eWalletService';
import { findUserById } from '../services/groupService';
import * as studentService from '../services/studentService';
import UserAvatar from './UserAvatar';

// --- ICONS ---
import { 
    PlusIcon, MinusIcon, CartIcon, StarIcon, FireIcon, HeartIcon, 
    ChevronDownIcon, ClockIconFilled, HomeIcon, SearchIcon, IconLocation,
    IconNavOrders, IconNavHealth
} from './Icons';

// Make TypeScript aware of the globally loaded libraries
declare var JsBarcode: any;
declare var QRCode: any;
declare var ZXingBrowser: any;

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
    const [orders, setOrders] = useState<CanteenOrder[]>([]);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'cart' | 'health' | 'profile'>('home');
    const [viewingItem, setViewingItem] = useState<CanteenMenuItem | null>(null);
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
    
    // Mock Data for Visuals (since backend doesn't have these yet)
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const updateStatus = () => {
            const status = canteenService.getCurrentCanteenStatus(school.id);
            setCanteenStatus(status);
        };
        updateStatus();
        const intervalId = setInterval(updateStatus, 60000); // Check every minute
        return () => clearInterval(intervalId);
    }, [school.id]);

    useEffect(() => {
        setShops(canteenService.getShopsForSchool(school.id));
        setCanteenSettings(canteenService.getCanteenSettings(school.id));
    }, [school.id]);

    useEffect(() => {
        // Auto-select first shop if available and none selected
        if (shops.length > 0 && !selectedShop) {
            setSelectedShop(shops[0]);
        }
    }, [shops, selectedShop]);

    useEffect(() => {
        if (selectedShop) {
            const shopCategories = canteenService.getCategoriesForShop(selectedShop.id);
            setCategories(shopCategories);
            // Don't auto-select category to show "All" or "Specials" first
            setSelectedCategory(null);
            setMenu(canteenService.getMenuItemsForShop(selectedShop.id));
        } else {
            setCategories([]);
            setMenu([]);
        }
    }, [selectedShop]);

    useEffect(() => {
        if (selectedShop) {
            if (selectedCategory) {
                setMenu(canteenService.getMenuItemsForCategory(selectedCategory.id));
            } else {
                setMenu(canteenService.getMenuItemsForShop(selectedShop.id));
            }
        }
    }, [selectedCategory, selectedShop]);

    useEffect(() => {
        if (activeTab === 'orders' || activeTab === 'health') {
             setOrders(canteenService.getOrdersForStudent(user.studentId));
        }
    }, [activeTab, user.studentId]);
    
    // UseEffect for restoring staged order
    useEffect(() => {
        if (stagedOrder) {
            const shop = shops.find(s => s.id === stagedOrder.shopId);
            if (shop) {
                setSelectedShop(shop);
                setCart(stagedOrder.cart);
                setDeliveryMethod(stagedOrder.deliveryMethod);
                setIsPaymentModalOpen(true);
                setActiveTab('cart'); 
            }
        }
    }, [stagedOrder, shops]);


    const addToCart = (itemId: string, qty: number = 1) => {
        setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + qty }));
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
                setActiveTab('orders'); // Go to orders view to see status
                setDeliveryMethod('pickup');
            }, 2000);
            
        } catch (error) {
            setPinError((error as Error).message);
        }
    };
    
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

    const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

    // --- RENDERERS ---

    const renderHeader = () => (
        <div className="flex justify-between items-center mb-6">
            <div className="relative">
                <button 
                    className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                    onClick={() => { /* Toggle Shop Selector Modal/Dropdown if multiple shops */ }}
                >
                    <span className="text-sm font-medium">Location</span>
                    <ChevronDownIcon />
                </button>
                <div className="text-xl font-serif font-bold text-white flex items-center gap-1">
                    {selectedShop ? selectedShop.name : "Select Canteen"}
                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-1"></span>
                </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
                 {/* Placeholder for user profile pic in top right if needed, though bottom nav handles it */}
                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="Profile" className="w-full h-full object-cover" />
            </div>
        </div>
    );

    const renderCategories = () => (
        <div className="flex space-x-3 overflow-x-auto pb-4 no-scrollbar">
            <button 
                onClick={() => setSelectedCategory(null)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === null ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
                All Items
            </button>
            {categories.map(cat => (
                <button 
                    key={cat.id} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategory?.id === cat.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                    {cat.name}
                </button>
            ))}
        </div>
    );

    const renderSpecials = () => {
        // Just mocking "Specials" by taking the first few items for visual effect
        const specials = menu.slice(0, 3);
        if (specials.length === 0) return null;

        return (
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white font-serif">Specials of the week</h3>
                    <span className="text-xs text-orange-400 font-semibold cursor-pointer">See all</span>
                </div>
                <div className="flex space-x-4 overflow-x-auto pb-4 no-scrollbar">
                    {specials.map((item, index) => (
                        <div key={item.id} onClick={() => setViewingItem(item)} className={`min-w-[260px] h-[160px] rounded-[24px] p-5 relative overflow-hidden cursor-pointer transform transition-transform hover:scale-105 ${index % 2 === 0 ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-orange-400 to-pink-500'}`}>
                            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 rounded-full bg-white/20"></div>
                            <div className="relative z-10 w-2/3">
                                <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold text-white mb-2">-20% OFF</span>
                                <h4 className="text-xl font-bold text-white font-serif leading-tight">{item.name}</h4>
                            </div>
                            <img src={item.imageUrl} alt={item.name} className="absolute bottom-[-10px] right-[-10px] w-32 h-32 object-cover rounded-full shadow-2xl rotate-[-10deg]" />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderProductGrid = () => (
        <div>
            <h3 className="text-lg font-bold text-white font-serif mb-4 flex items-center gap-2">
                Best prices <span className="text-green-400 text-xs bg-green-400/20 px-2 py-0.5 rounded-full">%</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 pb-24">
                {menu.map(item => {
                    const quantity = cart[item.id] || 0;
                    return (
                        <div key={item.id} onClick={() => setViewingItem(item)} className="bg-gray-800 p-3 rounded-[24px] cursor-pointer group hover:bg-gray-750 transition-colors relative">
                            <div className="relative aspect-square mb-3 rounded-2xl overflow-hidden bg-gray-700">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                <button className="absolute top-2 right-2 p-1.5 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-orange-500 transition-colors">
                                    <HeartIcon />
                                </button>
                            </div>
                            <h4 className="font-bold text-white text-sm truncate font-serif">{item.name}</h4>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 mb-3">
                                <StarIcon /> <span className="text-white font-bold">4.8</span> (120)
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-lg text-white">
                                    <span className="text-xs align-top text-orange-500">UGX</span>{item.price.toLocaleString()}
                                </span>
                                <div className="relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); addToCart(item.id); }}
                                        className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/40"
                                    >
                                        <PlusIcon />
                                    </button>
                                    {quantity > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-white text-orange-600 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md border border-orange-100 animate-fade-in-up">
                                            {quantity}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
    
    const renderOrdersView = () => (
        <div className="p-6 pb-24 space-y-4 animate-fade-in-up">
            <h2 className="text-2xl font-serif font-bold text-white mb-6">My Orders</h2>
            {orders.length === 0 ? (
                <div className="text-center py-10 bg-gray-800 rounded-3xl">
                    <p className="text-gray-400">You haven't placed any orders yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => {
                        const isDelivery = order.deliveryMethod === 'delivery';
                        const hasSlot = order.assignedSlotStart && order.assignedSlotEnd;
                        const durationMinutes = hasSlot 
                            ? Math.round((order.assignedSlotEnd! - order.assignedSlotStart!) / 60000) 
                            : 0;

                        return (
                            <div key={order.id} className="bg-gray-800 p-4 rounded-[20px] flex flex-col gap-3">
                                 <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-white">Order #{order.id.slice(-6)}</p>
                                        <p className="text-xs text-gray-400">{new Date(order.timestamp).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
                                        order.status === 'delivered' ? 'bg-green-500/20 text-green-300' :
                                        order.status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
                                        'bg-yellow-500/20 text-yellow-300'
                                    }`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="border-t border-gray-700 pt-2">
                                    <ul className="text-sm text-gray-300 space-y-1">
                                        {order.items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span>{item.quantity}x {item.name}</span>
                                                <span>{formatCurrency(item.price * item.quantity)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                {isDelivery && hasSlot && (
                                    <div className="bg-gray-700/50 p-3 rounded-xl mt-2 border border-gray-600/50">
                                        <h4 className="text-xs font-bold text-orange-400 uppercase mb-2">Delivery Details</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p className="text-gray-400 text-xs">Table</p>
                                                <p className="font-semibold text-white">{order.assignedTable || 'Pending'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-xs">Duration</p>
                                                <p className="font-semibold text-white">{durationMinutes} mins</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-gray-400 text-xs">Time Slot</p>
                                                <p className="font-semibold text-white">
                                                    {new Date(order.assignedSlotStart!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(order.assignedSlotEnd!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                                    <span className="text-sm text-gray-400">Total</span>
                                    <span className="font-bold text-lg text-orange-400">{formatCurrency(order.totalAmount)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
    
    const renderHealthView = () => {
        // Mock Health Data based on orders for visualization
        const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        // Assuming ~1000 UGX approx 100 kcal for simple mock math
        const estimatedCalories = Math.floor(totalSpent / 10); 
        
        return (
            <div className="p-6 pb-24 space-y-6 animate-fade-in-up">
                 <h2 className="text-2xl font-serif font-bold text-white mb-2">Health Tracker</h2>
                 <p className="text-gray-400 text-sm mb-6">Monitor your intake and manage allergies.</p>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-5 rounded-[24px] text-white">
                         <p className="text-sm opacity-90 mb-1">Total Calories</p>
                         <h3 className="text-3xl font-bold">{estimatedCalories}</h3>
                         <p className="text-xs opacity-75 mt-2">Estimated from orders</p>
                     </div>
                     <div className="bg-gray-800 p-5 rounded-[24px]">
                          <p className="text-sm text-gray-400 mb-1">Daily Avg</p>
                          <h3 className="text-3xl font-bold text-white">~450</h3>
                          <p className="text-xs text-gray-500 mt-2">kcal / meal</p>
                     </div>
                 </div>

                 <div className="bg-gray-800 p-6 rounded-[24px]">
                     <h3 className="font-bold text-white text-lg mb-4">Dietary Preferences</h3>
                     <div className="space-y-3">
                         <div className="flex items-center justify-between p-3 bg-gray-700 rounded-xl">
                             <div className="flex items-center gap-3">
                                 <span className="text-2xl">🥜</span>
                                 <span className="text-white font-medium">Nut Allergy</span>
                             </div>
                             <div className="w-10 h-6 bg-gray-600 rounded-full relative cursor-pointer">
                                 <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                             </div>
                         </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-xl">
                             <div className="flex items-center gap-3">
                                 <span className="text-2xl">🥛</span>
                                 <span className="text-white font-medium">Lactose Free</span>
                             </div>
                             <div className="w-10 h-6 bg-orange-500 rounded-full relative cursor-pointer">
                                 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="bg-gray-800 p-6 rounded-[24px]">
                      <h3 className="font-bold text-white text-lg mb-4">Nutritional Summary</h3>
                      <div className="space-y-4">
                          <div className="space-y-1">
                              <div className="flex justify-between text-sm text-gray-300"><span>Carbs</span><span>45%</span></div>
                              <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-blue-400 h-2 rounded-full" style={{width: '45%'}}></div></div>
                          </div>
                           <div className="space-y-1">
                              <div className="flex justify-between text-sm text-gray-300"><span>Protein</span><span>30%</span></div>
                              <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-red-400 h-2 rounded-full" style={{width: '30%'}}></div></div>
                          </div>
                           <div className="space-y-1">
                              <div className="flex justify-between text-sm text-gray-300"><span>Fats</span><span>25%</span></div>
                              <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-yellow-400 h-2 rounded-full" style={{width: '25%'}}></div></div>
                          </div>
                      </div>
                 </div>
            </div>
        );
    };

    const renderItemDetails = () => {
        if (!viewingItem) return null;
        
        // Mock data for details view
        const calories = Math.floor(Math.random() * 300) + 100;
        const prepTime = Math.floor(Math.random() * 15) + 5;

        return (
            <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col animate-slide-in-right">
                <div className="relative h-[45vh]">
                    <img src={viewingItem.imageUrl} alt={viewingItem.name} className="w-full h-full object-cover" />
                    <button onClick={() => setViewingItem(null)} className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:text-red-500 transition-colors">
                        <HeartIcon />
                    </button>
                </div>
                
                <div className="flex-1 bg-gray-900 -mt-10 rounded-t-[40px] p-8 relative z-10 flex flex-col">
                    <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-3xl font-serif font-bold text-white leading-tight w-2/3">{viewingItem.name}</h2>
                        <div className="flex items-center gap-1 bg-orange-500/20 px-3 py-1 rounded-full text-orange-400 text-sm font-bold">
                            <FireIcon /> <span>{calories} kcal</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                        <span className="flex items-center gap-1"><StarIcon /> 4.8 (2.1k reviews)</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span className="flex items-center gap-1"><ClockIconFilled /> {prepTime} min</span>
                    </div>

                    <p className="text-gray-400 leading-relaxed mb-8 flex-grow">
                        {viewingItem.description || "A delicious choice prepared fresh daily with the finest ingredients. Perfect for a quick snack or a hearty meal."}
                    </p>

                    <div className="border-t border-gray-800 pt-6">
                         <h4 className="text-white font-bold mb-4">Add to order</h4>
                         <div className="flex gap-4 overflow-x-auto no-scrollbar mb-8">
                             {[1, 2, 3].map(i => (
                                 <div key={i} className="flex-shrink-0 w-20 p-2 rounded-2xl bg-gray-800 border border-gray-700 text-center cursor-pointer hover:border-orange-500 transition-colors">
                                     <div className="w-10 h-10 rounded-full bg-gray-700 mx-auto mb-2"></div>
                                     <p className="text-xs text-gray-300 font-medium">Extra {i}</p>
                                     <p className="text-[10px] text-gray-500">+1k</p>
                                 </div>
                             ))}
                         </div>
                         
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4 bg-gray-800 rounded-full px-4 py-3">
                                 <button onClick={() => removeFromCart(viewingItem.id)} className="text-gray-400 hover:text-white"><MinusIcon /></button>
                                 <span className="text-white font-bold w-4 text-center">{cart[viewingItem.id] || 0}</span>
                                 <button onClick={() => addToCart(viewingItem.id)} className="text-white"><PlusIcon /></button>
                             </div>
                             
                             <button onClick={() => { addToCart(viewingItem.id); setViewingItem(null); }} className="flex-grow ml-4 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-[20px] shadow-lg shadow-orange-500/25 transition-all transform active:scale-95 flex justify-between px-8">
                                 <span>Add to cart</span>
                                 <span>{formatCurrency(viewingItem.price)}</span>
                             </button>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCartView = () => (
        <div className="h-full flex flex-col p-6 animate-fade-in-up">
            <header className="flex justify-between items-center mb-8">
                <button onClick={() => setActiveTab('home')} className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-xl font-bold font-serif text-white">Cart ({totalCartItems})</h2>
                <button onClick={() => setCart({})} className="text-red-400 text-sm font-semibold hover:text-red-300">Clear</button>
            </header>

            <div className="flex-grow overflow-y-auto space-y-4">
                {cartItemsArray.map(item => (
                    <div key={item.id} className="flex items-center gap-4 bg-gray-800 p-3 rounded-[20px]">
                        <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-2xl object-cover" />
                        <div className="flex-grow">
                            <h4 className="text-white font-bold font-serif">{item.name}</h4>
                            <p className="text-sm text-gray-400 mb-2">{item.description.substring(0, 30)}...</p>
                            <p className="text-orange-400 font-bold">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="flex flex-col items-center bg-gray-900 rounded-full py-2 px-1 gap-2">
                             <button onClick={() => addToCart(item.id)} className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-xs hover:bg-gray-200"><PlusIcon /></button>
                             <span className="text-white font-bold text-sm">{item.quantity}</span>
                             <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-full border border-gray-600 text-white flex items-center justify-center text-xs hover:bg-gray-700"><MinusIcon /></button>
                        </div>
                    </div>
                ))}
                {cartItemsArray.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        <CartIcon />
                        <p className="mt-4">Your cart is empty.</p>
                    </div>
                )}
            </div>

            <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-[20px] cursor-pointer hover:bg-gray-750 transition-colors">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                         </div>
                         <span className="text-white font-medium">Promo Code</span>
                    </div>
                    <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">TASTE2025</span>
                </div>

                <div className="border-t border-gray-800 pt-4 space-y-2">
                     <div className="flex justify-between text-gray-400 text-sm">
                         <span>Subtotal</span>
                         <span>{formatCurrency(cartTotal)}</span>
                     </div>
                     <div className="flex justify-between text-gray-400 text-sm">
                         <span>Delivery</span>
                         <span>{formatCurrency(0)}</span>
                     </div>
                     <div className="flex justify-between text-white font-bold text-xl pt-2">
                         <span>Total</span>
                         <span>{formatCurrency(cartTotal)}</span>
                     </div>
                </div>

                <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={cartItemsArray.length === 0 || !canteenStatus?.isOpen}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-[20px] shadow-lg shadow-orange-500/25 transition-all transform active:scale-95 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {canteenStatus?.isOpen ? 'Confirm Order' : 'Canteen Closed'}
                </button>
            </div>
        </div>
    );

    const renderPaymentModal = () => (
         <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-4">
            <div className="bg-gray-900 rounded-[30px] p-8 w-full max-w-sm space-y-6 text-center border border-gray-800">
               {paymentSuccess ? (
                   <div className="py-8">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white">Payment Success!</h3>
                        <p className="text-gray-400 mt-2">Your delicious food is on the way.</p>
                   </div>
               ) : (
                   <>
                        <h3 className="text-2xl font-serif font-bold text-white">Checkout</h3>
                        
                        <div className="bg-gray-800 p-4 rounded-2xl">
                            <p className="text-sm text-gray-400 mb-1">Total Amount</p>
                            <p className="text-3xl font-bold text-white">{formatCurrency(cartTotal)}</p>
                        </div>
                        
                        <div className="flex gap-2 bg-gray-800 p-1.5 rounded-xl">
                            <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${deliveryMethod === 'pickup' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>Pickup</button>
                            <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${deliveryMethod === 'delivery' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>Delivery</button>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="text-sm font-semibold text-gray-300 pl-1">E-Wallet PIN</label>
                            <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} className="w-full p-4 text-2xl tracking-[1rem] text-center bg-gray-800 border border-gray-700 rounded-2xl focus:outline-none focus:border-orange-500 text-white transition-colors" />
                            <PinStrengthIndicator pin={pin} />
                            {pinError && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg">{pinError}</p>}
                        </div>

                        <div className="flex gap-3 pt-2">
                             <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-2xl hover:bg-gray-700 transition-colors">Cancel</button>
                             <button onClick={handlePlaceOrder} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 shadow-lg shadow-orange-500/25 transition-colors">Pay Now</button>
                        </div>
                   </>
               )}
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    
    // If no shop selected (initial state)
    if (!selectedShop) {
        return (
            <div className="p-6">
                 <h2 className="text-3xl font-serif font-bold text-white mb-6">Choose a Canteen</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shops.map(shop => (
                        <button key={shop.id} onClick={() => setSelectedShop(shop)} className="bg-gray-800 p-6 rounded-[30px] shadow-xl text-left hover:bg-gray-700 transition-colors group">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                <IconLocation />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{shop.name}</h3>
                            <p className="text-gray-400 text-sm">{shop.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Main App Shell
    return (
        <div className="h-screen bg-gray-900 text-white font-sans flex flex-col relative overflow-hidden">
            {/* View Content */}
            <main className="flex-grow overflow-y-auto no-scrollbar pb-20 relative">
                {activeTab === 'home' && (
                    <div className="p-6 space-y-6 animate-fade-in-up">
                        {renderHeader()}
                        {renderCategories()}
                        {renderSpecials()}
                        {renderProductGrid()}
                    </div>
                )}
                
                {activeTab === 'orders' && renderOrdersView()}
                {activeTab === 'cart' && renderCartView()}
                {activeTab === 'health' && renderHealthView()}

                {/* Profile Placeholder */}
                {activeTab === 'profile' && (
                    <div className="p-6 text-center pt-20">
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-gray-800" />
                        <h2 className="text-2xl font-serif font-bold">{user.name}</h2>
                        <p className="text-gray-400 mb-8">{user.studentId}</p>
                        <div className="bg-gray-800 rounded-2xl p-4">
                            <p className="text-gray-400 text-sm">Wallet Balance</p>
                            <p className="text-3xl font-bold text-white mt-1">{formatCurrency(eWalletService.getAvailableBalance(user.studentId))}</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-6 left-6 right-6 h-20 bg-gray-800 rounded-[30px] shadow-2xl flex justify-around items-center px-2 z-40 border border-gray-700/50 backdrop-blur-md bg-opacity-95">
                {[
                    { id: 'home', icon: <HomeIcon />, label: 'Home' },
                    { id: 'orders', icon: <IconNavOrders />, label: 'Orders' },
                    { id: 'cart', icon: <CartIcon />, label: 'Cart', badge: totalCartItems },
                    { id: 'health', icon: <IconNavHealth />, label: 'Health' },
                    { id: 'profile', icon: <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-500"><img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}`} alt="Me" /></div>, label: 'Profile' }
                ].map((item) => (
                    <button 
                        key={item.id}
                        onClick={() => { setActiveTab(item.id as any); setViewingItem(null); }}
                        className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-300 relative group`}
                    >
                        <div className={`p-2 rounded-full transition-all ${activeTab === item.id ? 'bg-orange-500 text-white translate-y-[-10px] shadow-lg shadow-orange-500/30' : 'text-gray-400 group-hover:text-white'}`}>
                            {item.icon}
                        </div>
                        {item.badge ? (
                             <span className="absolute top-2 right-1 bg-white text-orange-600 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{item.badge}</span>
                        ) : null}
                         {activeTab === item.id && <span className="text-[9px] font-bold text-white mt-[-5px] animate-fade-in-up">{item.label}</span>}
                    </button>
                ))}
            </div>

            {/* Overlays */}
            {viewingItem && renderItemDetails()}
            {isPaymentModalOpen && renderPaymentModal()}
        </div>
    );
};

export default ECanteenStudentPage;