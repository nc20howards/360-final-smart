
// components/EWalletPage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, AdminUser, EWallet, EWalletTransaction, SchoolFee, ParentalControlSettings, TransactionType, TopUpMethod, WithdrawalMethod, PinResetRequest, SchoolUserRole, Receipt, SchoolClass, SchoolFeeItem, MarketplaceListing, SchoolFeePaymentRecord, StagedSchoolFee, StagedMarketplaceOrder, StagedCanteenOrder, StagedTransferPayment } from '../types';
import * as eWalletService from '../services/eWalletService';
import * as userService from '../services/userService';
import * as studentService from '../services/studentService';
import UserAvatar from './UserAvatar';
import PinStrengthIndicator from './PinStrengthIndicator';
import * as classService from '../services/classService';
import { findUserById } from '../services/groupService';
import * as marketplaceService from '../services/marketplaceService';
import * as receiptService from '../services/receiptService';


// --- Reusable Icons ---
const EyeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>);
const EyeOffIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" fillRule="evenodd"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.953 9.953 0 00-4.543 1.079L4.25 2.986A1 1 0 003.707 2.293zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /><path d="M10 17a9.953 9.953 0 01-4.543-1.079l-1.473 1.473a1 1 0 11-1.414-1.414l14-14a1 1 0 111.414 1.414l-1.473 1.473A10.014 10.014 0 01.458 10C1.732 14.057 5.522 17 10 17z" fillRule="evenodd" /></svg>);
const PlusCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const QrCodeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>);
const PaperAirplaneIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>);
const ArrowDownCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>);
const ArrowRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const FilterIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>);
const SortIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h16m-16 4h12m-16 4h20" /></svg>);
const SchoolFeeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>);
const DocumentTextIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>);

// --- Dashboard UI Components ---
const DashboardCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className }) => (
    <div className={`bg-gray-800 rounded-[20px] p-5 shadow-lg shadow-black/20 flex flex-col ${className}`}>
        <div className="flex justify-between items-start mb-4">
            <div>
                <h4 className="font-bold text-gray-200">{title}</h4>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button className="text-gray-500 hover:text-white transition-colors">
                <span className="text-xs font-semibold bg-gray-700 px-2 py-1 rounded-md">View Report</span>
            </button>
        </div>
        <div className="flex-grow">{children}</div>
    </div>
);

// --- Receipt Modal Component ---
interface ReceiptModalProps {
    receipt: Receipt;
    onClose: () => void;
    onDownload?: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose, onDownload }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[150] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md text-gray-800 flex flex-col animate-fade-in-up overflow-hidden">
                <div className="bg-cyan-600 p-4 text-white text-center relative">
                    <h3 className="text-xl font-bold uppercase tracking-wider">Transaction Receipt</h3>
                    <p className="text-xs opacity-80 mt-1">{new Date(receipt.timestamp).toLocaleString()}</p>
                    {onDownload && (
                        <button 
                            onClick={onDownload} 
                            className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            title="Download Receipt"
                        >
                            <DownloadIcon />
                        </button>
                    )}
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="text-center border-b border-gray-200 pb-4">
                        <p className="text-sm text-gray-500 uppercase tracking-wide">Amount</p>
                        <p className={`text-3xl font-bold ${receipt.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                           UGX {Math.abs(receipt.amount).toLocaleString()}
                        </p>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Transaction Type</span>
                            <span className="font-semibold capitalize">{receipt.type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Transaction ID</span>
                            <span className="font-mono text-xs">{receipt.transactionId}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-gray-500">{receipt.amount < 0 ? 'To' : 'From'}</span>
                            <span className="font-semibold">{receipt.partyName}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-gray-500">Status</span>
                            <span className="font-semibold text-green-600">Completed</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Description</span>
                            <span className="font-medium text-right">{receipt.description}</span>
                        </div>
                    </div>
                    
                    {receipt.items && receipt.items.length > 0 && (
                        <div className="border-t border-gray-200 pt-3">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Item Details</p>
                            <ul className="space-y-1 text-sm">
                                {receipt.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>{item.price.toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                     <p className="text-xs text-gray-400 mb-3">Thank you for using 360 Smart School E-Wallet.</p>
                    <button onClick={onClose} className="w-full py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 font-semibold transition-colors">
                        Close Receipt
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- New Fee Payment Modal (Internal component) ---
interface FeePaymentModalProps {
    isOpen: boolean;
    fee: SchoolFee;
    currentUser: User;
    stagedFee?: StagedSchoolFee | null;
    onClose: () => void;
    onPay: (feeId: string, amount: number) => void;
    pinError: string;
    setPinError: (error: string) => void;
}

const FeePaymentModal: React.FC<FeePaymentModalProps> = ({ isOpen, fee, currentUser, stagedFee, onClose, onPay, pinError, setPinError }) => {
    const studentPayments = fee.payments[currentUser.studentId] || [];
    const totalPaid = studentPayments.reduce((sum, p) => sum + p.paidAmount, 0);
    const remainingAmount = fee.totalAmount - totalPaid;
    
    const [amountToPay, setAmountToPay] = useState<number>(stagedFee ? stagedFee.amountToPay : remainingAmount);
    const [pin, setPin] = useState('');

    useEffect(() => {
        setPinError('');
    }, [fee, setPinError]);
    
    useEffect(() => {
        // If the modal opens due to a staged fee, use its amount
        setAmountToPay(stagedFee ? stagedFee.amountToPay : remainingAmount);
    }, [stagedFee, remainingAmount, isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (amountToPay <= 0) {
            setPinError("Amount to pay must be positive.");
            return;
        }
        if (amountToPay > remainingAmount) {
            setPinError("Amount to pay cannot exceed the remaining fee balance.");
            return;
        }
        if (pin.length !== 4) {
            setPinError("Please enter your 4-digit PIN.");
            return;
        }

        try {
            eWalletService.verifyPin(currentUser.studentId, pin);
            onPay(fee.id, amountToPay);
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                <h3 className="text-xl font-bold text-white">Pay School Fee: {fee.title}</h3>
                <div className="bg-gray-700 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Total Fee:</span> <strong>UGX {fee.totalAmount.toLocaleString()}</strong></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Paid:</span> <span className="text-green-400">UGX {totalPaid.toLocaleString()}</span></div>
                    <div className="flex justify-between text-lg font-bold border-t border-gray-600 pt-2"><span className="text-gray-400">Remaining:</span> <span className="text-yellow-400">UGX {remainingAmount.toLocaleString()}</span></div>
                </div>
                
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300 block">Amount to Pay (UGX)</label>
                    <input
                        type="number"
                        value={amountToPay}
                        onChange={e => {setAmountToPay(Number(e.target.value)); setPinError('');}}
                        min="0"
                        max={remainingAmount}
                        className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300 block">Enter PIN to Confirm</label>
                     <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-900 rounded-md"/>
                </div>
                {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => {onClose(); setPinError('');}} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-cyan-600 rounded">Pay Now</button>
                </div>
            </div>
        </div>
    );
};


interface EWalletPageProps {
    user: User | AdminUser;
    stagedMarketplaceOrder?: StagedMarketplaceOrder | null;
    onFinishShopping?: () => void;
    stagedCanteenOrder?: StagedCanteenOrder | null;
    onProceedWithCanteenOrder?: () => void;
    stagedTransferPayment?: StagedTransferPayment | null;
    onProceedWithTransferPayment?: () => void;
}

const EWalletPage: React.FC<EWalletPageProps> = ({ user, stagedMarketplaceOrder, onFinishShopping, stagedCanteenOrder, onProceedWithCanteenOrder, stagedTransferPayment, onProceedWithTransferPayment }) => {
    const [view, setView] = useState<'dashboard' | 'transactions' | 'receipts' | 'bursaries'>('dashboard');
    const [wallet, setWallet] = useState<EWallet | null>(null);
    const [transactions, setTransactions] = useState<EWalletTransaction[]>([]);
    const [schoolFees, setSchoolFees] = useState<SchoolFee[]>([]);
    const [pinResetRequests, setPinResetRequests] = useState<PinResetRequest[]>([]);
    const [schoolUsers, setSchoolUsers] = useState<User[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [stagedSchoolFee, setStagedSchoolFee] = useState<StagedSchoolFee | null>(null);
    const [bursaries, setBursaries] = useState<EWalletTransaction[]>([]);

    const [modal, setModal] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [currentAction, setCurrentAction] = useState<(() => void) | null>(null);
    
    // State for modal inputs
    const [topUpAmount, setTopUpAmount] = useState(0);
    const [selectedTopUpMethod, setSelectedTopUpMethod] = useState<TopUpMethod>('mobile_money');
    const [payAmount, setPayAmount] = useState(0);
    const [payRecipientSearch, setPayRecipientSearch] = useState('');
    const [payRecipientResults, setPayRecipientResults] = useState<(User | AdminUser)[]>([]);
    const [selectedPayRecipient, setSelectedPayRecipient] = useState<User | AdminUser | null>(null);
    const [withdrawAmount, setWithdrawAmount] = useState(0);
    const [withdrawRecipient, setWithdrawRecipient] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmNewPin, setConfirmNewPin] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
     // State for disbursement modal
    const [disbursementAmount, setDisbursementAmount] = useState<number>(0);
    const [disbursementDescription, setDisbursementDescription] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [disbursementCategory, setDisbursementCategory] = useState<SchoolUserRole | 'all' | 'staff'>('student');
    const [disbursementType, setDisbursementType] = useState<TransactionType>('disbursement');


    // State for add fee modal
    const [feeModalTab, setFeeModalTab] = useState<'manual' | 'bulk'>('manual');
    const [feeForm, setFeeForm] = useState({
        title: '',
        term: 'Term 1',
        year: new Date().getFullYear(),
        targetClasses: [] as string[],
        baseAmount: 0,
        items: [] as Omit<SchoolFeeItem, 'id'>[],
        dueDate: '',
    });
    const [newItem, setNewItem] = useState({ name: '', amount: 0 });
    const [isClassesDropdownOpen, setIsClassesDropdownOpen] = useState(false);
    const classesDropdownRef = useRef<HTMLDivElement>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [bulkUploadFeedback, setBulkUploadFeedback] = useState<{ successes: number; errors: string[] } | null>(null);

    // New state for filtering and sorting
    const [filteredTransactions, setFilteredTransactions] = useState<EWalletTransaction[]>([]);
    const [filterType, setFilterType] = useState('all');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [sortOption, setSortOption] = useState('newest');

    // New state for dashboard redesign
    const [showBalance, setShowBalance] = useState(true);

    // New state for student fees payment modal
    const [isFeePaymentModalOpen, setIsFeePaymentModalOpen] = useState(false);
    const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<SchoolFee | null>(null);


    const isStudent = 'studentId' in user && user.role === 'student';
    const isHeadteacher = 'assignedSchoolIds' in user && (user as AdminUser).role === 'headteacher' && (user as AdminUser).assignedSchoolIds.length > 0;
    const isSuperadmin = 'role' in user && user.role === 'superadmin';

    const currentUserId = 'studentId' in user ? user.studentId : user.id;
    const schoolId = isStudent ? user.schoolId : isHeadteacher ? (user as AdminUser).assignedSchoolIds[0] : undefined;

    const refreshData = useCallback(() => {
        setWallet(eWalletService.getWalletForUser(currentUserId));
        setStagedSchoolFee(eWalletService.getStagedSchoolFeePayment());

        if (isSuperadmin) {
            setTransactions(eWalletService.getTransactionsForUser(currentUserId));
            setPinResetRequests(eWalletService.getPinResetRequestsForSuperadmin());
            setReceipts(receiptService.getReceiptsForUser(currentUserId));
        } else if (isHeadteacher && schoolId) {
            const users = studentService.getSchoolUsersBySchoolIds([schoolId]);
            setSchoolUsers(users);
            setTransactions(eWalletService.getTransactionsForUser(currentUserId));
            setSchoolFees(eWalletService.getSchoolFees(schoolId));
            setPinResetRequests(eWalletService.getPinResetRequestsForSchool(schoolId));
            setClasses(classService.getClassesForSchool(schoolId));
            const personalReceipts = receiptService.getReceiptsForUser(currentUserId);
            setReceipts(personalReceipts);
            setBursaries(eWalletService.getSchoolBursaries(schoolId));
        } else { 
            setTransactions(eWalletService.getTransactionsForUser(currentUserId));
            setReceipts(receiptService.getReceiptsForUser(currentUserId));
            if (isStudent && schoolId) {
                setSchoolFees(eWalletService.getSchoolFees(schoolId));
            }
        }
        
    }, [currentUserId, isStudent, isHeadteacher, schoolId, isSuperadmin]);


    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Effect for recipient search
    useEffect(() => {
        if (payRecipientSearch.length > 2 && !selectedPayRecipient && schoolId) {
            const allSchoolUsers = studentService.getAllSchoolUsers();
            const allAdmins = userService.getAllAdminUsers();
            const allUsers = [...allSchoolUsers, ...allAdmins];
            
            // Filter for users within the same school
            const usersInSchool = allUsers.filter(u => {
                if ('schoolId' in u) { // SchoolUser (student, teacher, etc.)
                    return u.schoolId === schoolId;
                }
                if ('assignedSchoolIds' in u) { // AdminUser (headteacher)
                    return u.assignedSchoolIds.includes(schoolId);
                }
                return false;
            });

            const results = usersInSchool.filter(u => {
                const userId = 'studentId' in u ? u.studentId : u.id;
                return userId !== currentUserId && (
                    u.name.toLowerCase().includes(payRecipientSearch.toLowerCase()) ||
                    userId.toLowerCase().includes(payRecipientSearch.toLowerCase())
                );
            });
            setPayRecipientResults(results);
        } else {
            setPayRecipientResults([]);
        }
    }, [payRecipientSearch, selectedPayRecipient, currentUserId, schoolId]);

    // Filtering and Sorting Logic
    useEffect(() => {
        let processedTransactions = [...transactions];

        if (filterType !== 'all') {
            processedTransactions = processedTransactions.filter(tx => tx.type === filterType);
        }

        if (filterStartDate) {
            const startDate = new Date(filterStartDate);
            startDate.setHours(0, 0, 0, 0);
            processedTransactions = processedTransactions.filter(tx => tx.timestamp >= startDate.getTime());
        }
        if (filterEndDate) {
            const endDate = new Date(filterEndDate);
            endDate.setHours(23, 59, 59, 999);
            processedTransactions = processedTransactions.filter(tx => tx.timestamp <= endDate.getTime());
        }

        processedTransactions.sort((a, b) => {
            switch (sortOption) {
                case 'oldest':
                    return a.timestamp - b.timestamp;
                case 'amount-desc':
                    return Math.abs(b.amount) - Math.abs(a.amount);
                case 'amount-asc':
                    return Math.abs(a.amount) - Math.abs(b.amount);
                case 'newest':
                default:
                    return b.timestamp - a.timestamp;
            }
        });

        setFilteredTransactions(processedTransactions);
    }, [transactions, filterType, filterStartDate, filterEndDate, sortOption]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (classesDropdownRef.current && !classesDropdownRef.current.contains(event.target as Node)) {
                setIsClassesDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    const showFeedback = (message: string) => {
        setFeedbackMessage(message);
        setTimeout(() => setFeedbackMessage(''), 4000);
    };
    
    const handleActionWithPin = (action: () => void) => {
        setCurrentAction(() => action);
        setModal('pin');
    };

    const handlePinSubmit = () => {
        setPinError('');
        try {
            eWalletService.verifyPin(currentUserId, pin);
            currentAction?.();
            setModal(null);
            setPin('');
            setCurrentAction(null);
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    const handleSetNewPin = () => {
        setPinError('');
        if (newPin !== confirmNewPin) {
            setPinError("PINs do not match.");
            return;
        }
        try {
            eWalletService.setPin(currentUserId, newPin);
            refreshData();
            showFeedback("Your PIN has been set successfully!");
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    const handleRequestPinReset = () => {
        try {
            if ('studentId' in user && user.role === 'student') {
                eWalletService.requestPinResetForStudent(user as User);
                showFeedback("A PIN reset request has been sent to the school administration.");
            } else if ('assignedSchoolIds' in user) {
                eWalletService.requestPinResetForAdmin(user as AdminUser);
                showFeedback("A PIN reset request has been sent to the super administrator.");
            } else {
                setPinError("PIN reset is not available for your user type.");
                return;
            }
            setModal(null);
            setPin('');
            setPinError('');
        } catch (error) {
            setPinError((error as Error).message);
        }
    };
    
    const handleApprovePinReset = (requestId: string) => {
        try {
            eWalletService.approvePinReset(requestId);
            refreshData();
            showFeedback("PIN has been successfully reset for the user.");
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleTopUp = () => {
        try {
            eWalletService.topUpWallet(currentUserId, topUpAmount, selectedTopUpMethod);
            refreshData();
            setModal(null);
            showFeedback(`Successfully topped up ${formatCurrency(topUpAmount)}`);
            setTopUpAmount(0);
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handlePay = () => {
        if (!selectedPayRecipient) {
            alert("Please select a valid recipient from the search results.");
            return;
        }
        try {
            const recipientId = 'studentId' in selectedPayRecipient ? selectedPayRecipient.studentId : selectedPayRecipient.id;
            eWalletService.makePayment(currentUserId, recipientId, payAmount, `Payment`);
            refreshData();
            showFeedback(`Successfully paid ${formatCurrency(payAmount)} to ${selectedPayRecipient.name}`);
            setPayAmount(0);
            setPayRecipientSearch('');
            setSelectedPayRecipient(null);
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleWithdraw = () => {
        try {
            eWalletService.withdrawFromWallet(currentUserId, withdrawAmount, 'mobile_money', withdrawRecipient);
            refreshData();
            showFeedback(`Successfully withdrew ${formatCurrency(withdrawAmount)}`);
            setWithdrawAmount(0);
            setWithdrawRecipient('');
        } catch (error) {
            alert((error as Error).message);
        }
    };
    
    const handlePayFee = (feeId: string, amountToPay: number) => {
        try {
            eWalletService.paySchoolFee(currentUserId, feeId, amountToPay);
            eWalletService.clearStagedSchoolFeePayment(); 
            refreshData();
            setIsFeePaymentModalOpen(false);
            showFeedback(`Successfully paid UGX ${amountToPay.toLocaleString()} towards fee.`);
        } catch (error) {
            const err = error as Error;
            if (err.message === 'INSUFFICIENT_FUNDS') {
                setIsFeePaymentModalOpen(false);
                refreshData();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setPinError(err.message);
            }
        }
    };
    
    const handleInitiateFeePayment = (fee: SchoolFee) => {
        setSelectedFeeForPayment(fee);
        setIsFeePaymentModalOpen(true);
    };

    const handleProceedWithStagedFeePayment = () => {
        if (!stagedSchoolFee) return;
        const feeToPay = schoolFees.find(f => f.id === stagedSchoolFee.feeId);
        if (feeToPay) {
            setSelectedFeeForPayment(feeToPay);
            setIsFeePaymentModalOpen(true);
        }
    };
    
    const handleBulkDisbursement = () => {
        if (selectedUserIds.length === 0) {
            setPinError("Please select at least one user.");
            return;
        }
        if (disbursementAmount <= 0) {
            setPinError("Amount must be greater than zero.");
            return;
        }
        if (!disbursementDescription.trim()) {
            setPinError("Description is required.");
            return;
        }
        setPinError('');
    
        try {
            eWalletService.processBulkDisbursement(
                { id: currentUserId, name: user.name }, 
                selectedUserIds, 
                disbursementAmount, 
                disbursementDescription, 
                disbursementType
            );
            const typeLabel = disbursementType === 'bursary_credit' ? 'Bursary' : 'Disbursement';
            showFeedback(`${typeLabel} of ${formatCurrency(disbursementAmount)} sent to ${selectedUserIds.length} users.`);
            refreshData();
            setModal(null);
            setDisbursementAmount(0);
            setDisbursementDescription('');
            setSelectedUserIds([]);
            setDisbursementCategory('student');
            setDisbursementType('disbursement');
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    const handleAddFee = () => {
        setPinError('');
        if (!feeForm.title.trim() || !feeForm.term || !feeForm.year || !feeForm.dueDate) {
            setPinError("Please fill in all required fee details.");
            return;
        }
        if (feeForm.targetClasses.length === 0) {
            setPinError("Please select at least one target class.");
            return;
        }
        try {
            eWalletService.createSchoolFee({
                schoolId: schoolId!,
                title: feeForm.title,
                term: feeForm.term,
                year: feeForm.year,
                targetClasses: feeForm.targetClasses,
                baseAmount: feeForm.baseAmount,
                items: feeForm.items,
                dueDate: new Date(feeForm.dueDate).getTime(),
            });
            showFeedback(`Successfully created fee: ${feeForm.title}.`);
            refreshData();
            setModal(null);
            setFeeForm({ title: '', term: 'Term 1', year: new Date().getFullYear(), targetClasses: [], baseAmount: 0, items: [], dueDate: '' });
        } catch (error) {
            setPinError((error as Error).message);
        }
    };

    const handleBulkFeeUpload = () => {
        if (!csvFile || !schoolId) {
            setBulkUploadFeedback({ successes: 0, errors: ["Please select a CSV file to upload."] });
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target?.result as string;
            const result = eWalletService.bulkCreateSchoolFeesFromCSV(csvText, schoolId);
            setBulkUploadFeedback(result);
            if (result.successes > 0) {
                refreshData();
            }
        };
        reader.readAsText(csvFile);
    };

    const handleDownloadReceipt = (receipt: Receipt) => {
        // Simple print mechanism for a single receipt
        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            const content = `
                <html>
                    <head>
                        <title>Receipt - ${receipt.id}</title>
                        <style>
                            body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; }
                            .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
                            .amount { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; }
                            .details { margin-bottom: 20px; }
                            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                            .label { color: #666; font-weight: bold; }
                            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Transaction Receipt</h1>
                            <p>${new Date(receipt.timestamp).toLocaleString()}</p>
                        </div>
                        <div class="amount">
                            ${receipt.amount < 0 ? '-' : '+'} UGX ${Math.abs(receipt.amount).toLocaleString()}
                        </div>
                        <div class="details">
                            <div class="row"><span class="label">ID:</span><span>${receipt.transactionId}</span></div>
                            <div class="row"><span class="label">Type:</span><span>${receipt.type.replace('_', ' ')}</span></div>
                            <div class="row"><span class="label">Party:</span><span>${receipt.partyName}</span></div>
                            <div class="row"><span class="label">Description:</span><span>${receipt.description}</span></div>
                            <div class="row"><span class="label">Status:</span><span>Completed</span></div>
                        </div>
                        ${receipt.items && receipt.items.length > 0 ? `
                            <div class="details">
                                <p class="label">Items:</p>
                                ${receipt.items.map(i => `<div class="row"><span>${i.quantity}x ${i.name}</span><span>${i.price.toLocaleString()}</span></div>`).join('')}
                            </div>
                        ` : ''}
                        <div class="footer">
                            <p>Generated by 360 Smart School E-Wallet</p>
                        </div>
                    </body>
                </html>
            `;
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handleDownloadAllReceipts = () => {
        if (receipts.length === 0) {
            alert("No receipts to download.");
            return;
        }

        const printWindow = window.open('', '', 'width=800,height=1000');
        if (printWindow) {
            const rows = receipts.map(r => `
                <tr>
                    <td>${new Date(r.timestamp).toLocaleDateString()}</td>
                    <td>${r.transactionId}</td>
                    <td>${r.type.replace('_', ' ')}</td>
                    <td>${r.description}</td>
                    <td style="text-align:right; color:${r.amount < 0 ? 'red' : 'green'}">${r.amount.toLocaleString()}</td>
                </tr>
            `).join('');

            const content = `
                <html>
                    <head>
                        <title>Transaction History - ${user.name}</title>
                        <style>
                            body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
                            h1 { text-align: center; margin-bottom: 10px; }
                            p { text-align: center; color: #666; margin-bottom: 30px; }
                            table { width: 100%; border-collapse: collapse; font-size: 12px; }
                            th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
                            th { background-color: #f8f9fa; font-weight: bold; }
                            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
                        </style>
                    </head>
                    <body>
                        <h1>Transaction History Report</h1>
                        <p>Generated for ${user.name} on ${new Date().toLocaleString()}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th style="text-align:right">Amount (UGX)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                        <div class="footer">
                            <p>360 Smart School E-Wallet</p>
                        </div>
                    </body>
                </html>
            `;
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const staffRoles: SchoolUserRole[] = useMemo(() => ['teacher', 'head_of_department', 'canteen_seller', 'deputy_headteacher', 'carrier', 'parent', 'old_student'], []);

    const filteredUsersByCategory = useMemo(() => {
        if (!schoolUsers) return [];
        if (disbursementCategory === 'all') return schoolUsers;
        if (disbursementCategory === 'staff') return schoolUsers.filter(u => staffRoles.includes(u.role));
        return schoolUsers.filter(u => u.role === disbursementCategory);
    }, [disbursementCategory, schoolUsers, staffRoles]);

    const filteredUsersForDisbursement = useMemo(() => {
        if (!userSearchTerm) return filteredUsersByCategory;
        return filteredUsersByCategory.filter(s =>
            s.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            s.studentId.toLowerCase().includes(userSearchTerm.toLowerCase())
        );
    }, [filteredUsersByCategory, userSearchTerm]);

    const handleSelectUser = (userId: string, isChecked: boolean) => {
        setSelectedUserIds(prev => isChecked ? [...prev, userId] : prev.filter(id => id !== userId));
    };

    const handleSelectAllDisbursementUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedUserIds(filteredUsersForDisbursement.map(s => s.studentId));
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleViewReceipt = (txn: EWalletTransaction) => {
        // Find associated receipt
        const receipt = receipts.find(r => r.transactionId === txn.id);
        if (receipt) {
            setSelectedReceipt(receipt);
        } else {
            // Fallback if no receipt found (shouldn't happen with new logic, but handles legacy data)
            alert("No detailed receipt available for this transaction.");
        }
    };


     if (wallet && !wallet.pin) {
        return (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 text-center max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-white mb-4">Set Up Your E-Wallet PIN</h2>
                <p className="text-gray-400 mb-6">Create a 4-digit PIN to secure your wallet and approve transactions.</p>
                <div className="space-y-4">
                    <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} maxLength={4} placeholder="Enter 4-digit PIN" className="w-full p-3 text-xl text-center tracking-[1rem] bg-gray-700 rounded-md" />
                    <input type="password" value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))} maxLength={4} placeholder="Confirm PIN" className="w-full p-3 text-xl text-center tracking-[1rem] bg-gray-700 rounded-md" />
                </div>
                {pinError && <p className="text-red-400 text-sm mt-4">{pinError}</p>}
                <button onClick={handleSetNewPin} className="w-full mt-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">Save PIN</button>
            </div>
        );
    }

    const renderTransactionItem = (tx: EWalletTransaction, index?: number) => {
        const isCredit = tx.amount > 0;
        const description = isCredit && tx.senderName
            ? `${tx.description} from ${tx.senderName}`
            : tx.description;

        return (
            <div 
                key={tx.id || index} 
                onClick={() => handleViewReceipt(tx)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700/50 cursor-pointer group"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                        {isCredit ? <ArrowDownCircleIcon /> : <PaperAirplaneIcon />}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-200 group-hover:text-white transition-colors">{description}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                </div>
                <p className={`font-semibold text-lg ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isCredit ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
            </div>
        );
    };

    const renderBursaryTrackingView = () => {
        const totalBursaries = bursaries.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
        return (
            <div className="space-y-6 animate-fade-in-up">
                <header className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Bursary Tracking</h2>
                    <button onClick={() => setView('dashboard')} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md font-semibold text-gray-300 border border-gray-700">&larr; Back</button>
                </header>
                
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-lg text-white">
                    <p className="text-lg opacity-80">Total Bursaries Awarded</p>
                    <p className="text-4xl font-bold">{formatCurrency(totalBursaries)}</p>
                    <p className="text-sm mt-2 opacity-70">Across {bursaries.length} transactions</p>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4">Bursary History</h3>
                    {bursaries.length > 0 ? (
                        <div className="space-y-3">
                            {bursaries.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                         <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{tx.senderName || 'Student'} <span className="text-xs text-gray-400">({tx.senderId})</span></p>
                                            <p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-500 italic mt-1">{tx.description}</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-indigo-400">{formatCurrency(Math.abs(tx.amount))}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">No bursaries have been disbursed yet.</p>
                    )}
                </div>
            </div>
        );
    };

    const renderPersonalWalletDashboard = () => {
        const mockBalance = wallet?.balance ?? 0;
        
        const quickContacts = schoolId 
            ? studentService.getSchoolUsersBySchoolIds([schoolId])
                .filter(u => u.studentId !== currentUserId)
                .slice(0, 4)
            : [];
        
        const handleQuickContactClick = (contact: User) => {
            setSelectedPayRecipient(contact);
            setPayRecipientSearch(contact.name);
            setModal('pay');
        };

        const applicableFees = isStudent && 'class' in user && user.class
            ? schoolFees.filter(fee => fee.targetClasses.includes(user.class!))
            : [];

        const stagedFee = stagedSchoolFee ? schoolFees.find(f => f.id === stagedSchoolFee.feeId) : null;

        return (
          <div className="animate-fade-in-up space-y-8 text-white">
             {/* STAGED MARKETPLACE ORDER BANNER */}
             {stagedMarketplaceOrder && onFinishShopping && (
                <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up ${mockBalance >= stagedMarketplaceOrder.totalAmount ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                    {mockBalance >= stagedMarketplaceOrder.totalAmount ? (
                         <div>
                            <h3 className="font-bold text-green-400 text-lg">Funds Ready for Shopping!</h3>
                            <p className="text-gray-400 text-sm">Your balance is sufficient to complete your order of UGX {stagedMarketplaceOrder.totalAmount.toLocaleString()}.</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-bold text-yellow-400 text-lg">Insufficient Funds for Shopping</h3>
                            <p className="text-gray-400 text-sm">Please top up your E-Wallet to complete the order of UGX {stagedMarketplaceOrder.totalAmount.toLocaleString()}.</p>
                        </div>
                    )}
                    {mockBalance >= stagedMarketplaceOrder.totalAmount && (
                         <button onClick={onFinishShopping} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                            Finish Shopping
                        </button>
                    )}
                </div>
            )}

            {/* STAGED FEE BANNER */}
            {stagedFee && (
                <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up ${mockBalance >= stagedFee.totalAmount ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                    {mockBalance >= stagedFee.totalAmount ? (
                         <div>
                            <h3 className="font-bold text-green-400 text-lg">Funds Ready for School Fee!</h3>
                            <p className="text-gray-400 text-sm">Your balance is now sufficient to pay for {stagedFee.title}.</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-bold text-yellow-400 text-lg">Insufficient Funds for School Fee</h3>
                            <p className="text-gray-400 text-sm">Please top up your E-Wallet to complete the payment for {stagedFee.title}.</p>
                        </div>
                    )}
                    {mockBalance >= stagedFee.totalAmount && (
                         <button onClick={handleProceedWithStagedFeePayment} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                            Proceed with Fees Payment
                        </button>
                    )}
                </div>
            )}

             {/* STAGED CANTEEN ORDER BANNER */}
             {stagedCanteenOrder && onProceedWithCanteenOrder && (
                <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up ${mockBalance >= stagedCanteenOrder.totalAmount ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                    {mockBalance >= stagedCanteenOrder.totalAmount ? (
                         <div>
                            <h3 className="font-bold text-green-400 text-lg">Funds Ready for Canteen Order!</h3>
                            <p className="text-gray-400 text-sm">Your balance is sufficient to complete your order of UGX {stagedCanteenOrder.totalAmount.toLocaleString()}.</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-bold text-yellow-400 text-lg">Insufficient Funds for Canteen</h3>
                            <p className="text-gray-400 text-sm">Please top up your E-Wallet to complete the order of UGX {stagedCanteenOrder.totalAmount.toLocaleString()}.</p>
                        </div>
                    )}
                    {mockBalance >= stagedCanteenOrder.totalAmount && (
                         <button onClick={onProceedWithCanteenOrder} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                            Proceed with Order
                        </button>
                    )}
                </div>
            )}
            
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-[#3D339D] to-[#25206C] p-6 rounded-[20px] shadow-lg relative text-white/90">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm text-white/70">Balance</p>
                        <p className="text-3xl font-bold mt-1">
                            {showBalance ? formatCurrency(mockBalance) : '∗∗∗∗∗∗∗∗'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowBalance(!showBalance)} aria-label="Toggle balance visibility" className="text-white/70 hover:text-white">
                            {showBalance ? <EyeOffIcon/> : <EyeIcon />}
                        </button>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/ac/Old_Visa_Logo.svg" alt="VISA" className="h-4" />
                    </div>
                </div>
                <div className="mt-8 flex justify-between items-end font-mono tracking-widest text-lg">
                    <span>∗∗∗∗</span>
                    <span>∗∗∗∗</span>
                    <span>∗∗∗∗</span>
                    <span className="text-xl">1234</span>
                </div>
                 <div className="mt-2 text-right text-xs text-white/70 font-mono">12/24</div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <button onClick={() => { setTopUpAmount(0); setSelectedTopUpMethod('mobile_money'); setModal('top-up'); }} className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 border border-gray-700">
                    <PlusCircleIcon />
                    <span className="text-xs font-medium">Top Up</span>
                </button>
                <button onClick={() => setModal('pay')} className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 border border-gray-700">
                    <QrCodeIcon />
                    <span className="text-xs font-medium">Scan</span>
                </button>
                <button onClick={() => setModal('pay')} className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 border border-gray-700">
                    <PaperAirplaneIcon />
                    <span className="text-xs font-medium">Send</span>
                </button>
                <button onClick={() => setModal('withdraw')} className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 border border-gray-700">
                    <ArrowDownCircleIcon />
                    <span className="text-xs font-medium">Withdraw</span>
                </button>
                <button onClick={() => setView('receipts')} className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 border border-gray-700">
                    <DocumentTextIcon />
                    <span className="text-xs font-medium">Receipts</span>
                </button>
            </div>

            {/* Quick Transaction */}
            <div>
                <h3 className="text-xl font-semibold mb-4">Quick Transaction</h3>
                <div className="flex items-center gap-4">
                     <button onClick={() => setView('transactions')} className="flex flex-col items-center gap-2 text-center w-16">
                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center text-gray-400 hover:bg-gray-700/50">
                            <ArrowRightIcon />
                        </div>
                        <span className="text-xs text-gray-400">View All</span>
                    </button>
                    {quickContacts.map(contact => (
                         <button key={contact.studentId} onClick={() => handleQuickContactClick(contact)} className="flex flex-col items-center gap-2 text-center w-16">
                            <UserAvatar name={contact.name} avatarUrl={contact.avatarUrl} className="w-14 h-14 rounded-full object-cover" />
                            <span className="text-xs truncate w-full">{contact.name.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* School Fees Section for Students */}
            {isStudent && applicableFees.length > 0 && (
                <div>
                    <h3 className="text-xl font-semibold mb-4">School Fees</h3>
                    <div className="space-y-4">
                        {applicableFees.map(fee => {
                            const studentPayments = fee.payments[currentUserId] || [];
                            const totalPaid = studentPayments.reduce((sum, p) => sum + p.paidAmount, 0);
                            const remaining = fee.totalAmount - totalPaid;
                            const isPaid = remaining <= 0;

                            return (
                                <button
                                    key={fee.id}
                                    onClick={() => !isPaid && handleInitiateFeePayment(fee)}
                                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700/50 ${isPaid ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    disabled={isPaid}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/20">
                                            <SchoolFeeIcon />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-200">{fee.title}</p>
                                            <p className="text-xs text-gray-500">Due: {new Date(fee.dueDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold text-lg ${isPaid ? 'text-green-400' : 'text-rose-400'}`}>
                                            {isPaid ? 'PAID' : formatCurrency(remaining)}
                                        </p>
                                        {!isPaid && <p className="text-xs text-gray-500">Remaining</p>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Transactions List */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Recent Transactions</h3>
                    <button onClick={() => setView('transactions')} className="text-sm text-cyan-400 font-medium hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                    {filteredTransactions.slice(0, 3).map((tx, index) => renderTransactionItem(tx, index))}
                </div>
            </div>
          </div>
        );
    };

    const renderHeadteacherDashboard = () => {
        const wallet = eWalletService.getWalletForUser(user.id);
        const mockBalance = wallet.balance;

        return (
             <div className="space-y-8 animate-fade-in-up">
                {stagedMarketplaceOrder && onFinishShopping && (
                    <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up ${mockBalance >= stagedMarketplaceOrder.totalAmount ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                        {mockBalance >= stagedMarketplaceOrder.totalAmount ? (
                             <div>
                                <h3 className="font-bold text-green-400 text-lg">Funds Ready for Shopping!</h3>
                                <p className="text-gray-400 text-sm">Your balance is sufficient to complete your order of UGX {stagedMarketplaceOrder.totalAmount.toLocaleString()}.</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-bold text-yellow-400 text-lg">Insufficient Funds for Shopping</h3>
                                <p className="text-gray-400 text-sm">Please top up your E-Wallet to complete the order of UGX {stagedMarketplaceOrder.totalAmount.toLocaleString()}.</p>
                            </div>
                        )}
                        {mockBalance >= stagedMarketplaceOrder.totalAmount && (
                             <button onClick={onFinishShopping} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                                Finish Shopping
                            </button>
                        )}
                    </div>
                )}
                
                {stagedTransferPayment && onProceedWithTransferPayment && (
                    <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up ${mockBalance >= stagedTransferPayment.amount ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                        {mockBalance >= stagedTransferPayment.amount ? (
                             <div>
                                <h3 className="font-bold text-green-400 text-lg">Funds Ready for Transfer Payment!</h3>
                                <p className="text-gray-400 text-sm">Your balance is sufficient to complete the transfer payment of UGX {stagedTransferPayment.amount.toLocaleString()}.</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-bold text-yellow-400 text-lg">Insufficient Funds for Transfer</h3>
                                <p className="text-gray-400 text-sm">Please top up your E-Wallet to complete the transfer payment of UGX {stagedTransferPayment.amount.toLocaleString()}.</p>
                            </div>
                        )}
                        {mockBalance >= stagedTransferPayment.amount && (
                             <button onClick={onProceedWithTransferPayment} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                                Proceed with Payment
                            </button>
                        )}
                    </div>
                )}

                <div>
                    <h3 className="text-xl font-bold mb-4 text-white">Your Personal Wallet</h3>
                     <div className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white p-6 rounded-2xl shadow-xl">
                        <p className="text-lg opacity-80">Available Balance</p>
                        <p className="text-4xl font-bold">{formatCurrency(wallet?.balance || 0)}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                        <button onClick={() => { setTopUpAmount(0); setSelectedTopUpMethod('mobile_money'); setModal('top-up'); }} className="p-4 bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-700">
                            <PlusCircleIcon />
                            <span className="text-sm font-medium">Top-up</span>
                        </button>
                        <button onClick={() => setModal('pay')} className="p-4 bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-700">
                            <QrCodeIcon />
                            <span className="text-sm font-medium">Pay</span>
                        </button>
                        <button onClick={() => setModal('withdraw')} className="p-4 bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-700">
                            <ArrowDownCircleIcon />
                            <span className="text-sm font-medium">Withdraw</span>
                        </button>
                        <button onClick={() => setView('receipts')} className="p-4 bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-700">
                            <DocumentTextIcon />
                            <span className="text-sm font-medium">Receipts</span>
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-4 text-white">School Finance Management</h3>
                     <div className="flex flex-wrap gap-4 mt-4">
                        <button onClick={() => setModal('disbursement')} className="p-4 bg-cyan-800 rounded-xl flex items-center justify-center space-x-2 hover:bg-cyan-700 border border-cyan-600">
                            <span>Bulk Disbursement</span>
                        </button>
                        <button onClick={() => setView('bursaries')} className="p-4 bg-indigo-600 rounded-xl flex items-center justify-center space-x-2 hover:bg-indigo-500 border border-indigo-400">
                            <span>Track Bursaries</span>
                        </button>
                        <button onClick={() => setModal('add-fee')} className="p-4 bg-gray-800 rounded-xl flex items-center justify-center space-x-2 hover:bg-gray-700">
                            <span>Add School Fee</span>
                        </button>
                        <button onClick={() => setView('transactions')} className="p-4 bg-gray-800 rounded-xl flex items-center justify-center space-x-2 hover:bg-gray-700">
                             <span>View All Transactions</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTransactionsView = () => {
        const applicableFees = isStudent && 'class' in user
            ? schoolFees.filter(fee => fee.targetClasses.includes((user as User).class || ''))
            : schoolFees;

        return (
            <div className="space-y-6 animate-fade-in-up pb-8">
                <header className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Financial Dashboard</h2>
                    <button onClick={() => setView('dashboard')} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md font-semibold text-gray-300 border border-gray-700">&larr; Back</button>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <DashboardCard title="Recurring" className="lg:col-span-1">
                        <div className="space-y-3 mt-1">
                            {applicableFees.length > 0 ? (
                                applicableFees.map(fee => {
                                    const studentPayments = fee.payments[currentUserId] || [];
                                    const totalPaid = studentPayments.reduce((sum, p) => sum + p.paidAmount, 0);
                                    const remaining = fee.totalAmount - totalPaid;
                                    const isPaid = remaining <= 0;

                                    return (
                                        <button
                                            key={fee.id}
                                            onClick={() => !isPaid && handleInitiateFeePayment(fee)}
                                            className={`w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors ${isPaid ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            disabled={isPaid}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
                                                    <SchoolFeeIcon />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-200">{fee.title}</p>
                                                    <p className="text-xs text-gray-500">Due: {new Date(fee.dueDate).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${isPaid ? 'text-green-400' : 'text-rose-400'}`}>
                                                    {isPaid ? 'PAID' : formatCurrency(remaining)}
                                                </p>
                                                {!isPaid && <p className="text-xs text-gray-500">Remaining</p>}
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <p className="text-gray-500 text-sm text-center py-4">No recurring fees found for your class.</p>
                            )}
                        </div>
                    </DashboardCard>
                </div>
                <div className="bg-gray-800 rounded-[20px] p-6 shadow-lg mt-6">
                     <h3 className="text-lg font-bold text-white mb-4">Transaction History</h3>
                     <div className="space-y-2">
                        {filteredTransactions.length > 0 ? (
                            filteredTransactions.map((tx, index) => renderTransactionItem(tx, index))
                        ) : (
                            <div className="text-center py-8 text-gray-500">No transactions found.</div>
                        )}
                     </div>
                </div>
            </div>
        );
    };

    const renderReceiptsView = () => {
        return (
            <div className="space-y-6 animate-fade-in-up pb-8">
                 <header className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">My Receipts</h2>
                    <button onClick={() => setView('dashboard')} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md font-semibold text-gray-300 border border-gray-700">&larr; Back</button>
                </header>

                <div className="flex justify-end mb-4">
                    <button onClick={handleDownloadAllReceipts} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold text-white shadow-md">
                        <DownloadIcon />
                        <span>Download All (PDF)</span>
                    </button>
                </div>

                <div className="bg-gray-800 rounded-[20px] p-6 shadow-lg">
                    {receipts.length > 0 ? (
                        <div className="space-y-3">
                            {receipts.map((receipt) => (
                                <div key={receipt.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-4 mb-2 sm:mb-0">
                                        <div className="bg-gray-600 p-2 rounded-full">
                                            <DocumentTextIcon />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{receipt.description}</p>
                                            <p className="text-xs text-gray-400">{new Date(receipt.timestamp).toLocaleString()} • ID: {receipt.transactionId.slice(-8)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                        <p className={`font-bold ${receipt.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {receipt.amount < 0 ? '-' : '+'} {formatCurrency(Math.abs(receipt.amount))}
                                        </p>
                                        <div className="flex gap-2">
                                             <button 
                                                onClick={() => setSelectedReceipt(receipt)}
                                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-semibold"
                                            >
                                                View
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadReceipt(receipt)}
                                                className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-gray-300 hover:text-white"
                                                title="Download"
                                            >
                                                <DownloadIcon />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <p>No receipts found.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };
    
    return (
        <div className="h-full">
            {selectedReceipt && (
                <ReceiptModal
                    receipt={selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                    onDownload={() => handleDownloadReceipt(selectedReceipt)}
                />
            )}
            {modal === 'top-up' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4">
                        <h3 className="text-xl font-bold">Top Up Wallet</h3>
                        <p className="text-sm text-gray-400">Enter the amount you wish to add to your wallet.</p>
                        <div>
                            <label className="text-xs text-gray-400">Amount (UGX)</label>
                            <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(Number(e.target.value))} className="w-full p-2 bg-gray-700 rounded mt-1" />
                        </div>
                        <div className="text-sm text-gray-400">Select method:</div>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedTopUpMethod('mobile_money')} className={`flex-1 p-2 rounded ${selectedTopUpMethod === 'mobile_money' ? 'bg-cyan-600' : 'bg-gray-600'}`}>Mobile Money</button>
                            <button onClick={() => setSelectedTopUpMethod('card')} className={`flex-1 p-2 rounded ${selectedTopUpMethod === 'card' ? 'bg-cyan-600' : 'bg-gray-600'}`}>Card</button>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={handleTopUp} className="px-4 py-2 bg-cyan-600 rounded">Top Up</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ... (Pay, Withdraw, Pin, Disbursement, Add-Fee modals remain unchanged) ... */}
            {modal === 'pay' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold">Send Money</h3>
                        {selectedPayRecipient ? (
                             <div className="space-y-4">
                                <div className="bg-gray-700 p-3 rounded-lg"><p className="text-sm text-gray-400">Sending to:</p><div className="flex items-center gap-2 mt-1"><UserAvatar name={selectedPayRecipient.name} avatarUrl={selectedPayRecipient.avatarUrl} className="w-8 h-8 rounded-full" /><p className="font-semibold">{selectedPayRecipient.name}</p></div></div>
                                <div><label className="text-xs text-gray-400">Amount (UGX)</label><input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                <div className="flex justify-end gap-2 pt-2"><button onClick={() => { setSelectedPayRecipient(null); setPayAmount(0); }} className="px-4 py-2 bg-gray-600 rounded">Back</button><button onClick={() => handleActionWithPin(handlePay)} className="px-4 py-2 bg-cyan-600 rounded">Send</button></div>
                            </div>
                        ) : (
                             <div className="space-y-4">
                                <div><label className="text-xs text-gray-400">Recipient's Name or ID</label><input type="text" value={payRecipientSearch} onChange={e => setPayRecipientSearch(e.target.value)} placeholder="Search within your school..." className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                {payRecipientResults.length > 0 && (<div className="max-h-48 overflow-y-auto bg-gray-900/50 rounded-lg">{payRecipientResults.map(res => (<div key={'studentId' in res ? res.studentId : res.id} onClick={() => { setSelectedPayRecipient(res); setPayRecipientSearch(res.name); }} className="p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-700"><UserAvatar name={res.name} avatarUrl={res.avatarUrl} className="w-8 h-8 rounded-full" /><span>{res.name}</span></div>))}</div>)}
                                <div className="flex justify-end gap-2 pt-2"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {modal === 'withdraw' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4">
                        <h3 className="text-xl font-bold">Withdraw Funds</h3>
                        <div><label className="text-xs text-gray-400">Amount (UGX)</label><input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(Number(e.target.value))} className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                        <div><label className="text-xs text-gray-400">Recipient Mobile Money Number</label><input type="tel" value={withdrawRecipient} onChange={e => setWithdrawRecipient(e.target.value)} placeholder="e.g., 077..." className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                        <div className="flex justify-end gap-2 pt-2"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={() => handleActionWithPin(handleWithdraw)} className="px-4 py-2 bg-cyan-600 rounded">Withdraw</button></div>
                    </div>
                </div>
            )}
            {modal === 'pin' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4 text-center">
                        <h3 className="text-xl font-bold">Enter PIN</h3><p className="text-sm text-gray-400">Please enter your 4-digit PIN to authorize this transaction.</p>
                        <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-900 rounded-md"/>
                        <PinStrengthIndicator pin={pin} />
                        {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                        <div className="flex justify-center gap-2 pt-2"><button onClick={() => { setModal(null); setPin(''); setPinError(''); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handlePinSubmit} className="px-4 py-2 bg-cyan-600 rounded">Confirm</button></div>
                        <button onClick={handleRequestPinReset} className="text-xs text-cyan-400 hover:underline mt-2">Forgot PIN?</button>
                    </div>
                </div>
            )}
            {modal === 'disbursement' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl space-y-4 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold">Bulk Disbursement</h3>
                        <p className="text-sm text-gray-400">Distribute funds to multiple users in your school.</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400">Amount Per User (UGX)</label>
                                <input type="number" value={disbursementAmount} onChange={e => {setDisbursementAmount(Number(e.target.value)); setPinError('');}} min="0" className="w-full p-2 bg-gray-700 rounded mt-1"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Total Selected: {selectedUserIds.length}</label>
                                <input type="text" value={`UGX ${(disbursementAmount * selectedUserIds.length).toLocaleString()}`} disabled className="w-full p-2 bg-gray-900 rounded mt-1 text-gray-400"/>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs text-gray-400">Fund Type</label>
                            <select value={disbursementType} onChange={e => setDisbursementType(e.target.value as TransactionType)} className="w-full p-2 bg-gray-700 rounded mt-1">
                                <option value="disbursement">General Allowance</option>
                                <option value="bursary_credit">Student Bursary</option>
                                <option value="allowance">Staff Allowance</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400">Description</label>
                            <input type="text" value={disbursementDescription} onChange={e => {setDisbursementDescription(e.target.value); setPinError('');}} placeholder="e.g., Termly Allowance" className="w-full p-2 bg-gray-700 rounded mt-1"/>
                        </div>

                        <div className="flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg">
                            <select value={disbursementCategory} onChange={e => setDisbursementCategory(e.target.value as any)} className="w-full p-2 bg-gray-700 rounded-md">
                                <option value="student">Students</option>
                                <option value="teacher">Teachers</option>
                                <option value="staff">Other Staff</option>
                                <option value="all">All School Users</option>
                            </select>
                            <input type="text" value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} placeholder="Search users..." className="w-full p-2 bg-gray-700 rounded-md"/>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto pr-2 bg-gray-900/50 rounded-lg p-3">
                            <label className="flex items-center gap-2 mb-2 font-semibold">
                                <input type="checkbox" onChange={handleSelectAllDisbursementUsers} checked={selectedUserIds.length === filteredUsersForDisbursement.length && filteredUsersForDisbursement.length > 0} className="form-checkbox h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 rounded"/>
                                <span>Select All ({filteredUsersForDisbursement.length})</span>
                            </label>
                            <div className="space-y-2">
                                {filteredUsersForDisbursement.map(user => (
                                    <label key={user.studentId} className="flex items-center gap-2 p-2 bg-gray-700 rounded-md cursor-pointer hover:bg-gray-600">
                                        <input type="checkbox" checked={selectedUserIds.includes(user.studentId)} onChange={e => handleSelectUser(user.studentId, e.target.checked)} className="form-checkbox h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 rounded"/>
                                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="w-8 h-8 rounded-full"/>
                                        <span>{user.name} ({user.studentId})</span>
                                        <span className="text-xs text-gray-400 capitalize ml-auto">{user.role.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                            {filteredUsersForDisbursement.length === 0 && <p className="text-gray-400 text-center py-4">No users found for this category/search.</p>}
                        </div>

                        {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                        
                        <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
                            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={() => handleActionWithPin(handleBulkDisbursement)} className="px-4 py-2 bg-cyan-600 rounded">Disburse</button>
                        </div>
                    </div>
                </div>
            )}
            {modal === 'add-fee' && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl space-y-4 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold">Add School Fee</h3>
                        <div className="flex border-b border-gray-700 mb-4 flex-shrink-0">
                            <button onClick={() => setFeeModalTab('manual')} className={`px-4 py-2 text-sm font-semibold ${feeModalTab === 'manual' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Manual Entry</button>
                            <button onClick={() => setFeeModalTab('bulk')} className={`px-4 py-2 text-sm font-semibold ${feeModalTab === 'bulk' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Bulk Upload (CSV)</button>
                        </div>

                        {feeModalTab === 'manual' && (
                            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                                <div><label className="text-xs text-gray-400">Fee Title</label><input type="text" value={feeForm.title} onChange={e => {setFeeForm({...feeForm, title: e.target.value}); setPinError('');}} placeholder="e.g., Term 1 Tuition Fee" className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="text-xs text-gray-400">Term</label><input type="text" value={feeForm.term} onChange={e => {setFeeForm({...feeForm, term: e.target.value}); setPinError('');}} placeholder="e.g., Term 1" className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                    <div><label className="text-xs text-gray-400">Year</label><input type="number" value={feeForm.year} onChange={e => {setFeeForm({...feeForm, year: Number(e.target.value)}); setPinError('');}} min="2000" max="2099" className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                    <div><label className="text-xs text-gray-400">Due Date</label><input type="date" value={feeForm.dueDate} onChange={e => {setFeeForm({...feeForm, dueDate: e.target.value}); setPinError('');}} className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                </div>
                                <div className="relative" ref={classesDropdownRef}>
                                    <label className="text-xs text-gray-400 block">Target Classes</label>
                                    <button type="button" onClick={() => setIsClassesDropdownOpen(p => !p)} className="w-full p-2 bg-gray-700 rounded mt-1 text-left flex justify-between items-center">
                                        <span>{feeForm.targetClasses.length > 0 ? `${feeForm.targetClasses.length} selected` : 'Select classes...'}</span>
                                        <span className={`transform transition-transform ${isClassesDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                                    </button>
                                    {isClassesDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-gray-900/90 border border-gray-700 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto p-2">
                                            {classes.map(cls => (
                                                <label key={cls.id} className="flex items-center gap-2 p-1 hover:bg-gray-700 rounded cursor-pointer">
                                                    <input type="checkbox" checked={feeForm.targetClasses.includes(cls.name)} onChange={() => {
                                                        const newTargetClasses = feeForm.targetClasses.includes(cls.name)
                                                            ? feeForm.targetClasses.filter(c => c !== cls.name)
                                                            : [...feeForm.targetClasses, cls.name];
                                                        setFeeForm({...feeForm, targetClasses: newTargetClasses});
                                                    }} className="form-checkbox h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 rounded"/>
                                                    <span>{cls.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div><label className="text-xs text-gray-400">Base Amount (UGX)</label><input type="number" value={feeForm.baseAmount} onChange={e => {setFeeForm({...feeForm, baseAmount: Number(e.target.value)}); setPinError('');}} min="0" className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                                <div className="border-t border-gray-700 pt-4">
                                    <h4 className="font-semibold mb-2">Fee Items</h4>
                                    <div className="space-y-2">
                                        {feeForm.items.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                                                <span>{item.name}: {formatCurrency(item.amount)}</span>
                                                <button onClick={() => {
                                                    const newItems = feeForm.items.filter((_, i) => i !== index);
                                                    setFeeForm({...feeForm, items: newItems});
                                                }} className="ml-auto text-red-400 hover:text-red-300">&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Item Name" className="flex-grow p-2 bg-gray-700 rounded"/>
                                        <input type="number" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: Number(e.target.value)})} placeholder="Amount" min="0" className="w-24 p-2 bg-gray-700 rounded"/>
                                        <button onClick={() => {
                                            if (newItem.name && newItem.amount > 0) {
                                                setFeeForm({...feeForm, items: [...feeForm.items, newItem]});
                                                setNewItem({name: '', amount: 0});
                                            }
                                        }} className="px-3 py-1 bg-cyan-600 rounded">+</button>
                                    </div>
                                </div>
                                <div className="font-bold text-lg border-t border-gray-700 pt-4 flex justify-between"><span>Total Fee:</span><span>{formatCurrency(feeForm.baseAmount + feeForm.items.reduce((sum, item) => sum + item.amount, 0))}</span></div>
                            </div>
                        )}
                        {feeModalTab === 'bulk' && (
                            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                                <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md">
                                    <p className="font-bold mb-2">Instructions:</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Download the CSV template.</li>
                                        <li>Fill in fee details. The `targetClasses` column should be a semicolon-separated list (e.g., "S.1;S.2").</li>
                                        <li>The `items` column must be formatted as a semicolon-separated list of `ItemName:Amount` pairs (e.g., "Library:10000;Sports:5000").</li>
                                        <li>Save and upload the completed file.</li>
                                    </ol>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <input type="file" onChange={e => {setCsvFile(e.target.files ? e.target.files[0] : null); setBulkUploadFeedback(null);}} accept=".csv" className="hidden" id="fee-csv-upload"/>
                                    <label htmlFor="fee-csv-upload" className="flex-grow px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold cursor-pointer text-center">
                                        Upload CSV
                                    </label>
                                    <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("title,term,year,targetClasses,baseAmount,items,dueDate\nTerm 1 Tuition,Term 1,2024,\"S.1;S.2\",50000,\"Library:10000;Sports:5000\",2024-09-01")}`} download="school_fees_template.csv" className="text-sm text-cyan-400 hover:underline flex-shrink-0">
                                        Download Template
                                    </a>
                                </div>
                                {bulkUploadFeedback && (
                                    <div className={`p-3 rounded-md text-sm ${bulkUploadFeedback.errors.length > 0 ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                                        <p>Processed {bulkUploadFeedback.successes} fees, with {bulkUploadFeedback.errors.length} errors.</p>
                                        {bulkUploadFeedback.errors.length > 0 && (
                                            <ul className="list-disc list-inside mt-2 max-h-40 overflow-y-auto">
                                                {bulkUploadFeedback.errors.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {pinError && <p className="text-red-400 text-sm mt-4 text-center">{pinError}</p>}

                        <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
                            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            {feeModalTab === 'manual' && <button onClick={() => handleActionWithPin(handleAddFee)} className="px-4 py-2 bg-cyan-600 rounded">Add Fee</button>}
                            {feeModalTab === 'bulk' && <button onClick={() => handleActionWithPin(handleBulkFeeUpload)} disabled={!csvFile} className="px-4 py-2 bg-cyan-600 rounded disabled:bg-gray-500">Process Upload</button>}
                        </div>
                    </div>
                </div>
            )}
            {feedbackMessage && (<div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4 animate-pulse-custom">{feedbackMessage}</div>)}
            {isFeePaymentModalOpen && selectedFeeForPayment && (
                <FeePaymentModal
                    isOpen={isFeePaymentModalOpen}
                    fee={selectedFeeForPayment}
                    currentUser={user as User}
                    stagedFee={stagedSchoolFee}
                    onClose={() => setIsFeePaymentModalOpen(false)}
                    onPay={handlePayFee}
                    pinError={pinError}
                    setPinError={setPinError}
                />
            )}
            {view === 'dashboard' ? (isHeadteacher ? renderHeadteacherDashboard() : renderPersonalWalletDashboard()) : 
             view === 'receipts' ? renderReceiptsView() : 
             view === 'bursaries' && isHeadteacher ? renderBursaryTrackingView() :
             renderTransactionsView()}
        </div>
    );
};

export default EWalletPage;