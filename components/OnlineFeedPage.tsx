// components/OnlineFeedPage.tsx


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, AdminUser, PostComment, ChatConversation, ChatMessage, ChatAttachment, Event, Place, MarketplaceListing, MarketplaceMedia, Story, GroupPost, School, Receipt, ReceiptStatus, StagedMarketplaceOrder, Group } from '../types';
import ProfilePage from './ProfilePage';
import * as userService from '../services/userService';
import { getHomePageContent } from '../services/homePageService';
import { getAllSchools } from '../services/schoolService';
import { getAllSchoolUsers } from '../services/studentService';
import UserAvatar from './UserAvatar';
import { getAllAdminUsers } from '../services/userService';
import * as groupService from '../services/groupService';
import ConfirmationModal from './ConfirmationModal';
import GroupsPage from './GroupsPage';
import MessagesPage from './MessagesPage';
import * as chatService from '../services/chatService';
import * as apiService from '../services/apiService';
import { getPlaceSuggestionsFromAI, categorizeListing } from '../services/apiService';
import * as marketplaceService from '../services/marketplaceService';
import * as eWalletService from '../services/eWalletService';
import * as receiptService from '../services/receiptService';
import { decodeBarcodeWithGoogle } from '../services/apiService';
import PinStrengthIndicator from './PinStrengthIndicator';
import { isOnline } from '../services/presenceService';

// FIX: Define missing components used within OnlineFeedPage.

// --- TYPE DEFINITIONS ---
interface OnlineUser { id: string; name: string; avatar: string; }
interface Announcement { id: string; title: string; author: string; content: string; }

const findFullUserById = (userId: string): User | AdminUser | null => {
    const schoolUsers = getAllSchoolUsers();
    const foundSchoolUser = schoolUsers.find(u => u.studentId === userId);
    if (foundSchoolUser) return foundSchoolUser;

    const adminUsers = getAllAdminUsers();
    const foundAdminUser = adminUsers.find(u => u.id === userId);
    if (foundAdminUser) return foundAdminUser;
    
    return null;
};

const getUserIdForKey = (u: User | AdminUser): string => {
    if ('studentId' in u) {
        return u.studentId;
    }
    return (u as AdminUser).id;
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

// --- SVG ICONS ---
const IconFacebook = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.323-1.325z"/></svg>;
const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const IconNavFeed = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"></path></svg>;
const IconNavGroups = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>;
const IconNavEvents = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"></path></svg>;
const IconNavMarketplace = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2-2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"></path></svg>;
const IconNavChat = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>;
const IconComposerPhoto = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"></path></svg>;
const IconComposerVideo = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>;
const IconComposerFile = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"></path></svg>;
const IconHamburger = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconClose = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconCalendar = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconLocation = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>;
const PlusIcon = ({ className }: { className?: string }) => (<svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>);
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>;
const IconOnline = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M12 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
const IconAttachment = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const IconSchedule = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const IconLike = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.93L5.5 8m7 2v5m0 0v5m0-5h5" /></svg>;
const IconDislike = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.738 3h4.017c.163 0 .326-.02.485.06L17 4m-7 10v5a2 2 0 002 2h.085a2 2 0 001.736-.93l2.5-4m-7 2v-5m0 0V5m0 5h5" /></svg>;
const IconComment = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const IconCopyLink = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const IconEye = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>;
const IconMic = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"></path></svg>;

const IconKebab = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
);

const AnimatedCheckmarkIcon: React.FC<{ color: string }> = ({ color }) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
        <path className="checkmark__path" d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;

// FIX: Define missing components
const EventsView: React.FC<{ user: User | AdminUser; school: School | null; onMapClick: (uri: string) => void; }> = ({ user, school, onMapClick }) => {
    const [events, setEvents] = useState<Event[]>([]);
    useEffect(() => {
        if (school) {
            setEvents(groupService.getAllEventsForSchool(school.id));
        }
    }, [school]);

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold">School Events</h3>
            {events.length > 0 ? events.map(event => (
                <div key={event.id} className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-bold text-xl text-cyan-400">{event.title}</h4>
                    <p className="text-sm text-gray-400">{new Date(event.startTime).toLocaleString()}</p>
                    <p className="mt-2 text-gray-300">{event.description}</p>
                    <button onClick={() => onMapClick(event.place.uri)} className="text-sm text-cyan-400 hover:underline mt-2">View Location</button>
                </div>
            )) : <p className="text-gray-400">No events found for this school.</p>}
        </div>
    );
};

const MarketplaceView: React.FC<{ user: User | AdminUser; setViewingListing: (listing: MarketplaceListing) => void; onAddToCart: (listing: MarketplaceListing) => void; refreshAllData: () => void; initialTab: 'browse' | 'my_sales' | 'purchases'; cart: Record<string, number>; onClearCart: () => void; }> = ({ user, setViewingListing, onAddToCart, refreshAllData, initialTab, cart, onClearCart }) => {
    return <div>Marketplace Placeholder</div>;
};

const MapPreviewModal: React.FC<{ url: string; onClose: () => void; }> = ({ url, onClose }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4">
        <div className="bg-gray-800 rounded-lg w-full max-w-3xl h-[80vh] flex flex-col p-4">
            <div className="flex justify-end mb-2">
                <button onClick={onClose} className="text-white text-2xl">&times;</button>
            </div>
            <iframe src={url} className="w-full h-full border-0 rounded-md" allowFullScreen loading="lazy"></iframe>
        </div>
    </div>
);

const AddStoryModal: React.FC<{ user: User | AdminUser; onClose: () => void; onStoryPosted: () => void; }> = ({ user, onClose, onStoryPosted }) => {
    const [content, setContent] = useState('');
    const currentUserId = getUserIdForKey(user);

    const handlePost = () => {
        if (!content.trim()) return;
        groupService.addStory({
            userId: currentUserId,
            content: content.trim(),
        });
        onStoryPosted();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[120] p-4">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Create a Story</h3>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What's on your mind?" className="w-full p-2 bg-gray-700 rounded mb-4" rows={4}></textarea>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    <button onClick={handlePost} className="px-4 py-2 bg-cyan-600 rounded">Post</button>
                </div>
            </div>
        </div>
    );
};

const StoryViewer: React.FC<{ storiesByUser: Record<string, Story[]>; startUser: User | AdminUser; currentUser: User | AdminUser; onClose: () => void; }> = ({ storiesByUser, startUser, currentUser, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center" onClick={onClose}>
            <div className="w-full max-w-md h-[95vh] bg-gray-900 rounded-lg overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <p className="text-white p-4">Story Viewer for {startUser.name}</p>
                 <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl z-10">&times;</button>
            </div>
        </div>
    );
};

const MiniChatWindow: React.FC<{ currentUser: User; targetUser: User | AdminUser; onClose: () => void; }> = ({ currentUser, targetUser, onClose }) => {
    const currentUserId = getUserIdForKey(currentUser);
    const targetUserId = getUserIdForKey(targetUser);
    const [conversation, setConversation] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const convo = chatService.startOrGetConversation(currentUserId, targetUserId);
        setConversation(convo);
    }, [currentUserId, targetUserId]);

    const refreshMessages = useCallback(() => {
        if (conversation) {
            const msgs = chatService.getMessagesForConversation(conversation.id, currentUserId);
            setMessages(msgs);
        }
    }, [conversation, currentUserId]);

    useEffect(() => {
        refreshMessages();
        const interval = setInterval(refreshMessages, 2000);
        return () => clearInterval(interval);
    }, [refreshMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = () => {
        if (newMessage.trim() && conversation) {
            chatService.sendMessage(conversation.id, currentUserId, newMessage.trim());
            setNewMessage('');
            refreshMessages();
        }
    };
    return (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-gray-800 rounded-lg shadow-xl flex flex-col z-[110]">
            <header className="p-2 bg-gray-700 flex justify-between items-center rounded-t-lg">
                <p className="font-bold">{targetUser.name}</p>
                <button onClick={onClose}>&times;</button>
            </header>
            <div className="flex-grow p-2 overflow-y-auto">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                        <p className={`p-2 my-1 rounded-lg ${msg.senderId === currentUserId ? 'bg-cyan-600' : 'bg-gray-600'}`}>{msg.content}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-gray-700">
                <input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()} 
                    className="w-full p-2 bg-gray-700 rounded" 
                    placeholder="Type a message..."
                />
            </div>
        </div>
    );
};

// --- NEW Community Sidebar Component ---
const CommunitySidebar: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    user: User | AdminUser;
    school: School | null;
}> = ({ isOpen, onClose, user, school }) => {
    const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
    const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
    const [topGroups, setTopGroups] = useState<Group[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [pastEvents, setPastEvents] = useState<Event[]>([]);

    const currentUserId = getUserIdForKey(user);

    useEffect(() => {
        if (isOpen && school) {
            // Online Users
            const allUsers = getAllSchoolUsers().filter(u => u.schoolId === school.id);
            const online = allUsers.filter(u => isOnline(u.studentId));
            setOnlineUsers(online);

            // Suggested Users (simple random logic)
            const suggestions = allUsers
                .filter(u => u.studentId !== currentUserId)
                .sort(() => 0.5 - Math.random())
                .slice(0, 5);
            setSuggestedUsers(suggestions);
            
            // Top Groups
            const allGroups = groupService.getAllGroups()
                .filter(g => allUsers.some(u => g.memberIds.includes(u.studentId)))
                .sort((a, b) => b.memberIds.length - a.memberIds.length)
                .slice(0, 5);
            setTopGroups(allGroups);

            // Events
            const now = Date.now();
            const allEvents = groupService.getAllEventsForSchool(school.id);
            setUpcomingEvents(allEvents.filter(e => e.startTime >= now).sort((a,b) => a.startTime - b.startTime).slice(0, 5));
            setPastEvents(allEvents.filter(e => e.startTime < now).sort((a,b) => b.startTime - a.startTime).slice(0, 3));
        }
    }, [isOpen, school, currentUserId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>
            
            <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-gray-800 shadow-xl flex flex-col animate-slide-in-right">
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Community</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <IconClose />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-8">
                    <div>
                        <h3 className="font-bold text-cyan-400 mb-3">Users Online ({onlineUsers.length})</h3>
                        <div className="space-y-2">
                            {onlineUsers.slice(0, 5).map(u => (
                                <div key={u.studentId} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-md">
                                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                    <span className="text-sm font-semibold">{u.name}</span>
                                </div>
                            ))}
                            {onlineUsers.length > 5 && <p className="text-xs text-gray-400 mt-2 text-center">...and {onlineUsers.length - 5} more</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-cyan-400 mb-3">Suggested Users</h3>
                        <div className="space-y-2">
                            {suggestedUsers.map(u => (
                                <div key={u.studentId} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                        <span className="text-sm font-semibold">{u.name}</span>
                                    </div>
                                    <button className="px-3 py-1 bg-cyan-600 text-white rounded-full text-xs font-semibold">Follow</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-cyan-400 mb-3">Top Groups</h3>
                        <div className="space-y-2">
                             {topGroups.map(g => (
                                <div key={g.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-md">
                                    <UserAvatar name={g.name} avatarUrl={g.logoUrl} className="w-8 h-8 rounded-md" />
                                    <div>
                                        <p className="text-sm font-semibold">{g.name}</p>
                                        <p className="text-xs text-gray-400">{g.memberIds.length} members</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                     <div>
                        <h3 className="font-bold text-cyan-400 mb-3">Upcoming Events</h3>
                        <div className="space-y-2">
                             {upcomingEvents.map(e => (
                                <div key={e.id} className="p-2 bg-gray-700/50 rounded-md">
                                    <p className="font-semibold text-sm">{e.title}</p>
                                    <p className="text-xs text-gray-400">{new Date(e.startTime).toLocaleString()}</p>
                                </div>
                            ))}
                            {upcomingEvents.length === 0 && <p className="text-xs text-gray-400">No upcoming events.</p>}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

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

const OnlineFeedPage: React.FC<OnlineFeedPageProps> = ({ user, onLogout, onBackToDashboard, onStartMessage, onNavigateToWallet, onOrderStaged, stagedOrder, onStagedOrderConsumed }) => {
    type OnlineView = 'feed' | 'groups' | 'events' | 'marketplace' | 'chat';
    const [view, setView] = useState<OnlineView>('feed');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
    
    const [storiesByUser, setStoriesByUser] = useState<Record<string, Story[]>>({});
    const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
    const [viewingStoriesOfUser, setViewingStoriesOfUser] = useState<User | AdminUser | null>(null);

    const [feedPosts, setFeedPosts] = useState<GroupPost[]>([]);
    
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [postToDelete, setPostToDelete] = useState<GroupPost | null>(null);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [hiddenPostIds, setHiddenPostIds] = useState(() => new Set<string>()); // Using new Set() to fix compilation.
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
    const [isCommunitySidebarOpen, setIsCommunitySidebarOpen] = useState(false);


    const handleClearCart = () => {
        if (Object.keys(cart).length > 0 && window.confirm("Are you sure you want to remove all items from your cart?")) {
            setCart({});
        }
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

    const school = useMemo(() => {
        if ('schoolId' in user && user.schoolId) {
            return getAllSchools().find(s => s.id === user.schoolId) || null;
        }
        return null;
    }, [user]);

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
            setProfileModalUser(fullUser);
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
    };


    const navItems = useMemo(() => ([
        { view: 'feed', label: 'Feed', icon: <IconNavFeed />, unreadCount: feedUnreadCount },
        { view: 'groups', label: 'Groups', icon: <IconNavGroups />, unreadCount: groupsUnreadCount },
        { view: 'events', label: 'Events', icon: <IconNavEvents />, unreadCount: eventsUnreadCount },
        { view: 'marketplace', label: 'Shop', icon: <IconNavMarketplace />, unreadCount: marketplaceUnreadCount },
        { view: 'chat', label: 'Chats', icon: <IconNavChat />, unreadCount: chatUnreadCount },
    ]), [feedUnreadCount, groupsUnreadCount, eventsUnreadCount, marketplaceUnreadCount, chatUnreadCount]);

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
                        {currentUser && <PostComposer user={currentUser} onPost={handlePost} />}
                        {allUsersWithStories.length > 0 && (
                            <div className="bg-gray-800 p-4 rounded-lg flex space-x-4 overflow-x-auto scrollbar-hidden">
                                <div onClick={() => setIsAddStoryModalOpen(true)} className="flex-shrink-0 w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-600 border-2 border-dashed border-gray-600">
                                    <PlusIcon className="w-10 h-10" />
                                </div>
                                {allUsersWithStories.map(userWithStory => (
                                    <div key={getUserIdForKey(userWithStory)} onClick={() => setViewingStoriesOfUser(userWithStory)} className="flex-shrink-0 relative">
                                        <UserAvatar name={userWithStory.name} avatarUrl={userWithStory.avatarUrl} className="w-20 h-20 rounded-full border-2 border-cyan-500 cursor-pointer object-cover" />
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">{userWithStory.name.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                                        <p className="font-semibold text-white">{postAuthor.name}</p>
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
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <aside className="w-64 h-full bg-gray-800 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h1 className="text-xl font-bold text-cyan-400">Online Hub</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)}><IconClose /></button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                            {onBackToDashboard && (
                                <button onClick={() => { onBackToDashboard(); setIsMobileMenuOpen(false); }} className="w-full flex items-center px-4 py-3 transition-colors text-gray-400 hover:bg-gray-700 hover:text-white">
                                    <span className="mr-3">&larr;</span>
                                    <span className="text-sm font-medium">Back to Dashboard</span>
                                </button>
                            )}
                        </nav>
                        <footer className="p-4 border-t border-gray-700">
                             <div className="flex items-center space-x-3 cursor-pointer" onClick={onLogout}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                <span className="text-gray-400 hover:text-white font-medium">Logout</span>
                            </div>
                        </footer>
                    </aside>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="bg-gray-800 shadow-xl flex flex-col w-20 md:w-64 flex-shrink-0 transition-all duration-300 hidden md:flex">
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                    <IconOnline />
                    <h1 className="text-xl font-bold text-cyan-400 ml-3 truncate hidden md:block">Online Hub</h1>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                    {onBackToDashboard && (
                        <button onClick={() => onBackToDashboard()} className="w-full flex items-center p-3 transition-colors text-gray-400 hover:bg-gray-700 hover:text-white">
                            <span className="flex-shrink-0 w-6 h-6 mr-3">&larr;</span>
                            <span className="text-sm font-medium hidden md:block">Back to Dashboard</span>
                        </button>
                    )}
                    {navItems.map(item => (
                        <button
                            key={item.view}
                            onClick={() => handleTabClick(item.view)}
                            className={`w-full flex items-center p-3 transition-colors relative group ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            <span className="flex-shrink-0 w-6 h-6 mx-auto md:mx-0 md:mr-3">{item.icon}</span>
                            <span className="text-sm font-medium hidden md:block">{item.label}</span>
                            {item.unreadCount > 0 && <span className="ml-auto flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse-custom">{item.unreadCount}</span>}
                        </button>
                    ))}
                </nav>
                <footer className="p-4 border-t border-gray-700 flex-shrink-0">
                    <button onClick={onLogout} className="w-full flex items-center p-2 rounded-md hover:bg-gray-700 text-red-400 group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0 mx-auto md:mx-0 md:mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="text-sm font-medium hidden md:block">Logout</span>
                    </button>
                </footer>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header for desktop or when mobile menu is closed */}
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 sm:px-6 shadow-md z-10 md:pl-6">
                    <div className="flex items-center">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-gray-400 hover:text-white mr-2">
                            <IconHamburger />
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

                        <button onClick={() => setIsCommunitySidebarOpen(true)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600">
                            <IconKebab />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
                    <div className="max-w-3xl mx-auto">
                        {renderContent()}
                    </div>
                </main>

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
        </div>
    );
};

export default OnlineFeedPage;