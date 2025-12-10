import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, BroadcastChannel, BroadcastMessage } from '../types';
import GroupsPage from './GroupsPage';
import MessagesPage from './MessagesPage';
import * as groupService from '../services/groupService';

// --- ANNOUNCEMENTS PAGE SUB-COMPONENT ---
const AnnouncementsPage: React.FC<{ user: User }> = ({ user }) => {
    const [channels, setChannels] = useState<BroadcastChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel | null>(null);
    const [messages, setMessages] = useState<BroadcastMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');

    const currentUserId = 'studentId' in user ? user.studentId : (user as any).id;
    const schoolId = user.schoolId;

    useEffect(() => {
        if (schoolId) {
            const schoolChannels = groupService.getChannelsForSchool(schoolId);
            setChannels(schoolChannels);
            if (schoolChannels.length > 0 && window.innerWidth >= 640) { // Select first channel on desktop
                setSelectedChannel(schoolChannels[0]);
            }
        }
    }, [schoolId]);

    const refreshMessages = useCallback(() => {
        if (selectedChannel) {
            setMessages(groupService.getMessagesForChannel(selectedChannel.id));
        }
    }, [selectedChannel]);

    useEffect(() => {
        if (selectedChannel) {
            refreshMessages();
            const interval = setInterval(refreshMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [selectedChannel, refreshMessages]);

    const handlePost = () => {
        if (newMessage.trim() && selectedChannel) {
            groupService.postBroadcastMessage(selectedChannel.id, currentUserId, newMessage.trim());
            setNewMessage('');
            refreshMessages();
        }
    };

    if (!schoolId) {
        return <div className="p-4 text-center text-gray-400">User is not associated with a school.</div>;
    }
    
    if (channels.length === 0) {
        return <div className="p-4 text-center text-gray-400">No announcement channels found for this school.</div>;
    }

    const canPost = selectedChannel?.adminIds.includes(currentUserId);

    return (
        <div className="flex h-full overflow-hidden">
            {/* Channel List Sidebar */}
            <div className={`
                ${selectedChannel ? 'hidden sm:flex' : 'flex w-full'} 
                sm:w-1/3 sm:max-w-xs bg-gray-800 border-r border-gray-700 flex-col transition-all duration-300
            `}>
                <div className="p-4 border-b border-gray-700">
                    <h3 className="font-bold text-lg">Channels</h3>
                </div>
                <nav className="flex-grow overflow-y-auto">
                    {channels.map(channel => (
                        <button key={channel.id} onClick={() => setSelectedChannel(channel)}
                            className={`w-full text-left p-3 flex items-center space-x-3 ${selectedChannel?.id === channel.id ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                            <div className="bg-gray-700 p-2 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>
                            </div>
                            <div>
                                <p className="font-semibold">{channel.name}</p>
                                <p className="text-xs text-gray-400 truncate">{channel.description}</p>
                            </div>
                        </button>
                    ))}
                </nav>
            </div>
            {/* Message View */}
            <div className={`
                ${selectedChannel ? 'flex w-full sm:w-auto' : 'hidden'}
                flex-1 flex-col sm:flex
            `}>
                {selectedChannel ? (
                    <>
                        <header className="p-3 border-b border-gray-700 flex items-center space-x-3">
                            <button onClick={() => setSelectedChannel(null)} className="sm:hidden p-1 -ml-1 text-gray-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h2 className="font-bold text-lg">{selectedChannel.name}</h2>
                                <p className="text-xs text-gray-400">{selectedChannel.description}</p>
                            </div>
                        </header>
                        <main className="flex-grow p-4 overflow-y-auto space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className="flex items-start gap-3">
                                    <img src={msg.authorAvatar} alt={msg.authorName} className="w-10 h-10 rounded-full" />
                                    <div className="bg-gray-700 p-3 rounded-lg w-full shadow-md">
                                        <div className="flex justify-between items-baseline">
                                            <p className="font-bold text-cyan-300">{msg.authorName}</p>
                                            <p className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleString()}</p>
                                        </div>
                                        <p className="whitespace-pre-wrap mt-1 text-gray-200">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </main>
                        {canPost && (
                            <footer className="p-3 border-t border-gray-700 bg-gray-900/50">
                                <div className="flex items-start space-x-2">
                                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={`Post in #${selectedChannel.name}`}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" rows={2}/>
                                    <button onClick={handlePost} disabled={!newMessage.trim()}
                                        className="px-4 py-2 bg-cyan-600 rounded-lg font-semibold hover:bg-cyan-700 disabled:bg-gray-600 self-end">Post</button>
                                </div>
                            </footer>
                        )}
                    </>
                ) : (
                    <div className="hidden sm:flex items-center justify-center h-full text-gray-400">Select a channel to view announcements.</div>
                )}
            </div>
        </div>
    );
};

interface SocialHubPageProps {
    // The user prop is a modified AdminUser to match the SchoolUser (User) type.
    user: User;
    onLogout: () => void;
    onReturnToAdmin?: () => void;
}

type SocialHubView = 'messages' | 'groups' | 'announcements';

const SocialHubPage: React.FC<SocialHubPageProps> = ({ user, onLogout, onReturnToAdmin }) => {
    const [view, setView] = useState<SocialHubView>('messages');

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white font-sans rounded-lg overflow-hidden">
            <header className="bg-gray-800 p-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-700">
                <nav className="flex items-center gap-2">
                    <button onClick={() => setView('messages')} className={`px-4 py-2 text-sm font-semibold rounded-md ${view === 'messages' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Messages</button>
                    <button onClick={() => setView('groups')} className={`px-4 py-2 text-sm font-semibold rounded-md ${view === 'groups' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Groups</button>
                    <button onClick={() => setView('announcements')} className={`px-4 py-2 text-sm font-semibold rounded-md ${view === 'announcements' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Announcements</button>
                </nav>
                {onReturnToAdmin && (
                     <button onClick={onReturnToAdmin} className="text-sm px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold">&larr; Back to Admin Dashboard</button>
                )}
            </header>

            <main className="flex-1 overflow-hidden">
                {/* The child components are designed to fill their container. */}
                {view === 'groups' && <div className="h-full"><GroupsPage user={user} /></div>}
                {view === 'messages' && <div className="h-full"><MessagesPage user={user} /></div>}
                {view === 'announcements' && <div className="h-full"><AnnouncementsPage user={user} /></div>}
            </main>
        </div>
    );
};

export default SocialHubPage;