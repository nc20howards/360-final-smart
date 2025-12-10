
// services/eWalletService.ts

import { EWallet, EWalletTransaction, SchoolFee, ParentalControlSettings, TransactionType, TopUpMethod, WithdrawalMethod, PinResetRequest, User, AdminUser, SchoolFeeItem, MarketplaceListing, Receipt, SchoolFeePaymentRecord, StagedSchoolFee, StagedTransferPayment } from '../types';
import { getSchoolUsersBySchoolIds, getUsers, extractStudentIdFromIdentifier } from './studentService';
import { getAllStudents } from './studentService';
import { getAllAdminUsers } from './userService';
import { isUnebVerificationEnabled, getUnebServiceFeeAmount } from './systemSettingsService';
import { getShops } from './canteenService';
import * as receiptService from './receiptService';
import { logAction } from './auditLogService';

const WALLETS_KEY = '360_smart_school_wallets';
const TRANSACTIONS_KEY = '360_smart_school_transactions';
const FEES_KEY = '360_smart_school_fees';
const CONTROLS_KEY = '360_smart_school_parental_controls';
const PIN_RESET_REQUESTS_KEY = '360_smart_school_pin_resets';
export const TRANSFER_ESCROW_USER_ID = 'system_transfer_escrow';
export const MARKETPLACE_ESCROW_USER_ID = 'system_marketplace_escrow';
const MARKETPLACE_CHECKOUT_KEY = '360_smart_school_marketplace_checkout';
const STAGED_SCHOOL_FEE_KEY = '360_smart_school_staged_school_fee';
const STAGED_TRANSFER_PAYMENT_KEY = '360_smart_school_staged_transfer_payment';


// --- Helper Functions ---
const getWallets = (): EWallet[] => JSON.parse(localStorage.getItem(WALLETS_KEY) || '[]');
const saveWallets = (wallets: EWallet[]) => localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
const getTransactions = (): EWalletTransaction[] => JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
const saveTransactions = (transactions: EWalletTransaction[]) => localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
const getFees = (): SchoolFee[] => JSON.parse(localStorage.getItem(FEES_KEY) || '[]');
const saveFees = (fees: SchoolFee[]) => localStorage.setItem(FEES_KEY, JSON.stringify(fees));
const getControls = (): ParentalControlSettings[] => JSON.parse(localStorage.getItem(CONTROLS_KEY) || '[]');
const saveControls = (controls: ParentalControlSettings[]) => localStorage.setItem(CONTROLS_KEY, JSON.stringify(controls));
const getPinResetRequestsData = (): PinResetRequest[] => JSON.parse(localStorage.getItem(PIN_RESET_REQUESTS_KEY) || '[]');
const savePinResetRequestsData = (requests: PinResetRequest[]) => localStorage.setItem(PIN_RESET_REQUESTS_KEY, JSON.stringify(requests));
const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;


// --- Staged School Fee Management ---
export const stageSchoolFeePayment = (data: StagedSchoolFee): void => {
    localStorage.setItem(STAGED_SCHOOL_FEE_KEY, JSON.stringify(data));
};

export const getStagedSchoolFeePayment = (): StagedSchoolFee | null => {
    const data = localStorage.getItem(STAGED_SCHOOL_FEE_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedSchoolFeePayment = (): void => {
    localStorage.removeItem(STAGED_SCHOOL_FEE_KEY);
};

// --- Staged Transfer Payment Management ---
export const stageTransferPayment = (data: StagedTransferPayment): void => {
    localStorage.setItem(STAGED_TRANSFER_PAYMENT_KEY, JSON.stringify(data));
};

export const getStagedTransferPayment = (): StagedTransferPayment | null => {
    const data = localStorage.getItem(STAGED_TRANSFER_PAYMENT_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedTransferPayment = (): void => {
    localStorage.removeItem(STAGED_TRANSFER_PAYMENT_KEY);
};


// --- Wallet Management ---
export const getWalletForUser = (userId: string): EWallet => {
    const wallets = getWallets();
    let wallet = wallets.find(w => w.userId === userId);
    if (!wallet) {
        wallet = { userId, balance: 0, currency: 'UGX' };
        wallets.push(wallet);
        saveWallets(wallets);
    }
    return wallet;
};

export const getSchoolWallets = (schoolId: string) => {
    const schoolUsers = getSchoolUsersBySchoolIds([schoolId]);
    const userIds = schoolUsers.map(u => u.studentId);
    return userIds.map(id => getWalletForUser(id));
};

// --- PIN Management ---
export const setPin = (userId: string, newPin: string): void => {
    if (!/^\d{4}$/.test(newPin)) {
        throw new Error("PIN must be exactly 4 digits.");
    }
    const wallets = getWallets();
    const wallet = getWalletForUser(userId);
    wallet.pin = newPin; // In a real app, this would be hashed.

    const walletIndex = wallets.findIndex(w => w.userId === userId);
    if (walletIndex > -1) wallets[walletIndex] = wallet;
    else wallets.push(wallet);
    saveWallets(wallets);
    logAction(userId, 'User', 'PIN_SET', {});
};

export const verifyPin = (userId: string, pinToVerify: string): boolean => {
    const wallet = getWalletForUser(userId);
    if (!wallet.pin) {
        throw new Error("No PIN has been set for this wallet.");
    }
    if (wallet.pin !== pinToVerify) {
        throw new Error("Invalid PIN.");
    }
    return true;
};

export const requestPinResetForStudent = (student: User): void => {
    if (!student.schoolId) throw new Error("Student is not assigned to a school.");
    
    const requests = getPinResetRequestsData();
    const existingRequest = requests.find(r => r.userId === student.studentId && r.status === 'pending');
    if (existingRequest) {
        throw new Error("You already have a pending PIN reset request.");
    }
    
    const newRequest: PinResetRequest = {
        id: `pin_reset_${Date.now()}`,
        userId: student.studentId,
        userName: student.name,
        schoolId: student.schoolId,
        userRole: 'student',
        timestamp: Date.now(),
        status: 'pending',
    };
    requests.push(newRequest);
    savePinResetRequestsData(requests);
    logAction(student.studentId, student.name, 'PIN_RESET_REQUEST', { schoolId: student.schoolId });
};

export const requestPinResetForAdmin = (adminUser: AdminUser): void => {
    const requests = getPinResetRequestsData();
    const existingRequest = requests.find(r => r.userId === adminUser.id && r.status === 'pending');
    if (existingRequest) {
        throw new Error("You already have a pending PIN reset request.");
    }

    const newRequest: PinResetRequest = {
        id: `pin_reset_${Date.now()}`,
        userId: adminUser.id,
        userName: adminUser.name,
        userRole: adminUser.role,
        schoolId: adminUser.assignedSchoolIds?.[0], // May be undefined, which is fine
        timestamp: Date.now(),
        status: 'pending',
    };
    requests.push(newRequest);
    savePinResetRequestsData(requests);
    logAction(adminUser.id, adminUser.name, 'PIN_RESET_REQUEST', { role: adminUser.role });
};

export const getPinResetRequestsForSchool = (schoolId: string): PinResetRequest[] => {
    return getPinResetRequestsData().filter(r => r.schoolId === schoolId && r.userRole === 'student' && r.status === 'pending');
};

export const getPinResetRequestsForSuperadmin = (): PinResetRequest[] => {
    return getPinResetRequestsData().filter(r => (r.userRole === 'headteacher' || r.userRole === 'uneb_admin') && r.status === 'pending');
};

export const approvePinReset = (requestId: string): void => {
    const requests = getPinResetRequestsData();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        throw new Error("Reset request not found.");
    }
    const request = requests[requestIndex];

    const wallets = getWallets();
    const walletIndex = wallets.findIndex(w => w.userId === request.userId);
    if (walletIndex > -1) {
        delete wallets[walletIndex].pin;
        saveWallets(wallets);
    }

    request.status = 'completed';
    requests[requestIndex] = request;
    savePinResetRequestsData(requests);
    logAction('Admin', 'Admin', 'PIN_RESET_APPROVED', { targetUserId: request.userId });
};


// --- Transaction Management ---
export const createTransaction = (data: Omit<EWalletTransaction, 'id' | 'timestamp'>): EWalletTransaction => {
    const transactions = getTransactions();
    const newTransaction: EWalletTransaction = {
        ...data,
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
    };
    transactions.push(newTransaction);
    saveTransactions(transactions);
    return newTransaction;
};

export const getTransactionsForUser = (userId: string): EWalletTransaction[] => {
    const transactions = getTransactions();
    return transactions
        .filter(t => t.walletUserId === userId)
        .sort((a: EWalletTransaction, b: EWalletTransaction) => b.timestamp - a.timestamp);
};

export const getAllSchoolTransactions = (schoolId: string): EWalletTransaction[] => {
    const allTransactions = getTransactions();
    
    // Find the headteacher for the school, who represents the school's wallet/account.
    const headteacher = getAllAdminUsers().find(u => u.role === 'headteacher' && u.assignedSchoolIds.includes(schoolId));
    
    if (!headteacher) {
        return [];
    }
    const headteacherId = headteacher.id;

    const schoolUserIds = new Set(getSchoolUsersBySchoolIds([schoolId]).map(u => u.studentId));

    return allTransactions.filter(t => {
        // NEW PRIVACY RULE: Never show the student's personal debit for an admission fee.
        // The headteacher sees their own credit transaction (bursary_credit), which is sufficient.
        if (t.type === 'admission_fee_payment' && schoolUserIds.has(t.walletUserId)) {
            return false;
        }

        // Rule 1: Show any transaction that directly involves the headteacher's wallet.
        if (t.walletUserId === headteacherId) {
            return true;
        }
        
        // Rule 2: Show student's side of explicit school business transactions (EXCLUDING admission fee which is now handled above).
        const schoolBusinessTypes: TransactionType[] = ['fee_payment', 'transfer_fee_payment', 'bursary_credit'];
        if (schoolUserIds.has(t.walletUserId) && schoolBusinessTypes.includes(t.type)) {
            return true;
        }

        // Rule 3: Show student's side of a disbursement from the headteacher.
        if (schoolUserIds.has(t.walletUserId) && t.senderId === headteacherId) {
            return true;
        }
        
        // PRIVACY FIX: Removed rule that exposed student canteen payments.
        // A school-wide view should not include individual student purchases.

        // Exclude all other transactions (top-ups, withdrawals, P2P payments, marketplace).
        return false;
    }).sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Gets all bursary-related transactions for a school to track disbursement and usage history.
 */
export const getSchoolBursaries = (schoolId: string): EWalletTransaction[] => {
    const schoolUsers = getSchoolUsersBySchoolIds([schoolId]);
    const studentIds = new Set(schoolUsers.map(u => u.studentId));
    const allTransactions = getTransactions();

    // Filter for 'bursary_credit' transactions received by students of this school
    return allTransactions
        .filter(t => t.type === 'bursary_credit' && studentIds.has(t.walletUserId))
        .sort((a, b) => b.timestamp - a.timestamp);
};


export const getAvailableBalance = (userId: string): number => {
    const wallet = getWalletForUser(userId);
    const transactions = getTransactionsForUser(userId);
    const heldAmount = transactions
        .filter(tx => tx.status === 'pending' && (tx.type === 'payment' || tx.type === 'fee_payment'))
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return wallet.balance - heldAmount;
};

export const topUpWallet = (userId: string, amount: number, method: TopUpMethod, description?: string, type: TransactionType = 'top-up', senderInfo?: { senderId: string, senderName: string }): EWallet => {
    if (amount <= 0) throw new Error("Top-up amount must be positive.");
    const wallets = getWallets();
    const wallet = getWalletForUser(userId);
    wallet.balance += amount;

    const walletIndex = wallets.findIndex(w => w.userId === userId);
    if(walletIndex > -1) wallets[walletIndex] = wallet;
    else wallets.push(wallet);

    saveWallets(wallets);

    const txn = createTransaction({
        walletUserId: userId,
        type: type,
        amount: amount,
        description: description || `Top-up via ${method.replace('_', ' ')}`,
        status: 'completed',
        method: method,
        senderId: senderInfo?.senderId,
        senderName: senderInfo?.senderName,
    });

    // Generate receipt
    receiptService.createReceipt({
        transactionId: txn.id,
        userId: userId,
        type: 'top-up',
        amount: amount,
        description: txn.description,
        partyName: senderInfo?.senderName || 'System Top-up',
    }, 'Completed');
    
    // Log Activity
    logAction(senderInfo?.senderId || userId, senderInfo?.senderName || 'User', 'WALLET_TOPUP', { amount, method, recipient: userId });

    return wallet;
};

export const makePayment = (
    fromUserId: string, 
    toUserId: string, 
    amount: number, 
    description: string, 
    type: TransactionType = 'payment',
    options?: { overrideSenderName?: string; overrideRecipientName?: string; }
): void => {
    if (amount <= 0) throw new Error("Payment amount must be positive.");

    // --- Parental Controls Enforcement ---
    const allSchoolUsers = getUsers();
    const fromUserAsSchoolUser = allSchoolUsers.find(u => u.studentId === fromUserId);

    if (fromUserAsSchoolUser && fromUserAsSchoolUser.role === 'student') {
        const controls = getParentalControls(fromUserId);
        if (controls) {
            // 1. Blocked Merchants Check
            if (controls.blockedMerchants?.includes(toUserId)) {
                throw new Error("This payment is blocked by parental controls.");
            }

            // 2. Spending Limit Check (only applies to 'payment' type for canteen/marketplace)
            if (type === 'payment') {
                const now = Date.now();
                const oneDayAgo = now - 24 * 60 * 60 * 1000;
                const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                
                const transactions = getTransactionsForUser(fromUserId);
                
                // Calculate daily spending
                const dailySpending = transactions
                    .filter(t => t.timestamp >= oneDayAgo && t.amount < 0 && t.type === 'payment')
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

                if (controls.dailySpendingLimit && (dailySpending + amount) > controls.dailySpendingLimit) {
                    throw new Error(`This payment exceeds the daily spending limit of ${formatCurrency(controls.dailySpendingLimit)}. You have spent ${formatCurrency(dailySpending)} in the last 24 hours.`);
                }

                // Calculate weekly spending
                const weeklySpending = transactions
                    .filter(t => t.timestamp >= sevenDaysAgo && t.amount < 0 && t.type === 'payment')
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

                if (controls.weeklySpendingLimit && (weeklySpending + amount) > controls.weeklySpendingLimit) {
                    throw new Error(`This payment exceeds the weekly spending limit of ${formatCurrency(controls.weeklySpendingLimit)}. You have spent ${formatCurrency(weeklySpending)} in the last 7 days.`);
                }
            }
        }
    }
    // --- End Parental Controls ---
    
    const wallets = getWallets();
    
    // Find sender
    const fromWalletIndex = wallets.findIndex(w => w.userId === fromUserId);
    if (fromWalletIndex === -1) throw new Error("Sender wallet not found.");
    const fromWallet = wallets[fromWalletIndex];
    if (fromWallet.balance < amount) throw new Error("Insufficient funds.");

    // Find or create recipient wallet
    let toWalletIndex = wallets.findIndex(w => w.userId === toUserId);
    let toWallet: EWallet;
    if (toWalletIndex === -1) {
        toWallet = { userId: toUserId, balance: 0, currency: 'UGX' };
        wallets.push(toWallet);
        toWalletIndex = wallets.length - 1;
    } else {
        toWallet = wallets[toWalletIndex];
    }
    
    const allUsers = [...getUsers(), ...getAllAdminUsers()];
    
    let fromUser: { name: string } | User | AdminUser | null;
    if (fromUserId === MARKETPLACE_ESCROW_USER_ID) {
        fromUser = { name: 'System Marketplace Escrow' };
    } else if (fromUserId === TRANSFER_ESCROW_USER_ID) {
        fromUser = { name: 'System Transfer Escrow' };
    } else {
        fromUser = allUsers.find(u => ('studentId' in u ? u.studentId : u.id) === fromUserId);
    }
    
    let toUser: { name: string } | User | AdminUser | null;
    if (toUserId === TRANSFER_ESCROW_USER_ID) {
        toUser = { name: 'System Transfer Escrow' };
    } else if (toUserId === MARKETPLACE_ESCROW_USER_ID) {
        toUser = { name: 'System Marketplace Escrow' };
    } else {
        toUser = allUsers.find(u => ('studentId' in u ? u.studentId : u.id) === toUserId);
    }
    
    if(!fromUser || !toUser) throw new Error("Sender or recipient could not be identified.");

    // Perform transfer
    fromWallet.balance -= amount;
    toWallet.balance += amount;
    wallets[fromWalletIndex] = fromWallet;
    wallets[toWalletIndex] = toWallet;
    
    saveWallets(wallets);

    const fromUserName = options?.overrideSenderName || fromUser.name;
    const toUserName = options?.overrideRecipientName || toUser.name;

    // Create debit transaction for sender
    const debitTxn = createTransaction({
        walletUserId: fromUserId,
        type: type,
        amount: -amount,
        description: `${description} to ${toUserName}`,
        status: 'completed',
        recipient: toUserName,
        method: 'e-wallet',
    });

    // Generate receipt for sender
    receiptService.createReceipt({
        transactionId: debitTxn.id,
        userId: fromUserId,
        type: 'transfer_sent',
        amount: amount,
        description: debitTxn.description,
        partyName: toUserName,
    }, 'Completed');

    // Create credit transaction for recipient
    const creditTxn = createTransaction({
        walletUserId: toUserId,
        type: type,
        amount: amount,
        description: `${description} from ${fromUserName}`,
        status: 'completed',
        senderId: fromUserId,
        senderName: fromUserName,
        method: 'e-wallet',
    });

    // Generate receipt for recipient
    receiptService.createReceipt({
        transactionId: creditTxn.id,
        userId: toUserId,
        type: 'transfer_received',
        amount: amount,
        description: creditTxn.description,
        partyName: fromUserName,
    }, 'Completed');
    
    logAction(fromUserId, fromUserName, 'WALLET_PAYMENT', { to: toUserId, amount, description, type });
};

export const withdrawFromWallet = (userId: string, amount: number, method: WithdrawalMethod, recipient?: string): EWallet => {
    if (amount <= 0) throw new Error("Withdrawal amount must be positive.");
    const wallets = getWallets();
    const wallet = getWalletForUser(userId);

    if (getAvailableBalance(userId) < amount) throw new Error("Insufficient funds for withdrawal.");
    
    wallet.balance -= amount;

    const walletIndex = wallets.findIndex(w => w.userId === userId);
    if(walletIndex > -1) wallets[walletIndex] = wallet;

    saveWallets(wallets);

    const description = recipient
        ? `Withdrawal to ${recipient} via ${method.replace('_', ' ')}`
        : `Withdrawal via ${method.replace('_', ' ')}`;

    const txn = createTransaction({
        walletUserId: userId,
        type: 'withdrawal',
        amount: -amount,
        description: description,
        status: 'completed',
        method: method,
    });

    // Generate receipt
    receiptService.createReceipt({
        transactionId: txn.id,
        userId: userId,
        type: 'withdrawal',
        amount: amount,
        description: txn.description,
        partyName: recipient || 'Withdrawal Service',
    }, 'Completed');
    
    // Find user name for log
    const allUsers = [...getUsers(), ...getAllAdminUsers()];
    const user = allUsers.find(u => ('studentId' in u ? u.studentId : u.id) === userId);
    logAction(userId, user?.name || 'Unknown', 'WALLET_WITHDRAWAL', { amount, method, recipient });

    return wallet;
};

export const processAdmissionFeePayment = (studentId: string, schoolId: string, admissionFee: number): void => {
    const UNEB_ADMIN_CUT = 0.25;
    const SUPERADMIN_CUT = 0.75;
    
    const student = getAllStudents().find(s => s.studentId === studentId);
    if (!student) {
        throw new Error(`Student with ID ${studentId} not found for payment processing.`);
    }
    const senderInfo = { senderId: student.studentId, senderName: student.name };


    // 1. Debit student
    const wallets = getWallets();
    const studentWallet = getWalletForUser(studentId);

    if (studentWallet.balance < admissionFee) {
        throw new Error("Insufficient funds to pay admission fee.");
    }

    studentWallet.balance -= admissionFee;
    const studentWalletIndex = wallets.findIndex(w => w.userId === studentId);
    if (studentWalletIndex > -1) wallets[studentWalletIndex] = studentWallet;
    else wallets.push(studentWallet);
    saveWallets(wallets);

    const txn = createTransaction({
        walletUserId: studentId,
        type: 'admission_fee_payment',
        amount: -admissionFee,
        description: 'UNEB Admission Fee',
        status: 'completed',
        method: 'e-wallet',
    });

    // Generate receipt for student
    receiptService.createReceipt({
        transactionId: txn.id,
        userId: studentId,
        type: 'fee_payment',
        amount: admissionFee,
        description: 'UNEB Admission Fee Payment',
        partyName: 'School Administration',
    }, 'Completed');

    // 2. Find recipients
    const allAdmins = getAllAdminUsers();
    const headteacher = allAdmins.find(admin => admin.role === 'headteacher' && admin.assignedSchoolIds.includes(schoolId));
    const unebAdmin = allAdmins.find(admin => admin.role === 'uneb_admin');
    const superadminId = 'admin';

    if (!headteacher) {
        // Revert transaction if school has no headteacher to receive funds
        studentWallet.balance += admissionFee;
        if (studentWalletIndex > -1) wallets[studentWalletIndex] = studentWallet;
        saveWallets(wallets);
        throw new Error(`Cannot process payment: School (ID: ${schoolId}) has no assigned Headteacher to receive funds.`);
    }

    // 3. Distribute funds based on UNEB verification status
    if (isUnebVerificationEnabled()) {
        const serviceFee = getUnebServiceFeeAmount();
        const netFee = admissionFee - serviceFee;
        const unebAdminShare = serviceFee * UNEB_ADMIN_CUT;
        const superadminShare = serviceFee * SUPERADMIN_CUT;

        // Credit school (via headteacher)
        if (netFee > 0) {
            topUpWallet(headteacher.id, netFee, 'system_credit', 'Admission Fee (Net)', 'bursary_credit', senderInfo);
        }
        
        // Credit UNEB Admin
        if (unebAdmin) {
            topUpWallet(unebAdmin.id, unebAdminShare, 'system_credit', 'UNEB Admission Service Fee', 'service_fee_credit');
        }

        // Credit Superadmin
        topUpWallet(superadminId, superadminShare, 'system_credit', 'System Service Fee', 'service_fee_credit');
    } else {
        // Credit school with full amount
        topUpWallet(headteacher.id, admissionFee, 'system_credit', 'Admission Fee', 'bursary_credit', senderInfo);
    }
    
    logAction(studentId, student.name, 'ADMISSION_FEE_PAID', { schoolId, amount: admissionFee });
};

export const processBulkDisbursement = (
    payer: { id: string, name: string }, 
    userIds: string[], 
    amount: number, 
    description: string, 
    type: TransactionType = 'disbursement'
): void => {
    if (amount <= 0) throw new Error("Disbursement amount must be positive.");
    if (userIds.length === 0) throw new Error("No recipients selected.");
    
    const totalDisbursementAmount = amount * userIds.length;
    const wallets = getWallets(); // Load all wallets once at the start.

    // Find payer's wallet. It should exist for a logged-in user.
    const payerWalletIndex = wallets.findIndex(w => w.userId === payer.id);
    if (payerWalletIndex === -1) {
        throw new Error("Payer wallet could not be found.");
    }
    const payerWallet = wallets[payerWalletIndex];

    // 1. Check for sufficient funds and debit the payer in the array.
    if (payerWallet.balance < totalDisbursementAmount) {
        throw new Error(`Insufficient funds. Your balance is ${formatCurrency(payerWallet.balance)}, but the total disbursement is ${formatCurrency(totalDisbursementAmount)}.`);
    }

    // Update payer balance in the array object
    wallets[payerWalletIndex].balance -= totalDisbursementAmount;
    
    // 2. Create a single debit transaction record for the payer.
    const debitTxn = createTransaction({
        walletUserId: payer.id,
        type: type, // Use specific type (disbursement or bursary_credit)
        amount: -totalDisbursementAmount,
        description: `Bulk ${type === 'bursary_credit' ? 'Bursary' : 'Disbursement'}: ${description} to ${userIds.length} users`,
        status: 'completed',
    });

    // Generate receipt for payer
    receiptService.createReceipt({
        transactionId: debitTxn.id,
        userId: payer.id,
        type: 'transfer_sent',
        amount: totalDisbursementAmount,
        description: debitTxn.description,
        partyName: `${userIds.length} Recipients`,
    }, 'Completed');

    // 3. Loop through recipients, find their wallet in the array, and credit it.
    userIds.forEach(userId => {
        const recipientWalletIndex = wallets.findIndex(w => w.userId === userId);
        
        if (recipientWalletIndex > -1) {
            // Wallet exists, update it in place.
            wallets[recipientWalletIndex].balance += amount;
        } else {
            // Wallet doesn't exist, create and add it to the array.
            const newRecipientWallet: EWallet = {
                userId,
                balance: amount,
                currency: 'UGX',
            };
            wallets.push(newRecipientWallet);
        }

        // 4. Create the credit transaction record for the recipient.
        const creditTxn = createTransaction({
            walletUserId: userId,
            type: type, // Credit with specific type
            amount: amount,
            description,
            status: 'completed',
            senderId: payer.id,
            senderName: payer.name,
        });

        // Generate receipt for recipient
        receiptService.createReceipt({
            transactionId: creditTxn.id,
            userId: userId,
            type: 'transfer_received',
            amount: amount,
            description: creditTxn.description,
            partyName: payer.name,
        }, 'Completed');
    });

    // 5. Save the modified wallets array once after all operations.
    saveWallets(wallets);
    
    logAction(payer.id, payer.name, 'BULK_DISBURSEMENT', { amountPerUser: amount, recipientCount: userIds.length, type });
};


export const settleOrderPayment = (orderId: string, shopId: string): void => {
    const allTxns = getTransactions();
    const transactionIndex = allTxns.findIndex(tx => tx.orderId === orderId && tx.status === 'pending');
    if (transactionIndex === -1) throw new Error("Pending payment for this order not found.");
    
    const transaction = allTxns[transactionIndex];
    const wallets = getWallets();
    const studentWalletIndex = wallets.findIndex(w => w.userId === transaction.walletUserId);
    if (studentWalletIndex === -1) throw new Error("Student wallet not found.");

    // This is the actual deduction.
    wallets[studentWalletIndex].balance += transaction.amount; // amount is negative

    // Credit the seller
    const shop = getShops().find(s => s.id === shopId);
    if (!shop || !shop.ownerId) {
        wallets[studentWalletIndex].balance -= transaction.amount; // Revert
        saveWallets(wallets);
        throw new Error("Canteen shop or owner not found. Payment cannot be completed.");
    }
    
    const student = getAllStudents().find(s => s.studentId === transaction.walletUserId);

    const sellerWalletIndex = wallets.findIndex(w => w.userId === shop.ownerId);
    if (sellerWalletIndex === -1) {
        wallets.push({ userId: shop.ownerId, balance: Math.abs(transaction.amount), currency: 'UGX' });
    } else {
        wallets[sellerWalletIndex].balance += Math.abs(transaction.amount);
    }
    
    transaction.status = 'completed';
    allTxns[transactionIndex] = transaction;
    
    saveTransactions(allTxns);
    saveWallets(wallets);
};

export const cancelOrderPayment = (orderId: string): void => {
    const allTxns = getTransactions();
    const txnIndex = allTxns.findIndex(tx => tx.orderId === orderId && tx.status === 'pending');
    if (txnIndex > -1) {
        allTxns[txnIndex].status = 'cancelled';
        saveTransactions(allTxns);
    }
};


// --- School Fee Management ---
export const getSchoolFees = (schoolId: string): SchoolFee[] => {
    const allFees = getFees();
    return allFees.filter(f => f.schoolId === schoolId);
};


export const createSchoolFee = (data: Omit<SchoolFee, 'id' | 'payments' | 'totalAmount'>): SchoolFee => {
    if (data.baseAmount < 0) throw new Error("Base fee amount must be non-negative.");
    const fees = getFees();

    const totalAmount = data.baseAmount + data.items.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount <= 0) throw new Error("Total fee amount must be positive.");

    const newFee: SchoolFee = {
        ...data,
        items: data.items.map(item => ({...item, id: `item_${Date.now()}_${Math.random()}`})),
        id: `fee_${Date.now()}`,
        totalAmount,
        payments: {},
    };
    fees.push(newFee);
    saveFees(fees);
    return newFee;
};

export const bulkCreateSchoolFeesFromCSV = (csvText: string, schoolId: string): { successes: number; errors: string[] } => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    const errors: string[] = [];
    let successes = 0;

    if (lines.length < 2) {
        errors.push("CSV is empty or has no data rows.");
        return { successes, errors };
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedHeader = ['title', 'term', 'year', 'targetclasses', 'baseamount', 'items', 'duedate'];
    if (!expectedHeader.every(h => header.includes(h))) {
        errors.push(`Invalid CSV header. Expected columns: ${expectedHeader.join(', ')}`);
        return { successes, errors };
    }

    const allFees = getFees();
    const newFeesToCreate: SchoolFee[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        try {
            // Basic CSV parsing that assumes no commas within quoted fields
            const values = line.split(',');
            const title = values[0]?.trim().replace(/"/g, '');
            const term = values[1]?.trim().replace(/"/g, '');
            const year = parseInt(values[2]?.trim(), 10);
            const targetClassesStr = values[3]?.trim().replace(/"/g, '');
            const baseAmount = parseFloat(values[4]?.trim());
            const itemsStr = values[5]?.trim().replace(/"/g, '');
            const dueDateStr = values[6]?.trim().replace(/"/g, '');

            if (!title || !term || isNaN(year) || !targetClassesStr || isNaN(baseAmount) || !dueDateStr) {
                throw new Error("Missing or invalid required fields (title, term, year, targetClasses, baseAmount, dueDate).");
            }
            
            const dueDate = new Date(dueDateStr).getTime();
            if(isNaN(dueDate)) throw new Error(`Invalid dueDate format: "${dueDateStr}". Expected YYYY-MM-DD.`);

            const targetClasses = targetClassesStr.split(';').map(c => c.trim()).filter(Boolean);
            
            const items: SchoolFeeItem[] = [];
            if (itemsStr) {
                const itemPairs = itemsStr.split(';');
                for (const pair of itemPairs) {
                    if(!pair.trim()) continue;
                    const [name, amountStr] = pair.split(':');
                    const amount = parseFloat(amountStr);
                    if (name && !isNaN(amount)) {
                        items.push({ id: `item_${Date.now()}_${i}_${Math.random()}`, name: name.trim(), amount });
                    } else {
                        throw new Error(`Invalid item format: "${pair}". Expected "Item Name:Amount".`);
                    }
                }
            }

            const totalAmount = baseAmount + items.reduce((sum, item) => sum + item.amount, 0);

            const newFee: SchoolFee = {
                id: `fee_${Date.now()}_${i}`,
                schoolId,
                title,
                term,
                year,
                targetClasses,
                baseAmount,
                items,
                totalAmount,
                payments: {},
                dueDate,
            };

            newFeesToCreate.push(newFee);
            successes++;

        } catch (e) {
            errors.push(`Row ${i + 1}: ${(e as Error).message}`);
        }
    }

    if (errors.length > 0) {
        // Atomic operation: if any row has an error, don't save anything.
        return { successes: 0, errors };
    } else {
        saveFees([...allFees, ...newFeesToCreate]);
        return { successes, errors };
    }
};


export const paySchoolFee = (studentId: string, feeId: string, amountToPay: number): void => {
    const fees = getFees();
    const fee = fees.find(f => f.id === feeId);
    if (!fee) throw new Error("School fee not found.");

    const studentPayments = fee.payments[studentId] || [];
    const totalPaid = studentPayments.reduce((sum, p) => sum + p.paidAmount, 0);
    const remainingAmount = fee.totalAmount - totalPaid;

    if (amountToPay <= 0) throw new Error("Payment amount must be positive.");
    if (amountToPay > remainingAmount) throw new Error(`Payment amount exceeds remaining balance. Remaining: ${formatCurrency(remainingAmount)}`);
    
    if (getAvailableBalance(studentId) < amountToPay) {
        stageSchoolFeePayment({ studentId, feeId, amountToPay });
        throw new Error("INSUFFICIENT_FUNDS");
    }
    
    const student = getAllStudents().find(s => s.studentId === studentId);
    if (!student || !student.schoolId) throw new Error("Student or student's school not found.");
    
    const headteacher = getAllAdminUsers().find(a => a.role === 'headteacher' && a.assignedSchoolIds.includes(student.schoolId));
    if (!headteacher) throw new Error("School headteacher not found to receive payment.");

    // Since funds are sufficient, proceed with payment
    const wallets = getWallets();
    const walletIndex = wallets.findIndex(w => w.userId === studentId);
    wallets[walletIndex].balance -= amountToPay;
    saveWallets(wallets);
    
    const transaction = createTransaction({
        walletUserId: studentId,
        type: 'fee_payment',
        amount: -amountToPay,
        description: `${fee.title} (Installment)`,
        status: 'completed',
        method: 'e-wallet',
        feeId: fee.id,
        recipient: headteacher.id,
    });

    // Generate receipt for student
    receiptService.createReceipt({
        transactionId: transaction.id,
        userId: studentId,
        type: 'fee_payment',
        amount: amountToPay,
        description: `${fee.title} Payment`,
        partyName: 'School Administration',
    }, 'Completed');

    // Record the payment
    const newPaymentRecord: SchoolFeePaymentRecord = {
        transactionId: transaction.id,
        paidAt: transaction.timestamp,
        paidAmount: amountToPay,
    };
    if (!fee.payments[studentId]) {
        fee.payments[studentId] = [];
    }
    fee.payments[studentId].push(newPaymentRecord);
    
    saveFees(fees);
    
    // Credit headteacher
    topUpWallet(headteacher.id, amountToPay, 'system_credit', fee.title, 'fee_payment', { senderId: student.studentId, senderName: student.name });
    
    logAction(studentId, student.name, 'SCHOOL_FEE_PAID', { feeId, amount: amountToPay, schoolId: student.schoolId });
};

export const processTransferFee = (fromSchoolId: string, toSchoolId: string, studentName: string, amount: number): void => {
    const allAdmins = getAllAdminUsers();
    const fromHeadteacher = allAdmins.find(a => a.role === 'headteacher' && a.assignedSchoolIds.includes(fromSchoolId));
    const toHeadteacher = allAdmins.find(a => a.role === 'headteacher' && a.assignedSchoolIds.includes(toSchoolId));

    if (!fromHeadteacher) throw new Error("Paying school does not have a headteacher to process payment from.");
    if (!toHeadteacher) throw new Error("Receiving school does not have a headteacher to credit.");

    const fromWallet = getWalletForUser(fromHeadteacher.id);
    if (fromWallet.balance < amount) {
        throw new Error("The school's E-Wallet has insufficient funds to cover the transfer fee. Please contact the school administration to top up their account.");
    }

    // Debit the 'from' school
    makePayment(fromHeadteacher.id, toHeadteacher.id, amount, `Student transfer fee for ${studentName}`, 'transfer_fee_payment');
};

export const stageMarketplaceCheckout = (cartItems: (MarketplaceListing & { quantity: number })[]): void => {
    localStorage.setItem(MARKETPLACE_CHECKOUT_KEY, JSON.stringify(cartItems));
};

export const getStagedMarketplaceCheckout = (): (MarketplaceListing & { quantity: number })[] | null => {
    const data = localStorage.getItem(MARKETPLACE_CHECKOUT_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedMarketplaceCheckout = (): void => {
    localStorage.removeItem(MARKETPLACE_CHECKOUT_KEY);
};

export const releaseEscrowPayment = (receipt: Receipt, verifiedSellerId: string): void => {
    // Fresh check
    const freshReceipt = receiptService.getReceiptById(receipt.id);
    if (!freshReceipt) throw new Error("Receipt not found.");

    const currentStatus = freshReceipt.statusHistory[freshReceipt.statusHistory.length - 1]?.status;
    
    if (currentStatus === 'Completed') {
        throw new Error("Payment has already been released.");
    }

    if (currentStatus !== 'Delivered') {
        throw new Error("Payment can only be released for delivered items.");
    }
    
    // Use freshReceipt for ID checks just in case, though receipt passed in should be fine for static IDs
    const seller = getUsers().find(u => u.studentId === freshReceipt.sellerId);
    if (!seller || !seller.schoolId) {
        throw new Error("Could not identify the seller's school for verification.");
    }
    
    const extractedId = extractStudentIdFromIdentifier(verifiedSellerId, seller.schoolId);

    if (!extractedId || extractedId.toLowerCase() !== freshReceipt.sellerId.toLowerCase()) {
        throw new Error("Seller ID does not match the recipient of this purchase.");
    }

    // FIX: Search both student users and admin users to find the buyer, as the buyer could be a Headteacher.
    const allAdmins = getAllAdminUsers();
    const allStudents = getUsers();
    const allUsers = [...allStudents, ...allAdmins];

    const buyer = allUsers.find(u => {
        const id = 'studentId' in u ? u.studentId : u.id;
        return id === freshReceipt.buyerId;
    });

    if (!buyer) {
        throw new Error("Could not identify the buyer for this transaction.");
    }

    // Transfer from escrow to seller
    makePayment(
        MARKETPLACE_ESCROW_USER_ID,
        freshReceipt.sellerId,
        freshReceipt.amount,
        `Payment for Order ID: ${freshReceipt.orderId.slice(-8)}`,
        'payment',
        { overrideSenderName: buyer.name }
    );

    // Create log for buyer
    createTransaction({
        walletUserId: freshReceipt.buyerId,
        type: 'payment',
        amount: 0,
        description: `Payment released for Order ID: ${freshReceipt.orderId.slice(-8)} to ${seller.name}`,
        status: 'completed',
        recipient: seller.name,
        method: 'e-wallet',
    });

    // Update status
    receiptService.updateReceiptStatus(freshReceipt.id, 'Completed');
    
    logAction(freshReceipt.buyerId, buyer.name, 'MARKETPLACE_PAYMENT_RELEASE', { orderId: freshReceipt.orderId, sellerId: freshReceipt.sellerId });
};

// --- Parental Controls Management ---
export const getParentalControls = (userId: string): ParentalControlSettings | null => {
    const controls = getControls();
    return controls.find(c => c.userId === userId) || null;
};

export const saveParentalControls = (settings: ParentalControlSettings): void => {
    const controls = getControls();
    const index = controls.findIndex(c => c.userId === settings.userId);
    if (index > -1) {
        controls[index] = settings;
    } else {
        controls.push(settings);
    }
    saveControls(controls);
};