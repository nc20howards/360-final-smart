
// services/canteenService.ts

import { CanteenShop, CanteenCategory, CanteenMenuItem, CanteenOrder, User, CanteenSettings, PaymentMethod, EWalletTransaction, DeliveryNotification, CanteenTimeSlot, StagedCanteenOrder } from '../types';
import * as eWalletService from './eWalletService';
import { findUserById } from './groupService';
import { createReceipt } from './receiptService';
import * as pushNotificationService from './pushNotificationService';
import { createBroadcastNotification } from './notificationService';
import { logAction } from './auditLogService';

const SHOPS_KEY = '360_smart_school_canteen_shops';
const CATEGORIES_KEY = '360_smart_school_canteen_categories';
const MENU_ITEMS_KEY = '360_smart_school_canteen_menu_items';
const ORDERS_KEY = '360_smart_school_canteen_orders';
const CANTEEN_SETTINGS_KEY = '360_smart_school_canteen_settings';
const DELIVERY_NOTIFICATIONS_KEY = '360_smart_school_delivery_notifications';
const STAGED_CANTEEN_ORDER_KEY = '360_smart_school_staged_canteen_order';


// --- Helper Functions ---
export const getShops = (): CanteenShop[] => JSON.parse(localStorage.getItem(SHOPS_KEY) || '[]');
export const saveShops = (shops: CanteenShop[]) => localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
export const getCategories = (): CanteenCategory[] => JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]');
export const saveCategories = (categories: CanteenCategory[]) => localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
export const getMenuItems = (): CanteenMenuItem[] => JSON.parse(localStorage.getItem(MENU_ITEMS_KEY) || '[]');
export const saveMenuItems = (items: CanteenMenuItem[]) => localStorage.setItem(MENU_ITEMS_KEY, JSON.stringify(items));
export const getOrders = (): CanteenOrder[] => JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
export const saveOrders = (orders: CanteenOrder[]) => localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

// New helpers for settings
const getSettings = (): Record<string, CanteenSettings> => JSON.parse(localStorage.getItem(CANTEEN_SETTINGS_KEY) || '{}');
const saveSettings = (settings: Record<string, CanteenSettings>) => localStorage.setItem(CANTEEN_SETTINGS_KEY, JSON.stringify(settings));

// Helpers for delivery notifications.
const getDeliveryNotifications = (): DeliveryNotification[] => JSON.parse(localStorage.getItem(DELIVERY_NOTIFICATIONS_KEY) || '[]');
const saveDeliveryNotifications = (notifications: DeliveryNotification[]) => localStorage.setItem(DELIVERY_NOTIFICATIONS_KEY, JSON.stringify(notifications));

// FIX: Implement missing functions for delivery notifications
export const getDeliveryNotificationsForShop = (shopId: string): DeliveryNotification[] => {
    return getDeliveryNotifications().filter(n => n.shopId === shopId).sort((a, b) => a.timestamp - b.timestamp);
};

export const updateNotificationStatus = (notificationId: string, status: 'pending' | 'served'): void => {
    const notifications = getDeliveryNotifications();
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
        notifications[index].status = status;
        saveDeliveryNotifications(notifications);
    }
};

export const clearServedNotification = (notificationId: string): void => {
    const notifications = getDeliveryNotifications().filter(n => n.id !== notificationId);
    saveDeliveryNotifications(notifications);
};

// FIX: Implement missing functions for staged orders
export const stageCanteenOrder = (orderData: StagedCanteenOrder): void => {
    localStorage.setItem(STAGED_CANTEEN_ORDER_KEY, JSON.stringify(orderData));
};

export const getStagedCanteenOrder = (): StagedCanteenOrder | null => {
    const data = localStorage.getItem(STAGED_CANTEEN_ORDER_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedCanteenOrder = (): void => {
    localStorage.removeItem(STAGED_CANTEEN_ORDER_KEY);
};


export const getShopsForSchool = (schoolId: string): CanteenShop[] => {
    return getShops().filter(s => s.schoolId === schoolId);
};

export const addShop = (schoolId: string, name: string, description: string): CanteenShop => {
    const shops = getShops();
    const newShop: CanteenShop = {
        id: `shop_${Date.now()}`,
        schoolId,
        name,
        description,
        carrierIds: [],
    };
    shops.push(newShop);
    saveShops(shops);
    return newShop;
};

export const updateShop = (shopId: string, name: string, description: string): CanteenShop => {
    const shops = getShops();
    const shopIndex = shops.findIndex(s => s.id === shopId);
    if (shopIndex === -1) throw new Error("Shop not found.");
    shops[shopIndex] = { ...shops[shopIndex], name, description };
    saveShops(shops);
    return shops[shopIndex];
};

export const deleteShop = (shopId: string): void => {
    let shops = getShops();
    shops = shops.filter(s => s.id !== shopId);
    saveShops(shops);

    // Also delete categories and menu items associated with this shop
    let categories = getCategories();
    categories = categories.filter(c => c.shopId !== shopId);
    saveCategories(categories);

    let menuItems = getMenuItems();
    menuItems = menuItems.filter(i => i.shopId !== shopId);
    saveMenuItems(menuItems);
};

export const getCategoriesForShop = (shopId: string): CanteenCategory[] => {
    return getCategories().filter(c => c.shopId === shopId);
};

export const addCategory = (shopId: string, name: string): CanteenCategory => {
    const categories = getCategories();
    const newCategory: CanteenCategory = {
        id: `cat_${Date.now()}`,
        shopId,
        name,
        itemCount: 0, // Will be updated when items are added
    };
    categories.push(newCategory);
    saveCategories(categories);
    return newCategory;
};

export const updateCategory = (categoryId: string, name: string): void => {
    const categories = getCategories();
    const index = categories.findIndex(c => c.id === categoryId);
    if (index > -1) {
        categories[index].name = name;
        saveCategories(categories);
    }
};

export const deleteCategory = (categoryId: string): void => {
    let categories = getCategories();
    categories = categories.filter(c => c.id !== categoryId);
    saveCategories(categories);
    // Also delete menu items in this category
    let menuItems = getMenuItems();
    menuItems = menuItems.filter(i => i.categoryId !== categoryId);
    saveMenuItems(menuItems);
};

export const getMenuItemsForShop = (shopId: string): CanteenMenuItem[] => {
    return getMenuItems().filter(i => i.shopId === shopId);
};

export const getMenuItemsForCategory = (categoryId: string): CanteenMenuItem[] => {
    return getMenuItems().filter(i => i.categoryId === categoryId);
};


export const addMenuItem = (data: Omit<CanteenMenuItem, 'id'>): CanteenMenuItem => {
    const items = getMenuItems();
    const newMenuItem: CanteenMenuItem = {
        ...data,
        id: `item_${Date.now()}`,
    };
    items.push(newMenuItem);
    saveMenuItems(items);
    return newMenuItem;
};

export const updateMenuItem = (itemId: string, data: Partial<Omit<CanteenMenuItem, 'id' | 'shopId' | 'categoryId'>>): void => {
    const items = getMenuItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index > -1) {
        items[index] = { ...items[index], ...data };
        saveMenuItems(items);
    }
};

export const deleteMenuItem = (itemId: string): void => {
    let items = getMenuItems();
    items = items.filter(i => i.id !== itemId);
    saveMenuItems(items);
};

// --- Canteen Settings Management ---
export const getCanteenSettings = (schoolId: string): CanteenSettings => {
    const allSettings = getSettings();
    const savedSchoolSettings = allSettings[schoolId];

    const defaultSettings: CanteenSettings = {
        schoolId,
        activePaymentMethod: 'e_wallet',
        seatSettings: {
            totalStudents: 0,
            breakfastMinutes: 30, // Default if no windows/sync.
            breakfastStartTime: "07:00", // Default if no windows/sync.
            tables: [],
            syncWindowIds: [],
            timePerStudentPerSlotMinutes: 15, // NEW DEFAULT
        },
        orderingWindows: [],
    };

    if (savedSchoolSettings) {
        // Merge to ensure new properties are added if they don't exist in storage
        return {
            ...defaultSettings,
            ...savedSchoolSettings,
            seatSettings: {
                ...defaultSettings.seatSettings,
                ...(savedSchoolSettings.seatSettings || {}),
                // Ensure new field is present
                timePerStudentPerSlotMinutes: savedSchoolSettings.seatSettings?.timePerStudentPerSlotMinutes ?? defaultSettings.seatSettings.timePerStudentPerSlotMinutes,
            },
            orderingWindows: savedSchoolSettings.orderingWindows || defaultSettings.orderingWindows,
        };
    }
    
    return defaultSettings;
};

export const saveCanteenSettings = (settings: CanteenSettings): void => {
    const allSettings = getSettings();
    allSettings[settings.schoolId] = settings;
    saveSettings(allSettings);
};

export const getCurrentCanteenStatus = (schoolId: string): {
    isOpen: boolean;
    closesIn: number | null;
    nextOpening: { opensIn: number; window: CanteenTimeSlot; } | null;
    activeWindow: CanteenTimeSlot | null; // <-- Add this
    windowName: string | null;
} => {
    const settings = getCanteenSettings(schoolId);
    let windows = settings.orderingWindows || [];

    // If syncWindowIds are specified, only consider those for active window determination
    const syncedWindowIds = settings.seatSettings.syncWindowIds || [];
    if (syncedWindowIds.length > 0) {
        windows = windows.filter(w => syncedWindowIds.includes(w.id));
    }

    if (windows.length === 0) {
        // If no windows (or no synced windows) are set, fallback to old default assumptions or assume closed for delivery
        // For delivery, if no specific windows are configured, it's safer to say it's closed,
        // or rely on explicit breakfast/daily hours if those are the only settings available.
        // For now, let's treat it as closed if specific windows aren't defined.
        return { isOpen: false, closesIn: null, nextOpening: null, activeWindow: null, windowName: null };
    }

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Check if we are currently in an open window
    for (const window of windows) {
        const [startH, startM] = window.startTime.split(':').map(Number);
        const startTimeInMinutes = startH * 60 + startM;
        const windowStartTimestamp = new Date(today).setHours(startH, startM, 0, 0);

        const [endH, endM] = window.endTime.split(':').map(Number);
        const endTimeInMinutes = endH * 60 + endM;
        const windowEndTimestamp = new Date(today).setHours(endH, endM, 0, 0);

        if (now >= windowStartTimestamp && now < windowEndTimestamp) {
            const closesIn = windowEndTimestamp - now;
            return { isOpen: true, closesIn, nextOpening: null, activeWindow: window, windowName: window.name };
        }
    }

    // If closed, find the next opening window
    let nextWindow: CanteenTimeSlot | null = null;
    let minDiffMs = Infinity;

    // Iterate through windows for today (future openings)
    for (const window of windows) {
        const [startH, startM] = window.startTime.split(':').map(Number);
        const windowStartTimestamp = new Date(today).setHours(startH, startM, 0, 0);
        const diff = windowStartTimestamp - now;
        
        if (diff > 0 && diff < minDiffMs) {
            minDiffMs = diff;
            nextWindow = window;
        }
    }

    // If no window found for today, check for tomorrow's first window
    if (!nextWindow && windows.length > 0) {
        // Find the earliest window of all, which would be tomorrow's first
        const sortedWindows = [...windows].sort((a, b) => {
             const [aH, aM] = a.startTime.split(':').map(Number);
             const [bH, bM] = b.startTime.split(':').map(Number);
             return (aH * 60 + aM) - (bH * 60 + bM);
        });
        nextWindow = sortedWindows[0] || null;

        if (nextWindow) {
            const [startH, startM] = nextWindow.startTime.split(':').map(Number);
            const tomorrowStartTimestamp = new Date(today);
            tomorrowStartTimestamp.setDate(tomorrowStartTimestamp.getDate() + 1);
            tomorrowStartTimestamp.setHours(startH, startM, 0, 0);
            minDiffMs = tomorrowStartTimestamp.getTime() - now;
        }
    }
    
    if (nextWindow) {
        return { isOpen: false, closesIn: null, nextOpening: { opensIn: minDiffMs, window: nextWindow }, activeWindow: null, windowName: null };
    }

    // No active or upcoming windows found
    return { isOpen: false, closesIn: null, nextOpening: null, activeWindow: null, windowName: null };
};


// --- Helper for getting orders within a specific window ---
const _getOrdersInTimeRange = (
    shopId: string,
    startMs: number,
    endMs: number
): CanteenOrder[] => {
    const allOrders = getOrders();
    return allOrders.filter(o =>
        o.shopId === shopId &&
        o.deliveryMethod === 'delivery' &&
        o.status !== 'cancelled' && // Don't count cancelled orders
        o.assignedSlotStart !== null && // Must have been assigned a slot
        o.assignedSlotStart >= startMs &&
        o.assignedSlotStart < endMs
    ).sort((a, b) => (a.assignedSlotStart || 0) - (b.assignedSlotStart || 0));
};

// --- Helper for allocating the next seating slot ---
const _allocateNextSeatingSlot = (
    shopId: string,
    activeWindow: CanteenTimeSlot,
    settings: CanteenSettings,
    existingOrdersInWindow: CanteenOrder[]
): { assignedTable: string; assignedSlotStart: number; assignedSlotEnd: number } => {
    
    const tables = settings.seatSettings.tables;
    const timePerStudentPerSlotMinutes = settings.seatSettings.timePerStudentPerSlotMinutes;
    
    if (tables.length === 0 || timePerStudentPerSlotMinutes <= 0) {
        throw new Error("Canteen seating configuration (tables or time per slot) is incomplete.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const [windowStartH, windowStartM] = activeWindow.startTime.split(':').map(Number);
    const windowStartTimestamp = new Date(today).setHours(windowStartH, windowStartM, 0, 0);

    const [windowEndH, windowEndM] = activeWindow.endTime.split(':').map(Number);
    // FIX: Corrected typo from endH/endM to windowEndH/windowEndM.
    const windowEndTimestamp = new Date(today).setHours(windowEndH, windowEndM, 0, 0);

    const timePerSlotMs = timePerStudentPerSlotMinutes * 60 * 1000;

    // Initialize the next available time for each individual seat
    // Each element in `seatAvailability` represents a unique seat, tracking when it next becomes free.
    const seatAvailability: { tableLabel: string; nextAvailableTime: number; }[] = [];
    tables.forEach(table => {
        for (let i = 0; i < table.capacity; i++) {
            seatAvailability.push({ tableLabel: table.label, nextAvailableTime: windowStartTimestamp });
        }
    });

    // "Book" the existing orders into the conceptual seats to determine the next available slot
    // For each existing order, find the earliest free seat and assign the order's duration to it.
    existingOrdersInWindow.forEach(order => {
        // Find the earliest free seat that this order can occupy
        const earliestFreeSeatIndex = seatAvailability.reduce((bestIndex, currentSeat, currentIndex) => {
            return currentSeat.nextAvailableTime < seatAvailability[bestIndex].nextAvailableTime ? currentIndex : bestIndex;
        }, 0); // Start with index 0 as initial best

        // If the order already has a slot, ensure its end time is respected.
        // Otherwise, simply advance the `nextAvailableTime` for the found seat.
        seatAvailability[earliestFreeSeatIndex].nextAvailableTime = Math.max(
            seatAvailability[earliestFreeSeatIndex].nextAvailableTime, // Current free time of this seat
            order.assignedSlotStart || windowStartTimestamp // Or the order's own start time if it's already assigned
        ) + timePerSlotMs;
    });

    // Find the overall earliest available seat for the *new* order
    let nextAvailableSeatIndex = -1;
    let earliestAvailableTime = Infinity;

    seatAvailability.forEach((seat, index) => {
        if (seat.nextAvailableTime < earliestAvailableTime) {
            earliestAvailableTime = seat.nextAvailableTime;
            nextAvailableSeatIndex = index;
        }
    });

    if (nextAvailableSeatIndex === -1) {
        throw new Error("No available seating slots could be found."); // Should not happen if tables.length > 0
    }

    let assignedSlotStart = Math.max(windowStartTimestamp, earliestAvailableTime);
    let assignedSlotEnd = assignedSlotStart + timePerSlotMs;

    // Check for overflow beyond the window
    // Add a small buffer to window end (e.g., half a slot duration) to account for floating point errors or last-minute assignments
    if (assignedSlotEnd > windowEndTimestamp + (timePerSlotMs / 2)) {
        throw new Error(`Ordering window (${activeWindow.name}) is full. No more delivery slots available.`);
    }

    const assignedTable = seatAvailability[nextAvailableSeatIndex].tableLabel;

    return { assignedTable, assignedSlotStart, assignedSlotEnd };
};


// --- Order Management ---
export const getOrdersForShop = (shopId: string, status?: CanteenOrder['status']): CanteenOrder[] => {
    let orders = getOrders().filter(o => o.shopId === shopId);
    if (status) {
        orders = orders.filter(o => o.status === status);
    }
    return orders.sort((a, b) => b.timestamp - a.timestamp);
};

export const getOrdersForSchool = (schoolId: string): CanteenOrder[] => {
    const schoolShops = getShopsForSchool(schoolId);
    const shopIds = new Set(schoolShops.map(s => s.id));
    const allOrders = getOrders();
    return allOrders.filter(o => shopIds.has(o.shopId)).sort((a, b) => b.timestamp - a.timestamp);
};

export const getOrdersForStudent = (studentId: string): CanteenOrder[] => {
    return getOrders().filter(o => o.studentId === studentId).sort((a, b) => b.timestamp - a.timestamp);
};

export const getOrderById = (orderId: string): CanteenOrder | null => {
    const orders = getOrders();
    return orders.find(o => o.id === orderId) || null;
};

export const findReadyOrderForStudent = (studentId: string, shopId: string): CanteenOrder | null => {
    const orders = getOrders();
    // Find the first order that matches criteria. In a real-world scenario, you might want to handle multiple ready orders.
    const readyOrder = orders.find(o => 
        o.studentId === studentId && 
        o.shopId === shopId && 
        o.status === 'out_for_delivery'
    );
    return readyOrder || null;
};

export const placeOrder = (
    shopId: string,
    studentId: string,
    cart: { itemId: string; quantity: number }[],
    pin: string,
    deliveryMethod: 'pickup' | 'delivery'
): CanteenOrder => {
    const student = findUserById(studentId);
    if (!student) throw new Error("Student not found.");
    
    const shop = getShops().find(s => s.id === shopId);
    if (!shop) throw new Error("Shop not found.");

    const items = getMenuItems();
    const orderItems = cart.map(cartItem => {
        const menuItem = items.find(i => i.id === cartItem.itemId);
        if (!menuItem) throw new Error(`Item with ID ${cartItem.itemId} not found.`);
        // Ensure availability before placing order
        if (!menuItem.isAvailable) throw new Error(`Item "${menuItem.name}" is currently unavailable.`);
        return { itemId: menuItem.id, name: menuItem.name, quantity: cartItem.quantity, price: menuItem.price };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (eWalletService.getAvailableBalance(studentId) < totalAmount) {
        // FIX: Use the new stageCanteenOrder function
        stageCanteenOrder({
            shopId,
            cart: Object.fromEntries(cart.map(c => [c.itemId, c.quantity])),
            deliveryMethod,
            totalAmount
        });
        throw new Error("Insufficient funds.");
    }
    if (!eWalletService.verifyPin(studentId, pin)) throw new Error("Invalid PIN.");

    let assignedTable: string | null = null;
    let assignedSlotStart: number | null = null;
    let assignedSlotEnd: number | null = null;

    if (deliveryMethod === 'delivery') {
        const settings = getCanteenSettings(shop.schoolId);
        const canteenStatus = getCurrentCanteenStatus(shop.schoolId);

        if (!canteenStatus.isOpen || !canteenStatus.activeWindow) {
            throw new Error(`Canteen is currently closed for delivery orders. ${canteenStatus.nextOpening ? `Next window opens ${new Date(canteenStatus.nextOpening.window.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.` : 'No upcoming windows.'}`);
        }

        const activeWindow = canteenStatus.activeWindow;
        
        // Ensure timePerStudentPerSlotMinutes is set
        if (!settings.seatSettings.timePerStudentPerSlotMinutes || settings.seatSettings.timePerStudentPerSlotMinutes <= 0) {
            throw new Error("Canteen delivery seating duration is not configured. Please contact administration.");
        }

        // Get existing delivery orders assigned slots within this active window
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const [windowStartH, windowStartM] = activeWindow.startTime.split(':').map(Number);
        const windowStartTimestamp = new Date(today).setHours(windowStartH, windowStartM, 0, 0);
        const [windowEndH, windowEndM] = activeWindow.endTime.split(':').map(Number);
        const windowEndTimestamp = new Date(today).setHours(windowEndH, windowEndM, 0, 0);

        const existingDeliveryOrdersInWindow = _getOrdersInTimeRange(
            shop.id,
            windowStartTimestamp,
            windowEndTimestamp
        );
        
        // Allocate the next available slot
        const allocation = _allocateNextSeatingSlot(
            shop.id,
            activeWindow,
            settings,
            existingDeliveryOrdersInWindow
        );
        assignedTable = allocation.assignedTable;
        assignedSlotStart = allocation.assignedSlotStart;
        assignedSlotEnd = allocation.assignedSlotEnd;
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const transaction = eWalletService.createTransaction({
        walletUserId: studentId,
        type: 'payment',
        amount: -totalAmount,
        description: `Canteen Order from ${shop.name}`,
        status: 'pending', // Pending until delivered (or 'completed' for pickup)
        recipient: `Shop ID: ${shopId}`,
        method: 'e-wallet',
        orderId: orderId,
    });
    
    const newOrder: CanteenOrder = {
        id: orderId,
        shopId,
        studentId,
        studentName: student.name,
        items: orderItems,
        totalAmount,
        status: 'pending',
        timestamp: Date.now(),
        transactionId: transaction.id,
        deliveryMethod,
        assignedTable,
        assignedSlotStart,
        assignedSlotEnd,
    };
    const orders = getOrders();
    orders.push(newOrder);
    saveOrders(orders);
    
    logAction(studentId, student.name, 'CANTEEN_ORDER_PLACED', { shopId, totalAmount, deliveryMethod });

    if (shop.ownerId) {
        const title = `New Order #${newOrder.id.slice(-6)}`;
        let message = `From: ${student.name}\nTotal: UGX ${totalAmount.toLocaleString()}`;
        if (deliveryMethod === 'delivery' && assignedTable && assignedSlotStart && assignedSlotEnd) {
             const startTime = new Date(assignedSlotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             const endTime = new Date(assignedSlotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             message = `${message}\nTable: ${assignedTable}, Slot: ${startTime} - ${endTime}`;
        }
        createBroadcastNotification(title, message, [shop.ownerId]);
    }

    return newOrder;
};

export const completeScannedOrder = (orderId: string, requestingUserId: string): CanteenOrder => {
    const orders = getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error("Order not found.");

    const order = orders[orderIndex];

    if (order.status !== 'out_for_delivery') {
        throw new Error(`Order is not ready for pickup. Current status: ${order.status}`);
    }
    
    const shop = getShops().find(s => s.id === order.shopId);
    const isOwner = shop?.ownerId === requestingUserId;
    const isCarrier = shop?.carrierIds?.includes(requestingUserId);

    if (!shop || (!isOwner && !isCarrier)) {
        throw new Error("You are not authorized to complete this order.");
    }

    if (!order.transactionId) throw new Error("Order has no associated transaction to complete.");
    
    eWalletService.settleOrderPayment(order.id, order.shopId);

    order.status = 'delivered';
    orders[orderIndex] = order;
    saveOrders(orders);

    if (!shop.ownerId) throw new Error("Could not find shop owner to create receipt.");

    createReceipt({
        transactionId: order.transactionId,
        orderId: order.id,
        userId: order.studentId,
        buyerId: order.studentId,
        sellerId: shop.ownerId,
        type: 'purchase',
        amount: order.totalAmount,
        description: `Purchase at ${shop.name}`,
        partyName: shop.name,
        items: order.items,
    });
    
    createReceipt({
        transactionId: order.transactionId,
        orderId: order.id,
        userId: shop.ownerId,
        buyerId: order.studentId,
        sellerId: shop.ownerId,
        type: 'sale',
        amount: order.totalAmount,
        description: `Sale to ${order.studentName}`,
        partyName: order.studentName,
        items: order.items,
    });
    
    logAction(requestingUserId, 'Staff', 'CANTEEN_ORDER_COMPLETED', { orderId: order.id, studentId: order.studentId });

    return order;
};

export const updateOrderStatus = (orderId: string, newStatus: CanteenOrder['status']): CanteenOrder => {
    const orders = getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('Order not found.');
    
    const order = orders[orderIndex];
    const originalStatus = order.status;
    order.status = newStatus;

    try {
        if (newStatus === 'delivered' && order.transactionId) {
            eWalletService.settleOrderPayment(order.id, order.shopId);
        } else if (newStatus === 'cancelled' && order.transactionId) {
            eWalletService.cancelOrderPayment(order.id);
        }
    } catch (e) {
        order.status = originalStatus; // Revert status on error
        saveOrders(orders);
        throw e; // Re-throw the error
    }
    
    orders[orderIndex] = order;
    saveOrders(orders);
    return orders[orderIndex];
};

export const cancelStudentOrder = (orderId: string, studentId: string): void => {
    const orders = getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('Order not found.');
    
    const order = orders[orderIndex];
    
    if (order.studentId !== studentId) throw new Error("You are not authorized to cancel this order.");
    if (order.status !== 'pending') throw new Error("Only pending orders can be cancelled.");

    order.status = 'cancelled';
    
    if (order.transactionId) eWalletService.cancelOrderPayment(order.id);
    
    orders[orderIndex] = order;
    saveOrders(orders);
    
    logAction(studentId, order.studentName, 'CANTEEN_ORDER_CANCELLED', { orderId });
};

export const getOrderForAttendanceCheck = (studentId: string, schoolId: string): CanteenOrder | null => {
    // FIX: Include all active order statuses for attendance check
    const allowedStatuses = ['pending', 'preparing', 'packaged', 'out_for_delivery'];
    const studentOrders = getOrdersForStudent(studentId).filter(o => allowedStatuses.includes(o.status) && o.deliveryMethod === 'delivery');
    const now = Date.now();
    // Find an order whose time slot is current or very recent
    return studentOrders.find(o => o.assignedSlotStart && o.assignedSlotEnd && now >= (o.assignedSlotStart - 5 * 60 * 1000) && now <= o.assignedSlotEnd) || null;
};

export const signInForCanteenAttendance = (orderId: string): void => {
    const order = getOrderById(orderId);
    if (!order) throw new Error("Order not found.");
    
    // FIX: Allow sign-in for any active order status, not just pending
    const allowedStatuses = ['pending', 'preparing', 'packaged', 'out_for_delivery'];
    if (!allowedStatuses.includes(order.status)) throw new Error("This order is not valid for attendance check-in.");
    
    if (!order.assignedTable) throw new Error("This order has no assigned table.");
    if (!order.assignedSlotStart) throw new Error("This order has no assigned time slot.");

    const now = Date.now();
    const gracePeriod = 15 * 60 * 1000; // 15 minutes
    if (now < order.assignedSlotStart - gracePeriod || now > order.assignedSlotEnd! + gracePeriod) {
        throw new Error("It is not currently your assigned time slot.");
    }
    
    const notifications = getDeliveryNotifications();
    if (notifications.some(n => n.orderId === orderId)) {
        throw new Error("A delivery notification for this order already exists.");
    }

    const shop = getShops().find(s => s.id === order.shopId);
    if (!shop) {
        throw new Error("Could not find the associated shop.");
    }
    
    const newNotification: DeliveryNotification = {
        id: `del_notif_${Date.now()}`,
        orderId: order.id,
        studentId: order.studentId,
        studentName: order.studentName,
        shopId: order.shopId,
        tableNumber: order.assignedTable,
        timestamp: Date.now(),
        status: 'pending'
    };
    notifications.push(newNotification);
    saveDeliveryNotifications(notifications);
    
    logAction(order.studentId, order.studentName, 'CANTEEN_ATTENDANCE_SIGNIN', { orderId, table: order.assignedTable });

    if (shop.carrierIds && shop.carrierIds.length > 0) {
        const title = "Student Awaiting Delivery";
        const message = `${order.studentName} is at Table ${order.assignedTable} awaiting their order.`;
        createBroadcastNotification(title, message, shop.carrierIds);
    }
};

// FIX: Implement missing seed function
export const seedInitialCanteenData = (schoolId: string): CanteenShop => {
    const shop1 = addShop(schoolId, "Main Tuck Shop", "Serving a variety of meals and snacks.");
    const cat1 = addCategory(shop1.id, "Breakfast");
    const cat2 = addCategory(shop1.id, "Lunch");
    const cat3 = addCategory(shop1.id, "Snacks");
    
    addMenuItem({ shopId: shop1.id, categoryId: cat1.id, name: "Rolex", description: "Classic Ugandan street food.", price: 2000, imageUrl: "https://picsum.photos/seed/rolex/200", isAvailable: true });
    addMenuItem({ shopId: shop1.id, categoryId: cat1.id, name: "Chapati & Beans", description: "A hearty breakfast.", price: 3000, imageUrl: "https://picsum.photos/seed/chapati/200", isAvailable: true });
    addMenuItem({ shopId: shop1.id, categoryId: cat2.id, name: "Pilau Rice with Beef", description: "Spiced rice with tender beef.", price: 7000, imageUrl: "https://picsum.photos/seed/pilau/200", isAvailable: true });
    addMenuItem({ shopId: shop1.id, categoryId: cat3.id, name: "Samosa (Beef)", description: "Crispy and savory.", price: 1000, imageUrl: "https://picsum.photos/seed/samosa/200", isAvailable: true });
    
    return shop1;
};
