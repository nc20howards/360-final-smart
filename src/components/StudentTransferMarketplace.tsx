
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { School, AdminUser, StudentTransferProposal, TransferNegotiation, CompletedAdmission, SchoolClass, EWallet, StudentTransferRequest, StagedTransferPayment } from '../types';
import * as schoolService from '../services/schoolService';
import * as settingsService from '../services/settingsService';
import UserAvatar from './UserAvatar';
import { GRADE_OPTIONS, GENDER_OPTIONS } from '../constants';
import * as eWalletService from '../services/eWalletService';
import PinStrengthIndicator from './PinStrengthIndicator';
import { getAllAdminUsers } from '../services/userService';
import { getHomePageContent } from '../services/homePageService';


interface StudentTransferMarketplaceProps {
    school: School;
    user: AdminUser;
    classes: SchoolClass[];
    onNavigateToWallet?: () => void;
    stagedTransferPayment?: StagedTransferPayment | null;
    onConsumeStagedTransfer?: () => void;
}

const getStatusIndicator = (status: TransferNegotiation['status']) => {
    switch (status) {
        case 'active':
            return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 capitalize">Active</span>;
        case 'accepted':
            return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 capitalize">Accepted</span>;
        case 'payment_made':
            return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 capitalize">Payment Made</span>;
        case 'completed':
            return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-300 capitalize">Completed</span>;
        case 'rejected':
            return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 capitalize">Rejected</span>;
        default:
            return null;
    }
};

const AnimatedCheckmarkIcon: React.FC<{ color: string }> = ({ color }) => (
    <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path className="checkmark__path" d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);


const StudentTransferMarketplace: React.FC<StudentTransferMarketplaceProps> = ({ school, user, classes, onNavigateToWallet, stagedTransferPayment, onConsumeStagedTransfer }) => {
    type Tab = 'marketplace' | 'my_items' | 'negotiations';
    const [activeTab, setActiveTab] = useState<Tab>('marketplace');
    const [myItemsView, setMyItemsView] = useState<'open' | 'history'>('open');
    
    // Data states
    const [marketProposals, setMarketProposals] = useState<StudentTransferProposal[]>([]);
    const [myProposals, setMyProposals] = useState<StudentTransferProposal[]>([]);
    const [negotiations, setNegotiations] = useState<TransferNegotiation[]>([]);
    const [marketRequests, setMarketRequests] = useState<StudentTransferRequest[]>([]);
    const [myRequests, setMyRequests] = useState<StudentTransferRequest[]>([]);

    // UI states
    const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [selectedNegotiation, setSelectedNegotiation] = useState<TransferNegotiation | null>(null);
    const [newMessage, setNewMessage] = useState('');
    
    // Form state
    const initialFormState = {
        numberOfStudents: 1,
        gender: 'Mixed' as 'Male' | 'Female' | 'Mixed',
        grade: '',
        levelCategory: '' as 'O-Level' | 'A-Level' | '',
        className: '',
        description: '',
        termsAndConditions: '',
        pricePerStudent: 0,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const [proposalForm, setProposalForm] = useState(initialFormState);
    const [requestForm, setRequestForm] = useState({
        numberOfStudents: 1,
        gender: 'Mixed' as 'Male' | 'Female' | 'Mixed',
        grade: '',
        className: '',
        amountPerStudent: 0,
    });
    const [formError, setFormError] = useState('');
    
    const [stagedStudents, setStagedStudents] = useState<CompletedAdmission[]>([]);

    const [isProposalDetailsModalOpen, setIsProposalDetailsModalOpen] = useState(false);
    const [areTermsAccepted, setAreTermsAccepted] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [selectedStudentsForNego, setSelectedStudentsForNego] = useState<string[]>([]);
    const [wallet, setWallet] = useState<EWallet | null>(null);

    // New negotiation state
    const [buyerOffer, setBuyerOffer] = useState<number | string>('');
    const [sellerOffer, setSellerOffer] = useState<number | string>('');
    const [isSettingFinalPrice, setIsSettingFinalPrice] = useState(false);
    const [finalPriceInput, setFinalPriceInput] = useState('');
    
    const allAdmins = useMemo(() => getAllAdminUsers(), []);
    const [showTermsOnMobile, setShowTermsOnMobile] = useState(false);
    
    // New states for Fulfill Request Modal
    const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
    const [requestToFulfill, setRequestToFulfill] = useState<StudentTransferRequest | null>(null);
    const [fulfillForm, setFulfillForm] = useState({ numberOfStudents: 0, pricePerStudent: 0 });

    // Notification counters
    const [marketUnreadCount, setMarketUnreadCount] = useState(0);
    const [myItemsUnreadCount, setMyItemsUnreadCount] = useState(0);
    const [negotiationsUnreadCount, setNegotiationsUnreadCount] = useState(0);

    const LAST_VISIT_KEY = useRef({
        marketplace: `360_transfer_market_last_visit_${user.id}`,
        my_items: `360_transfer_my_items_last_visit_${user.id}`,
        negotiations: `360_transfer_negotiations_last_visit_${user.id}`,
    });


    const totalAmount = useMemo(() => {
        const numStudents = Number(proposalForm.numberOfStudents) || 0;
        const price = Number(proposalForm.pricePerStudent) || 0;
        return numStudents * price;
    }, [proposalForm.numberOfStudents, proposalForm.pricePerStudent]);

    const refreshData = useCallback(() => {
        const currentTimestamp = Date.now();
        
        const allProposals = schoolService.getProposals();
        const allRequests = schoolService.getRequests();
        const allNegotiations = schoolService.getNegotiationsForSchool(school.id);

        const marketProposalsData = schoolService.getOpenMarketProposals(school.id);
        const myProposalsData = schoolService.getProposalsForSchool(school.id);
        const marketRequestsData = schoolService.getOpenMarketRequests(school.id);
        const myRequestsData = schoolService.getRequestsForSchool(school.id);

        setMarketProposals(marketProposalsData);
        setMyProposals(myProposalsData);
        setMarketRequests(marketRequestsData);
        setMyRequests(myRequestsData);
        setNegotiations(allNegotiations);
        setWallet(eWalletService.getWalletForUser(user.id));

        if (selectedNegotiation) {
            const updatedNego = allNegotiations.find(n => n.id === selectedNegotiation.id);
            if(updatedNego) {
                if (!updatedNego.assignedStudents) {
                    updatedNego.assignedStudents = [];
                }
                setSelectedNegotiation(updatedNego);
                const assignedIds = updatedNego.assignedStudents?.map(s => s.studentId) || [];
                setSelectedStudentsForNego(assignedIds);
            } else {
                setSelectedNegotiation(null);
            }
        }
        
        const admissions = settingsService.getCompletedAdmissions(school.id);
        const stagedForTransfer = admissions.filter(a => a.status === 'transferred' && !a.transferToSchoolId);
        setStagedStudents(stagedForTransfer);

        // --- Calculate Unread Counts ---
        const lastMarketVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.marketplace) || 0);
        const lastMyItemsVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.my_items) || 0);
        const lastNegotiationsVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.negotiations) || 0);

        // Marketplace: new proposals/requests from others
        const newMarketItems = marketProposalsData.filter(p => p.timestamp > lastMarketVisit).length +
                               marketRequestsData.filter(r => r.timestamp > lastMarketVisit).length; 
        setMarketUnreadCount(newMarketItems);

        // My Items: new negotiations started on my proposals
        const newNegoOnMyProposals = allNegotiations.filter(n => 
            myProposalsData.some(p => p.id === n.proposalId) && n.lastUpdated > lastMyItemsVisit && n.proposingSchoolId === school.id && n.messages.filter(m => m.senderId !== user.id).length > 0
        ).length;
        // Also: new offers to fulfill my requests (which create negotiations)
        const newOffersOnMyRequests = allNegotiations.filter(n =>
            myRequestsData.some(r => r.id === n.requestId) && n.lastUpdated > lastMyItemsVisit && n.interestedSchoolId === school.id && n.messages.filter(m => m.senderId !== user.id).length > 0
        ).length;
        setMyItemsUnreadCount(newNegoOnMyProposals + newOffersOnMyRequests);


        // Negotiations: unread messages in my active negotiations
        const unreadNegoMsgs = allNegotiations.filter(n => n.messages.some(m => m.senderId !== user.id && (!m.readBy || !m.readBy.includes(user.id)))).length;
        setNegotiationsUnreadCount(unreadNegoMsgs);

    }, [school.id, selectedNegotiation, user.id, myProposals, myRequests, negotiations]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000); // Poll for updates
        return () => clearInterval(interval);
    }, [refreshData]);
    
    useEffect(() => {
        if (selectedNegotiation) {
            schoolService.markNegotiationMessagesAsRead(selectedNegotiation.id, user.id);
            refreshData(); // Refresh to clear the individual negotiation's unread status
        }
    }, [selectedNegotiation, user.id, refreshData]);
    
    // Check for staged payment return
    useEffect(() => {
        if (stagedTransferPayment) {
             const negotiation = negotiations.find(n => n.id === stagedTransferPayment.negotiationId);
             if (negotiation) {
                 setSelectedNegotiation(negotiation);
                 setActiveTab('negotiations');
                 setIsProposalDetailsModalOpen(true);
                 // Optionally show a success message if coming back with funds?
                 // For now, the user sees the modal and can click "Pay Now" again.
             }
        }
    }, [stagedTransferPayment, negotiations]);


    const handleTabClick = (tab: Tab) => {
        setActiveTab(tab);
        // Mark items in this tab as read
        localStorage.setItem(LAST_VISIT_KEY.current[tab], String(Date.now()));
        refreshData(); // Refresh to update counters
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        setProposalForm(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'levelCategory') {
                newState.className = '';
            }
            return newState;
        });
        setFormError('');
    };

    const handleRequestFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setRequestForm(prev => ({ 
            ...prev, 
            [name]: e.target.type === 'number' ? Number(value) : value 
        }));
        setFormError('');
    };

    const handleCreateRequest = () => {
        if (!requestForm.className || !requestForm.grade || !requestForm.numberOfStudents) {
            setFormError("Please fill all required fields.");
            return;
        }
        try {
            schoolService.createRequest({
                ...requestForm,
                requestingSchoolId: school.id,
                numberOfStudents: Number(requestForm.numberOfStudents),
                amountPerStudent: Number(requestForm.amountPerStudent) || undefined,
            });
            setIsRequestModalOpen(false);
            setRequestForm({ numberOfStudents: 1, gender: 'Mixed', grade: '', className: '', amountPerStudent: 0 });
            refreshData();
        } catch (error) {
            setFormError((error as Error).message);
        }
    };
    
    const handleCloseRequest = (requestId: string) => {
        schoolService.closeRequest(requestId, school.id);
        refreshData();
    };

    const handleFulfillRequest = (request: StudentTransferRequest) => {
        setRequestToFulfill(request);
        setFulfillForm({
            numberOfStudents: request.numberOfStudents - (request.fulfilledStudentsCount || 0), // Pre-fill with remaining needed
            pricePerStudent: request.amountPerStudent || 0,
        });
        setIsFulfillModalOpen(true);
        setFormError(''); // Clear any previous errors
    };
    
    const handleConfirmFulfillRequest = () => {
        if (!requestToFulfill) return;
        setFormError('');

        const { numberOfStudents, pricePerStudent } = fulfillForm;
        const remainingNeeded = requestToFulfill.numberOfStudents - (requestToFulfill.fulfilledStudentsCount || 0);

        if (numberOfStudents <= 0 || numberOfStudents > remainingNeeded) {
            setFormError(`Number of students to offer must be between 1 and ${remainingNeeded}.`);
            return;
        }

        // --- Robust Validation Logic (re-check against staged) ---
        const stagedForClass = stagedStudents.filter(s => s.targetClass === requestToFulfill.className);
        const staged_male_count = stagedForClass.filter(s => s.gender === 'Male').length;
        const staged_female_count = stagedForClass.filter(s => s.gender === 'Female').length;
        
        // This calculates students already committed by THIS school in other *open* proposals for this class/gender
        const committed_male = myProposals.filter(p => p.status === 'open' && p.className === requestToFulfill.className && p.gender === 'Male').reduce((sum, p) => sum + p.numberOfStudents, 0);
        const committed_female = myProposals.filter(p => p.status === 'open' && p.className === requestToFulfill.className && p.gender === 'Female').reduce((sum, p) => sum + p.numberOfStudents, 0);
        const committed_mixed = myProposals.filter(p => p.status === 'open' && p.className === requestToFulfill.className && p.gender === 'Mixed').reduce((sum, p) => sum + p.numberOfStudents, 0);
        
        const available_male = staged_male_count - committed_male;
        const available_female = staged_female_count - committed_female;
        
        if (requestToFulfill.gender === 'Male' && numberOfStudents > available_male) {
            setFormError(`Cannot offer ${numberOfStudents} male students. Only ${available_male} are available.`);
            return;
        }
        if (requestToFulfill.gender === 'Female' && numberOfStudents > available_female) {
            setFormError(`Cannot offer ${numberOfStudents} female students. Only ${available_female} are available.`);
            return;
        }
        if (requestToFulfill.gender === 'Mixed') {
            const available_pool = available_male + available_female;
            if (numberOfStudents > available_pool - committed_mixed) {
                 setFormError(`Cannot offer ${numberOfStudents} students. Only ${available_pool - committed_mixed} are available in the unallocated pool for this class.`);
                 return;
            }
        }
        // --- End Validation ---

        try {
            const privateProposal = schoolService.createProposal({
                proposingSchoolId: school.id,
                targetSchoolId: requestToFulfill.requestingSchoolId,
                requestId: requestToFulfill.id, // Link to the original request
                numberOfStudents: numberOfStudents,
                gender: requestToFulfill.gender,
                grade: requestToFulfill.grade,
                className: requestToFulfill.className,
                description: `This is an offer in response to your request for ${requestToFulfill.numberOfStudents} students.`,
                pricePerStudent: pricePerStudent,
                deadline: Date.now() + 14 * 24 * 60 * 60 * 1000, // 2 weeks deadline
                levelCategory: classes.find(c => c.name === requestToFulfill.className)?.level || '',
            });

            const negotiation = schoolService.startOrGetNegotiation(privateProposal.id, requestToFulfill.requestingSchoolId);
            
            // Add a system message to start the chat
            schoolService.addNegotiationMessage(negotiation.id, 'system', `[System] ${school.name} has made an offer in response to your request for students.`);

            // Close modal and navigate
            setIsFulfillModalOpen(false);
            setRequestToFulfill(null);
            setSelectedNegotiation(negotiation);
            setActiveTab('negotiations');
            refreshData();

        } catch (error) {
            setFormError((error as Error).message);
        }
    };


    const handleCreateProposal = () => {
        const { pricePerStudent, numberOfStudents, grade, className, gender } = proposalForm;
        const price = Number(pricePerStudent);
        const numStudentsToPropose = Number(numberOfStudents);

        setFormError('');

        if (price < 0 || numStudentsToPropose <= 0 || !grade || !className) {
            setFormError("Please fill all required fields with valid values.");
            return;
        }

        // --- Robust Validation Logic ---
        const stagedForClass = stagedStudents.filter(s => s.targetClass === className);
        const staged_male_count = stagedForClass.filter(s => s.gender === 'Male').length;
        const staged_female_count = stagedForClass.filter(s => s.gender === 'Female').length;
        
        const committed_male = myProposals.filter(p => p.status === 'open' && p.className === className && p.gender === 'Male').reduce((sum, p) => sum + p.numberOfStudents, 0);
        const committed_female = myProposals.filter(p => p.status === 'open' && p.className === className && p.gender === 'Female').reduce((sum, p) => sum + p.numberOfStudents, 0);
        const committed_mixed = myProposals.filter(p => p.status === 'open' && p.className === className && p.gender === 'Mixed').reduce((sum, p) => sum + p.numberOfStudents, 0);
        
        const available_male = staged_male_count - committed_male;
        const available_female = staged_female_count - committed_female;
        
        if (gender === 'Male' && numStudentsToPropose > available_male) {
            setFormError(`Cannot propose ${numStudentsToPropose} male students. Only ${available_male} are available and uncommitted.`);
            return;
        }
        if (gender === 'Female' && numStudentsToPropose > available_female) {
            setFormError(`Cannot propose ${numStudentsToPropose} female students. Only ${available_female} are available and uncommitted.`);
            return;
        }
        if (gender === 'Mixed') {
            const available_pool = available_male + available_female;
            if (numStudentsToPropose > available_pool - committed_mixed) {
                 setFormError(`Cannot propose ${numStudentsToPropose} students. Only ${available_pool - committed_mixed} are available in the unallocated pool for this class.`);
                 return;
            }
        }
        // --- End Validation ---
        
        try {
            schoolService.createProposal({
                ...proposalForm,
                proposingSchoolId: school.id,
                numberOfStudents: numStudentsToPropose,
                pricePerStudent: price,
                deadline: new Date(proposalForm.deadline).getTime(),
            });
            setIsProposalModalOpen(false);
            setProposalForm(initialFormState);
            refreshData();
            setActiveTab('my_items');
        } catch (error) {
            setFormError((error as Error).message);
        }
    };
    
    const handleStartNegotiation = (proposalId: string) => {
        const negotiation = schoolService.startOrGetNegotiation(proposalId, school.id);
        setSelectedNegotiation(negotiation);
        setActiveTab('negotiations');
        refreshData();
    };

    const handleSendMessage = () => {
        if (newMessage.trim() && selectedNegotiation) {
            schoolService.addNegotiationMessage(selectedNegotiation.id, user.id, newMessage.trim());
            setNewMessage('');
        }
    };

    const handleUpdateTerms = (terms: Partial<TransferNegotiation>) => {
        if (!selectedNegotiation) return;
        try {
            schoolService.updateNegotiationTerms(selectedNegotiation.id, terms, school.name);
            if (terms.buyerOffer) {
                 setBuyerOffer(''); // Clear input after submitting
            }
            if (terms.sellerOffer) {
                setSellerOffer('');
            }
            refreshData(); // Force refresh to show update immediately
            setIsProposalDetailsModalOpen(false); // Close modal on action
        } catch(error) { alert((error as Error).message); }
    };

    const handleRejectBuyerOffer = () => {
        if (!selectedNegotiation) return;
        try {
            schoolService.rejectBuyerOffer(selectedNegotiation.id, school.name)
        } catch (err) {
            alert((err as Error).message);
        } finally {
            refreshData();
            setIsProposalDetailsModalOpen(false);
        }
    };
    
    const handleRejectAllNegotiations = () => {
        if (!selectedNegotiation) return;
        try {
            schoolService.rejectNegotiations(selectedNegotiation.id, school.name);
            refreshData();
            setIsProposalDetailsModalOpen(false);
        } catch(err) {
            alert((err as Error).message);
        }
    };
    
    const handlePayIntoEscrow = () => {
        if (!selectedNegotiation) return;
        setPinError('');
        try {
            schoolService.preCheckStudentAvailabilityForProposal(selectedNegotiation.id);
            
            const proposal = schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId);
            if (!proposal) throw new Error("Proposal not found.");
            const totalAmount = (selectedNegotiation.finalPrice ?? 0) * proposal.numberOfStudents;
            
            if (wallet && wallet.balance < totalAmount) {
                // Stage payment and redirect
                if (onNavigateToWallet) {
                    eWalletService.stageTransferPayment({ negotiationId: selectedNegotiation.id, amount: totalAmount });
                    onNavigateToWallet();
                    // Close this modal
                    setIsProposalDetailsModalOpen(false);
                } else {
                    setPinError("Insufficient funds in E-Wallet.");
                    setIsPaymentModalOpen(true);
                }
            } else {
                 setIsPaymentModalOpen(true);
            }

        } catch (error) {
            setPinError((error as Error).message);
            setIsPaymentModalOpen(true); // Open modal to show error
        }
    };

    const handleConfirmPayment = () => {
        if (!selectedNegotiation || selectedNegotiation.finalPrice === undefined) return;
        setPinError('');
        try {
            eWalletService.verifyPin(user.id, pin);
            const proposal = schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId); 
            if (!proposal) throw new Error("Proposal not found.");

            const totalAmount = selectedNegotiation.finalPrice * proposal.numberOfStudents;
            
            // makePayment will throw "Insufficient funds" if balance is too low
            eWalletService.makePayment(
                user.id, 
                eWalletService.TRANSFER_ESCROW_USER_ID, 
                totalAmount, 
                `Escrow for deal #${selectedNegotiation.id.slice(-6)}`,
                'transfer_fee_payment'
            );
            
            schoolService.updateNegotiationStatus(selectedNegotiation.id, 'payment_made');

            if (onConsumeStagedTransfer) {
                onConsumeStagedTransfer();
            }

            setIsPaymentModalOpen(false);
            setPin('');
            refreshData(); // Explicitly refresh
        } catch(err) {
            setPinError((err as Error).message);
        }
    };
    
    const handleAssignStudentsToDeal = () => {
        if (!selectedNegotiation) return;
        const proposal = schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId);
        if (!proposal) return;

        if (selectedStudentsForNego.length !== proposal.numberOfStudents) {
            alert(`You must select exactly ${proposal.numberOfStudents} students for this deal.`);
            return;
        }

        const studentDetails = selectedStudentsForNego.map(id => {
            const adm = stagedStudents.find(s => s.applicantId === id);
            const studentName = adm ? ('candidateName' in adm.data ? adm.data.candidateName : adm.data.name) : 'Unknown Student';
            const indexNumber = adm ? ('indexNumber' in adm.data ? adm.data.indexNumber : adm.data.indexNo) : 'N/A';
            return { studentId: id, studentName, indexNumber };
        });
        
        schoolService.assignStudentsToNegotiation(selectedNegotiation.id, studentDetails);
        schoolService.addNegotiationMessage(selectedNegotiation.id, 'system', `[System] ${school.name} has assigned ${studentDetails.length} students. The buyer can now review and accept.`);
    };
    
    const handleAcceptStudents = () => {
        if (!selectedNegotiation) return;
        schoolService.updateNegotiationStatus(selectedNegotiation.id, 'completed');
    };

    const renderMarketplace = () => (
        <div className="space-y-4">
            {(marketProposals.length > 0 || marketRequests.length > 0) ? (
                <>
                    {marketProposals.map(p => (
                        <div key={p.id} className="bg-gray-800 p-4 rounded-lg border-l-4 border-cyan-500">
                             <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <span className="text-xs font-semibold px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full">PROPOSAL</span>
                                    <p className="font-bold mt-2">{p.proposingSchoolName}</p>
                                    <p className="text-sm text-gray-300">Offering <span className="font-semibold">{p.numberOfStudents} {p.gender}</span> students in <span className="font-semibold">{p.className}</span></p>
                                    {p.pricePerStudent > 0 && <p className="text-sm text-cyan-400 font-semibold mt-1">UGX {p.pricePerStudent.toLocaleString()} per student (Total: UGX {(p.pricePerStudent * p.numberOfStudents).toLocaleString()})</p>}
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <button onClick={() => handleStartNegotiation(p.id)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-sm font-semibold rounded-md">Start Negotiation</button>
                                    <p className="text-xs text-gray-500 mt-1">Ends: {new Date(p.deadline).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                     {marketRequests.map(r => {
                         const remainingStudents = r.numberOfStudents - (r.fulfilledStudentsCount || 0);
                         if (remainingStudents <= 0) return null; // Hide if fully fulfilled
                         
                         return (
                            <div key={r.id} className="bg-gray-800 p-4 rounded-lg border-l-4 border-yellow-500">
                                <div className="flex justify-between items-start">
                                     <div className="flex-grow">
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full">REQUEST</span>
                                        <p className="font-bold mt-2">{r.requestingSchoolName}</p>
                                        <p className="text-sm text-gray-300">Requesting <span className="font-semibold">{r.numberOfStudents} {r.gender}</span> students for <span className="font-semibold">{r.className}</span></p>
                                        {remainingStudents > 0 && <p className="text-sm text-green-400 font-semibold mt-1">Remaining: {remainingStudents} students</p>}
                                         {r.amountPerStudent && r.amountPerStudent > 0 && (
                                            <p className="text-sm text-yellow-400 font-semibold mt-1">Offering UGX {r.amountPerStudent.toLocaleString()} per student</p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <button onClick={() => handleFulfillRequest(r)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-sm font-semibold rounded-md">Fulfill Request</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            ) : (
                <p className="text-gray-400 text-center py-8">The marketplace is currently empty.</p>
            )}
        </div>
    );
    
    const historyItems = useMemo(() => {
        const proposalsHistory = myProposals.map(p => ({
            id: p.id,
            type: 'PROPOSAL' as const,
            description: `You created a proposal offering ${p.numberOfStudents} students.`,
            timestamp: p.timestamp,
            status: p.status,
            statusText: p.status.charAt(0).toUpperCase() + p.status.slice(1)
        }));
    
        const requestsHistory = myRequests.map(r => ({
            id: r.id,
            type: 'REQUEST' as const,
            description: `You created a request for ${r.numberOfStudents} students.`,
            timestamp: r.timestamp,
            status: r.status,
            statusText: r.status.charAt(0).toUpperCase() + r.status.slice(1),
            remainingStudents: r.numberOfStudents - (r.fulfilledStudentsCount || 0)
        }));
    
        const negotiationsHistory = negotiations.map(n => {
            const otherSchool = schoolService.getAllSchools().find(s => s.id === (n.proposingSchoolId === school.id ? n.interestedSchoolId : n.proposingSchoolId));
    
            return {
                id: n.id,
                type: 'NEGOTIATION' as const,
                description: `Negotiation with ${otherSchool?.name || 'Unknown School'} for deal #${n.id.slice(-6)}`,
                timestamp: n.lastUpdated,
                status: n.status,
                statusText: n.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            };
        });
    
        const allItems = [...proposalsHistory, ...requestsHistory, ...negotiationsHistory];
        return allItems.sort((a, b) => b.timestamp - a.timestamp);
    
    }, [myProposals, myRequests, negotiations, school.id]);
    
    const getHistoryStatusColor = (status: string) => {
        status = status.toLowerCase();
        if (status.includes('open') || status.includes('active')) return 'bg-yellow-500/20 text-yellow-300';
        if (status.includes('closed') || status.includes('rejected')) return 'bg-red-500/20 text-red-300';
        if (status.includes('completed')) return 'bg-green-500/20 text-green-300';
        if (status.includes('payment')) return 'bg-cyan-500/20 text-cyan-300';
        return 'bg-gray-500/20 text-gray-300';
    };

    const renderMyItems = () => (
        <div>
             <div className="flex items-center gap-2 p-1 bg-gray-900 rounded-lg mb-4">
                <button onClick={() => setMyItemsView('open')} className={`w-full py-2 text-sm font-semibold rounded-md ${myItemsView === 'open' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Open Items</button>
                <button onClick={() => setMyItemsView('history')} className={`w-full py-2 text-sm font-semibold rounded-md ${myItemsView === 'history' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>History</button>
            </div>

            {myItemsView === 'open' ? (
                <>
                    <div className="flex justify-end gap-4 mb-4">
                        <button onClick={() => setIsRequestModalOpen(true)} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 font-semibold rounded-md">+ Create Request</button>
                        <button onClick={() => setIsProposalModalOpen(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 font-semibold rounded-md">+ Create Proposal</button>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-2">My Open Proposals</h3>
                            <div className="space-y-4">
                                {myProposals.filter(p => p.status === 'open').map(p => {
                                   const interestedCount = schoolService.getNegotiationCountForProposal(p.id);
                                   return (
                                       <div key={p.id} className="bg-gray-800 p-4 rounded-lg">
                                           <p className="font-bold">Offering {p.numberOfStudents} {p.gender} students</p>
                                           <p className="text-sm text-gray-300">Class: {p.className} | Grade: {p.grade}</p>
                                           <p className="text-sm text-cyan-400 font-semibold">UGX {p.pricePerStudent.toLocaleString()} per student (Total: UGX {(p.pricePerStudent * p.numberOfStudents).toLocaleString()})</p>
                                           <p className="text-sm text-gray-400 mt-1">Interested Schools: <span className="font-bold text-white">{interestedCount}</span></p>
                                       </div>
                                   );
                                })}
                               {myProposals.filter(p => p.status === 'open').length === 0 && <p className="text-gray-400">No open proposals.</p>}
                            </div>
                        </div>
                        <div>
                             <h3 className="text-xl font-bold mb-2">My Open Requests</h3>
                            <div className="space-y-4">
                                 {myRequests.filter(r => r.status === 'open' && (r.numberOfStudents - (r.fulfilledStudentsCount || 0)) > 0).map(r => {
                                     const remainingStudents = r.numberOfStudents - (r.fulfilledStudentsCount || 0);
                                     return (
                                        <div key={r.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                                           <div>
                                               <p className="font-bold">Requesting {r.numberOfStudents} {r.gender} students</p>
                                               <p className="text-sm text-gray-300">Class: {r.className} | Grade: {r.grade}</p>
                                                {remainingStudents > 0 && <p className="text-sm text-green-400 font-semibold mt-1">Remaining: {remainingStudents} students</p>}
                                               {r.amountPerStudent && r.amountPerStudent > 0 && (
                                                   <p className="text-sm text-yellow-400 font-semibold">Offering UGX {r.amountPerStudent.toLocaleString()} per student</p>
                                               )}
                                           </div>
                                           <button onClick={() => handleCloseRequest(r.id)} className="px-3 py-1 bg-red-600 text-xs font-semibold rounded-md">Close</button>
                                       </div>
                                   );
                               })}
                               {myRequests.filter(r => r.status === 'open' && (r.numberOfStudents - (r.fulfilledStudentsCount || 0)) > 0).length === 0 && <p className="text-gray-400">No open requests.</p>}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-xl font-bold mb-4">Activity History</h3>
                     <div className="space-y-3">
                        {historyItems.map(item => (
                            <div key={item.id} className="bg-gray-700/50 p-3 rounded-md flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${item.type === 'PROPOSAL' ? 'bg-cyan-500/20 text-cyan-300' : item.type === 'REQUEST' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                                            {item.type}
                                        </span>
                                         <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getHistoryStatusColor(item.statusText)}`}>
                                            {item.statusText}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300">{item.description}
                                        {item.type === 'REQUEST' && (item as any).remainingStudents > 0 ? ` (Remaining: ${(item as any).remainingStudents})` : ''}
                                    </p>
                                </div>
                                <p className="text-xs text-gray-500 flex-shrink-0 ml-4">{new Date(item.timestamp).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderNegotiations = () => {
        const getUnreadCount = (negotiation: TransferNegotiation) => {
            return negotiation.messages.filter(m => m.senderId !== user.id && (!m.readBy || !m.readBy.includes(user.id))).length;
        };
    
        const otherSchoolName = (negotiation: TransferNegotiation) => {
            const isProposer = negotiation.proposingSchoolId === school.id;
            const otherSchoolId = isProposer ? negotiation.interestedSchoolId : negotiation.proposingSchoolId;
            const otherSchool = schoolService.getAllSchools().find(s => s.id === otherSchoolId);
            return otherSchool?.name || 'Unknown School';
        };

        const otherSchoolAvatar = (negotiation: TransferNegotiation) => {
            const isProposer = negotiation.proposingSchoolId === school.id;
            const otherSchoolId = isProposer ? negotiation.interestedSchoolId : negotiation.proposingSchoolId;
            const otherSchool = schoolService.getAllSchools().find(s => s.id === otherSchoolId);
            if (otherSchool) {
                const homeContent = getHomePageContent(otherSchool.id); 
                return homeContent.hero.logoUrl;
            }
            return `https://picsum.photos/seed/school-${otherSchoolId}/100`; // Generic placeholder
        };

        const negotiationOwner = (negotiation: TransferNegotiation, id: string) => {
            const admin = allAdmins.find(a => a.id === id);
            return admin?.name || 'System';
        };
    
        const renderTermsPanelContent = () => {
            if (!selectedNegotiation) return null;
    
            const isBuyer = selectedNegotiation.interestedSchoolId === school.id;
            const proposal = schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId); 
            const currentPrice = selectedNegotiation.finalPrice ?? selectedNegotiation.sellerOffer ?? selectedNegotiation.buyerOffer ?? proposal?.pricePerStudent ?? 0;
            const whoseTurn = selectedNegotiation.isBuyerOfferActive ? (isBuyer ? 'Waiting for Seller' : 'Your Turn') : (isBuyer ? 'Your Turn' : 'Waiting for Buyer');
            
            // Standard user control check
            const allControlsDisabled = selectedNegotiation.status === 'completed';

            return (
                <div className="flex-grow overflow-y-auto p-3 space-y-4">
                    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-gray-400">Current Price / Student</p>
                        <p className="text-2xl font-bold text-cyan-400">UGX {currentPrice.toLocaleString()}</p>
                        <p className={`text-xs font-semibold mt-1 ${whoseTurn === 'Your Turn' ? 'text-green-400' : 'text-yellow-400'}`}>{whoseTurn}</p>
                    </div>
                </div>
            );
        };
    
        const renderChatContent = () => {
            if (!selectedNegotiation) return null;
        
            const proposingHeadteacher = allAdmins.find(a => a.role === 'headteacher' && a.assignedSchoolIds.includes(selectedNegotiation.proposingSchoolId));
            const interestedHeadteacher = allAdmins.find(a => a.role === 'headteacher' && a.assignedSchoolIds.includes(selectedNegotiation.interestedSchoolId));
            
            const participantsMap = new Map<string, AdminUser>();
            if (proposingHeadteacher) participantsMap.set(proposingHeadteacher.id, proposingHeadteacher);
            if (interestedHeadteacher) participantsMap.set(interestedHeadteacher.id, interestedHeadteacher);
            
            return (
                <>
                    <div className="flex-grow p-4 overflow-y-auto space-y-4">
                        {selectedNegotiation?.messages.map((msg, index) => {
                             if (msg.senderId === 'system') {
                                return (
                                    <div key={index} className="text-center my-2">
                                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">{msg.content}</span>
                                    </div>
                                );
                            }

                            const sender = participantsMap.get(msg.senderId);
                            const isMine = msg.senderId === user.id;

                            return (
                                <div key={index} className={`flex items-start gap-3 ${isMine ? 'justify-end' : ''}`}>
                                    {!isMine && (
                                        <UserAvatar
                                            name={sender?.name || '?'}
                                            avatarUrl={sender?.avatarUrl}
                                            className="w-8 h-8 rounded-full flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex flex-col">
                                        {!isMine && <p className="text-xs text-gray-400 mb-1">{sender?.name}</p>}
                                        <div className={`p-3 rounded-lg max-w-xs md:max-w-md ${isMine ? 'bg-cyan-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                            <p className="text-white text-sm whitespace-pre-wrap">{msg.content}</p>
                                            <p className="text-xs text-gray-300 text-right mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    {isMine && (
                                        <UserAvatar
                                            name={user.name}
                                            avatarUrl={user.avatarUrl}
                                            className="w-8 h-8 rounded-full flex-shrink-0"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <footer className="p-3 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type a message..." className="w-full bg-gray-700 p-2 rounded-md" />
                            <button onClick={handleSendMessage} className="px-4 bg-cyan-600 rounded-md">Send</button>
                        </div>
                    </footer>
                </>
            )
        };
    
        return (
            <div className="flex h-[75vh] bg-gray-800 rounded-lg overflow-hidden">
                {/* Left Panel: List of Negotiations */}
                <div className={`w-full lg:w-1/3 border-r border-gray-700 flex-col ${selectedNegotiation ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-gray-700"> <h3 className="font-bold text-lg">All Negotiations</h3> </div>
                    <div className="flex-grow overflow-y-auto">
                        {negotiations.map(nego => (
                            <button key={nego.id} onClick={() => { setSelectedNegotiation(nego); setShowTermsOnMobile(false); }} className={`w-full text-left p-3 flex justify-between items-center ${selectedNegotiation?.id === nego.id ? 'bg-cyan-800' : 'hover:bg-gray-700'}`}>
                                <div><p className="font-semibold">{otherSchoolName(nego)}</p><p className="text-xs text-gray-400">Deal #{nego.id.slice(-6)}</p></div>
                                <div className="flex items-center gap-2">{getStatusIndicator(nego.status)}{getUnreadCount(nego) > 0 && (<span className="w-5 h-5 bg-cyan-500 rounded-full text-xs flex items-center justify-center font-bold">{getUnreadCount(nego)}</span>)}</div>
                            </button>
                        ))}
                    </div>
                </div>
    
                {/* Right Panel: Chat and Terms */}
                {selectedNegotiation ? (
                    // Desktop view: two columns for chat and terms
                    <div className="flex-1 flex flex-col hidden lg:flex">
                        <div className="flex-1 flex flex-row">
                            <div className="flex-1 flex flex-col">
                                <header className="p-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <UserAvatar name={otherSchoolName(selectedNegotiation)} avatarUrl={otherSchoolAvatar(selectedNegotiation)} className="w-8 h-8 rounded-full" />
                                        <p className="font-bold">{otherSchoolName(selectedNegotiation)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setIsProposalDetailsModalOpen(true)} className="px-3 py-1 bg-gray-700 text-cyan-300 rounded-full border border-cyan-700 text-xs font-semibold animate-pulse-custom">View Proposal</button>
                                    </div>
                                </header>
                                {renderChatContent()}
                            </div>
                            <div className="w-1/3 border-l border-gray-700 flex flex-col bg-gray-900/30">
                                <div className="p-4 border-b border-gray-700"><h3 className="font-bold text-lg">Terms of Deal</h3></div>
                                {renderTermsPanelContent()} // This just renders current price, logic is in modal
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="hidden lg:flex flex-1 items-center justify-center text-gray-500">
                        Select a negotiation to view details.
                    </div>
                )}
                
                {/* Mobile View: Toggled Fullscreen Chat/Terms */}
                {selectedNegotiation && (
                    <div className="lg:hidden flex-1 flex flex-col w-full">
                        {showTermsOnMobile ? (
                            <div className="w-full flex flex-col flex-1">
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                    <h3 className="font-bold text-lg">Terms of Deal</h3>
                                    <button onClick={() => setShowTermsOnMobile(false)} className="px-3 py-1 bg-gray-600 rounded text-sm">Back to Chat</button>
                                </div>
                                {renderTermsPanelContent()}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <header className="p-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedNegotiation(null)} className="p-1 -ml-2 text-gray-400">&larr;</button>
                                        <UserAvatar name={otherSchoolName(selectedNegotiation)} avatarUrl={otherSchoolAvatar(selectedNegotiation)} className="w-8 h-8 rounded-full" />
                                        <div><p className="text-sm font-bold">{otherSchoolName(selectedNegotiation)}</p></div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setIsProposalDetailsModalOpen(true)} className="px-3 py-1 bg-gray-700 text-cyan-300 rounded-full border border-cyan-700 text-xs font-semibold animate-pulse-custom">View Proposal</button>
                                        <button onClick={() => setShowTermsOnMobile(true)} className="px-3 py-1 bg-gray-700 text-cyan-300 rounded-full border border-cyan-700 text-xs font-semibold">View Terms</button>
                                    </div>
                                </header>
                                {renderChatContent()}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };
    
    return (
        <div className="space-y-6">
             <h2 className="text-2xl sm:text-3xl font-bold text-white">Student Transfer</h2>
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
                <button onClick={() => handleTabClick('marketplace')} className={`w-full py-2 text-sm font-semibold rounded-md relative ${activeTab === 'marketplace' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                    Marketplace
                    {marketUnreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse-custom">{marketUnreadCount}</span>}
                </button>
                <button onClick={() => handleTabClick('my_items')} className={`w-full py-2 text-sm font-semibold rounded-md relative ${activeTab === 'my_items' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                    My Items
                    {myItemsUnreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse-custom">{myItemsUnreadCount}</span>}
                </button>
                <button onClick={() => handleTabClick('negotiations')} className={`w-full py-2 text-sm font-semibold rounded-md relative ${activeTab === 'negotiations' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                    Negotiations
                    {negotiationsUnreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse-custom">{negotiationsUnreadCount}</span>}
                </button>
            </div>

            {activeTab === 'marketplace' && renderMarketplace()}
            {activeTab === 'my_items' && renderMyItems()}
            {activeTab === 'negotiations' && renderNegotiations()}
            
            {isProposalModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <header className="p-4 border-b border-gray-700 flex-shrink-0">
                            <h3 className="text-xl font-bold">Create a Student Transfer Proposal</h3>
                        </header>
                        
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 mb-4">
                                <h4 className="font-bold text-lg text-cyan-400 mb-2">Staged Student Availability</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    {['O-Level', 'A-Level'].map(level => {
                                        const stagedForLevel = stagedStudents.filter(s => classes.find(c => c.name === s.targetClass)?.level === level);
                                        const staged_male_count = stagedForLevel.filter(s => s.gender === 'Male').length;
                                        const staged_female_count = stagedForLevel.filter(s => s.gender === 'Female').length;

                                        const proposedForLevel = myProposals.filter(p => p.status === 'open' && classes.find(c => c.name === p.className)?.level === level);
                                        const proposedMale = proposedForLevel.filter(p => p.gender === 'Male').reduce((sum, p) => sum + p.numberOfStudents, 0);
                                        const proposedFemale = proposedForLevel.filter(p => p.gender === 'Female').reduce((sum, p) => sum + p.numberOfStudents, 0);
                                        const proposedMixed = proposedForLevel.filter(p => p.status === 'open' && p.className === level && p.gender === 'Mixed').reduce((sum, p) => sum + p.numberOfStudents, 0);
                                        
                                        const remainingMale = staged_male_count - proposedMale;
                                        const remainingFemale = staged_female_count - proposedFemale;
                                        const remainingPool = Math.max(0, (remainingMale + remainingFemale) - proposedMixed);

                                        return (
                                            <div key={level} className="bg-gray-700/50 p-3 rounded-md">
                                                <p className="font-semibold text-white">{level}</p>
                                                <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
                                                    <span className="font-bold text-gray-400"></span>
                                                    <span className="font-bold text-gray-400 text-center">Male</span>
                                                    <span className="font-bold text-gray-400 text-center">Female</span>
                                                    
                                                    <span className="text-gray-400">Staged:</span>
                                                    <span className="text-center">{staged_male_count}</span>
                                                    <span className="text-center">{staged_female_count}</span>
                                                    
                                                    <span className="text-gray-400">Proposed:</span>
                                                    <span className="text-center">{proposedMale}</span>
                                                    <span className="text-center">{proposedFemale}</span>

                                                     <span className="text-gray-400">Mixed Pool:</span>
                                                    <span className="text-center col-span-2">{proposedMixed}</span>

                                                    <span className="font-bold text-green-400 mt-1">Remaining:</span>
                                                    <span className="font-bold text-green-400 text-center mt-1">{remainingMale}</span>
                                                    <span className="font-bold text-green-400 text-center mt-1">{remainingFemale}</span>
                                                </div>
                                                <p className="text-center mt-2 text-green-300 font-bold text-xs">Available Mixed Pool: {remainingPool}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {formError && <p className="text-red-400 text-sm mb-2">{formError}</p>}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400">Level Category</label>
                                    <select name="levelCategory" value={proposalForm.levelCategory} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1">
                                        <option value="">Select Level</option>
                                        <option value="O-Level">O-Level</option>
                                        <option value="A-Level">A-Level</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Class</label>
                                    <select name="className" value={proposalForm.className} onChange={handleFormChange} disabled={!proposalForm.levelCategory} className="w-full p-2 bg-gray-700 rounded mt-1 disabled:bg-gray-600">
                                        <option value="">Select Class</option>
                                        {classes.filter(c => c.level === proposalForm.levelCategory).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Academic Grade</label>
                                    <select name="grade" value={proposalForm.grade} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1">
                                        <option value="">Select Grade</option>
                                        {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Gender</label>
                                    <select name="gender" value={proposalForm.gender} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1">
                                        <option value="Mixed">Mixed Gender</option>
                                        <option value="Male">Male Only</option>
                                        <option value="Female">Female Only</option>
                                    </select>
                                </div>
                                 <div>
                                    <label className="text-xs text-gray-400">Number of Students</label>
                                    <input type="number" name="numberOfStudents" value={proposalForm.numberOfStudents} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1" min="1"/>
                                </div>
                                 <div>
                                    <label className="text-xs text-gray-400">Amount per Student (UGX)</label>
                                    <input type="number" name="pricePerStudent" value={proposalForm.pricePerStudent} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1" min="0"/>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Total Amount</label>
                                    <input type="text" value={`UGX ${totalAmount.toLocaleString()}`} readOnly className="w-full p-2 bg-gray-900 text-gray-400 rounded mt-1"/>
                                </div>
                                 <div>
                                    <label className="text-xs text-gray-400">Deadline</label>
                                    <input type="date" name="deadline" value={proposalForm.deadline} onChange={handleFormChange} className="w-full p-2 bg-gray-700 rounded mt-1"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Description</label>
                                <textarea name="description" value={proposalForm.description} onChange={handleFormChange} placeholder="Add a brief description or justification for the transfer..." rows={3} className="w-full p-2 bg-gray-700 rounded mt-1"></textarea>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Terms and Conditions</label>
                                <textarea name="termsAndConditions" value={proposalForm.termsAndConditions} onChange={handleFormChange} placeholder="Enter specific terms for this transfer..." rows={3} className="w-full p-2 bg-gray-700 rounded mt-1"></textarea>
                            </div>
                        </div>

                        <footer className="p-4 border-t border-gray-700 flex justify-end gap-2 flex-shrink-0">
                            <button onClick={() => setIsProposalModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={handleCreateProposal} className="px-4 py-2 bg-cyan-600 rounded">Create Proposal</button>
                        </footer>
                    </div>
                </div>
            )}
            
            {isFulfillModalOpen && requestToFulfill && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
                        <h3 className="text-xl font-bold">Fulfill Request</h3>
                        
                        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                            <p className="text-sm text-gray-400">Original Request from <strong className="text-white">{requestToFulfill.requestingSchoolName}</strong>:</p>
                            <ul className="text-sm mt-2 space-y-1">
                                <li><span className="text-gray-400">Requested:</span> <span className="font-semibold text-white">{requestToFulfill.numberOfStudents} {requestToFulfill.gender} student(s)</span></li>
                                <li><span className="text-gray-400">Remaining Needed:</span> <span className="font-semibold text-green-400">{requestToFulfill.numberOfStudents - (requestToFulfill.fulfilledStudentsCount || 0)} students</span></li>
                                <li><span className="text-gray-400">For Class:</span> <span className="font-semibold text-white">{requestToFulfill.className} ({requestToFulfill.grade})</span></li>
                                {requestToFulfill.amountPerStudent && <li><span className="text-gray-400">You Offered:</span> <span className="font-semibold text-white">UGX {requestToFulfill.amountPerStudent.toLocaleString()} per student</span></li>}
                            </ul>
                        </div>

                        {formError && <p className="text-red-400 text-sm">{formError}</p>}

                        <div className="space-y-4 pt-4 border-t border-gray-700">
                            <h4 className="font-semibold text-white">Your Offer:</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400">Number of Students to Offer</label>
                                    <input 
                                        type="number"
                                        value={fulfillForm.numberOfStudents}
                                        onChange={e => setFulfillForm(prev => ({...prev, numberOfStudents: Number(e.target.value)}))}
                                        min="1"
                                        max={requestToFulfill.numberOfStudents - (requestToFulfill.fulfilledStudentsCount || 0)}
                                        className="w-full p-2 bg-gray-700 rounded mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Amount per Student (UGX)</label>
                                    <input 
                                        type="number"
                                        value={fulfillForm.pricePerStudent}
                                        onChange={e => setFulfillForm(prev => ({...prev, pricePerStudent: Number(e.target.value)}))}
                                        min="0"
                                        className="w-full p-2 bg-gray-700 rounded mt-1"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <button onClick={() => setIsFulfillModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={handleConfirmFulfillRequest} className="px-4 py-2 bg-cyan-600 rounded">Submit Offer</button>
                        </div>
                    </div>
                </div>
            )}


            {isRequestModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">Create a Request for Students</h3>
                        {formError && <p className="text-red-400 text-sm mb-2">{formError}</p>}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <select name="className" value={requestForm.className} onChange={handleRequestFormChange} className="p-2 bg-gray-700 rounded"><option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                                <select name="grade" value={requestForm.grade} onChange={handleRequestFormChange} className="p-2 bg-gray-700 rounded"><option value="">Select Grade</option>{GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <select name="gender" value={requestForm.gender} onChange={handleRequestFormChange} className="p-2 bg-gray-700 rounded"><option value="Mixed">Mixed Gender</option><option value="Male">Male</option><option value="Female">Female</option></select>
                                <input type="number" name="numberOfStudents" value={requestForm.numberOfStudents} onChange={handleRequestFormChange} placeholder="Number of Students" className="p-2 bg-gray-700 rounded" min="1"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400">Amount per Student (UGX)</label>
                                    <input type="number" name="amountPerStudent" value={requestForm.amountPerStudent} onChange={handleRequestFormChange} className="w-full p-2 bg-gray-700 rounded mt-1" min="0"/>
                                </div>
                                 <div>
                                    <label className="text-xs text-gray-400">Total Amount</label>
                                    <input type="text" value={`UGX ${(requestForm.numberOfStudents * requestForm.amountPerStudent).toLocaleString()}`} readOnly className="w-full p-2 bg-gray-900 text-gray-400 rounded mt-1"/>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsRequestModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                                <button onClick={handleCreateRequest} className="px-4 py-2 bg-cyan-600 rounded">Create Request</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isProposalDetailsModalOpen && selectedNegotiation && (() => {
                const proposal = schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId);
                if (!proposal) return null;
                const totalAmount = (selectedNegotiation.finalPrice ?? proposal.pricePerStudent) * proposal.numberOfStudents;
                const isBuyer = selectedNegotiation.interestedSchoolId === school.id;
                
                // For a negotiation that is in 'payment_made' status, display assigned students
                const isPaymentMade = selectedNegotiation.status === 'payment_made';
                const hasAssignedStudents = selectedNegotiation.assignedStudents && selectedNegotiation.assignedStudents.length > 0;
                const isCompleted = selectedNegotiation.status === 'completed';

                // Disable all controls if the deal is completed
                const allControlsDisabled = isCompleted;

                // --- Fulfillment Request Specifics ---
                const originalRequest = proposal?.requestId ? schoolService.getRequests().find(r => r.id === proposal.requestId) : null;
                const remainingNeededInRequest = originalRequest ? originalRequest.numberOfStudents - (originalRequest.fulfilledStudentsCount || 0) : 0;


                return (
                    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4 border border-gray-600 shadow-xl max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold text-white">Proposal Details</h3>
                            
                            {isCompleted && (
                                <div className="text-center bg-green-500/20 text-green-300 p-4 rounded-lg flex flex-col items-center justify-center animate-pulse-custom">
                                    <AnimatedCheckmarkIcon color="#22C55E" /> {/* Green-500 */}
                                    <p className="font-bold text-xl mt-2">Deal Completed Successfully!</p>
                                    <p className="text-sm">No further actions can be taken.</p>
                                </div>
                            )}

                            {originalRequest && isBuyer && (
                                <div className="bg-gray-700/50 p-4 rounded-lg border border-yellow-500/50">
                                    <h4 className="font-bold text-lg text-yellow-400 mb-2">Your Original Request:</h4>
                                    <ul className="text-sm mt-2 space-y-1">
                                        <li><span className="text-gray-400">Requested:</span> <span className="font-semibold text-white">{originalRequest.numberOfStudents} {originalRequest.gender} student(s)</span></li>
                                        <li><span className="text-gray-400">Remaining Needed:</span> <span className="font-semibold text-green-400">{remainingNeededInRequest} students</span></li>
                                        <li><span className="text-gray-400">For Class:</span> <span className="font-semibold text-white">{originalRequest.className} ({originalRequest.grade})</span></li>
                                        {originalRequest.amountPerStudent && <li><span className="text-gray-400">You Offered:</span> <span className="font-semibold text-white">UGX {originalRequest.amountPerStudent.toLocaleString()} per student</span></li>}
                                    </ul>
                                </div>
                            )}

                            {(!originalRequest || !isBuyer) && ( 
                                <div className="bg-gray-700/50 p-4 rounded-lg space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-400">From:</span><span className="font-semibold">{proposal.proposingSchoolName}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Students:</span><span className="font-semibold">{proposal.numberOfStudents} ({proposal.gender})</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Class:</span><span className="font-semibold">{proposal.className}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Grade:</span><span className="font-semibold">{proposal.grade}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Price/Student:</span><span className="font-semibold">UGX {proposal.pricePerStudent.toLocaleString()}</span></div>
                                    <div className="flex justify-between font-bold border-t border-gray-600 pt-2 mt-2"><span className="text-gray-300">Total Amount:</span><span className="text-cyan-400">UGX {totalAmount.toLocaleString()}</span></div>
                                    {proposal.termsAndConditions && (
                                        <div className="bg-gray-700/50 p-3 rounded-md mt-2 border-t border-gray-600 pt-2">
                                            <h5 className="font-bold text-sm text-gray-300 mb-1">Terms & Conditions</h5>
                                            <p className="text-xs text-gray-400 whitespace-pre-wrap">{proposal.termsAndConditions}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="border-t border-gray-700 pt-4">
                                <h4 className="font-bold text-lg text-white mb-2">Negotiation Actions</h4>
                                {isBuyer ? (
                                    <>
                                        {isPaymentMade ? (
                                            <>
                                                {hasAssignedStudents ? (
                                                    <div className="space-y-4">
                                                        <h5 className="font-bold text-green-400">Students Assigned:</h5>
                                                        <ul className="space-y-2 text-sm max-h-40 overflow-y-auto bg-gray-700 p-3 rounded-md">
                                                            {selectedNegotiation.assignedStudents?.map(s => (
                                                                <li key={s.studentId} className="flex justify-between items-center text-white">
                                                                    <span>{s.studentName}</span>
                                                                    <span className="text-gray-400 text-xs">{s.indexNumber}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <p className="text-center text-green-300">Review the assigned students. Click below to finalize the transfer and release funds.</p>
                                                        <button onClick={handleAcceptStudents} disabled={allControlsDisabled} className="w-full py-2 bg-green-600 rounded font-semibold disabled:bg-gray-600">
                                                            Accept Students & Complete Deal
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-center text-yellow-300">Payment is complete. Waiting for the seller to assign students.</p>
                                                )}
                                            </>
                                        ) : selectedNegotiation.status === 'active' && selectedNegotiation.isNegotiable ? (
                                            <div className="space-y-3">
                                                {selectedNegotiation.isBuyerOfferActive ? (
                                                    <p className="text-center text-yellow-300">Your offer of UGX {selectedNegotiation.buyerOffer?.toLocaleString()} is pending review.</p>
                                                ) : selectedNegotiation.sellerOffer ? (
                                                     <p className="text-center text-cyan-300">Seller has countered with UGX {selectedNegotiation.sellerOffer.toLocaleString()}.</p>
                                                ) : null}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <input type="number" placeholder="Set Your Offer (UGX)" value={buyerOffer} onChange={e => setBuyerOffer(e.target.value)} disabled={allControlsDisabled} className="flex-grow p-2 bg-gray-700 rounded min-w-0" />
                                                    <button onClick={() => handleUpdateTerms({ buyerOffer: Number(buyerOffer) })} disabled={allControlsDisabled || !buyerOffer} className="px-3 py-2 bg-cyan-600 rounded font-semibold whitespace-nowrap text-sm">Submit Offer</button>
                                                    <button onClick={() => handleUpdateTerms({ finalPrice: selectedNegotiation.sellerOffer ?? proposal.pricePerStudent, status: 'accepted' })} disabled={allControlsDisabled} className="px-3 py-2 bg-green-600 rounded font-semibold whitespace-nowrap text-sm">Accept Price</button>
                                                </div>
                                            </div>
                                        ) : selectedNegotiation.status === 'accepted' || selectedNegotiation.isNegotiable === false ? (
                                            <div className="space-y-3">
                                                <p className="text-center font-semibold">Final Agreed Price: <span className="text-green-400">UGX {selectedNegotiation.finalPrice?.toLocaleString()}</span> per student.</p>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-700 rounded-md">
                                                    <input type="checkbox" checked={areTermsAccepted} onChange={e => setAreTermsAccepted(e.target.checked)} disabled={allControlsDisabled} className="form-checkbox h-5 w-5 text-cyan-600" />
                                                    <span>I agree to the terms and conditions of this transfer.</span>
                                                </label>
                                                <button onClick={handlePayIntoEscrow} disabled={!areTermsAccepted || isPaymentMade || allControlsDisabled} className={`w-full py-2 ${isPaymentMade ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed`}>
                                                    {isPaymentMade ? "Payment Sent" : "Pay Now"}
                                                </button>
                                                {isPaymentMade && <p className="text-center text-sm text-green-300 mt-2">Payment is complete. Waiting for seller to assign students.</p>}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400">Waiting for seller's action.</p>
                                        )}
                                    </>
                                ) : ( // Seller's View
                                    <div className="space-y-3">
                                        {isPaymentMade && hasAssignedStudents ? (
                                            <div className="space-y-4">
                                                 <h5 className="font-bold text-green-400">Students Automatically Assigned:</h5>
                                                 <ul className="space-y-2 text-sm max-h-40 overflow-y-auto bg-gray-700 p-3 rounded-md">
                                                    {selectedNegotiation.assignedStudents?.map(s => (
                                                        <li key={s.studentId} className="flex justify-between items-center text-white">
                                                            <span>{s.studentName}</span>
                                                            <span className="text-gray-400 text-xs">{s.indexNumber}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <p className="text-center text-yellow-300">Waiting for buyer to review and accept students.</p>
                                            </div>
                                        ) : isPaymentMade && !hasAssignedStudents ? (
                                            <p className="text-center text-yellow-300">Payment received. The system is automatically assigning students to this deal.</p>
                                        ) : selectedNegotiation.isBuyerOfferActive ? (
                                            <>
                                                <p>Buyer has offered <strong className="text-yellow-300">UGX {selectedNegotiation.buyerOffer?.toLocaleString()}</strong> per student.</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => handleUpdateTerms({ finalPrice: selectedNegotiation.buyerOffer, status: 'accepted' })} disabled={allControlsDisabled} className="px-3 py-1 bg-green-600 rounded text-sm">Accept Offer</button>
                                                    <button onClick={handleRejectBuyerOffer} disabled={allControlsDisabled} className="px-3 py-1 bg-red-600 rounded text-sm">Reject Offer</button>
                                                    <div className="flex items-center gap-2 w-full"><input type="number" placeholder="Counter Offer (UGX)" value={sellerOffer} onChange={e => setSellerOffer(e.target.value)} disabled={allControlsDisabled} className="p-2 bg-gray-700 rounded w-full" /><button onClick={() => handleUpdateTerms({ sellerOffer: Number(sellerOffer) })} disabled={allControlsDisabled} className="px-3 py-2 bg-yellow-600 rounded text-sm whitespace-nowrap">Counter</button></div>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-gray-400">Waiting for buyer's offer.</p>
                                        )}
                                        {!isPaymentMade && (
                                            <div className="border-t border-gray-600 pt-3 mt-3">
                                                {!isSettingFinalPrice ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button onClick={() => setIsSettingFinalPrice(true)} disabled={allControlsDisabled} className="px-3 py-1 bg-green-700 rounded text-sm hover:bg-green-600 transition-colors">Set Final Price</button>
                                                        <button onClick={handleRejectAllNegotiations} disabled={allControlsDisabled} className="px-3 py-1 bg-red-700 rounded text-sm hover:bg-red-600 transition-colors">Reject All Negotiations</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 animate-fade-in-up">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Enter Price" 
                                                            value={finalPriceInput} 
                                                            onChange={e => setFinalPriceInput(e.target.value)} 
                                                            className="p-1 bg-gray-700 rounded text-sm w-32 focus:ring-2 focus:ring-cyan-500 outline-none" 
                                                            autoFocus
                                                        />
                                                        <button 
                                                            onClick={() => {
                                                                if (finalPriceInput && !isNaN(Number(finalPriceInput))) {
                                                                    handleUpdateTerms({ finalPrice: Number(finalPriceInput), status: 'accepted' });
                                                                    setIsSettingFinalPrice(false);
                                                                    setFinalPriceInput('');
                                                                }
                                                            }} 
                                                            className="px-3 py-1 bg-green-600 rounded text-sm font-bold hover:bg-green-500"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button 
                                                            onClick={() => { setIsSettingFinalPrice(false); setFinalPriceInput(''); }} 
                                                            className="px-3 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="text-right mt-4">
                                <button onClick={() => setIsProposalDetailsModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            
            {isPaymentModalOpen && selectedNegotiation && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4 text-center">
                        <h3 className="text-xl font-bold">Confirm Payment</h3>
                        <p className="text-sm text-gray-400">Enter your E-Wallet PIN to authorize this payment.</p>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Total Amount</p>
                            <p className="font-bold text-2xl text-cyan-400">
                                UGX {( (selectedNegotiation.finalPrice ?? 0) * (schoolService.getProposals().find(p => p.id === selectedNegotiation.proposalId)?.numberOfStudents ?? 0)).toLocaleString()}
                            </p>
                        </div>
                        <input 
                            type="password" 
                            value={pin} 
                            onChange={e => {setPin(e.target.value.replace(/\D/g, '')); setPinError('');}} 
                            maxLength={4} 
                            className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-900 rounded-md"
                            autoFocus
                        />
                        <PinStrengthIndicator pin={pin} />
                        {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                        <div className="flex justify-center gap-2 pt-2">
                            <button onClick={() => { setIsPaymentModalOpen(false); setPin(''); setPinError(''); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={handleConfirmPayment} className="px-4 py-2 bg-cyan-600 rounded">Confirm Payment</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StudentTransferMarketplace;
