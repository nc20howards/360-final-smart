


import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CanteenShop, CanteenCategory, CanteenMenuItem, AdminUser, CanteenOrder } from '../types';
import * as canteenService from '../services/canteenService';
import * as apiService from '../services/apiService';
import { findUserById } from '../services/groupService';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;

declare var JsBarcode: any;
declare var QRCode: any;

interface ECanteenAdminPageProps {
    shop: CanteenShop;
    onBack: () => void;
    user: AdminUser;
}

const ECanteenAdminPage: React.FC<ECanteenAdminPageProps> = ({ shop, onBack, user }) => {
    const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'pos'>('menu');
    
    // State for Menu Management
    const [categories, setCategories] = useState<CanteenCategory[]>([]);
    const [menuItems, setMenuItems] = useState<CanteenMenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<CanteenCategory | null>(null);
    const [modal, setModal] = useState<'addCategory' | 'editCategory' | 'addMenuItem' | 'editMenuItem' | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [formError, setFormError] = useState('');
    
    // State for Orders
    const [orders, setOrders] = useState<CanteenOrder[]>([]);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // State for POS
    const [scannedStudentId, setScannedStudentId] = useState('');
    const [verifiedOrder, setVerifiedOrder] = useState<CanteenOrder | null>(null);
    const [posError, setPosError] = useState('');
    const [posSuccess, setPosSuccess] = useState('');
    const posInputRef = useRef<HTMLInputElement>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const desktopVideoRef = useRef<HTMLVideoElement>(null);
    const [isDesktopCameraModalOpen, setIsDesktopCameraModalOpen] = useState(false);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

    const refreshData = useCallback(() => {
        setCategories(canteenService.getCategoriesForShop(shop.id));
        setMenuItems(canteenService.getMenuItemsForShop(shop.id));
        setOrders(canteenService.getOrdersForShop(shop.id));
    }, [shop.id]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0]);
        } else if (categories.length === 0) {
            setSelectedCategory(null);
        }
    }, [categories, selectedCategory]);
    
    useEffect(() => {
        if (activeTab === 'pos' && posInputRef.current) {
            posInputRef.current.focus();
        }
    }, [activeTab]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const initializeCamera = async () => {
            if (desktopVideoRef.current?.srcObject) {
                (desktopVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
            if (isDesktopCameraModalOpen && videoDevices.length === 0) {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevs = devices.filter(d => d.kind === 'videoinput');
                    if (videoDevs.length === 0) {
                        setPosError("No camera found.");
                        setIsDesktopCameraModalOpen(false);
                        return;
                    }
                    setVideoDevices(videoDevs);
                    return;
                } catch (err) {
                    setPosError("Could not list cameras. Please grant permissions.");
                    setIsDesktopCameraModalOpen(false);
                    return;
                }
            }
            if (!isDesktopCameraModalOpen) {
                if (desktopVideoRef.current?.srcObject) {
                    (desktopVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                }
                setVideoDevices([]);
                setSelectedDeviceIndex(0);
                return;
            }
            if (videoDevices.length > 0) {
                const deviceId = videoDevices[selectedDeviceIndex]?.deviceId;
                if (!deviceId) return;
                const constraints = { video: { deviceId: { exact: deviceId } } };
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (desktopVideoRef.current) {
                        desktopVideoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error starting camera stream:", err);
                    setPosError("Could not access the selected camera. Maybe it's in use?");
                    if(videoDevices.length > 1) {
                        setSelectedDeviceIndex(prev => (prev + 1) % videoDevices.length);
                    } else {
                        setIsDesktopCameraModalOpen(false);
                    }
                }
            }
        };
        initializeCamera();
        return () => { stream?.getTracks().forEach(track => track.stop()); };
    }, [isDesktopCameraModalOpen, videoDevices, selectedDeviceIndex]);

    const itemsForSelectedCategory = selectedCategory
        ? menuItems.filter(item => item.categoryId === selectedCategory.id)
        : [];
    
    const resetPos = () => {
        setPosError('');
        setPosSuccess('');
        setVerifiedOrder(null);
        setScannedStudentId('');
        setCapturedImage(null);
    };

    const handleFindOrder = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        resetPos();
        const studentId = scannedStudentId.trim();
        if (!studentId) {
            setPosError("Please enter a Student ID.");
            return;
        }
        const order = canteenService.findReadyOrderForStudent(studentId, shop.id);
        if (!order) {
            const student = findUserById(studentId);
            const studentName = student ? student.name : `ID ${studentId}`;
            setPosError(`No order is ready for pickup for ${studentName}.`);
            return;
        }
        setVerifiedOrder(order);
    };

    const handleModalSubmit = () => {
        setFormError('');
        try {
            switch (modal) {
                case 'addCategory':
                    canteenService.addCategory(shop.id, formData.name);
                    break;
                case 'editCategory':
                    canteenService.updateCategory(formData.id, formData.name);
                    break;
                case 'addMenuItem':
                    canteenService.addMenuItem({
                        shopId: shop.id,
                        categoryId: selectedCategory!.id,
                        name: formData.name,
                        description: formData.description,
                        price: Number(formData.price),
                        imageUrl: formData.imageUrl || `https://picsum.photos/seed/${formData.name}/200`,
                        isAvailable: formData.isAvailable ?? true,
                    });
                    break;
                case 'editMenuItem':
                    canteenService.updateMenuItem(formData.id, {
                        name: formData.name,
                        description: formData.description,
                        price: Number(formData.price),
                        imageUrl: formData.imageUrl,
                        isAvailable: formData.isAvailable,
                    });
                    break;
            }
            refreshData();
            setModal(null);
            setFormData({});
        } catch (e) {
            setFormError((e as Error).message);
        }
    };

    const handleDeleteCategory = (categoryId: string) => {
        if (window.confirm("Are you sure? This will also delete all menu items in this category.")) {
            canteenService.deleteCategory(categoryId);
            setSelectedCategory(null);
            refreshData();
        }
    };

    const handleDeleteMenuItem = (itemId: string) => {
        if (window.confirm("Are you sure you want to delete this menu item?")) {
            canteenService.deleteMenuItem(itemId);
            refreshData();
        }
    };
    
    const handleAvailabilityToggle = (itemId: string, isAvailable: boolean) => {
        canteenService.updateMenuItem(itemId, { isAvailable: !isAvailable });
        refreshData();
    };

    const handleStatusUpdate = (orderId: string, status: CanteenOrder['status']) => {
        canteenService.updateOrderStatus(orderId, status);
        refreshData();
    };
    
    const handleCompleteScannedOrder = async () => {
        if (!verifiedOrder) {
            setPosError("No order data to process.");
            return;
        }
        resetPos();
        try {
            if (!shop.ownerId) {
                setPosError("This shop has no assigned seller. Cannot complete order.");
                return;
            }
            await canteenService.completeScannedOrder(verifiedOrder.id, shop.ownerId);
            setPosSuccess(`Payment of UGX ${verifiedOrder.totalAmount.toLocaleString()} from ${verifiedOrder.studentName} successful!`);
            refreshData();
        } catch (error) {
            setPosError((error as Error).message);
        }
    };

    const handleToggleDetails = (orderId: string) => {
        setExpandedOrderId(prevId => prevId === orderId ? null : orderId);
    };
    
    useEffect(() => {
        if (scannedStudentId) handleFindOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scannedStudentId]);
    
    const processCapturedImage = async (dataUrl: string) => {
        const base64Image = dataUrl.split(',')[1];
        try {
            const decodedContent = await apiService.decodeBarcodeWithGoogle(base64Image, 'image/jpeg');
            if (decodedContent) {
                setScannedStudentId(decodedContent);
            } else {
                setPosError("No scannable code found in the captured image.");
            }
        } catch (error) {
             if (!(error instanceof Error && error.message.includes("No scannable code"))) {
                setPosError("Failed to process image. Please try again.");
            } else {
                 setPosError("No scannable code found in the captured image.");
            }
        } finally {
            setIsProcessingImage(false);
        }
    };
    
    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            resetPos();
            setIsProcessingImage(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setCapturedImage(dataUrl);
                processCapturedImage(dataUrl);
            };
            reader.readAsDataURL(file);
        }
        if (e.target) e.target.value = '';
    };
    
    const handleSnapDesktopPhoto = () => {
        if (desktopVideoRef.current) {
            resetPos();
            setIsProcessingImage(true);
            const canvas = document.createElement('canvas');
            canvas.width = desktopVideoRef.current.videoWidth;
            canvas.height = desktopVideoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(desktopVideoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
                processCapturedImage(dataUrl);
            }
            setIsDesktopCameraModalOpen(false);
        }
    };

    const handleScanButtonClick = () => {
        const isMobile = /Mobi/i.test(navigator.userAgent);
        resetPos();
        if (isMobile) {
            fileInputRef.current?.click();
        } else {
            setIsDesktopCameraModalOpen(true);
        }
    };
    
    const handleSwitchCamera = () => {
        if (videoDevices.length > 1) {
            setSelectedDeviceIndex(prevIndex => (prevIndex + 1) % videoDevices.length);
        }
    };

    const renderModal = () => {
        if (!modal) return null;
        const title = {
            addCategory: 'Add New Category',
            editCategory: 'Edit Category',
            addMenuItem: 'Add New Menu Item',
            editMenuItem: 'Edit Menu Item',
        }[modal];

        return (
            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
                    <h3 className="text-xl font-bold">{title}</h3>
                    {formError && <p className="text-red-400 text-sm">{formError}</p>}
                    {(modal === 'addCategory' || modal === 'editCategory') && (
                        <input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Category Name" className="w-full p-2 bg-gray-700 rounded" />
                    )}
                    {(modal === 'addMenuItem' || modal === 'editMenuItem') && (
                        <>
                            <input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Item Name" className="w-full p-2 bg-gray-700 rounded" />
                            <textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Description" rows={2} className="w-full p-2 bg-gray-700 rounded" />
                            <input type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="Price (UGX)" className="w-full p-2 bg-gray-700 rounded" />
                            <input value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="Image URL" className="w-full p-2 bg-gray-700 rounded" />
                             <label className="flex items-center space-x-2 text-white">
                                <input type="checkbox" checked={formData.isAvailable ?? true} onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"/>
                                <span>Is Available</span>
                            </label>
                        </>
                    )}
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => { setModal(null); setFormError(''); setFormData({}); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                        <button onClick={handleModalSubmit} className="px-4 py-2 bg-cyan-600 rounded">Save</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAttendanceTab = () => {
        return (
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl mx-auto space-y-4">
                <h3 className="text-xl font-bold">Canteen Attendance Sign-In</h3>
                <p className="text-sm text-gray-400">This feature is managed by the Carrier role.</p>
            </div>
        );
    };

    return (
        <div>
            {renderModal()}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageCapture} className="hidden" />
            {isDesktopCameraModalOpen && (
                 <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl space-y-4">
                        <h3 className="text-xl font-bold">Scan Student ID</h3>
                        <div className="relative">
                            <video ref={desktopVideoRef} autoPlay playsInline className="w-full rounded-lg bg-gray-900"></video>
                            {videoDevices.length > 1 && (
                                <button onClick={handleSwitchCamera} className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/75" title="Switch Camera">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.695v4.992h-4.992" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="flex justify-center space-x-4">
                            <button onClick={() => setIsDesktopCameraModalOpen(false)} className="px-6 py-2 bg-gray-600 rounded-md">Cancel</button>
                            <button onClick={handleSnapDesktopPhoto} className="px-6 py-2 bg-cyan-600 rounded-md font-semibold">Snap Photo</button>
                        </div>
                    </div>
                </div>
            )}
            <header className="flex justify-between items-start mb-6">
                <div>
                    <button onClick={onBack} className="text-sm text-cyan-400 hover:underline mb-2">&larr; Back to Shops</button>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Manage: {shop.name}</h2>
                </div>
            </header>
            
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6">
                <button onClick={() => setActiveTab('menu')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'menu' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Menu</button>
                <button onClick={() => setActiveTab('orders')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'orders' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Orders</button>
                <button onClick={() => setActiveTab('pos')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'pos' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>POS</button>
            </div>

            {activeTab === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Categories</h3><button onClick={() => { setFormData({}); setModal('addCategory'); }} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md"><PlusIcon /></button></div>
                        <div className="space-y-2">
                            {categories.map(cat => (
                                <div key={cat.id} onClick={() => setSelectedCategory(cat)} className={`p-3 rounded-md cursor-pointer ${selectedCategory?.id === cat.id ? 'bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    <div className="flex justify-between items-center"><span className="font-semibold">{cat.name}</span><div className="flex items-center space-x-2"><button onClick={(e) => { e.stopPropagation(); setFormData(cat); setModal('editCategory'); }} className="text-gray-400 hover:text-white"><EditIcon /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="text-gray-400 hover:text-white"><DeleteIcon /></button></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-gray-800 p-4 rounded-lg">
                        {selectedCategory ? (
                            <>
                                <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Menu for: {selectedCategory.name}</h3><button onClick={() => { setFormData({}); setModal('addMenuItem'); }} className="flex items-center space-x-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-sm font-semibold rounded-md"><PlusIcon /><span>Add Item</span></button></div>
                                <div className="space-y-2">
                                    {itemsForSelectedCategory.map(item => (
                                        <div key={item.id} className="bg-gray-700 p-3 rounded-md flex items-center justify-between"><div className="flex items-center space-x-3"><img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded object-cover"/><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-400">UGX {item.price.toLocaleString()}</p></div></div><div className="flex items-center space-x-3"><label className="relative inline-flex items-center cursor-pointer" title={item.isAvailable ? 'Mark as Unavailable' : 'Mark as Available'}><input type="checkbox" checked={item.isAvailable} onChange={() => handleAvailabilityToggle(item.id, item.isAvailable)} className="sr-only peer" /><div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div></label><button onClick={() => { setFormData(item); setModal('editMenuItem'); }} className="text-gray-400 hover:text-white"><EditIcon /></button><button onClick={() => handleDeleteMenuItem(item.id)} className="text-gray-400 hover:text-white"><DeleteIcon /></button></div></div>
                                    ))}
                                    {itemsForSelectedCategory.length === 0 && <p className="text-gray-400 text-center py-4">No items in this category.</p>}
                                </div>
                            </>
                        ) : (<div className="flex items-center justify-center h-full text-gray-400"><p>Select or create a category.</p></div>)}
                    </div>
                </div>
            )}
            {activeTab === 'orders' && (
                 <div className="space-y-4">
                    {orders.map(order => {
                        const isExpanded = expandedOrderId === order.id;
                        return (
                            <div key={order.id} className="bg-gray-800 p-4 rounded-lg transition-all duration-300">
                                <div className="flex justify-between items-start cursor-pointer" onClick={() => handleToggleDetails(order.id)}>
                                    <div><p className="font-bold">Order #{order.id.slice(-6)}</p><p className="text-sm text-gray-400">From: {order.studentName}</p><p className="text-sm text-gray-400">At: {new Date(order.timestamp).toLocaleString()}</p></div>
                                    <div className="text-right flex flex-col items-end"><p className="font-bold text-lg text-cyan-400">UGX {order.totalAmount.toLocaleString()}</p><div className="flex items-center gap-2"><span className={`mt-1 px-3 py-1 text-xs font-semibold rounded-full capitalize ${order.deliveryMethod === 'delivery' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-500/20 text-gray-300'}`}>{order.deliveryMethod}</span><span className={`mt-1 px-3 py-1 text-xs font-semibold rounded-full capitalize ${order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : order.status === 'preparing' ? 'bg-blue-500/20 text-blue-300' : order.status === 'out_for_delivery' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{order.status.replace('_', ' ')}</span></div></div>
                                </div>
                                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] mt-4 pt-4 border-t border-gray-700' : 'max-h-0'}`}>
                                    <h4 className="font-semibold text-sm mb-2 text-gray-300">Order Items:</h4><ul className="space-y-1">{order.items.map(item => (<li key={item.itemId} className="text-sm flex justify-between"><span>{item.quantity} x {item.name}</span><span className="text-gray-400">UGX {(item.quantity * item.price).toLocaleString()}</span></li>))}</ul>{isExpanded && (<div className="mt-2 border-t border-gray-700 pt-2"><h4 className="font-semibold text-sm mb-1 text-gray-300">Delivery Information:</h4>{order.deliveryMethod === 'delivery' ? (<p className="text-sm text-gray-200">{(order as any).deliveryDetails || 'No details provided.'}</p>) : (<p className="text-sm text-gray-400">Customer will pick up from the canteen.</p>)}</div>)}<div className="flex justify-end space-x-2 mt-4">{order.status === 'pending' && <button onClick={() => handleStatusUpdate(order.id, 'preparing')} className="px-3 py-1 bg-blue-600 rounded text-sm">Start Preparing</button>}{order.status === 'preparing' && <button onClick={() => handleStatusUpdate(order.id, 'out_for_delivery')} className="px-3 py-1 bg-green-600 rounded text-sm">Mark as Ready</button>}</div>
                                </div>
                            </div>
                        )
                    })}
                    {orders.length === 0 && <p className="text-gray-400 text-center py-4">No incoming orders right now.</p>}
                </div>
            )}
            {activeTab === 'pos' && (
                 <div className="bg-gray-800 p-6 rounded-lg max-w-2xl mx-auto space-y-4">
                    <h3 className="text-xl font-bold">Point of Sale</h3><p className="text-sm text-gray-400">Manually enter a Student ID or use your device camera to scan the barcode from the student's ID card.</p>
                    <form onSubmit={handleFindOrder} className="flex items-center gap-2"><input ref={posInputRef} type="text" value={scannedStudentId} onChange={e => { resetPos(); setScannedStudentId(e.target.value); }} placeholder="Enter Student ID..." autoFocus className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" /><button type="button" onClick={handleScanButtonClick} className="p-2.5 bg-gray-600 hover:bg-gray-500 rounded-md" title="Scan with Camera"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm1 2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V4zm10 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V4zm-5 4a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V8zm-5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V8zm10 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V8zm-5 4a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2zm-5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2z" clipRule="evenodd" /></svg></button><button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 font-semibold rounded-md">Find</button></form>
                    <div className="bg-gray-700 p-4 rounded-lg min-h-[200px]"><h4 className="font-bold mb-2">Order Verification</h4>{isProcessingImage ? (<div className="flex flex-col items-center justify-center">{capturedImage && <img src={capturedImage} alt="Captured barcode" className="max-h-32 rounded-lg mb-2"/>}<p className="text-cyan-400">Processing image with AI...</p></div>) : (<>{posError && <p className="text-red-400 text-sm">{posError}</p>}{posSuccess && <p className="text-green-400 text-sm">{posSuccess}</p>}{verifiedOrder && (<div className="space-y-3"><div><p className="text-xs text-gray-400">Student</p><p className="font-semibold">{verifiedOrder.studentName} ({verifiedOrder.studentId})</p></div><div><p className="text-xs text-gray-400">Items ({verifiedOrder.items.length})</p><ul className="text-sm list-disc list-inside">{verifiedOrder.items.map(item => (<li key={item.itemId}>{item.quantity} x {item.name}</li>))}</ul></div><div className="border-t border-gray-600 pt-2"><p className="text-xs text-gray-400">Total Amount</p><p className="font-bold text-xl text-cyan-400">UGX {verifiedOrder.totalAmount.toLocaleString()}</p></div><button onClick={handleCompleteScannedOrder} className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold">Complete Order</button></div>)}{!verifiedOrder && !posError && !posSuccess && (<p className="text-gray-400 text-sm">Waiting for a valid Student ID...</p>)}</>)}</div>
                </div>
            )}
            {activeTab === 'attendance' && renderAttendanceTab()}
        </div>
    );
};

export default ECanteenAdminPage;
