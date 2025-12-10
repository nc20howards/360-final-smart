import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatConversation, ChatMessage } from '../types';
import * as chatService from '../services/chatService';
import * as groupService from '../services/groupService'; // for user lookups
import { isOnline } from '../services/presenceService';
import { translateText } from '../services/apiService';
import { ChatAttachment } from '../types';

interface MessagesPageProps {
    user: User;
    initialConversationId?: string;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ user, initialConversationId }) => {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isComposing, setIsComposing] = useState(false); // To show new message modal
    const [searchTerm, setSearchTerm] = useState('');
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    
    // --- State for new features ---
    const [translations, setTranslations] = useState<Record<string, { text: string; isOriginal: boolean }>>({});
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDateTime, setScheduleDateTime] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
    const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
    const [attachments, setAttachments] = useState<ChatAttachment[]>([]);


    const menuRef = useRef<HTMLDivElement>(null);
    const currentUserId = 'studentId' in user ? user.studentId : (user as any).id;

    const refreshConversations = useCallback(() => {
        const convos = chatService.getConversationsForUser(currentUserId);
        setConversations(convos);
    }, [currentUserId]);

    const refreshMessages = useCallback(() => {
        if (selectedConversation) {
            const msgs = chatService.getMessagesForConversation(selectedConversation.id, currentUserId);
            setMessages(msgs);
        }
    }, [selectedConversation, currentUserId]);
    
    // Handle opening a specific conversation via prop
    useEffect(() => {
        if (initialConversationId && conversations.length > 0 && !selectedConversation) {
            const convoToSelect = conversations.find(c => c.id === initialConversationId);
            if (convoToSelect) {
                setSelectedConversation(convoToSelect);
            }
        }
    }, [initialConversationId, conversations, selectedConversation]);

    // Handle closing dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    // Initial load and polling
    useEffect(() => {
        refreshConversations();
        const interval = setInterval(() => {
            // Also check for scheduled messages
            const sent = chatService.sendDueScheduledMessages();
            if (sent) {
                refreshMessages();
            }
            refreshConversations();
        }, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, [refreshConversations, refreshMessages]);

    // Effect for when a conversation is selected
    useEffect(() => {
        if (selectedConversation) {
            chatService.markConversationAsRead(selectedConversation.id, currentUserId);
            refreshMessages();
            refreshConversations(); // to update unread count
        } else {
            setMessages([]);
        }
    }, [selectedConversation, currentUserId, refreshMessages, refreshConversations]);
    
    // Polling for messages and typing status in the selected conversation
    useEffect(() => {
        if (!selectedConversation) return;

        const interval = setInterval(() => {
            refreshMessages();
            const typing = chatService.getTypingStatus(selectedConversation.id, currentUserId);
            const typingNames = typing.map(id => groupService.findUserById(id)?.name).filter(Boolean) as string[];
            setTypingUsers(typingNames);
        }, 1000); // Faster poll for active chat

        return () => clearInterval(interval);
    }, [selectedConversation, currentUserId, refreshMessages]);

    const handleSelectConversation = (conversation: ChatConversation) => {
        setSelectedConversation(conversation);
        setTranslations({}); // Clear translations when switching chats
    };

    const handleSendMessage = () => {
        if ((newMessage.trim() || attachments.length > 0) && selectedConversation) {
            const replyData = replyToMessage ? {
                messageId: replyToMessage.id,
                authorName: replyToMessage.senderName,
                content: replyToMessage.content.length > 50 ? `${replyToMessage.content.substring(0, 50)}...` : replyToMessage.content,
            } : undefined;
            
            chatService.sendMessage(selectedConversation.id, currentUserId, newMessage.trim(), attachments, replyData);
            setNewMessage('');
            setAttachments([]);
            setReplyToMessage(null);
            refreshMessages();
            refreshConversations();
        }
    };
    
    const handleStartConversation = (contactId: string) => {
        const conversation = chatService.startOrGetConversation(currentUserId, contactId);
        setSelectedConversation(conversation);
        setIsComposing(false);
        refreshConversations();
    };

    const getOtherParticipant = (conversation: ChatConversation) => {
        const otherId = conversation.participantIds.find(id => id !== currentUserId);
        return otherId ? groupService.findUserById(otherId) : null;
    };
    
    const handleTranslate = async (message: ChatMessage) => {
        // If we already have a translation, just toggle the view
        if (translations[message.id]) {
            toggleTranslation(message.id);
            return;
        }
    
        const targetLanguage = prompt("Translate to which language?", "English");
        if (!targetLanguage || !targetLanguage.trim()) return;
    
        setTranslatingId(message.id);
        try {
            const translatedText = await translateText(message.content, targetLanguage);
            setTranslations(prev => ({
                ...prev,
                [message.id]: { text: translatedText, isOriginal: false }
            }));
        } catch (error) {
            console.error("Translation failed", error);
            alert("Sorry, the translation failed. Please try again.");
        } finally {
            setTranslatingId(null);
        }
    };
    
    const toggleTranslation = (messageId: string) => {
        setTranslations(prev => {
            if (!prev[messageId]) return prev;
            return {
                ...prev,
                [messageId]: { ...prev[messageId], isOriginal: !prev[messageId].isOriginal }
            };
        });
    };
    
    const handleToggleReaction = (messageId: string, emoji: string) => {
        chatService.toggleReaction(messageId, currentUserId, emoji);
        refreshMessages();
    };
    
    const handleStartEdit = (message: ChatMessage) => {
        setEditingMessageId(message.id);
        setEditingContent(message.content);
        setOpenMenuId(null);
    };

    const handleSaveEdit = () => {
        if (editingMessageId && editingContent.trim()) {
            chatService.editMessage(editingMessageId, editingContent.trim());
            setEditingMessageId(null);
            setEditingContent('');
            refreshMessages();
            refreshConversations();
        }
    };

    const handleDeleteRequest = (message: ChatMessage) => {
        setMessageToDelete(message);
        setOpenMenuId(null);
    };
    
    const handleConfirmDelete = (forEveryone: boolean) => {
        if (!messageToDelete) return;
        try {
            chatService.deleteMessage(messageToDelete.id, currentUserId, forEveryone);
            refreshMessages();
            if (forEveryone) {
                refreshConversations();
            }
            setMessageToDelete(null);
        } catch (error) {
            alert((error as Error).message);
        }
    };
    
    const handleOpenScheduleModal = () => {
        if (!newMessage.trim() && attachments.length === 0) {
            alert("Please write a message or add an attachment to schedule.");
            return;
        }
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10); // 10 minutes from now

        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        const localDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;

        setScheduleDateTime(localDateTimeString);
        setIsScheduling(true);
    };

    const handleScheduleSubmit = () => {
        if ((newMessage.trim() || attachments.length > 0) && scheduleDateTime && selectedConversation) {
            const scheduleTime = new Date(scheduleDateTime).getTime();
            if (scheduleTime > Date.now()) {
                chatService.scheduleMessage(selectedConversation.id, currentUserId, newMessage.trim(), attachments, scheduleTime);
                setNewMessage('');
                setAttachments([]);
                setIsScheduling(false);
                setScheduleDateTime('');
                refreshMessages(); // to show the scheduled message
            } else {
                alert("Please select a time in the future.");
            }
        }
    };
    
    const handleToggleMenu = (messageId: string) => {
        setOpenMenuId(prevId => (prevId === messageId ? null : messageId));
    };


    const renderConversationList = () => {
        const possibleContacts = groupService.getAllPossibleMembers().filter(m => m.id !== currentUserId);
        
        return (
            <div className="flex flex-col h-full bg-gray-800 rounded-lg">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Messages</h2>
                </div>
                 <div className="p-4">
                     <button onClick={() => setIsComposing(true)} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">
                        New Message
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {conversations.map(convo => {
                        const otherUser = getOtherParticipant(convo);
                        if (!otherUser) return null;
                        const isSelected = selectedConversation?.id === convo.id;

                        const words = convo.lastMessage.split(' ');
                        const truncatedLastMessage = words.length > 3
                            ? words.slice(0, 3).join(' ') + '...'
                            : convo.lastMessage;

                        return (
                             <div key={convo.id} onClick={() => handleSelectConversation(convo)} className={`p-3 flex items-center space-x-3 cursor-pointer border-l-4 ${isSelected ? 'border-cyan-500 bg-gray-700' : 'border-transparent hover:bg-gray-700/50'}`}>
                                <div className="relative">
                                    <img src={otherUser.avatar} alt={otherUser.name} className="w-12 h-12 rounded-full"/>
                                     {isOnline(otherUser.id) && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-400 ring-2 ring-gray-800"></span>}
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex justify-between">
                                        <p className="font-semibold truncate">{otherUser.name}</p>
                                        <p className="text-xs text-gray-400 flex-shrink-0">{new Date(convo.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-400 truncate">{truncatedLastMessage}</p>
                                        {convo.unreadCount[currentUserId] > 0 && (
                                            <span className="bg-cyan-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">{convo.unreadCount[currentUserId]}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isComposing && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
                        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold mb-4">Start a new conversation</h3>
                            <input
                                type="text"
                                placeholder="Search for a user..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 rounded-md mb-4"
                            />
                            <ul className="max-h-60 overflow-y-auto space-y-2">
                                {possibleContacts
                                    .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(contact => (
                                        <li key={contact.id} onClick={() => handleStartConversation(contact.id)} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                                             <img src={contact.avatar} className="w-10 h-10 rounded-full" alt={contact.name} />
                                            <span>{contact.name}</span>
                                        </li>
                                    ))
                                }
                            </ul>
                            <button onClick={() => setIsComposing(false)} className="mt-4 px-4 py-2 bg-gray-600 rounded-md w-full">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderMessageView = () => {
        const availableReactions = ['👍', '❤️', '😂', '😮', '😢'];

        if (!selectedConversation) {
            return (
                <div className="hidden lg:flex items-center justify-center h-full bg-gray-800 rounded-lg">
                    <p className="text-gray-400">Select a conversation to start messaging.</p>
                </div>
            );
        }
        
        const otherUser = getOtherParticipant(selectedConversation);

        return (
             <div className="flex flex-col h-full bg-gray-800 rounded-lg">
                <header className="p-4 border-b border-gray-700 flex items-center space-x-3">
                    <button onClick={() => setSelectedConversation(null)} className="lg:hidden p-1 -ml-2 mr-1 text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                     {otherUser && (
                        <>
                             <div className="relative">
                                <img src={otherUser.avatar} alt={otherUser.name} className="w-10 h-10 rounded-full"/>
                                {isOnline(otherUser.id) && <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span>}
                            </div>
                            <div>
                                <h3 className="font-bold">{otherUser.name}</h3>
                                <p className="text-xs text-gray-400">{isOnline(otherUser.id) ? 'Online' : 'Offline'}</p>
                            </div>
                        </>
                     )}
                </header>
                <main className="flex-grow p-4 overflow-y-auto">
                     <div className="space-y-4">
                        {messages.map(msg => {
                            const isMine = msg.senderId === currentUserId;
                            const translationInfo = translations[msg.id];
                            const contentToShow = translationInfo && !translationInfo.isOriginal ? translationInfo.text : msg.content;
                            const isTranslated = !!translationInfo;
                            const isEditingThis = editingMessageId === msg.id;
                            
                            if (msg.isDeleted && !msg.senderId) return null;
                            
                            const scheduledTime = !msg.isSent && msg.scheduledSendTime ? new Date(msg.scheduledSendTime) : null;
                             if(scheduledTime && scheduledTime < new Date()) return null;

                            return (
                                <div key={msg.id} className={`w-full flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`group flex items-start gap-2 relative ${isMine ? 'flex-row-reverse' : ''}`}>
                                        
                                        {!msg.isDeleted && !isEditingThis && (
                                            <div className="relative self-center flex-shrink-0">
                                                <button
                                                    onClick={() => handleToggleMenu(msg.id)}
                                                    className="p-1.5 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-700 transition-opacity"
                                                >
                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                                </button>

                                                {openMenuId === msg.id && (
                                                    <div 
                                                        ref={menuRef} 
                                                        className={`absolute bottom-full mb-2 w-48 bg-gray-600 border border-gray-500 rounded-md shadow-lg z-20 text-left py-1 ${isMine ? 'right-0' : 'left-0'}`}
                                                    >
                                                        <button 
                                                            onClick={() => { setReplyToMessage(msg); setOpenMenuId(null); }}
                                                            className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                            <span>Reply</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => { handleTranslate(msg); setOpenMenuId(null); }}
                                                            className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m4 13-4-4m0 0l4-4m-4 4h12" /></svg>
                                                            <span>Translate</span>
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => handleDeleteRequest(msg)}
                                                            className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-500"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                            <span>Delete</span>
                                                        </button>

                                                        {isMine && (
                                                            <button 
                                                                onClick={() => { handleStartEdit(msg); setOpenMenuId(null); }}
                                                                className="flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500"
                                                            >
                                                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                               <span>Edit</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <img src={msg.senderAvatar} alt={msg.senderName} className="w-8 h-8 rounded-full self-start" />

                                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            <div className={`relative max-w-md p-3 rounded-lg ${isMine ? 'bg-cyan-600' : 'bg-gray-700'}`}>
                                                {!isMine && !msg.isDeleted && <p className="text-xs font-bold text-cyan-300 mb-1">{msg.senderName}</p>}

                                                {msg.replyTo && (
                                                    <div className="p-2 bg-black/20 rounded-md mb-2 border-l-2 border-cyan-400">
                                                        <p className="text-xs font-semibold text-cyan-200">{msg.replyTo.authorName}</p>
                                                        <p className="text-xs text-gray-300 italic truncate">{msg.replyTo.content}</p>
                                                    </div>
                                                )}
                                                
                                                {isEditingThis ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={editingContent}
                                                            onChange={(e) => setEditingContent(e.target.value)}
                                                            className="w-full p-2 bg-gray-800 rounded-md text-white"
                                                            rows={3}
                                                        />
                                                        <div className="flex justify-end space-x-2">
                                                            <button onClick={() => setEditingMessageId(null)} className="text-xs px-2 py-1 bg-gray-600 rounded">Cancel</button>
                                                            <button onClick={handleSaveEdit} className="text-xs px-2 py-1 bg-cyan-700 rounded">Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className={`whitespace-pre-wrap ${msg.isDeleted ? 'italic text-gray-400' : ''}`}>{contentToShow}</p>
                                                        
                                                        {translatingId === msg.id && <p className="text-xs italic text-gray-400 mt-1">Translating...</p>}
                                                        {isTranslated && (
                                                            <button onClick={() => toggleTranslation(msg.id)} className="text-xs text-cyan-300 hover:underline mt-1 font-semibold">
                                                                {translationInfo.isOriginal ? 'Show Translation' : 'Show Original'}
                                                            </button>
                                                        )}

                                                        <div className="flex items-center justify-end space-x-2 mt-1">
                                                            {msg.isEdited && !msg.isDeleted && <span className="text-xs text-gray-400">Edited</span>}
                                                            <p className={`text-xs ${isMine ? 'text-cyan-100' : 'text-gray-400'}`}>
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                             {isMine && !msg.isDeleted && msg.isSent && msg.readBy && msg.readBy.length > 1 && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-200" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                    <div className={`flex flex-wrap gap-1 mt-1 pt-1 border-t border-black/20 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                        {Object.entries(msg.reactions)
                                                            .filter(([, userIds]) => (userIds as string[]).length > 0)
                                                            .map(([emoji, userIds]) => (
                                                            <div key={emoji} title={(userIds as string[]).map(id => groupService.findUserById(id)?.name || '...').join(', ')} className="bg-gray-900/40 rounded-full px-2 py-0.5 flex items-center text-xs cursor-default">
                                                                <span>{emoji}</span>
                                                                <span className="ml-1 text-gray-300 font-semibold">{(userIds as string[]).length}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {!msg.isDeleted && (
                                                 <div className="flex items-center mt-1 space-x-2 h-8">
                                                    <div className="flex items-center space-x-1 bg-gray-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {availableReactions.map(emoji => (
                                                             <button 
                                                                key={emoji} 
                                                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                className={`p-1 rounded-full text-base transition-transform transform hover:scale-125 ${
                                                                    msg.reactions?.[emoji]?.includes(currentUserId) ? 'bg-cyan-500/30' : ''
                                                                }`}
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {scheduledTime && (
                                                <p className="text-xs text-yellow-400 mt-1 italic">
                                                    Scheduled for {scheduledTime.toLocaleDateString()} at {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
                <footer className="p-4 border-t border-gray-700">
                    {typingUsers.length > 0 && (
                        <p className="text-xs text-gray-400 mb-2 italic">
                            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
                        </p>
                    )}
                    {replyToMessage && (
                        <div className="p-2 bg-gray-700 rounded-t-lg flex justify-between items-center gap-2">
                            <div className="border-l-2 border-cyan-400 pl-2 min-w-0">
                                <p className="text-xs font-semibold text-cyan-200 truncate">Replying to {replyToMessage.senderName}</p>
                                <p className="text-xs text-gray-300 italic truncate">
                                    {replyToMessage.content.split(/\s+/).slice(0, 3).join(' ') + (replyToMessage.content.split(/\s+/).length > 3 ? '...' : '')}
                                </p>
                            </div>
                            <button onClick={() => setReplyToMessage(null)} className="flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                         <button onClick={handleOpenScheduleModal} title="Schedule message" className="p-3 text-gray-300 hover:text-white bg-gray-700 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                if (selectedConversation) {
                                    chatService.setTypingStatus(selectedConversation.id, currentUserId);
                                }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage() }}
                            placeholder="Type a message..."
                            className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                            onClick={handleSendMessage}
                            className="p-3 bg-cyan-600 rounded-full text-white hover:bg-cyan-700 disabled:bg-gray-600"
                            disabled={!newMessage.trim()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} transform="rotate(90)">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </button>
                    </div>
                </footer>
                
                {isScheduling && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
                        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
                            <h3 className="text-lg font-bold text-white">Schedule Message</h3>
                            <p className="bg-gray-700 p-3 rounded-md text-gray-300 border border-gray-600">{newMessage}</p>
                            <div>
                                <label htmlFor="schedule-input" className="block text-sm font-medium text-gray-400 mb-1">Select date and time to send</label>
                                <input
                                    id="schedule-input"
                                    type="datetime-local"
                                    value={scheduleDateTime}
                                    onChange={e => setScheduleDateTime(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-600 rounded-md text-white border border-gray-500"
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-2">
                                <button onClick={() => setIsScheduling(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors">Cancel</button>
                                <button onClick={handleScheduleSubmit} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">Schedule</button>
                            </div>
                        </div>
                    </div>
                )}

                 {messageToDelete && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
                        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
                            <h3 className="text-lg font-bold text-white mb-4">Delete Message?</h3>
                            <div className="bg-gray-700 p-3 rounded-md mb-6 text-left text-gray-300 italic truncate">
                                "{messageToDelete.content}"
                            </div>
                            <div className="flex flex-col space-y-3">
                                {messageToDelete.senderId === currentUserId && (
                                    <button onClick={() => handleConfirmDelete(true)} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold">
                                        Delete for Everyone
                                    </button>
                                )}
                                <button onClick={() => handleConfirmDelete(false)} className="w-full py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">
                                    Delete for Me
                                </button>
                                <button onClick={() => setMessageToDelete(null)} className="w-full py-2 text-gray-300 hover:bg-gray-700 rounded-md text-sm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full overflow-hidden text-white">
            {/* Conversation List Pane */}
            <div className={`
                ${selectedConversation ? 'hidden lg:flex' : 'flex w-full'}
                lg:w-1/3 xl:w-1/4 h-full flex-col
            `}>
                {renderConversationList()}
            </div>
            {/* Message View Pane */}
            <div className={`
                ${selectedConversation ? 'flex w-full lg:w-auto' : 'hidden lg:flex'}
                flex-1 h-full
            `}>
                {renderMessageView()}
            </div>
        </div>
    );
};

export default MessagesPage;
