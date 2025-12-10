
// components/OnlineFeedPage.tsx


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, AdminUser, PostComment, ChatConversation, ChatMessage, ChatAttachment, Event, Place, MarketplaceListing, MarketplaceMedia, Story, GroupPost, School, Receipt, ReceiptStatus, StagedMarketplaceOrder } from '../types';
import ProfilePage from './ProfilePage';
import * as userService from '../services/userService';
import { getHomePageContent } from '../services/homePageService';
import { getAllSchools } from '../services/schoolService';
import * as studentService from '../services/studentService';
import UserAvatar from './UserAvatar';
import { getAllAdminUsers } from '../services/userService';
import * as groupService from '../services/groupService';
import ConfirmationModal from './ConfirmationModal';
import GroupsPage from './GroupsPage';
import MessagesPage from './MessagesPage';
import * as chatService from '../services/chatService';
import * as apiService from '../services/apiService';
import { getPlaceSuggestionsFromAI, categorizeListing, decodeBarcodeWithGoogle, translateText } from '../services/apiService';
import * as marketplaceService from '../services/marketplaceService';
import * as eWalletService from '../services/eWalletService';
import * as receiptService from '../services/receiptService';
import PinStrengthIndicator from './PinStrengthIndicator';
import { CartIcon, MinusIcon, PlusIcon, IconComposerPhoto, IconComposerVideo, IconComposerFile, IconLink, IconCopyLink, IconCalendar, IconLocation, IconTrash, IconLike, IconDislike, IconComment, IconEye, IconMic, CloseIcon, HamburgerIcon, IconNavFeed, IconNavGroups, IconNavEvents, IconNavMarketplace, IconNavChat, IconOnline, IconMenuKebab } from './Icons';


// --- TYPE DEFINITIONS ---
interface OnlineUser { id: string; name: string; avatar: string; }
interface Announcement { id: string; title: string; author: string; content: string; }

const findFullUserById = (userId: string): User | AdminUser | null => {
    const schoolUsers = studentService.getAllSchoolUsers();
    const foundSchoolUser = schoolUsers.find(u => u.studentId === userId);
    if (foundSchoolUser) return foundSchoolUser;

    const adminUsers = getAllAdminUsers();
    const foundAdminUser = adminUsers.find(u => u.id === userId);
    if (foundAdminUser) return foundAdminUser;
    
    return null;
};

// Helper to safely get user ID for the key prop (moved to module scope)
const getUserIdForKey = (u: User | AdminUser): string => {
    if ('studentId' in u) {
        return u.studentId;
    }
    return (u as AdminUser).id; // Cast to AdminUser as it must be the other type
};

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const timeSince = (timestamp: number | undefined): string => {
    const safeTimestamp = timestamp ?? 0;
    const seconds = Math.floor((Date.now() - safeTimestamp) / 1000);
    if (seconds < 2) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};


const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

const AnimatedCheckmarkIcon: React.FC<{ color: string }> = ({ color }) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3}>
        <path className="checkmark__path" d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);


// --- MarketplacePaymentModal Component Definition ---
interface MarketplacePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    stagedCheckout: (MarketplaceListing & { quantity: number })[];
    stagedCheckoutTotal: number;
    userWalletBalance: number;
    onConfirmPayment: (pin: string) => void;
    pinError: string;
    setPinError: (error: string) => void;
}

const MarketplacePaymentModal: React.FC<MarketplacePaymentModalProps> = ({
    isOpen,
    onClose,
    stagedCheckout,
    stagedCheckoutTotal,
    userWalletBalance,
    onConfirmPayment,
    pinError,
    setPinError,
}) => {
    const [pin, setPin] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[150] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4 text-center">
                <h3 className="text-xl font-bold">Confirm Marketplace Payment</h3>
                <p className="text-sm text-gray-400">Please enter your E-Wallet PIN to confirm this purchase.</p>
                <div className="bg-gray-700 p-4 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Order Total:</span><strong>UGX {stagedCheckoutTotal.toLocaleString()}</strong></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Your Balance:</span><span>UGX {userWalletBalance.toLocaleString()}</span></div>
                </div>
                <input type="password" value={pin} onChange={e => {setPin(e.target.value.replace(/\D/g, '')); setPinError('');}} maxLength={4} className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-900 rounded-md" />
                <PinStrengthIndicator pin={pin} />
                {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                <div className="flex justify-center gap-2 pt-2">
                    <button onClick={() => {onClose(); setPin(''); setPinError('');}} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    <button onClick={() => onConfirmPayment(pin)} className="px-4 py-2 bg-cyan-600 rounded">Confirm Payment</button>
                </div>
            </div>
        </div>
    );
};


// --- Listing Editor Modal ---
interface ListingEditorModalProps {
    listing?: MarketplaceListing | null;
    onClose: () => void;
    onSave: (data: Omit<MarketplaceListing, 'id' | 'createdAt' | 'sellerId' | 'sellerName' | 'sellerAvatar'>) => void;
}

const ListingEditorModal: React.FC<ListingEditorModalProps> = ({ listing, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: listing?.title || '',
        description: listing?.description || '',
        price: listing?.price || 0,
        category: listing?.category || 'Other',
        condition: listing?.condition || 'used',
        location: listing?.location || '',
        availableUnits: listing?.availableUnits || 1,
        imageUrl: listing?.media[0]?.url || '',
    });

    const handleSave = () => {
        if (!formData.title || !formData.description || formData.price <= 0) {
            alert("Please fill all required fields correctly.");
            return;
        }
        
        onSave({
            title: formData.title,
            description: formData.description,
            price: Number(formData.price),
            category: formData.category as any,
            condition: formData.condition as any,
            location: formData.location || 'School Campus',
            availableUnits: Number(formData.availableUnits),
            media: formData.imageUrl ? [{ type: 'image', url: formData.imageUrl }] : [],
            status: 'available'
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setFormData(prev => ({ ...prev, imageUrl: base64 }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[130] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-white">{listing ? 'Edit Listing' : 'Create New Listing'}</h3>
                
                <input 
                    placeholder="Title" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    className="w-full p-2 bg-gray-700 rounded text-white"
                />
                
                <textarea 
                    placeholder="Description" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    rows={3}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <input 
                        type="number" 
                        placeholder="Price (UGX)" 
                        value={formData.price} 
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                        className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                    <input 
                        type="number" 
                        placeholder="Quantity" 
                        value={formData.availableUnits} 
                        onChange={e => setFormData({...formData, availableUnits: Number(e.target.value)})} 
                        className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <select 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        className="w-full p-2 bg-gray-700 rounded text-white"
                    >
                        <option value="Electronics">Electronics</option>
                        <option value="Books">Books</option>
                        <option value="Clothing">Clothing</option>
                        <option value="Furniture">Furniture</option>
                        <option value="Services">Services</option>
                        <option value="Other">Other</option>
                    </select>
                     <select 
                        value={formData.condition} 
                        onChange={e => setFormData({...formData, condition: e.target.value})} 
                        className="w-full p-2 bg-gray-700 rounded text-white"
                    >
                        <option value="used">Used</option>
                        <option value="new">New</option>
                    </select>
                </div>
                
                <input 
                    placeholder="Location (Optional)" 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    className="w-full p-2 bg-gray-700 rounded text-white"
                />

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Image</label>
                    <div className="flex gap-2">
                        <input type="file" onChange={handleFileUpload} className="text-sm text-gray-300" />
                    </div>
                    {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-32 object-cover rounded" />}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 rounded hover:bg-cyan-700">Save Listing</button>
                </div>
            </div>
        </div>
    );
};


// --- CartModal Component Definition ---
interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
    cart: Record<string, number>;
    listings: MarketplaceListing[]; // All available listings to get item details
    onUpdateQuantity: (listingId: string, quantity: number) => void;
    onStartMessage: (userId: string) => void;
    onNavigateToWallet: () => void; // Callback to switch to E-Wallet view in parent
    user: User | AdminUser;
    onOpenMarketplacePayment: (stagedItems: (MarketplaceListing & { quantity: number })[], total: number) => void;
    onOrderStaged?: (order: StagedMarketplaceOrder) => void;
    onClearCart: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose, cart, listings, onUpdateQuantity, onStartMessage, onNavigateToWallet, user, onOpenMarketplacePayment, onOrderStaged, onClearCart }) => {
    const cartItems = useMemo(() => {
        return Object.entries(cart)
            .map(([listingId, quantity]) => {
                const listing = listings.find(l => l.id === listingId);
                return listing ? { ...listing, quantity } : null;
            })
            .filter((item): item is MarketplaceListing & { quantity: number } => item !== null);
    }, [cart, listings]);

    const cartTotal = useMemo(() => {
        return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    }, [cartItems]);

    const userWallet = eWalletService.getWalletForUser('studentId' in user ? user.studentId : user.id);


    if (!isOpen) return null;

    const handleCheckout = () => {
        if (cartItems.length === 0) {
            alert("Your cart is empty!");
            return;
        }

        // Check for insufficient funds first
        if (userWallet.balance < cartTotal) {
             const stagedOrder: StagedMarketplaceOrder = {
                cart: cart, // Record<string, number>
                totalAmount: cartTotal,
             };
             // Call the staging callback which will handle saving via service and redirecting
             onOrderStaged?.(stagedOrder);
             onClose(); // Close cart modal as we are redirecting
        } else {
            // Proceed to payment if funds are sufficient
            eWalletService.stageMarketplaceCheckout(cartItems); // Legacy staging for payment modal? No, this is for payment confirmation data
            onOpenMarketplacePayment(cartItems, cartTotal);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[150] p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg text-white flex flex-col max-h-[90vh]">
                <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-xl font-bold">Your Shopping Cart</h3>
                     <div className="flex items-center gap-2">
                        {cartItems.length > 0 && (
                             <button onClick={onClearCart} className="flex items-center text-red-400 hover:text-red-300 text-sm mr-2" title="Clear Cart">
                                <IconTrash /><span className="ml-1">Clear</span>
                             </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close cart">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </header>
                <main className="flex-grow overflow-y-auto p-4 space-y-4">
                    {cartItems.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Your cart is empty.</p>
                    ) : (
                        cartItems.map(item => (
                            <div key={item.id} className="flex items-center space-x-3 bg-gray-700 p-3 rounded-lg">
                                <img src={item.media[0]?.url} alt={item.title} className="w-16 h-16 object-cover rounded-md" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-white">{item.title}</p>
                                    <p className="text-sm text-gray-400">UGX {item.price.toLocaleString()} each</p>
                                    <p className="text-xs text-gray-500">In stock: {item.availableUnits}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="p-1 bg-gray-600 rounded-full hover:bg-gray-500 disabled:opacity-50"><MinusIcon /></button>
                                    <span className="w-6 text-center text-white">{item.quantity}</span>
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.availableUnits} className="p-1 bg-gray-600 rounded-full hover:bg-gray-500 disabled:opacity-50"><PlusIcon /></button>
                                </div>
                            </div>
                        ))
                    )}
                </main>
                <footer className="p-4 border-t border-gray-700 flex-shrink-0">
                    <div className="flex justify-between items-center font-bold text-xl mb-4">
                        <span>Total:</span>
                        <span>UGX {cartTotal.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-bold text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        Proceed to Payment
                    </button>
                </footer>
            </div>
        </div>
    );
};


interface ReleasePaymentModalProps {
    receipt: Receipt;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

const ReleasePaymentModal: React.FC<ReleasePaymentModalProps> = ({ receipt, onClose, onSuccess }) => {
    const [sellerIdInput, setSellerIdInput] = useState('');
    const [error, setError] = useState('');
    const [isReleasing, setIsReleasing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRelease = async () => {
        setError('');
        if (!sellerIdInput.trim()) {
            setError("Please enter or scan the seller's User ID.");
            return;
        }

        setIsReleasing(true);
        try {
            eWalletService.releaseEscrowPayment(receipt, sellerIdInput.trim());
            onSuccess(`Payment released to ${receipt.partyName} successfully.`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsReleasing(false);
        }
    };
    
    // FIX: Renamed 'setVerificationId' to 'setSellerIdInput' to match state variable.
    const handleScanSuccess = (decodedText: any) => {
        setSellerIdInput(String(decodedText));
        setIsScanning(false);
    };

    const processImage = async (dataUrl: string) => {
        const base64Image = dataUrl.split(',')[1];
        try {
            const decodedContent = await apiService.decodeBarcodeWithGoogle(base64Image, 'image/jpeg');
            if (decodedContent) {
                setSellerIdInput(decodedContent);
            } else {
                setError("No scannable code found in the image.");
            }
        } catch (err) {
            if (!(err instanceof Error && err.message.includes("No scannable code"))) {
                setError("Failed to process image. Please try again.");
            } else {
                 setError("No scannable code found in the image.");
            }
        } finally {
            setIsScanning(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                processImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setIsScanning(false);
        }
    };

    const handleSnap = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            processImage(canvas.toDataURL('image/jpeg'));
        }
    };

    useEffect(() => {
        if (isScanning) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch(err => {
                    setError("Could not access camera. Please allow permission.");
                    setIsScanning(false);
                });
        } else {
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        }
    }, [isScanning]);
    

    if (isScanning) {
        return (
             <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[110] p-4 flex-col">
                <video ref={videoRef} autoPlay playsInline className="w-full max-w-md rounded-lg mb-4"></video>
                <div className="flex gap-4">
                    <button onClick={handleSnap} className="px-6 py-3 bg-cyan-600 text-white font-bold rounded-full">Take Picture</button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-600 rounded-md">Upload File</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <button onClick={() => setIsScanning(false)} className="px-4 py-2 bg-gray-600 rounded-md">Cancel</button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[110] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                <h3 className="text-xl font-bold">Release Payment</h3>
                <div className="bg-gray-700 p-3 rounded-lg">
                    <p>You are releasing payment for order from <strong>{receipt.partyName}</strong>.</p>
                    <p className="font-bold text-lg text-cyan-400">Total: UGX {receipt.amount.toLocaleString()}</p>
                </div>
                <p className="text-sm text-gray-400">
                    To confirm you have received your item(s) satisfactorily, please enter or scan the seller's User ID. This will transfer the funds from the escrow system to their account.
                </p>
                <div>
                    <label className="text-sm text-gray-300">Seller's User ID</label>
                    <div className="flex gap-2">
                        <input
                            value={sellerIdInput}
                            onChange={(e) => setSellerIdInput(e.target.value)}
                            placeholder="Enter seller ID manually"
                            className="w-full p-2 bg-gray-900 rounded-md"
                        />
                        <button onClick={() => setIsScanning(true)} className="p-2 bg-gray-600 rounded-md">Scan</button>
                    </div>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    <button onClick={handleRelease} disabled={isReleasing} className="px-4 py-2 bg-green-600 rounded disabled:bg-gray-500">
                        {isReleasing ? 'Releasing...' : 'Confirm & Release Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const PostComposer: React.FC<{ user: User | AdminUser; onPost: (htmlContent: string) => void }> = ({ user, onPost }) => {
    const [title, setTitle] = useState('');
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const savedSelectionRef = useRef<Range | null>(null);

    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const isInternalProductLink = (url: string): boolean => {
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.origin === window.location.origin && urlObj.hash.startsWith('#/marketplace/view/listing/');
        } catch {
            return url.startsWith('#/marketplace/view/listing/');
        }
    };

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
            savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        const selection = window.getSelection();
        if (selection && savedSelectionRef.current) {
            selection.removeAllRanges();
            selection.addRange(savedSelectionRef.current);
        }
    };

    const insertHtmlAtCursor = (html: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();
        
        const el = document.createElement("div");
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node, lastNode;
        while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);

        if (lastNode) {
            const newRange = range.cloneRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    };

    const handleLink = () => {
        if (!editorRef.current) return;
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            alert("Please highlight the text you want to turn into a link first.");
            return;
        }

        saveSelection();
        setLinkUrl('https://');
        setIsLinkModalOpen(true);
    };
    
    const handleAddLink = () => {
        if (!editorRef.current || !linkUrl.trim()) return;
        
        editorRef.current.focus();
        restoreSelection();
        
        document.execCommand('createLink', false, linkUrl);
        
        const selection = window.getSelection();
        if (selection && selection.focusNode) {
            let parentElement = selection.focusNode.parentElement;
            while (parentElement && parentElement.tagName !== 'A') {
                parentElement = parentElement.parentElement;
            }
            if (parentElement && parentElement.tagName === 'A') {
                parentElement.className = "bg-cyan-600 text-white px-3 py-1 rounded-full inline-block text-sm font-semibold no-underline hover:bg-cyan-700 transition-colors shadow-md";
                
                if (!isInternalProductLink(linkUrl)) {
                    parentElement.setAttribute('target', '_blank');
                    parentElement.setAttribute('rel', 'noopener noreferrer');
                } else {
                    const urlObj = new URL(linkUrl, window.location.origin);
                    parentElement.setAttribute('href', urlObj.hash);
                }
            }
        }
        
        setIsLinkModalOpen(false);
        setLinkUrl('');
        savedSelectionRef.current = null;
    };


    const processFiles = async (files: FileList) => {
        if (savedSelectionRef.current) {
             const sel = window.getSelection();
             if (sel) {
                sel.removeAllRanges();
                sel.addRange(savedSelectionRef.current);
             }
        }

        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (file) {
                try {
                    const dataUrl = await fileToBase64(file);
                    let htmlToInsert = '';
                    if (file.type.startsWith('image/')) {
                        htmlToInsert = `<div style="display: flex; justify-content: center; margin: 0.5rem 0;"><img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; display: block; border-radius: 8px;" /></div><br>`;
                    } else if (file.type.startsWith('video/')) {
                        htmlToInsert = `<div style="display: flex; justify-content: center; margin: 0.5rem 0;"><video controls src="${dataUrl}" style="max-width: 100%; display: block; border-radius: 8px;"></video></div><br>`;
                    } else {
                        htmlToInsert = `<div style="padding: 1rem; background-color: #374151; border-radius: 8px; margin: 0.5rem 0;"><a href="${dataUrl}" download="${file.name}" style="text-decoration: none; color: #9ca3af; font-weight: bold;">Download: ${file.name}</a></div><br>`;
                    }
                    insertHtmlAtCursor(htmlToInsert);
                } catch (error) {
                    console.error("Error processing file:", error);
                }
            }
        }
        savedSelectionRef.current = null;
    };

    const handleAttachmentClick = (acceptType: string) => {
        saveSelection();
        if (fileInputRef.current) {
            fileInputRef.current.accept = acceptType;
            fileInputRef.current.click();
        }
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        restoreSelection();
        if (e.target.files) {
            await processFiles(e.target.files);
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePost = () => {
        if (editorRef.current && title.trim()) {
            const htmlContent = editorRef.current.innerHTML;
            if (!htmlContent.trim().replace(/<br\s*\/?>/ig, '')) return;
            const fullContent = `<h3><strong>${title.trim()}</strong></h3>${htmlContent}`;
            onPost(fullContent);
            editorRef.current.innerHTML = '';
            setTitle('');
        }
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        const linkedText = sanitizedText.replace(urlRegex, (url) => {
            if (isInternalProductLink(url)) {
                const urlObj = new URL(url, window.location.origin);
                return `<a href="${urlObj.hash}" style="color: #22d3ee;">${url}</a>`;
            } else {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #22d3ee;">${url}</a>`;
            }
        });
        document.execCommand('insertHTML', false, linkedText);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        
        const sel = window.getSelection();
        if (sel) {
            let range;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
            } else {
                e.preventDefault();
                // @ts-ignore
                range = document.createRange();
                // @ts-ignore
                range.setStart(e.rangeParent, e.rangeOffset);
            }
            if (range) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        
        saveSelection();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };
    
    const editorIsEmpty = !editorRef.current?.innerHTML.trim() || editorRef.current?.innerHTML.trim() === '<br>';

    return (
        <>
            <div 
                className={`bg-gray-800 rounded-lg transition-all duration-200 ${isDragOver ? 'border-2 border-dashed border-cyan-500' : 'border-2 border-transparent'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex items-start gap-3 p-4">
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="w-full">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Post Title..."
                            className="w-full bg-transparent text-xl font-bold pb-2 focus:outline-none placeholder-gray-400 border-b border-gray-700"
                        />
                        <div 
                            ref={editorRef}
                            contentEditable="true"
                            onPaste={handlePaste}
                            data-placeholder={`What's on your mind, ${user.name.split(' ')[0]}?`}
                            className="w-full bg-transparent p-3 -ml-3 mt-2 min-h-[84px] max-h-60 overflow-y-auto focus:outline-none prose prose-sm prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                        />
                    </div>
                </div>
                
                <div className="mt-3 p-4 border-t border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button type="button" onClick={() => handleAttachmentClick('image/*')} title="Add Photos" className="p-2 text-gray-400 hover:text-green-500 hover:bg-gray-700 rounded-full transition-colors">
                            <IconComposerPhoto />
                        </button>
                        <button type="button" onClick={() => handleAttachmentClick('video/*')} title="Add Video" className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full transition-colors">
                            <IconComposerVideo />
                        </button>
                        <button type="button" onClick={() => handleAttachmentClick('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt')} title="Attach File" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-700 rounded-full transition-colors">
                            <IconComposerFile />
                        </button>
                        <button type="button" onClick={handleLink} title="Add Link" className="p-2 text-gray-400 hover:text-cyan-500 hover:bg-gray-700 rounded-full transition-colors">
                            <IconLink />
                        </button>
                    </div>
                    <button onClick={handlePost} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:opacity-50" disabled={!title.trim() || editorIsEmpty}>Post</button>
                </div>
                
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
            
            {isLinkModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold">Embed Link</h3>
                        <p className="text-sm text-gray-400">Enter the URL you want to link to the selected text.</p>
                        <div>
                            <label htmlFor="link-url" className="text-xs text-gray-400">URL</label>
                            <input 
                                id="link-url"
                                type="url"
                                value={linkUrl}
                                onChange={e => setLinkUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full p-2 bg-gray-700 rounded mt-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Cancel</button>
                            <button onClick={handleAddLink} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Add Link</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const PostRenderer: React.FC<{ content: string; onInternalLinkClick: (path: string) => void }> = ({ content, onInternalLinkClick }) => {
    const sanitizedContent = useMemo(() => {
        const DOMPurify = (window as any).DOMPurify;
        if (!DOMPurify) return content;
        return DOMPurify.sanitize(content, { ADD_ATTR: ['target', 'rel', 'style', 'class'], ADD_TAGS: ['video'], ADD_CLASSES: { 'a': true } });
    }, [content]);

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        let target = e.target as HTMLElement;
        while (target && target.tagName !== 'A' && target.parentElement) {
            if (target.parentElement.classList.contains('prose')) break;
            target = target.parentElement;
        }

        if (target && target.tagName === 'A') {
            const anchor = target as HTMLAnchorElement;
            const href = anchor.getAttribute('href');

            if (href) {
                try {
                    const url = new URL(href, window.location.origin);
                    if (url.origin === window.location.origin && url.hash.startsWith('#/marketplace/view/listing/')) {
                        e.preventDefault();
                        onInternalLinkClick(url.hash);
                    }
                } catch (error) {
                    if (href.startsWith('#/marketplace/view/listing/')) {
                        e.preventDefault();
                        onInternalLinkClick(href);
                    }
                }
            }
        }
    };

    return (
        <div
            onClick={handleContentClick}
            className="prose prose-sm prose-invert max-w-none text-gray-300 [&_img]:rounded-lg [&_video]:rounded-lg [&_img]:max-h-96 [&_video]:max-h-96 [&_img]:mx-auto [&_video]:mx-auto"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
};

// FIX: Add UserProfileModal component since it's used
interface UserProfileModalProps {
    userToShow: User | AdminUser;
    currentUser: User | AdminUser;
    onClose: () => void;
    onStartMessage: (userId: string) => void;
    onRefresh: () => void;
}
const UserProfileModal: React.FC<UserProfileModalProps> = ({ userToShow, currentUser, onClose, onStartMessage, onRefresh }) => {
    const userToShowId = getUserIdForKey(userToShow);
    const currentUserId = getUserIdForKey(currentUser);
    const [isFollowing, setIsFollowing] = useState(groupService.isFollowing(currentUserId, userToShowId));
    
    const handleFollowToggle = () => {
        const newState = groupService.toggleFollow(currentUserId, userToShowId);
        setIsFollowing(newState);
        onRefresh(); // Refresh parent to update counts potentially
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[120] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <UserAvatar name={userToShow.name} avatarUrl={userToShow.avatarUrl} className="w-16 h-16 rounded-full text-2xl"/>
                        <div>
                            <h3 className="text-xl font-bold">{userToShow.name}</h3>
                            <p className="text-sm text-gray-400">@{userToShowId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-2xl text-gray-500 hover:text-white">&times;</button>
                </div>
                <div className="flex justify-around text-center border-t border-b border-gray-700 py-3">
                    <div>
                        <p className="font-bold text-lg">{groupService.getFollowerCount(userToShowId)}</p>
                        <p className="text-xs text-gray-400">Followers</p>
                    </div>
                     <div>
                        <p className="font-bold text-lg">{groupService.getFollowingCount(userToShowId)}</p>
                        <p className="text-xs text-gray-400">Following</p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={() => onStartMessage(userToShowId)} className="px-4 py-2 bg-cyan-600 rounded">Message</button>
                    <button onClick={handleFollowToggle} className={`px-4 py-2 rounded ${isFollowing ? 'bg-gray-600' : 'bg-blue-600'}`}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// FIX: Add ListingDetailModal component since it's used
interface ListingDetailModalProps {
    listing: MarketplaceListing;
    onClose: () => void;
    onStartMessage: (userId: string) => void;
    currentUserId: string;
    onAddToCart: (listing: MarketplaceListing) => void;
}
const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ listing, onClose, onStartMessage, currentUserId, onAddToCart }) => {
    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[120] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                <h3 className="text-xl font-bold">{listing.title}</h3>
                <p>Description: {listing.description}</p>
                <p>Price: UGX {listing.price.toLocaleString()}</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Close</button>
                    {listing.sellerId !== currentUserId && (
                         <button onClick={() => onAddToCart(listing)} className="px-4 py-2 bg-cyan-600 rounded">Add to Cart</button>
                    )}
                    {listing.sellerId !== currentUserId && (
                        <button onClick={() => onStartMessage(listing.sellerId)} className="px-4 py-2 bg-blue-600 rounded">Message Seller</button>
                    )}
                </div>
            </div>
        </div>
    );
};

// FIX: Add MapPreviewModal component since it's used
const MapPreviewModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div className="fixed inset-0 bg-black/80 z-[200] flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-gray-800 w-full max-w-3xl h-[60vh] rounded-lg overflow-hidden relative flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-2 bg-gray-900">
                <span className="text-white font-bold ml-2">Location Preview</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><CloseIcon /></button>
            </div>
            <iframe src={url} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
        </div>
    </div>
);

// FIX: Add AddStoryModal component since it's used
const AddStoryModal: React.FC<{ user: User | AdminUser; onClose: () => void; onStoryPosted: () => void }> = ({ user, onClose, onStoryPosted }) => {
    const [media, setMedia] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image');
    const [content, setContent] = useState('');
    
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setMedia(base64);
            if (file.type.startsWith('video/')) {
                setMediaType('video');
            } else if (file.type.startsWith('audio/')) {
                setMediaType('audio');
            } else {
                setMediaType('image');
            }
        }
    };

    const handleSubmit = () => {
        if (!media && !content.trim()) return;
        groupService.addStory({
            userId: getUserIdForKey(user),
            mediaUrl: media || undefined,
            mediaType: media ? mediaType : undefined,
            content
        });
        onStoryPosted();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[150] flex justify-center items-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                <h3 className="text-xl font-bold text-white">Add to Story</h3>
                <input type="file" accept="image/*,video/*,audio/*" onChange={handleFile} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700"/>
                {media && (
                    <div className="relative h-48 bg-black rounded-lg overflow-hidden flex justify-center items-center">
                        {mediaType === 'image' && <img src={media} className="h-full object-contain"/>}
                        {mediaType === 'video' && <video src={media} controls className="h-full max-w-full"/>}
                        {mediaType === 'audio' && <audio src={media} controls className="w-full px-4" />}
                        <button onClick={() => setMedia(null)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs">Remove</button>
                    </div>
                )}
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Add a caption..." className="w-full p-2 bg-gray-700 rounded text-white" rows={3}/>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-cyan-600 rounded">Share</button>
                </div>
            </div>
        </div>
    );
};

// FIX: Add StoryViewer component since it's used
const StoryViewer: React.FC<{ storiesByUser: Record<string, Story[]>; startUser: User | AdminUser; currentUser: User | AdminUser; onClose: () => void }> = ({ storiesByUser, startUser, currentUser, onClose }) => {
    const userIds = useMemo(() => {
        const startId = getUserIdForKey(startUser);
        const others = Object.keys(storiesByUser).filter(id => id !== startId);
        return [startId, ...others];
    }, [storiesByUser, startUser]);

    const [currentUserIndex, setCurrentUserIndex] = useState(0);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    const activeUserStories = storiesByUser[userIds[currentUserIndex]] || [];
    const story = activeUserStories[currentStoryIndex];
    const currentUserId = getUserIdForKey(currentUser);

    useEffect(() => {
        setProgress(0);
        setCurrentStoryIndex(0);
    }, [currentUserIndex]);

    useEffect(() => {
        if (story && !story.viewedBy.includes(currentUserId)) {
            groupService.markStoryAsViewed(story.id, currentUserId);
        }
        setProgress(0);
    }, [story, currentUserId]);

    const nextStory = useCallback(() => {
        if (currentStoryIndex < activeUserStories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
        } else if (currentUserIndex < userIds.length - 1) {
            setCurrentUserIndex(prev => prev + 1);
        } else {
            onClose();
        }
    }, [currentStoryIndex, activeUserStories.length, currentUserIndex, userIds.length, onClose]);

    const prevStory = useCallback(() => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
        } else if (currentUserIndex > 0) {
            setCurrentUserIndex(prev => prev - 1);
            setCurrentStoryIndex(0);
        }
    }, [currentStoryIndex, currentUserIndex]);

    useEffect(() => {
        if (!story) return;

        const isVideoOrAudio = story.mediaType === 'video' || story.mediaType === 'audio';
        let intervalId: any;

        if (!isVideoOrAudio) {
            const duration = 5000; 
            const interval = 50; 
            const step = 100 / (duration / interval);

            intervalId = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(intervalId);
                        nextStory();
                        return 100;
                    }
                    return prev + step;
                });
            }, interval);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [story, nextStory]);

    const handleMediaEnded = () => {
        nextStory();
    };

    if (!story) return null;

    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
            <div className="absolute top-0 left-0 w-full p-2 flex gap-1 z-20">
                {activeUserStories.map((s, i) => (
                    <div key={s.id} className="h-1 flex-1 bg-gray-600/50 rounded-full overflow-hidden">
                        <div 
                            className={`h-full bg-white transition-all duration-100 ease-linear`}
                            style={{ 
                                width: i < currentStoryIndex ? '100%' : i === currentStoryIndex ? `${progress}%` : '0%' 
                            }}
                        ></div>
                    </div>
                ))}
            </div>
            <div className="flex items-center p-4 z-20 mt-4">
                 <UserAvatar name={story.userName} avatarUrl={story.userAvatar} className="w-10 h-10 rounded-full mr-3 border border-gray-500"/>
                 <div className="flex flex-col">
                    <span className="font-bold text-white text-sm shadow-black drop-shadow-md">{story.userName}</span>
                    <span className="text-gray-300 text-xs shadow-black drop-shadow-md">{timeSince(story.timestamp)}</span>
                 </div>
                 <button onClick={onClose} className="ml-auto text-white p-2 hover:bg-white/10 rounded-full"><CloseIcon/></button>
            </div>
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gray-900">
                <div className="absolute inset-y-0 left-0 w-[30%] z-10" onClick={prevStory}></div>
                <div className="absolute inset-y-0 right-0 w-[70%] z-10" onClick={nextStory}></div>
                {story.mediaUrl ? (
                    story.mediaType === 'video' ? (
                        <video src={story.mediaUrl} autoPlay className="max-h-full max-w-full" onEnded={handleMediaEnded} />
                    ) : story.mediaType === 'audio' ? (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-gray-800 to-black">
                            <div className="p-8 rounded-full bg-gray-700/50 mb-8 animate-pulse"><IconMic /></div>
                            <audio src={story.mediaUrl} autoPlay controls className="w-[80%] z-20 relative" onEnded={handleMediaEnded} />
                             {story.content && <p className="text-white text-center px-8 mt-8 text-xl font-medium">{story.content}</p>}
                        </div>
                    ) : (
                        <img src={story.mediaUrl} className="max-h-full max-w-full object-contain" alt="Story" />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8 text-center">
                        <p className="text-white text-2xl md:text-4xl font-bold leading-relaxed">{story.content}</p>
                    </div>
                )}
                {(story.mediaType === 'image' || story.mediaType === 'video') && story.content && (
                    <div className="absolute bottom-20 bg-black/60 p-4 w-full text-center backdrop-blur-sm z-0">
                        <p className="text-white text-lg">{story.content}</p>
                    </div>
                )}
            </div>
            <div className="p-4 flex justify-center gap-6 z-20 pb-8 bg-gradient-to-t from-black/80 to-transparent">
                {['❤️', '😂', '😮', '😢', '🙏', '🔥'].map(emoji => (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); groupService.toggleStoryReaction(story.id, currentUserId, emoji); }} className="text-3xl hover:scale-125 transition-transform active:scale-95">
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

// FIX: Add MiniChatWindow component since it's used
const MiniChatWindow: React.FC<{ currentUser: User; targetUser: User | AdminUser; onClose: () => void }> = ({ currentUser, targetUser, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState('');
    const targetUserId = getUserIdForKey(targetUser);
    const conversation = chatService.startOrGetConversation(currentUser.studentId, targetUserId);

    useEffect(() => {
        const refresh = () => {
            setMessages(chatService.getMessagesForConversation(conversation.id, currentUser.studentId));
        };
        refresh();
        const interval = setInterval(refresh, 2000);
        return () => clearInterval(interval);
    }, [conversation.id, currentUser.studentId]);

    const send = () => {
        if (text.trim()) {
            chatService.sendMessage(conversation.id, currentUser.studentId, text.trim());
            setText('');
        }
    };

    return (
        <div className="fixed bottom-0 right-4 w-80 h-96 bg-gray-800 rounded-t-lg shadow-2xl z-[100] flex flex-col border border-gray-700">
            <div className="p-3 bg-cyan-700 rounded-t-lg flex justify-between items-center cursor-pointer" onClick={onClose}>
                <div className="flex items-center gap-2">
                    <UserAvatar name={targetUser.name} avatarUrl={targetUser.avatarUrl} className="w-6 h-6 rounded-full"/>
                    <span className="font-bold text-white truncate">{targetUser.name}</span>
                </div>
                <button onClick={onClose}><CloseIcon/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === currentUser.studentId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.senderId === currentUser.studentId ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-2 bg-gray-800 border-t border-gray-700 flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm" placeholder="Type a message..."/>
                <button onClick={send} className="text-cyan-400"><IconComposerVideo/></button>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Listing Card with Animation ---
interface ListingCardProps {
    listing: MarketplaceListing;
    cartQuantity: number;
    currentUserId: string;
    onAddToCart: (listing: MarketplaceListing) => void;
    setViewingListing: (listing: MarketplaceListing) => void;
    isExpanded: boolean;
    toggleExpand: (id: string) => void;
    handleShare: (listing: MarketplaceListing) => void;
    copiedLink: string | null;
    openModal: (listing: MarketplaceListing) => void;
    handleDelete: (listing: MarketplaceListing) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({
    listing,
    cartQuantity,
    currentUserId,
    onAddToCart,
    setViewingListing,
    isExpanded,
    toggleExpand,
    handleShare,
    copiedLink,
    openModal,
    handleDelete
}) => {
    const [isAdded, setIsAdded] = useState(false);
    const isLong = listing.description.length > 100;

    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddToCart(listing);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 600); // Reset after animation
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl flex flex-col">
            <div className="w-full h-48 bg-gray-700 rounded-t-lg overflow-hidden cursor-pointer" onClick={() => setViewingListing(listing)}>
                {listing.media[0]?.type === 'image' && <img src={listing.media[0].url} alt={listing.title} className="w-full h-full object-cover"/>}
                {listing.media[0]?.type === 'video' && <video src={listing.media[0].url} className="w-full h-full object-cover" controls />}
            </div>
            <div className="p-4 flex-grow flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full self-start">{listing.category}</span>
                    {listing.availableUnits > 0 ? (
                        <span className="text-xs font-semibold text-gray-300">{listing.availableUnits} in stock</span>
                    ) : (
                        <span className="text-xs font-semibold text-red-400">Out of stock</span>
                    )}
                </div>

                <h4 onClick={() => setViewingListing(listing)} className="font-bold text-lg text-white cursor-pointer hover:text-cyan-300">{listing.title}</h4>
                <div className="text-sm text-gray-300 my-2 flex-grow">
                    <p className={`${isLong && !isExpanded ? 'line-clamp-2' : ''}`}>
                        {listing.description}
                    </p>
                    {isLong && (
                        <button onClick={() => toggleExpand(listing.id)} className="text-xs text-cyan-400 hover:underline mt-1">
                            {isExpanded ? 'See less' : 'See more'}
                        </button>
                    )}
                </div>
                <div className="flex justify-between items-center my-2">
                    <p className="font-bold text-xl text-cyan-400">UGX {listing.price.toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAddClick}
                            disabled={listing.availableUnits <= 0}
                            className={`px-6 py-2 text-sm font-semibold rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95 ${isAdded ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                        >
                            {listing.availableUnits <= 0 ? 'Out of Stock' : isAdded ? 'Added!' : (cartQuantity ? `Add More (${cartQuantity})` : 'Add')}
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-400 border-t border-gray-700 pt-3 mt-auto">
                    <div className="flex items-center gap-2">
                        <UserAvatar name={listing.sellerName} avatarUrl={listing.sellerAvatar} className="w-8 h-8 rounded-full" />
                        <span>{listing.sellerName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                            <button onClick={() => handleShare(listing)} className="p-2 hover:bg-gray-700 rounded-full" title="Copy Link">
                            {copiedLink === listing.id ? <span className="text-xs text-cyan-400">Copied!</span> : <IconCopyLink />}
                        </button>
                        {listing.sellerId === currentUserId && (
                            <>
                                <button onClick={() => openModal(listing)} className="p-2 hover:bg-gray-700 rounded-full text-xs" title="Edit">Edit</button>
                                <button onClick={() => handleDelete(listing)} className="p-2 hover:bg-gray-700 rounded-full text-xs text-red-400" title="Delete">Delete</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// FIX: Add MarketplaceView component since it's used
const MarketplaceView: React.FC<{
    user: User | AdminUser;
    setViewingListing: (listing: MarketplaceListing) => void;
    onAddToCart: (listing: MarketplaceListing) => void;
    refreshAllData: () => void;
    initialTab: string;
    onClearCart: () => void;
    cart: Record<string, number>;
}> = ({ user, setViewingListing, onAddToCart, refreshAllData, initialTab, onClearCart, cart }) => {
    const [tab, setTab] = useState(initialTab || 'browse');
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const currentUserId = getUserIdForKey(user);
    const [expandedPosts, setExpandedPosts] = useState(new Set<string>());
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [purchases, setPurchases] = useState<Receipt[]>([]);
    const [salesHistory, setSalesHistory] = useState<Receipt[]>([]);
    const [receiptToRelease, setReceiptToRelease] = useState<Receipt | null>(null);
    
    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null);
    const [mySalesViewMode, setMySalesViewMode] = useState<'listings' | 'history'>('listings');
    
    const handleCreateClick = () => {
        setEditingListing(null);
        setIsEditorOpen(true);
    };

    const handleEditClick = (l: MarketplaceListing) => {
        setEditingListing(l);
        setIsEditorOpen(true);
    };

    const handleSaveListing = (data: any) => {
        if (editingListing) {
            marketplaceService.updateListing(editingListing.id, data);
        } else {
            marketplaceService.createListing({ ...data, sellerId: currentUserId, sellerName: user.name, sellerAvatar: user.avatarUrl });
        }
        refreshAllData();
        // Manually refresh local listings as well
        setListings(marketplaceService.getListings());
        setIsEditorOpen(false);
    };
    
    const handleDelete = (l: MarketplaceListing) => {
        if(window.confirm("Delete listing?")) {
            marketplaceService.deleteListing(l.id);
            refreshAllData();
            setListings(marketplaceService.getListings());
        }
    };

    useEffect(() => {
        setListings(marketplaceService.getListings());
        const interval = setInterval(() => setListings(marketplaceService.getListings()), 5000);
        return () => clearInterval(interval);
    }, []);

    // Fetch purchases/sales when tab is active
    useEffect(() => {
        if (tab === 'purchases') {
            const myReceipts = receiptService.getReceiptsForUser(currentUserId)
                .filter(r => r.type === 'purchase');
            setPurchases(myReceipts);
        } else if (tab === 'my_sales') {
             const mySalesReceipts = receiptService.getReceiptsForUser(currentUserId)
                .filter(r => r.type === 'sale');
             setSalesHistory(mySalesReceipts);
        }
    }, [tab, currentUserId, refreshAllData]);

    const filteredListings = listings.filter(l => {
        if (tab === 'my_sales') return l.sellerId === currentUserId;
        if (tab === 'purchases') return false; 
        
        const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'All' || l.category === category;
        return matchesSearch && matchesCategory;
    });

    const handleShare = (listing: MarketplaceListing) => {
        const url = `${window.location.origin}/#/marketplace/view/listing/${listing.id}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(listing.id);
        setTimeout(() => setCopiedLink(null), 2000);
    };
    
    // Logic for seller to update order status
    const handleOrderStatusUpdate = (receiptId: string, newStatus: ReceiptStatus) => {
        try {
            receiptService.updateReceiptStatus(receiptId, newStatus);
            refreshAllData(); // Refresh UI to reflect changes
            
            // Re-fetch sales history specifically to update the view immediately
             const mySalesReceipts = receiptService.getReceiptsForUser(currentUserId)
                .filter(r => r.type === 'sale');
             setSalesHistory(mySalesReceipts);

        } catch (error) {
            console.error("Failed to update status", error);
            alert("Failed to update status: " + (error as Error).message);
        }
    };


    return (
        <div className="space-y-4">
            {isEditorOpen && (
                <ListingEditorModal 
                    listing={editingListing} 
                    onClose={() => setIsEditorOpen(false)} 
                    onSave={handleSaveListing} 
                />
            )}
            
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['browse', 'my_sales', 'purchases'].map(t => (
                    <button key={t} onClick={() => setTab(t as any)} className={`px-4 py-2 rounded-full whitespace-nowrap ${tab === t ? 'bg-cyan-600' : 'bg-gray-700'}`}>
                        {t === 'browse' ? 'Browse' : t === 'my_sales' ? 'My Sales' : 'My Purchases'}
                    </button>
                ))}
            </div>
            
            {tab === 'browse' && (
                <div className="flex gap-2 mb-4">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-gray-700 rounded px-3 py-2"/>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="bg-gray-700 rounded px-3 py-2">
                        <option value="All">All Categories</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Books">Books</option>
                        <option value="Clothing">Clothing</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            )}

            {tab === 'my_sales' && (
                <div className="flex gap-2 mb-4 bg-gray-800 p-1 rounded-lg inline-flex">
                    <button onClick={() => setMySalesViewMode('listings')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${mySalesViewMode === 'listings' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Active Listings</button>
                    <button onClick={() => setMySalesViewMode('history')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${mySalesViewMode === 'history' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Sales History</button>
                </div>
            )}

            {tab === 'purchases' ? (
                <div className="space-y-4 animate-fade-in-up">
                    {purchases.length === 0 ? (
                         <div className="text-center py-12 bg-gray-800 rounded-lg">
                            <p className="text-gray-400">No purchases found.</p>
                        </div>
                    ) : (
                        purchases.map(receipt => {
                            const currentStatus = receipt.statusHistory[receipt.statusHistory.length - 1]?.status || 'Unknown';
                            const isDelivered = currentStatus === 'Delivered';
                            
                            return (
                                <div key={receipt.id} className="bg-gray-800 p-4 rounded-lg shadow-md border-l-4 border-cyan-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-white text-lg">{receipt.partyName}</p>
                                            <p className="text-sm text-gray-400">Order #{receipt.orderId.slice(-6)}</p>
                                            <p className="text-xs text-gray-500">{new Date(receipt.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-cyan-400 text-lg">UGX {receipt.amount.toLocaleString()}</p>
                                            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 font-semibold ${
                                                currentStatus === 'Completed' ? 'bg-green-500/20 text-green-300' :
                                                currentStatus === 'Delivered' ? 'bg-blue-500/20 text-blue-300' :
                                                'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {currentStatus}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 bg-gray-900/50 p-3 rounded-md">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Items</p>
                                        <ul className="space-y-1 text-sm text-gray-300">
                                            {receipt.items?.map((item, idx) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span>{(item.price * item.quantity).toLocaleString()}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div className="mt-4 flex justify-end">
                                        {isDelivered && (
                                            <button 
                                                onClick={() => setReceiptToRelease(receipt)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-sm transition-colors shadow-lg"
                                            >
                                                Confirm Receipt & Release Payment
                                            </button>
                                        )}
                                        {currentStatus === 'Pending' && (
                                            <button disabled className="px-4 py-2 bg-gray-700 text-gray-400 rounded-md text-sm cursor-not-allowed">
                                                Waiting for Delivery
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    
                    {receiptToRelease && (
                        <ReleasePaymentModal 
                            receipt={receiptToRelease}
                            onClose={() => setReceiptToRelease(null)}
                            onSuccess={(msg) => {
                                alert(msg);
                                setReceiptToRelease(null);
                                refreshAllData(); // Refresh list
                            }}
                        />
                    )}
                </div>
            ) : tab === 'my_sales' && mySalesViewMode === 'history' ? (
                <div className="space-y-4 animate-fade-in-up">
                    {salesHistory.length === 0 ? (
                        <div className="text-center py-12 bg-gray-800 rounded-lg">
                            <p className="text-gray-400">No sales history found.</p>
                        </div>
                    ) : (
                        salesHistory.map(receipt => {
                            const currentStatus = receipt.statusHistory[receipt.statusHistory.length - 1]?.status || 'Pending';
                            const isActionable = currentStatus !== 'Completed' && currentStatus !== 'Cancelled' && currentStatus !== 'Delivered';
                            
                            return (
                                <div key={receipt.id} className="bg-gray-800 p-4 rounded-lg shadow-md border-l-4 border-green-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-white text-lg">Sold to: {receipt.partyName}</p>
                                            <p className="text-sm text-gray-400">Order #{receipt.orderId.slice(-6)}</p>
                                            <p className="text-xs text-gray-500">{new Date(receipt.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-400 text-lg">+ UGX {receipt.amount.toLocaleString()}</p>
                                            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 font-semibold ${
                                                currentStatus === 'Completed' ? 'bg-green-500/20 text-green-300' :
                                                currentStatus === 'Cancelled' ? 'bg-red-500/20 text-red-300' :
                                                currentStatus === 'Delivered' ? 'bg-blue-500/20 text-blue-300' :
                                                'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {currentStatus}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 bg-gray-900/50 p-2 rounded-md">
                                         <ul className="space-y-1 text-xs text-gray-300">
                                            {receipt.items?.map((item, idx) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span>{(item.price * item.quantity).toLocaleString()}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    {/* Seller Status Controls */}
                                    <div className="mt-3 flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-700">
                                         {currentStatus === 'Pending' && (
                                             <>
                                                <button 
                                                    onClick={() => handleOrderStatusUpdate(receipt.id, 'Cancelled')} 
                                                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md text-xs font-semibold border border-red-600/30"
                                                >
                                                    Cancel Order
                                                </button>
                                                <button 
                                                    onClick={() => handleOrderStatusUpdate(receipt.id, 'Preparing')} 
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold"
                                                >
                                                    Start Preparing
                                                </button>
                                             </>
                                         )}
                                         {currentStatus === 'Preparing' && (
                                             <button 
                                                onClick={() => handleOrderStatusUpdate(receipt.id, 'Out for Delivery')} 
                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold"
                                             >
                                                Dispatch / Ready
                                             </button>
                                         )}
                                         {currentStatus === 'Out for Delivery' && (
                                             <button 
                                                onClick={() => handleOrderStatusUpdate(receipt.id, 'Delivered')} 
                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold"
                                             >
                                                Mark as Delivered
                                             </button>
                                         )}
                                         {currentStatus === 'Delivered' && (
                                            <span className="text-xs text-gray-400 italic">Waiting for buyer confirmation...</span>
                                         )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            ) : (
                <>
                     {tab === 'my_sales' && (
                        <div className="mb-4">
                            <button onClick={handleCreateClick} className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2 font-semibold">
                                <PlusIcon className="w-5 h-5"/> Create New Listing
                            </button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredListings.map(l => (
                            <ListingCard 
                                key={l.id} 
                                listing={l} 
                                cartQuantity={cart[l.id] || 0} 
                                currentUserId={currentUserId} 
                                onAddToCart={onAddToCart} 
                                setViewingListing={setViewingListing} 
                                isExpanded={expandedPosts.has(l.id)}
                                toggleExpand={(id) => setExpandedPosts(prev => { const newSet = new Set(prev); if(newSet.has(id)) newSet.delete(id); else newSet.add(id); return newSet; })}
                                handleShare={handleShare}
                                copiedLink={copiedLink}
                                openModal={handleEditClick}
                                handleDelete={handleDelete}
                            />
                        ))}
                        {filteredListings.length === 0 && <p className="col-span-full text-center text-gray-500 py-8">No listings found.</p>}
                    </div>
                </>
            )}
        </div>
    );
};

// FIX: Add EventsView component since it's used
const EventsView: React.FC<{ user: User | AdminUser; school: School | null, onMapClick: (uri: string) => void }> = ({ user, school, onMapClick }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    const toDateTimeLocal = (timestamp: number) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        try {
            return date.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    const initialFormState = useMemo(() => ({
        title: '',
        description: '',
        startTime: toDateTimeLocal(Date.now() + 3600 * 1000), 
        endTime: toDateTimeLocal(Date.now() + 7200 * 1000), 
        bannerUrl: '',
        logoUrl: '',
        place: { title: '', uri: '' },
        attachments: [],
    }), []);

    const [formState, setFormState] = useState<Omit<Event, 'id' | 'schoolId' | 'createdBy' | 'createdAt' | 'startTime' | 'endTime'> & {startTime: string, endTime: string, attachments: ChatAttachment[]}>(initialFormState);
    const [placeSearch, setPlaceSearch] = useState('');
    const [placeSuggestions, setPlaceSuggestions] = useState<Place[]>([]);
    const [isPlaceDropdownOpen, setIsPlaceDropdownOpen] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ message: React.ReactNode; onConfirm: () => void; } | null>(null);
    const placeDropdownRef = useRef<HTMLDivElement>(null);

    const currentUserId = 'studentId' in user ? user.studentId : (user as AdminUser).id;

    useEffect(() => {
        if (school) {
            setEvents(groupService.getAllEventsForSchool(school.id));
        }
        navigator.geolocation.getCurrentPosition(
            pos => setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            err => console.warn("Could not get user location:", err)
        );
    }, [school]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (placeSearch.length > 2 && currentLocation) {
                const suggestions = await getPlaceSuggestionsFromAI(placeSearch, currentLocation);
                setPlaceSuggestions(suggestions);
                setIsPlaceDropdownOpen(true);
            } else {
                setPlaceSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [placeSearch, currentLocation]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (placeDropdownRef.current && !placeDropdownRef.current.contains(event.target as Node)) {
                setIsPlaceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const openModal = (event: Event | null) => {
        setEditingEvent(event);
        if (event) {
            setFormState({
                ...event,
                startTime: toDateTimeLocal(event.startTime),
                endTime: toDateTimeLocal(event.endTime),
                attachments: event.attachments || [],
            });
            setPlaceSearch(event.place.title);
        } else {
            setFormState(initialFormState);
            setPlaceSearch('');
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToBase64(file);
            callback(dataUrl);
        }
    };
    
    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToBase64(file);
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
            setFormState(prev => ({...prev, attachments: [...(prev.attachments || []), { name: file.name, type, dataUrl }]}));
        }
    };
    
    const removeAttachment = (index: number) => {
        setFormState(prev => ({...prev, attachments: prev.attachments?.filter((_, i) => i !== index)}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!school) return;

        const eventData = {
            ...formState,
            startTime: new Date(formState.startTime).getTime(),
            endTime: new Date(formState.endTime).getTime(),
        };

        if (editingEvent) {
            groupService.updateEvent(editingEvent.id, eventData);
        } else {
            groupService.createEvent({ ...eventData, schoolId: school.id, createdBy: currentUserId });
        }
        setEvents(groupService.getAllEventsForSchool(school.id));
        setIsModalOpen(false);
    };

    const handleDelete = (event: Event) => {
        setConfirmModal({
            message: `Are you sure you want to delete the event "${event.title}"?`,
            onConfirm: () => {
                if (!school) return;
                groupService.deleteEvent(event.id);
                setEvents(groupService.getAllEventsForSchool(school.id));
                setConfirmModal(null);
            }
        });
    };

    const renderModal = () => (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[110] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl space-y-4 max-h-[90vh] flex flex-col">
                <h3 className="text-xl font-bold">{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
                    <input name="title" value={formState.title} onChange={handleFormChange} placeholder="Event Title" required className="w-full p-2 bg-gray-700 rounded"/>
                    <textarea name="description" value={formState.description} onChange={handleFormChange} placeholder="Event Description" required rows={4} className="w-full p-2 bg-gray-700 rounded"/>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm">Start Time</label><input type="datetime-local" name="startTime" value={formState.startTime} onChange={handleFormChange} required className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                        <div><label className="text-sm">End Time</label><input type="datetime-local" name="endTime" value={formState.endTime} onChange={handleFormChange} required className="w-full p-2 bg-gray-700 rounded mt-1"/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm">Banner Image URL</label><input name="bannerUrl" value={formState.bannerUrl} onChange={handleFormChange} placeholder="https://..." className="w-full p-2 bg-gray-700 rounded mt-1"/><input type="file" onChange={e => handleFileChange(e, url => setFormState(p => ({...p, bannerUrl: url})))} className="text-xs mt-1"/></div>
                        <div><label className="text-sm">Logo URL</label><input name="logoUrl" value={formState.logoUrl} onChange={e => setFormState(p => ({...p, logoUrl: e.target.value}))} placeholder="https://..." className="w-full p-2 bg-gray-700 rounded mt-1"/><input type="file" onChange={e => handleFileChange(e, url => setFormState(p => ({...p, logoUrl: url})))} className="text-xs mt-1"/></div>
                    </div>
                    <div className="relative" ref={placeDropdownRef}>
                        <label className="text-sm">Location</label>
                        <input value={placeSearch} onChange={e => setPlaceSearch(e.target.value)} placeholder="Search for a location..." required className="w-full p-2 bg-gray-700 rounded mt-1"/>
                        {isPlaceDropdownOpen && placeSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-gray-600 rounded-b-md z-20 max-h-40 overflow-y-auto">
                                {placeSuggestions.map((p, i) => <div key={i} onClick={() => { setFormState(prev => ({...prev, place: p})); setPlaceSearch(p.title); setIsPlaceDropdownOpen(false); groupService.addPlaceToCache(p); }} className="p-2 hover:bg-gray-500 cursor-pointer">{p.title}</div>)}
                            </div>
                        )}
                        {!placeSearch && groupService.getCachedPlaces().length > 0 && (
                            <div className="mt-2">
                                <label className="block text-xs text-gray-500 mb-1">Recent Locations:</label>
                                <div className="flex flex-wrap gap-2">
                                    {groupService.getCachedPlaces().slice(0, 5).map((p, i) => (
                                        <button key={`cached-${i}`} type="button" onClick={() => { setFormState(prev => ({...prev, place: p})); setPlaceSearch(p.title); setIsPlaceDropdownOpen(false); }} className="px-3 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600">{p.title}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div><label className="text-sm">Attachments</label><input type="file" onChange={handleAttachmentUpload} className="text-xs mt-1 w-full"/>
                        <div className="flex flex-wrap gap-2 mt-2">{formState.attachments?.map((att, i) => <div key={i} className="bg-gray-600 p-1 rounded text-xs flex items-center gap-2">{att.name}<button type="button" onClick={() => removeAttachment(i)}>&times;</button></div>)}</div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-700"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-cyan-600 rounded">Save Event</button></div>
                </form>
            </div>
        </div>
    );
    
    return (
        <div className="space-y-6">
            {isModalOpen && renderModal()}
            {confirmModal && <ConfirmationModal isOpen={true} title="Confirm Deletion" message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} confirmButtonVariant="danger" />}
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">School Events</h3>
                {school && ( 
                    <button onClick={() => openModal(null)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 rounded-md font-semibold">
                        <PlusIcon /> <span className="hidden sm:inline">Create Event</span>
                    </button>
                )}
            </div>
            <div className="space-y-6">
                {events.length > 0 ? events.map(event => {
                    const isCreator = event.createdBy === currentUserId;
                    return (
                        <div key={event.id} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                            <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${event.bannerUrl || 'https://picsum.photos/seed/event-banner/800/200'})` }}></div>
                            <div className="p-4">
                                <div className="flex items-start gap-4 -mt-12">
                                    <img src={event.logoUrl || 'https://picsum.photos/seed/event-logo/100'} alt={event.title} className="w-20 h-20 rounded-lg border-4 border-gray-800 object-cover" />
                                    <div>
                                        <h4 className="text-xl font-bold text-white pt-12">{event.title}</h4>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300 mt-3">{event.description}</p>
                                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-400">
                                    <div className="flex items-center gap-2"><IconCalendar /> <span>{new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleTimeString()}</span></div>
                                    <button onClick={() => onMapClick(event.place.uri)} className="flex items-center gap-2 hover:text-cyan-400"><IconLocation /> <span>{event.place.title}</span></button>
                                </div>
                                {isCreator && (
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button onClick={() => openModal(event)} className="text-xs px-3 py-1 bg-gray-600 rounded-md">Edit</button>
                                        <button onClick={() => handleDelete(event)} className="text-xs px-3 py-1 bg-red-600 rounded-md">Delete</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : <p className="text-gray-400 text-center py-8">No events have been created for this school yet.</p>}
            </div>
        </div>
    );
};


// FIX: Define OnlineFeedPageProps interface here as it's the component's direct prop type.
interface OnlineFeedPageProps {
    user: User | AdminUser;
    onLogout: () => void;
    onBackToDashboard?: () => void;
    onStartMessage?: (userId: string) => void;
    onNavigateToWallet?: () => void;
    onOrderStaged?: (order: StagedMarketplaceOrder) => void;
    stagedOrder?: StagedMarketplaceOrder | null;
    onStagedOrderConsumed?: () => void;
}

export const OnlineFeedPage: React.FC<OnlineFeedPageProps> = ({ user, onLogout, onBackToDashboard, onStartMessage, onNavigateToWallet, onOrderStaged, stagedOrder, onStagedOrderConsumed }) => {
    type OnlineView = 'feed' | 'groups' | 'events' | 'marketplace' | 'chat';
    const [view, setView] = useState<OnlineView>('feed');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    // NEW: State for desktop sidebar collapsed/expanded
    const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
    
    const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
    
    const [storiesByUser, setStoriesByUser] = useState<Record<string, Story[]>>({});
    const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
    const [viewingStoriesOfUser, setViewingStoriesOfUser] = useState<User | AdminUser | null>(null);
    const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);


    const [feedPosts, setFeedPosts] = useState<GroupPost[]>([]);
    
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [postToDelete, setPostToDelete] = useState<GroupPost | null>(null);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [hiddenPostIds, setHiddenPostIds] = useState(() => new Set<string>()); 
    const menuRef = useRef<HTMLDivElement>(null);

    const [comments, setComments] = useState<Record<string, PostComment[]>>({});
    const [commentingOnPostId, setCommentingOnPostId] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');

    const [expandedPosts, setExpandedPosts] = useState(new Set<string>());
    const [profileModalUser, setProfileModalUser] = useState<User | AdminUser | null>(null);
    
    const [chatTarget, setChatTarget] = useState<User | AdminUser | null>(null);
    const [viewingListing, setViewingListing] = useState<MarketplaceListing | null>(null);
    
    const [cart, setCart] = useState<Record<string, number>>({});
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    const currentUser = findFullUserById(getUserIdForKey(user));
    const currentUserId = getUserIdForKey(user);

    const [marketplaceInitialTab, setMarketplaceInitialTab] = useState<'browse' | 'my_sales' | 'purchases'>('browse');

    const [isMarketplacePaymentModalOpen, setIsMarketplacePaymentModalOpen] = useState(false);
    const [marketplacePaymentError, setMarketplacePaymentError] = useState('');
    const [stagedCheckoutItems, setStagedCheckoutItems] = useState<(MarketplaceListing & { quantity: number })[] | null>(null);
    const [stagedCheckoutTotal, setStagedCheckoutTotal] = useState(0);

    const userWallet = useMemo(() => eWalletService.getWalletForUser(currentUserId), [currentUserId]);

    const LAST_VISIT_KEY = useRef({
        feed: `online_feed_last_visit_${currentUserId}`,
        groups: `online_groups_last_visit_${currentUserId}`,
        events: `online_events_last_visit_${currentUserId}`,
        marketplace: `online_marketplace_last_visit_${currentUserId}`,
        chat: `online_chat_last_visit_${currentUserId}`,
    });

    // Notification counters state
    const [feedUnreadCount, setFeedUnreadCount] = useState(0);
    const [groupsUnreadCount, setGroupsUnreadCount] = useState(0);
    const [eventsUnreadCount, setEventsUnreadCount] = useState(0);
    const [marketplaceUnreadCount, setMarketplaceUnreadCount] = useState(0);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    
    // Right Sidebar State
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

    // FIX: Define school here
    const school = useMemo(() => {
        if ('schoolId' in user && user.schoolId) {
            return getAllSchools().find(s => s.id === user.schoolId) || null;
        }
        if ('assignedSchoolIds' in user && user.assignedSchoolIds.length > 0) {
            return getAllSchools().find(s => s.id === user.assignedSchoolIds[0]) || null;
        }
        return null;
    }, [user]);

    const allSchoolUsers = useMemo(() => {
         // Fix type incompatibility by casting
         const admins = userService.getAllAdminUsers();
         const users = studentService.getAllSchoolUsers(); 
         return [...admins, ...users] as (User | AdminUser)[];
    }, []);
    
    const onlineUsersList = useMemo(() => {
        return allSchoolUsers.filter(u => 'studentId' in u ? groupService.findUserById(u.studentId) : groupService.findUserById((u as AdminUser).id)); // Simplification for demo
    }, [allSchoolUsers]);

    const topUsersList = useMemo(() => {
        return [...allSchoolUsers].sort((a, b) => {
            const idA = 'studentId' in a ? a.studentId : a.id;
            const idB = 'studentId' in b ? b.studentId : b.id;
            return groupService.getFollowerCount(idB) - groupService.getFollowerCount(idA);
        }).slice(0, 5);
    }, [allSchoolUsers]);

    const suggestedUsersList = useMemo(() => {
        return allSchoolUsers.filter(u => {
            const uId = 'studentId' in u ? u.studentId : u.id;
            return uId !== currentUserId && !groupService.isFollowing(currentUserId, uId);
        }).slice(0, 5);
    }, [allSchoolUsers, currentUserId]);

    const upcomingEvents = useMemo(() => {
         if (!school) return [];
         return groupService.getAllEventsForSchool(school.id).filter(e => e.endTime > Date.now());
    }, [school]);
    
    const pastEvents = useMemo(() => {
         if (!school) return [];
         return groupService.getAllEventsForSchool(school.id).filter(e => e.endTime <= Date.now()).slice(0, 5);
    }, [school]);


    const handleClearCart = () => {
        if (Object.keys(cart).length > 0 && window.confirm("Are you sure you want to remove all items from your cart?")) {
            setCart({});
        };
    };

    useEffect(() => {
        const postPurchaseRedirect = localStorage.getItem('360_post_purchase_redirect');
        if (postPurchaseRedirect) {
            setView('marketplace');
            setMarketplaceInitialTab('purchases');
            localStorage.removeItem('360_post_purchase_redirect');
        }
    }, []);

    // Effect to handle staged order from parent (E-Wallet redirect)
    useEffect(() => {
        if (stagedOrder) {
            // Automatically open checkout modal
            const allListings = marketplaceService.getListings();
            const items = Object.entries(stagedOrder.cart).map(([id, qty]) => {
                const listing = allListings.find(l => l.id === id);
                return listing ? { ...listing, quantity: qty } : null;
            }).filter((i): i is (MarketplaceListing & { quantity: number }) => !!i);

            if (items.length > 0) {
                setStagedCheckoutItems(items);
                setStagedCheckoutTotal(stagedOrder.totalAmount);
                
                // Ensure we are on the marketplace view
                setView('marketplace');
                setMarketplaceInitialTab('browse'); // or purchases, but browse is default
                
                // Open the payment modal
                setIsMarketplacePaymentModalOpen(true);
            }
        }
    }, [stagedOrder]);

    const allUsersWithStories = useMemo(() => {
        return Object.keys(storiesByUser)
            .map(userId => findFullUserById(userId))
            .filter((u): u is User | AdminUser => !!u)
            .sort((a, b) => {
                // Prioritize current user's story
                if (getUserIdForKey(a) === currentUserId) return -1;
                if (getUserIdForKey(b) === currentUserId) return 1;
                return 0; // Keep original order for others
            });
    }, [storiesByUser, currentUserId]);

    const observer = useRef<IntersectionObserver | null>(null);
    const viewedPostsRef = useRef(new Set<string>());

    const handleInternalLinkClick = (path: string) => {
        const listingId = path.split('/').pop();
        if (listingId) {
            const listing = marketplaceService.getListingById(listingId);
            if (listing) {
                setViewingListing(listing);
            }
        }
    };
    
    const totalCartItems = useMemo(() => {
        return Object.values(cart).reduce((sum: number, quantity: number) => sum + quantity, 0);
    }, [cart]);

    const handleAddToCart = (listing: MarketplaceListing) => {
        setCart(prevCart => {
            const currentQuantity = prevCart[listing.id] || 0;
            if (currentQuantity >= listing.availableUnits) {
                alert(`Sorry, only ${listing.availableUnits} units of "${listing.title}" are available.`);
                return prevCart;
            }
            return {
                ...prevCart,
                [listing.id]: currentQuantity + 1
            };
        });
    };

    const handleUpdateCartQuantity = (listingId: string, quantity: number) => {
        const listing = marketplaceService.getListings().find(l => l.id === listingId);
        if (!listing) return;
    
        if (quantity > listing.availableUnits) {
            alert(`Sorry, only ${listing.availableUnits} units of "${listing.title}" are available.`);
            // Revert to max available
            setCart(prevCart => ({...prevCart, [listingId]: listing.availableUnits }));
            return;
        }
    
        setCart(prevCart => {
            const newCart = { ...prevCart };
            if (quantity <= 0) {
                delete newCart[listingId];
            } else {
                newCart[listingId] = quantity;
            }
            return newCart;
        });
    };
    
     const userStats = useMemo(() => {
        const allPosts = groupService.getPosts();
        const myPosts = allPosts.filter(p => p.authorId === currentUserId);
        const created = myPosts.length;
        const views = myPosts.reduce((acc, p) => acc + (p.views || 0), 0);
        // Calculate total likes received (assuming '👍' emoji)
        const likes = myPosts.reduce((acc, p) => {
            const thumbsUp = p.reactions?.['👍'] || [];
            return acc + thumbsUp.length;
        }, 0);
        
        return {
            followers: groupService.getFollowerCount(currentUserId),
            following: groupService.getFollowingCount(currentUserId),
            created,
            views,
            likes,
            earned: userWallet.balance
        };
    }, [currentUserId, feedPosts, userWallet.balance]);


    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#/marketplace/view/listing/')) {
                handleInternalLinkClick(hash);
                window.history.replaceState("", document.title, window.location.pathname + window.location.search);
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const intersectionCallback: IntersectionObserverCallback = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                const postId = (entry.target as HTMLElement).dataset.postId;
                if (entry.isIntersecting && postId && !viewedPostsRef.current.has(postId)) {
                    groupService.incrementPostViewCount(postId);
                    viewedPostsRef.current.add(postId);
                    observer.current?.unobserve(entry.target);
                }
            });
        };
        observer.current = new IntersectionObserver(intersectionCallback, { threshold: 0.5 });
        const currentObserver = observer.current;
        return () => currentObserver.disconnect();
    }, []);

    const postObserverRef = useCallback((node: HTMLDivElement) => {
        if (node) {
            observer.current?.observe(node);
        }
    }, []);

    const refreshAllData = useCallback(() => {
        // This function can be expanded to refresh all data sources for the online feed
        const posts: GroupPost[] = groupService.getPostsForGroup('global_feed');
        setFeedPosts([...posts].sort((a: GroupPost, b: GroupPost) => (b.timestamp) - (a.timestamp)));
        setStoriesByUser(groupService.getStoriesGroupedByUser());
        
        // Also refresh staged checkout state
        const staged = eWalletService.getStagedMarketplaceCheckout();
        if (staged && staged.length > 0) {
            setStagedCheckoutItems(staged);
            setStagedCheckoutTotal(staged.reduce((sum, item) => sum + item.price * item.quantity, 0));
        } else {
            setStagedCheckoutItems(null);
            setStagedCheckoutTotal(0);
        }

    }, []);

    const refreshStories = useCallback(() => {
        setStoriesByUser(groupService.getStoriesGroupedByUser());
    }, []);

    const refreshFeed = useCallback(() => {
        const posts: GroupPost[] = groupService.getPostsForGroup('global_feed');
        setFeedPosts([...posts].sort((a: GroupPost, b: GroupPost) => (b.timestamp) - (a.timestamp)));
    }, []);

    const loadComments = useCallback(async (postId: string) => {
        const postComments = groupService.getCommentsForPost(postId);
        setComments(prev => ({ ...prev, [postId]: postComments }));
    }, []);

    const handlePostComment = (postId: string) => {
        if (!newComment.trim()) return;
        groupService.addComment(postId, currentUserId, newComment.trim());
        setNewComment('');
        loadComments(postId);
    };

    const handleCommentClick = (postId: string) => {
        const newCommentingId = commentingOnPostId === postId ? null : postId;
        setCommentingOnPostId(newCommentingId);
        if (newCommentingId) {
            loadComments(newCommentingId);
        }
    };


    useEffect(() => {
        refreshStories();
        refreshFeed();
        const interval = setInterval(() => {
            refreshStories();
            refreshFeed();
        }, 5000);
        return () => clearInterval(interval);
    }, [refreshStories, refreshFeed]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStartMiniChat = (targetUserId: string) => {
        const target = findFullUserById(targetUserId);
        if (target) {
            setProfileModalUser(null);
            if (onStartMessage) {
                onStartMessage(targetUserId);
            } else {
                setChatTarget(target);
            }
        }
    };
    
    const handleMapClick = (uri: string) => {
        try {
            const url = new URL(uri);
            const query = url.searchParams.get('query');

            if (query) {
                const embedUrl = `https://www.google.com/maps?output=embed&q=${encodeURIComponent(query)}`;
                setMapPreviewUrl(embedUrl);
            } else {
                window.open(uri, '_blank');
            }
        } catch (error) {
            window.open(uri, '_blank');
        }
    };

    const handlePost = (htmlContent: string) => {
        if (!currentUser) return;
        try {
            groupService.createPost('global_feed', currentUserId, htmlContent);
            refreshFeed();
        } catch (error) {
            console.error("Failed to create post:", error);
            alert("Could not post your message. Please try again.");
        }
    };
    
    const handleToggleReaction = (postId: string, emoji: string) => {
        if (!currentUser) return;
        groupService.toggleReaction(postId, currentUserId, emoji);
        refreshFeed();
    };

    const handleEdit = (post: GroupPost) => {
        setEditingPostId(post.id);
        setEditingContent(post.content);
        setOpenMenuId(null);
    };

    const handleSaveEdit = () => {
        if (editingPostId && editingContent.trim()) {
            groupService.updatePost(editingPostId, currentUserId, editingContent);
            refreshFeed();
            setEditingPostId(null);
            setEditingContent('');
        }
    };
    
    const handleHide = (postId: string) => {
        setHiddenPostIds(prev => new Set(prev).add(postId));
        setOpenMenuId(null);
    };

    const handleReport = () => {
        alert('Thank you, this post has been reported for review.');
        setOpenMenuId(null);
    };
    
    const handleDelete = (post: GroupPost) => {
        setPostToDelete(post);
        setOpenMenuId(null);
    };

    const confirmDelete = () => {
        if (postToDelete) {
            groupService.deleteMessage(postToDelete.id, currentUserId);
            refreshFeed();
            setPostToDelete(null);
        }
    };

    const toggleExpandPost = (postId: string) => {
        setExpandedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
    };

    const handleAvatarClick = (authorId: string) => {
        if (authorId === currentUserId) return;
        const fullUser = findFullUserById(authorId);
        if (fullUser) {
            console.log("Opening profile for user:", fullUser);
            setProfileModalUser(fullUser);
        } else {
            console.error("Could not find user with ID:", authorId);
        }
    };

    const handleOpenMarketplacePayment = (items: (MarketplaceListing & { quantity: number })[], total: number) => {
        setStagedCheckoutItems(items);
        setStagedCheckoutTotal(total);
        setIsMarketplacePaymentModalOpen(true);
    };

    const handleConfirmMarketplacePayment = (pin: string) => {
        setMarketplacePaymentError('');
        if (!stagedCheckoutItems || stagedCheckoutItems.length === 0) {
            setMarketplacePaymentError("No checkout items found.");
            return;
        }
        
        try {
            eWalletService.verifyPin(currentUserId, pin);
    
            const sellerId = stagedCheckoutItems[0].sellerId;
            const seller = findFullUserById(sellerId);
            if (!seller) throw new Error("Could not find seller's account.");
    
            eWalletService.makePayment(
                currentUserId,
                eWalletService.MARKETPLACE_ESCROW_USER_ID,
                stagedCheckoutTotal,
                `Marketplace Purchase for ${seller.name} (Escrow)`
            );

            const itemsToUpdate = stagedCheckoutItems.map(item => ({
                listingId: item.id,
                quantity: item.quantity,
            }));
            marketplaceService.purchaseListingItems(itemsToUpdate);
    
            const receiptItems = stagedCheckoutItems.map(item => ({ name: item.title, quantity: item.quantity, price: item.price }));
            const orderId = `mkt_${Date.now()}`;
            const txId = `txn_${orderId}`;
    
            receiptService.createReceipt({
                transactionId: txId,
                orderId,
                userId: currentUserId,
                buyerId: currentUserId,
                sellerId: sellerId,
                type: 'purchase',
                amount: stagedCheckoutTotal,
                description: `Purchase from ${seller.name}`,
                partyName: seller.name,
                items: receiptItems
            });
            
            receiptService.createReceipt({
                transactionId: txId,
                orderId,
                userId: sellerId,
                buyerId: currentUserId,
                sellerId: sellerId,
                type: 'sale',
                amount: stagedCheckoutTotal,
                description: `Sale to ${user.name}`,
                partyName: user.name,
                items: receiptItems
            });
    
            eWalletService.clearStagedMarketplaceCheckout();
            
            setIsMarketplacePaymentModalOpen(false);
            setMarketplacePaymentError('');
            alert("Payment successful! Your purchase is complete. Check 'My Purchases' tab for status.");
            setMarketplaceInitialTab('purchases'); // Set tab to purchases for immediate view
            setView('marketplace'); // Switch to marketplace view
            refreshAllData(); // Refresh all data to update listings, receipts, etc.
    
        } catch (err) {
            setMarketplacePaymentError((err as Error).message);
        }
    };

    // --- NEW: Calculate Unread Counts for Tabs ---
    const calculateUnreadCounts = useCallback(() => {
        const lastFeedVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.feed) || 0);
        const lastGroupsVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.groups) || 0);
        const lastEventsVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.events) || 0);
        const lastMarketplaceVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.marketplace) || 0);
        const lastChatVisit = Number(localStorage.getItem(LAST_VISIT_KEY.current.chat) || 0);

        // Feed: new posts in global feed
        const globalFeedPosts = groupService.getPostsForGroup('global_feed');
        const newFeedPosts = globalFeedPosts.filter(p => p.timestamp > lastFeedVisit && p.authorId !== currentUserId).length;
        setFeedUnreadCount(newFeedPosts);

        // Groups: new posts in any group the user is a member of
        const userGroups = groupService.getAllGroups().filter(g => g.memberIds.includes(currentUserId));
        let newGroupPosts = 0;
        userGroups.forEach(group => {
            const postsInGroup = groupService.getPostsForGroup(group.id);
            newGroupPosts += postsInGroup.filter(p => p.timestamp > lastGroupsVisit && p.authorId !== currentUserId).length;
        });
        setGroupsUnreadCount(newGroupPosts);

        // Events: new events created for this school
        const schoolEvents = school ? groupService.getAllEventsForSchool(school.id) : [];
        const newEvents = schoolEvents.filter(e => e.createdAt > lastEventsVisit && e.createdBy !== currentUserId).length;
        setEventsUnreadCount(newEvents);

        // Marketplace: new listings posted by others
        const allListings = marketplaceService.getListings();
        const newMarketplaceListings = allListings.filter(l => l.createdAt > lastMarketplaceVisit && l.sellerId !== currentUserId).length;
        setMarketplaceUnreadCount(newMarketplaceListings);

        // Chats: unread messages in direct conversations
        const unreadMessagesInChats = chatService.getConversationsForUser(currentUserId).reduce((sum, convo) => sum + (convo.unreadCount[currentUserId] || 0), 0);
        setChatUnreadCount(unreadMessagesInChats);

    }, [currentUserId, school]); // Recalculate if user or school changes

    // Poll for unread counts
    useEffect(() => {
        calculateUnreadCounts();
        const interval = setInterval(calculateUnreadCounts, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [calculateUnreadCounts]);


    const handleTabClick = (tab: OnlineView) => {
        setView(tab);
        // Mark items in this tab as read
        localStorage.setItem(LAST_VISIT_KEY.current[tab], String(Date.now()));
        calculateUnreadCounts(); // Refresh to update counters immediately
        setIsDesktopSidebarExpanded(false); // Auto-collapse on desktop
    };


    const navItems = useMemo(() => ([
        { view: 'feed', label: 'Feed', icon: <IconNavFeed />, unreadCount: feedUnreadCount },
        { view: 'groups', label: 'Groups', icon: <IconNavGroups />, unreadCount: groupsUnreadCount },
        { view: 'events', label: 'Events', icon: <IconNavEvents />, unreadCount: eventsUnreadCount },
        { view: 'marketplace', label: 'Shop', icon: <IconNavMarketplace />, unreadCount: marketplaceUnreadCount },
        { view: 'chat', label: 'Chats', icon: <IconNavChat />, unreadCount: chatUnreadCount },
    ]), [feedUnreadCount, groupsUnreadCount, eventsUnreadCount, marketplaceUnreadCount, chatUnreadCount]);

    // Extracted content for the right sidebar to allow reuse
    const RightSidebarContent = () => (
         <div className="space-y-6">
            {/* User Profile Card - 3rd Column Feature */}
            <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600 shadow-lg">
                <div className="flex flex-col items-center">
                     <UserAvatar name={currentUser?.name || '?'} avatarUrl={currentUser?.avatarUrl} className="w-20 h-20 rounded-full border-4 border-gray-600 mb-3 text-2xl shadow-sm"/>
                     <h3 className="text-lg font-bold text-white text-center leading-tight">{currentUser?.name}</h3>
                     <p className="text-sm text-gray-400">@{currentUserId}</p>
                </div>

                <div className="flex justify-around mt-6 border-t border-gray-600 pt-4">
                    <div className="text-center">
                        <p className="text-xl font-bold text-white">{userStats.followers}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Followers</p>
                    </div>
                    <div className="text-center">
                         <p className="text-xl font-bold text-white">{userStats.following}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Following</p>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                        <p className="text-lg font-bold text-cyan-400">{userStats.created}</p>
                        <p className="text-xs text-gray-400 uppercase">Posts</p>
                    </div>
                    <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                        <p className="text-lg font-bold text-green-400">{userStats.likes}</p>
                        <p className="text-xs text-gray-400 uppercase">Likes</p>
                    </div>
                     <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                        <p className="text-lg font-bold text-yellow-400">{userStats.views}</p>
                        <p className="text-xs text-gray-400 uppercase">Views</p>
                    </div>
                     <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                        <p className="text-lg font-bold text-purple-400">0</p>
                        <p className="text-xs text-gray-400 uppercase">Shared</p>
                    </div>
                </div>
                
                 <div className="mt-6 bg-gradient-to-r from-emerald-900/40 to-emerald-800/40 p-4 rounded-xl border border-emerald-500/30 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-emerald-300 uppercase font-semibold">Earned</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(userStats.earned)}</p>
                    </div>
                     <div className="bg-emerald-500/20 p-2 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.196.567-.267v1.698a2.5 2.5 0 004 0V7.151c.22.071.408.164.567.267C13.863 7.84 14.25 8.354 14.25 9c0 .646-.387 1.16-1.25 1.582V11a2.5 2.5 0 01-4 0v-.418C8.387 10.16 8 9.646 8 9c0-.646.387-1.16 1.25-1.582h-.817z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.766 1.824 2.272a4.535 4.535 0 011.676.662V13a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C15.398 11.766 16 11.009 16 10c0-.99-.602-1.766-1.824-2.272a4.535 4.535 0 00-1.676-.662V5z" clipRule="evenodd" /></svg>
                    </div>
                </div>
            </div>

            {/* Active Now */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Now</h3>
                <div className="space-y-3">
                    {onlineUsersList.slice(0, 5).map(u => (
                        <div key={getUserIdForKey(u)} className="flex items-center gap-3">
                            <div className="relative">
                                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-gray-800"></span>
                            </div>
                            <span className="text-sm font-medium text-white truncate">{u.name}</span>
                        </div>
                    ))}
                    {onlineUsersList.length === 0 && <p className="text-xs text-gray-500">No one is currently online.</p>}
                </div>
            </div>

            {/* Community Stars */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Community Stars</h3>
                <div className="space-y-3">
                        {topUsersList.map((u, i) => (
                        <div key={getUserIdForKey(u)} className="flex items-center gap-3">
                            <div className="relative">
                                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                {i === 0 && <span className="absolute -top-1 -right-1 text-xs">👑</span>}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white truncate">{u.name}</p>
                                <p className="text-xs text-gray-400">{groupService.getFollowerCount(getUserIdForKey(u))} followers</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Suggested Users */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">People You Might Know</h3>
                <div className="space-y-3">
                        {suggestedUsersList.map(u => (
                        <div key={getUserIdForKey(u)} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                <span className="text-sm font-medium text-white truncate max-w-[100px]">{u.name.split(' ')[0]}</span>
                            </div>
                            <button onClick={() => groupService.toggleFollow(currentUserId, getUserIdForKey(u))} className="text-xs bg-cyan-600/20 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-600/30">Follow</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Events Calendar */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Events Calendar</h3>
                
                {upcomingEvents.length > 0 && (
                    <div className="mb-4">
                        <p className="text-xs text-cyan-400 font-bold mb-2">Upcoming</p>
                        <div className="space-y-2">
                            {upcomingEvents.slice(0, 3).map(e => (
                                <div key={e.id} className="bg-gray-700/50 p-2 rounded border-l-2 border-cyan-500">
                                    <p className="text-sm font-bold text-white truncate">{e.title}</p>
                                    <p className="text-xs text-gray-400">{new Date(e.startTime).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {pastEvents.length > 0 && (
                    <div>
                        <p className="text-xs text-gray-500 font-bold mb-2">Past Events</p>
                            <div className="space-y-2 opacity-60">
                            {pastEvents.map(e => (
                                <div key={e.id} className="bg-gray-700/30 p-2 rounded">
                                    <p className="text-sm font-bold text-white truncate">{e.title}</p>
                                    <p className="text-xs text-gray-400">{new Date(e.startTime).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        // Ensure currentUser is available for child components if they expect it
        const schoolUser = currentUser as User;
        
        switch (view) {
            case 'groups':
                return <GroupsPage user={schoolUser} />;
            case 'chat':
                return <MessagesPage user={schoolUser} />;
            case 'events':
                return <EventsView user={currentUser!} school={school} onMapClick={handleMapClick} />;
            case 'marketplace':
                return <MarketplaceView 
                            user={currentUser!} 
                            setViewingListing={setViewingListing} 
                            onAddToCart={handleAddToCart} 
                            refreshAllData={refreshAllData} 
                            initialTab={marketplaceInitialTab} 
                            onClearCart={handleClearCart}
                            cart={cart}
                        />;
            case 'feed':
            default:
                return (
                    <div className="space-y-6">
                        {/* Stories Bar */}
                        <div className="bg-gray-800 p-4 rounded-lg flex space-x-4 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                             {/* Add Story Button */}
                            <div onClick={() => setIsAddStoryModalOpen(true)} className="flex-shrink-0 w-20 h-20 bg-gray-700 rounded-full flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-600 border-2 border-dashed border-gray-500 gap-1 transition-colors">
                                <PlusIcon className="w-8 h-8" />
                                <span className="text-[10px] font-semibold">Add Story</span>
                            </div>
                            {/* User Stories */}
                            {allUsersWithStories.map(userWithStory => (
                                <div key={getUserIdForKey(userWithStory)} onClick={() => setViewingStoriesOfUser(userWithStory)} className="flex-shrink-0 relative cursor-pointer group">
                                    <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 group-hover:from-yellow-300 group-hover:to-fuchsia-500">
                                        <div className="p-[2px] bg-gray-800 rounded-full">
                                            <UserAvatar name={userWithStory.name} avatarUrl={userWithStory.avatarUrl} className="w-[70px] h-[70px] rounded-full object-cover" />
                                        </div>
                                    </div>
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded-full truncate max-w-[80px] border border-gray-700">
                                        {userWithStory.name.split(' ')[0]}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {currentUser && <PostComposer user={currentUser} onPost={handlePost} />}
                        
                        {feedPosts.filter(post => !hiddenPostIds.has(post.id)).map((post: GroupPost) => {
                            const postAuthor = findFullUserById(post.authorId);
                            if (!postAuthor) return null;
                            const isMine = post.authorId === currentUserId;
                            const isLong = post.content.length > 300;
                            const isExpanded = expandedPosts.has(post.id);
                            const postComments = comments[post.id] || [];

                            const isEditingThis = editingPostId === post.id;
                            const isCommentingThis = commentingOnPostId === post.id;

                            return (
                                <div ref={postObserverRef} data-post-id={post.id} key={post.id} className="bg-gray-800 p-4 rounded-lg shadow-xl relative animate-fade-in-up">
                                    {isEditingThis ? (
                                        <div className="space-y-4">
                                            <textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md" rows={6}></textarea>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingPostId(null)} className="px-3 py-1 bg-gray-600 rounded-md">Cancel</button>
                                                <button onClick={() => handleSaveEdit()} className="px-3 py-1 bg-cyan-600 rounded-md">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => handleAvatarClick(getUserIdForKey(postAuthor))}>
                                                        <UserAvatar name={postAuthor.name} avatarUrl={postAuthor.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                                                    </button>
                                                    <div>
                                                        <button onClick={() => handleAvatarClick(getUserIdForKey(postAuthor))} className="font-semibold text-white text-left hover:underline">
                                                            {postAuthor.name}
                                                        </button>
                                                        <p className="text-sm text-gray-400">{timeSince(post.timestamp)}</p>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <button onClick={() => setOpenMenuId(prev => prev === post.id ? null : post.id)} className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
                                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                                    </button>
                                                    {openMenuId === post.id && (
                                                        <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-gray-600 border border-gray-500 rounded-md shadow-lg z-20 text-left py-1">
                                                            <button 
                                                                onClick={() => { setEditingPostId(post.id); setEditingContent(post.content); setOpenMenuId(null); }}
                                                                className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500"
                                                            >
                                                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                               <span>Edit</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleHide(post.id)}
                                                                className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                <span>Hide Post</span>
                                                            </button>
                                                            <button 
                                                                onClick={handleReport}
                                                                className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-gray-500"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                                <span>Report Post</span>
                                                            </button>
                                                            {isMine && (
                                                                <button 
                                                                    onClick={() => handleDelete(post)}
                                                                    className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-500"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                    <span>Delete Post</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className={`text-gray-300 ${isLong && !isExpanded ? 'line-clamp-4' : ''}`}>
                                                <PostRenderer content={post.content} onInternalLinkClick={handleInternalLinkClick} />
                                            </div>
                                            {isLong && <button onClick={() => toggleExpandPost(post.id)} className="text-cyan-400 text-sm hover:underline mt-2">{isExpanded ? 'Read Less' : 'Read More'}</button>}
                                            
                                            <div className="flex justify-between items-center text-sm text-gray-400 mt-4 border-t border-gray-700 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleToggleReaction(post.id, '👍')} className={`flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors ${post.reactions?.['👍']?.includes(currentUserId) ? 'text-cyan-400' : ''}`}>
                                                        <IconLike />
                                                        <span>{post.reactions?.['👍']?.length || 0}</span>
                                                    </button>
                                                     <button onClick={() => handleToggleReaction(post.id, '👎')} className={`flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors ${post.reactions?.['👎']?.includes(currentUserId) ? 'text-red-400' : ''}`}>
                                                        <IconDislike />
                                                         <span>{post.reactions?.['👎']?.length || 0}</span>
                                                    </button>
                                                     <button onClick={() => handleCommentClick(post.id)} className="flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors">
                                                        <IconComment />
                                                        <span>{postComments.length}</span>
                                                    </button>
                                                </div>
                                                 <div className="flex items-center gap-1">
                                                    <IconEye />
                                                    <span>{post.views || 0}</span>
                                                </div>
                                            </div>

                                            {isCommentingThis && (
                                                <div className="mt-4 border-t border-gray-700 pt-4">
                                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                                        {postComments.map(comment => (
                                                            <div key={comment.id} className="flex items-start gap-2">
                                                                <UserAvatar name={comment.authorName} avatarUrl={comment.authorAvatar} className="w-8 h-8 rounded-full" />
                                                                <div className="bg-gray-700/50 p-2 rounded-lg text-sm">
                                                                    <p className="font-semibold">{comment.authorName}</p>
                                                                    <p className="text-gray-300">{comment.content}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                     <div className="flex items-center gap-2 mt-3">
                                                        <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyPress={e => e.key === 'Enter' && handlePostComment(post.id)} placeholder="Write a comment..." className="w-full bg-gray-700 p-2 rounded-md"/>
                                                        <button onClick={() => handlePostComment(post.id)} className="px-4 py-2 bg-cyan-600 rounded-md text-sm">Post</button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                );
        }
    };
    
    return (
        <div className="h-full bg-gray-900 text-white flex font-sans">
            {/* Right Sidebar Overlay for Mobile only (hidden on desktop) */}
            {isRightSidebarOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsRightSidebarOpen(false)}></div>
                    <aside className="absolute right-0 top-0 bottom-0 w-80 bg-gray-800 shadow-2xl p-4 overflow-y-auto flex flex-col animate-slide-in-right">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Explore</h2>
                            <button onClick={() => setIsRightSidebarOpen(false)}><CloseIcon /></button>
                        </div>
                        <RightSidebarContent />
                    </aside>
                </div>
            )}
            
            {/* Mobile Profile Modal */}
            {isMobileProfileOpen && currentUser && (
                <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-end sm:items-center" onClick={() => setIsMobileProfileOpen(false)}>
                    <div className="bg-gray-800 w-full sm:max-w-md p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl space-y-6 animate-slide-in-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b border-gray-700 pb-4">
                             <h3 className="text-xl font-bold text-white">My Profile</h3>
                             <button onClick={() => setIsMobileProfileOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon /></button>
                        </div>
                        
                        <div className="flex flex-col items-center">
                            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-24 h-24 rounded-full border-4 border-gray-700 text-3xl mb-3" />
                            <h4 className="text-xl font-bold text-white">{currentUser.name}</h4>
                            <p className="text-gray-400 text-sm">@{currentUserId}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-center">
                             <div className="bg-gray-700/50 p-3 rounded-xl">
                                 <p className="text-2xl font-bold text-cyan-400">{userStats.followers}</p>
                                 <p className="text-xs text-gray-400 uppercase tracking-wide">Followers</p>
                             </div>
                             <div className="bg-gray-700/50 p-3 rounded-xl">
                                 <p className="text-2xl font-bold text-cyan-400">{userStats.following}</p>
                                 <p className="text-xs text-gray-400 uppercase tracking-wide">Following</p>
                             </div>
                        </div>

                         <div className="bg-gradient-to-r from-green-900/40 to-green-800/40 p-4 rounded-xl border border-green-500/30 flex justify-between items-center">
                            <div>
                                <p className="text-xs text-green-300 uppercase font-semibold">Total Earned</p>
                                <p className="text-xl font-bold text-white">{formatCurrency(userStats.earned)}</p>
                            </div>
                            <div className="bg-green-500/20 p-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                         </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-700/30 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm text-gray-300">Posts</span>
                                <span className="font-bold text-white">{userStats.created}</span>
                            </div>
                             <div className="bg-gray-700/30 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm text-gray-300">Likes</span>
                                <span className="font-bold text-white">{userStats.likes}</span>
                            </div>
                             <div className="bg-gray-700/30 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm text-gray-300">Views</span>
                                <span className="font-bold text-white">{userStats.views}</span>
                            </div>
                             <div className="bg-gray-700/30 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm text-gray-300">Shared</span>
                                <span className="font-bold text-white">0</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-700 space-y-3">
                             {onBackToDashboard && (
                                <button onClick={() => { setIsMobileProfileOpen(false); onBackToDashboard(); }} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">
                                    <span>Back to Dashboard</span>
                                </button>
                            )}
                            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium transition-colors border border-red-600/30">
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Sidebar (Left) */}
            <aside className={`bg-gray-800 shadow-xl flex flex-col flex-shrink-0 transition-all duration-300 hidden md:flex ${isDesktopSidebarExpanded ? 'w-64' : 'w-20'}`}>
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                    {isDesktopSidebarExpanded ? (
                        <div className="flex items-center justify-between w-full animate-fade-in-up">
                             <div className="flex items-center">
                                <IconOnline />
                                <h1 className="text-xl font-bold text-cyan-400 ml-2 truncate">Online Hub</h1>
                             </div>
                             <button onClick={() => setIsDesktopSidebarExpanded(false)} className="text-gray-400 hover:text-white">
                                <CloseIcon />
                             </button>
                        </div>
                    ) : (
                        <button onClick={() => setIsDesktopSidebarExpanded(true)} className="text-gray-400 hover:text-white" title="Expand Menu">
                             <HamburgerIcon />
                        </button>
                    )}
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                    {onBackToDashboard && (
                        <button onClick={() => onBackToDashboard()} className="w-full flex items-center p-3 transition-colors text-gray-400 hover:bg-gray-700 hover:text-white" title={!isDesktopSidebarExpanded ? "Back to Dashboard" : ""}>
                            <span className={`flex-shrink-0 w-6 h-6 ${isDesktopSidebarExpanded ? 'mr-3' : 'mx-auto'}`}>&larr;</span>
                            {isDesktopSidebarExpanded && <span className="text-sm font-medium">Back to Dashboard</span>}
                        </button>
                    )}
                    {navItems.map(item => (
                        <button
                            key={item.view}
                            onClick={() => handleTabClick(item.view)}
                            className={`w-full flex items-center p-3 transition-colors relative group ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            title={!isDesktopSidebarExpanded ? item.label : ''}
                        >
                            <span className={`flex-shrink-0 w-6 h-6 ${isDesktopSidebarExpanded ? 'mr-3' : 'mx-auto'}`}>{item.icon}</span>
                            {isDesktopSidebarExpanded && <span className="text-sm font-medium">{item.label}</span>}
                            {item.unreadCount > 0 && <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse-custom ${isDesktopSidebarExpanded ? 'ml-auto' : 'absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4'}`}>{item.unreadCount}</span>}
                        </button>
                    ))}
                </nav>
                <footer className="p-4 border-t border-gray-700 flex-shrink-0">
                    <button onClick={onLogout} className="w-full flex items-center p-2 rounded-md hover:bg-gray-700 text-red-400 group" title={!isDesktopSidebarExpanded ? "Logout" : ""}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 flex-shrink-0 ${isDesktopSidebarExpanded ? 'mr-3' : 'mx-auto'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {isDesktopSidebarExpanded && <span className="text-sm font-medium">Logout</span>}
                    </button>
                </footer>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header for desktop or when mobile menu is closed */}
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 sm:px-6 shadow-md z-10 md:pl-6">
                    <div className="flex items-center">
                        <button onClick={() => setIsMobileProfileOpen(true)} className="md:hidden mr-2">
                             <UserAvatar name={currentUser?.name || '?'} avatarUrl={currentUser?.avatarUrl} className="w-8 h-8 rounded-full border border-gray-600" />
                        </button>
                        <h2 className="text-lg font-semibold text-white truncate">
                            {navItems.find(i => i.view === view)?.label || 'Online Feed'}
                        </h2>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2 bg-gray-700 rounded-full hover:bg-gray-600">
                            <CartIcon/>
                            {totalCartItems > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-white">{totalCartItems}</span>}
                        </button>
                        
                        <button onClick={() => setIsRightSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white transition-colors md:hidden">
                            <IconMenuKebab />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6 bg-gray-900 relative">
                        <div className="max-w-3xl mx-auto">
                            {renderContent()}
                        </div>
                    </main>

                    {/* Right Sidebar - 3rd Column for Desktop/Tablet */}
                    {view === 'feed' && (
                        <aside className="w-80 hidden md:block bg-gray-800 border-l border-gray-700 overflow-y-auto p-4 flex-shrink-0 z-10">
                             <RightSidebarContent />
                        </aside>
                    )}
                </div>

                 {/* Mobile Bottom Navigation */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around items-center z-50 pb-safe">
                    {navItems.map(item => (
                        <button
                            key={item.view}
                            onClick={() => handleTabClick(item.view)}
                            className={`flex flex-col items-center justify-center w-full py-2 ${view === item.view ? 'text-cyan-400' : 'text-gray-400'}`}
                        >
                            <div className="relative">
                                {item.icon}
                                {item.unreadCount > 0 && <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse-custom">{item.unreadCount > 9 ? '9+' : item.unreadCount}</span>}
                            </div>
                            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            {mapPreviewUrl && <MapPreviewModal url={mapPreviewUrl} onClose={() => setMapPreviewUrl(null)} />}
            {isAddStoryModalOpen && <AddStoryModal user={currentUser!} onClose={() => setIsAddStoryModalOpen(false)} onStoryPosted={refreshStories} />}
            {viewingStoriesOfUser && <StoryViewer storiesByUser={storiesByUser} startUser={viewingStoriesOfUser} currentUser={currentUser!} onClose={() => setViewingStoriesOfUser(null)} />}
            {chatTarget && currentUser && 'studentId' in currentUser && <MiniChatWindow currentUser={currentUser as User} targetUser={chatTarget} onClose={() => setChatTarget(null)} />}
            {viewingListing && <ListingDetailModal listing={viewingListing} onClose={() => setViewingListing(null)} onStartMessage={handleStartMiniChat} currentUserId={currentUserId} onAddToCart={handleAddToCart} />}
            {isCartOpen && <CartModal 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                cart={cart} 
                listings={marketplaceService.getListings()} 
                onUpdateQuantity={handleUpdateCartQuantity} 
                onStartMessage={handleStartMiniChat} 
                onNavigateToWallet={onNavigateToWallet!} 
                user={currentUser!}
                onOpenMarketplacePayment={handleOpenMarketplacePayment}
                onOrderStaged={onOrderStaged!}
                onClearCart={handleClearCart}
            />}

            {isMarketplacePaymentModalOpen && stagedCheckoutItems && (
                <MarketplacePaymentModal
                    isOpen={isMarketplacePaymentModalOpen}
                    onClose={() => setIsMarketplacePaymentModalOpen(false)}
                    stagedCheckout={stagedCheckoutItems}
                    stagedCheckoutTotal={stagedCheckoutTotal}
                    userWalletBalance={userWallet.balance}
                    onConfirmPayment={handleConfirmMarketplacePayment}
                    pinError={marketplacePaymentError}
                    setPinError={setMarketplacePaymentError}
                />
            )}

            {postToDelete && (
                <ConfirmationModal isOpen={true} title="Delete Post" message={<p>Are you sure you want to delete this post?</p>} onConfirm={confirmDelete} onCancel={() => setPostToDelete(null)} confirmButtonVariant="danger" />
            )}
             {profileModalUser && currentUser && (
                <UserProfileModal 
                    userToShow={profileModalUser} 
                    currentUser={currentUser} 
                    onClose={() => setProfileModalUser(null)} 
                    onStartMessage={handleStartMiniChat}
                    onRefresh={refreshAllData}
                />
            )}
        </div>
    );
};
export default OnlineFeedPage;
