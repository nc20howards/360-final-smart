import { ChatConversation, ChatMessage, ChatAttachment } from '../types';
import { findUserById } from './groupService'; // Reusing this handy function
import * as pushNotificationService from '../services/pushNotificationService';
import { createBroadcastNotification } from './notificationService';

const CONVERSATIONS_KEY = '360_smart_school_conversations';
const MESSAGES_KEY = '360_smart_school_messages';
const TYPING_STATUS_KEY = '360_smart_school_typing_status';
const TYPING_TIMEOUT_MS = 3000; // 3 seconds


// --- Helper Functions ---
const getConversations = (): ChatConversation[] => {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveConversations = (conversations: ChatConversation[]) => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
};

const getMessages = (): ChatMessage[] => {
    const data = localStorage.getItem(MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
};

const saveMessages = (messages: ChatMessage[]) => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
};

// --- Service Functions ---

/**
 * Gets all conversations for a specific user, sorted by most recent.
 */
export const getConversationsForUser = (userId: string): ChatConversation[] => {
    const allConversations = getConversations();
    // FIX: Explicitly type sort parameters to prevent type inference issues.
    return allConversations
        .filter(c => c.participantIds.includes(userId))
        .sort((a: ChatConversation, b: ChatConversation) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
};

/**
 * Gets all messages for a specific conversation, including scheduled ones for the sender, sorted oldest to newest.
 */
export const getMessagesForConversation = (conversationId: string, currentUserId: string): ChatMessage[] => {
    const allMessages = getMessages();
    return allMessages
        .filter(m =>
            m.conversationId === conversationId &&
            (m.isSent || m.senderId === currentUserId) &&
            !m.deletedFor?.includes(currentUserId) // Filter out messages deleted for the current user
        )
        // FIX: Explicitly type sort parameters to prevent type inference issues.
        .sort((a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp);
};

/**
 * Marks all messages in a conversation as read for a specific user.
 */
export const markConversationAsRead = (conversationId: string, userId: string): void => {
    const conversations = getConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    let conversationUpdated = false;

    if (conversation && conversation.unreadCount[userId] > 0) {
        conversation.unreadCount[userId] = 0;
        conversationUpdated = true;
    }

    if (conversationUpdated) {
        saveConversations(conversations);
    }

    // Now, mark the actual messages as read
    const messages = getMessages();
    let messagesUpdated = false;
    messages.forEach(msg => {
        // If message is in this convo, was not sent by me, and I haven't read it yet
        if (msg.conversationId === conversationId && msg.senderId !== userId && !msg.readBy?.includes(userId)) {
            if (!msg.readBy) {
                msg.readBy = [];
            }
            msg.readBy.push(userId);
            messagesUpdated = true;
        }
    });

    if (messagesUpdated) {
        saveMessages(messages);
    }
};

/**
 * Updates the last message for a conversation, typically after an action like delete or edit.
 */
const updateConversationLastMessage = (conversationId: string) => {
    const conversations = getConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    const messages = getMessages()
        .filter(m => m.conversationId === conversationId && m.isSent)
        .sort((a, b) => b.timestamp - a.timestamp);

    const lastMessage = messages[0];
    if (lastMessage) {
        let lastMsgText = lastMessage.content;
        if (lastMessage.isDeleted) {
            lastMsgText = 'Message deleted';
        } else if (lastMessage.isEdited) {
            lastMsgText = `(Edited) ${lastMessage.content}`;
        }
        conversation.lastMessage = lastMsgText;
        conversation.lastMessageSenderId = lastMessage.senderId;
        conversation.lastMessageTimestamp = lastMessage.timestamp;
    } else {
        conversation.lastMessage = "Conversation started.";
        conversation.lastMessageSenderId = undefined;
        // Keep the original timestamp for sorting purposes
    }
    saveConversations(conversations);
};

/**
 * Sends a new message in a conversation.
 */
export const sendMessage = (
    conversationId: string, 
    senderId: string, 
    content: string, 
    attachments?: ChatAttachment[],
    replyTo?: ChatMessage['replyTo']
): ChatMessage => {
    const allMessages = getMessages();
    const allConversations = getConversations();
    const sender = findUserById(senderId);
    if (!sender) throw new Error("Sender not found.");

    const conversation = allConversations.find(c => c.id === conversationId);
    if (!conversation) throw new Error("Conversation not found.");

    const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        content,
        attachments,
        timestamp: Date.now(),
        isSent: true,
        readBy: [senderId], // The sender has implicitly "read" their own message
        replyTo,
    };
    allMessages.push(newMessage);
    saveMessages(allMessages);

    // Update conversation metadata
    if (content) {
        conversation.lastMessage = content;
    } else if (attachments && attachments.length > 0) {
        const firstAttachment = attachments[0];
        const typeDisplay = firstAttachment.type.charAt(0).toUpperCase() + firstAttachment.type.slice(1);
        conversation.lastMessage = `Sent a${['image'].includes(firstAttachment.type) ? 'n' : ''} ${typeDisplay}`;
    } else {
        conversation.lastMessage = '...';
    }
    conversation.lastMessageSenderId = senderId;
    conversation.lastMessageTimestamp = newMessage.timestamp;
    
    // Increment unread count for other participants
    conversation.participantIds.forEach(participantId => {
        if (participantId !== senderId) {
            conversation.unreadCount[participantId] = (conversation.unreadCount[participantId] || 0) + 1;
        }
    });

    saveConversations(allConversations);

    // --- Trigger In-App Notifications for recipients ---
    const recipients = conversation.participantIds.filter(id => id !== senderId);
    if (recipients.length > 0) {
        createBroadcastNotification(`New message from ${sender.name}`, conversation.lastMessage, recipients);
    }

    return newMessage;
};

/**
 * Starts a new conversation or finds an existing one between two users.
 */
export const startOrGetConversation = (userId1: string, userId2: string): ChatConversation => {
    const allConversations = getConversations();
    
    // Find existing conversation
    const existingConversation = allConversations.find(c => 
        c.participantIds.length === 2 &&
        c.participantIds.includes(userId1) &&
        c.participantIds.includes(userId2)
    );

    if (existingConversation) {
        return existingConversation;
    }

    // Create a new conversation
    const newConversation: ChatConversation = {
        id: `conv_${Date.now()}`,
        participantIds: [userId1, userId2],
        lastMessage: "Conversation started.",
        lastMessageTimestamp: Date.now(),
        unreadCount: { [userId1]: 0, [userId2]: 0 }
    };

    allConversations.push(newConversation);
    saveConversations(allConversations);
    
    return newConversation;
};

// --- New Message Interaction Functions ---

export const toggleReaction = (messageId: string, userId: string, emoji: string): void => {
    const messages = getMessages();
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) {
        message.reactions = {};
    }

    if (!message.reactions[emoji]) {
        message.reactions[emoji] = [];
    }
    
    const userReactedIndex = message.reactions[emoji].indexOf(userId);

    if (userReactedIndex > -1) {
        // User is removing this specific reaction
        message.reactions[emoji].splice(userReactedIndex, 1);
        if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
        }
    } else {
        // User is adding this reaction, remove any other reaction they might have
         Object.keys(message.reactions).forEach(existingEmoji => {
            const userIndex = message.reactions![existingEmoji].indexOf(userId);
            if (userIndex > -1) {
                message.reactions![existingEmoji].splice(userIndex, 1);
                 if (message.reactions![existingEmoji].length === 0) {
                    delete message.reactions![existingEmoji];
                }
            }
        });
        message.reactions[emoji].push(userId);
    }
    
    saveMessages(messages);
};

export const editMessage = (messageId: string, newContent: string): void => {
    const messages = getMessages();
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    message.content = newContent;
    message.isEdited = true;
    saveMessages(messages);
    updateConversationLastMessage(message.conversationId);
};


export const deleteMessage = (messageId: string, userId: string, forEveryone: boolean): void => {
    const messages = getMessages();
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];

    if (forEveryone) {
        // Only the sender can delete for everyone
        if (message.senderId !== userId) {
            throw new Error("You can only delete your own messages for everyone.");
        }
        message.isDeleted = true;
        message.content = "This message was deleted.";
        message.reactions = {}; // Clear reactions
    } else { // Delete for me
        if (!message.deletedFor) {
            message.deletedFor = [];
        }
        if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
        }
    }

    messages[messageIndex] = message;
    saveMessages(messages);
    
    if (forEveryone) {
        updateConversationLastMessage(message.conversationId);
    }
};

export const scheduleMessage = (
    conversationId: string, 
    senderId: string, 
    content: string, 
    attachments: ChatAttachment[],
    sendTime: number
): void => {
    const messages = getMessages();
    const sender = findUserById(senderId);
    if (!sender) throw new Error("Sender not found.");

    const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        content,
        attachments,
        timestamp: Date.now(), // Creation time
        scheduledSendTime: sendTime,
        isSent: false,
    };
    messages.push(newMessage);
    saveMessages(messages);
};

/**
 * Checks for any due scheduled messages and "sends" them.
 * @returns true if any messages were sent, false otherwise.
 */
export const sendDueScheduledMessages = (): boolean => {
    const messages = getMessages();
    const conversations = getConversations();
    const now = Date.now();
    let messageSent = false;

    messages.forEach(msg => {
        if (!msg.isSent && msg.scheduledSendTime && msg.scheduledSendTime <= now) {
            msg.isSent = true;
            msg.timestamp = now; // Update timestamp to reflect send time for sorting
            msg.readBy = [msg.senderId]; // Sender has "read" it
            
            const conversation = conversations.find(c => c.id === msg.conversationId);
            if (conversation) {
                 if (msg.content) {
                    conversation.lastMessage = msg.content;
                } else if (msg.attachments && msg.attachments.length > 0) {
                    const firstAttachment = msg.attachments[0];
                    const typeDisplay = firstAttachment.type.charAt(0).toUpperCase() + firstAttachment.type.slice(1);
                    conversation.lastMessage = `Sent a${['image'].includes(firstAttachment.type) ? 'n' : ''} ${typeDisplay}`;
                }
                conversation.lastMessageSenderId = msg.senderId;
                conversation.lastMessageTimestamp = msg.timestamp;
                conversation.participantIds.forEach(pid => {
                    if (pid !== msg.senderId) {
                        conversation.unreadCount[pid] = (conversation.unreadCount[pid] || 0) + 1;
                    }
                });
            }
            messageSent = true;
        }
    });

    if (messageSent) {
        saveMessages(messages);
        saveConversations(conversations);
    }
    
    return messageSent;
};

/**
 * Updates the typing status for a user in a conversation.
 */
export const setTypingStatus = (conversationId: string, userId: string): void => {
    const statusDataStr = localStorage.getItem(TYPING_STATUS_KEY);
    const statusData = statusDataStr ? JSON.parse(statusDataStr) : {};

    if (!statusData[conversationId]) {
        statusData[conversationId] = {};
    }

    statusData[conversationId][userId] = Date.now();

    localStorage.setItem(TYPING_STATUS_KEY, JSON.stringify(statusData));
};

/**
 * Gets a list of users currently typing in a conversation.
 */
export const getTypingStatus = (conversationId: string, currentUserId: string): string[] => {
    const statusDataStr = localStorage.getItem(TYPING_STATUS_KEY);
    if (!statusDataStr) return [];
    
    const statusData = JSON.parse(statusDataStr);
    const conversationStatus = statusData[conversationId];
    if (!conversationStatus) return [];

    const now = Date.now();
    const typingUserIds: string[] = [];

    for (const userId in conversationStatus) {
        if (userId !== currentUserId && now - conversationStatus[userId] < TYPING_TIMEOUT_MS) {
            typingUserIds.push(userId);
        }
    }

    return typingUserIds;
};