
// services/receiptService.ts
import { Receipt, ReceiptStatus } from '../types';

const RECEIPTS_KEY = '360_smart_school_receipts';

// Helper to get all receipts from localStorage
const getReceipts = (): Receipt[] => {
    const data = localStorage.getItem(RECEIPTS_KEY);
    return data ? JSON.parse(data) : [];
};

// Helper to save all receipts to localStorage
const saveReceipts = (receipts: Receipt[]) => {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
};

/**
 * Creates and saves a new receipt.
 * @param data The data for the new receipt, excluding the ID and timestamp.
 * @param initialStatus The initial status of the receipt. Defaults to 'Pending'.
 * @returns The newly created receipt object.
 */
export const createReceipt = (data: Omit<Receipt, 'id' | 'timestamp' | 'statusHistory'>, initialStatus: ReceiptStatus | string = 'Pending'): Receipt => {
    const allReceipts = getReceipts();
    const newReceipt: Receipt = {
        ...data,
        id: `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        statusHistory: [{ status: initialStatus, timestamp: Date.now() }],
    };
    allReceipts.push(newReceipt);
    saveReceipts(allReceipts);
    return newReceipt;
};

/**
 * Retrieves all receipts for a specific user, sorted by newest first.
 * @param userId The ID of the user whose receipts are to be fetched.
 * @returns An array of Receipt objects.
 */
export const getReceiptsForUser = (userId: string): Receipt[] => {
    const allReceipts = getReceipts();
    // FIX: Explicitly type sort parameters to prevent type inference issues.
    return allReceipts
        .filter(r => r.userId === userId)
        .sort((a: Receipt, b: Receipt) => b.timestamp - a.timestamp);
};

/**
 * Retrieves a single receipt by its ID.
 * @param receiptId The ID of the receipt to retrieve.
 * @returns The Receipt object or null if not found.
 */
export const getReceiptById = (receiptId: string): Receipt | null => {
    const allReceipts = getReceipts();
    return allReceipts.find(r => r.id === receiptId) || null;
};


/**
 * Updates the status of a marketplace receipt by adding a new status to its history.
 * It also finds and updates the corresponding "twin" receipt (e.g., the buyer's 'purchase' receipt when the seller updates their 'sale' receipt).
 * @param receiptId The ID of the receipt to update.
 * @param newStatus The new status to add.
 * @returns The updated receipt.
 */
export const updateReceiptStatus = (receiptId: string, newStatus: ReceiptStatus): Receipt => {
    const allReceipts = getReceipts();
    const primaryReceiptIndex = allReceipts.findIndex(r => r.id === receiptId);
    if (primaryReceiptIndex === -1) {
        throw new Error("Receipt not found.");
    }

    const primaryReceipt = allReceipts[primaryReceiptIndex];
    
    const currentStatus = primaryReceipt.statusHistory[primaryReceipt.statusHistory.length - 1]?.status;
    if (currentStatus === newStatus) {
        return primaryReceipt; // No change needed
    }

    // Add the new status to the primary receipt
    const newStatusEntry = { status: newStatus, timestamp: Date.now() };
    primaryReceipt.statusHistory.push(newStatusEntry);
    allReceipts[primaryReceiptIndex] = primaryReceipt;

    // Find and update the corresponding "twin" receipt (the other side of the transaction)
    const twinReceiptIndex = allReceipts.findIndex(r => 
        r.orderId === primaryReceipt.orderId && // Match by the shared orderId
        r.id !== primaryReceipt.id              // But ensure it's not the same receipt object
    );

    if (twinReceiptIndex > -1) {
        const twinReceipt = allReceipts[twinReceiptIndex];
        twinReceipt.statusHistory.push(newStatusEntry); // Add the same status entry to synchronize
        allReceipts[twinReceiptIndex] = twinReceipt;
    }
    
    saveReceipts(allReceipts);
    return primaryReceipt;
};
