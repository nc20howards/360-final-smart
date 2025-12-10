

import { Group, GroupPost, Story, BroadcastChannel, BroadcastMessage, ChatMessage, PostComment, Event, Place, ChatAttachment, NegotiationMessage, User, AdminUser } from '../types';
import { getAllSchoolUsers } from './studentService';
import { getAllAdminUsers } from './userService';
import * as pushNotificationService from '../services/pushNotificationService';
import { createBroadcastNotification } from './notificationService';
import { logAction } from './auditLogService';


const GROUPS_KEY = '360_smart_school_groups';
const POSTS_KEY = '360_smart_school_group_posts';
const STORIES_KEY = '360_smart_school_stories';
const BROADCAST_CHANNELS_KEY = '360_smart_school_broadcast_channels';
const BROADCAST_MESSAGES_KEY = '360_smart_school_broadcast_messages';
const POST_COMMENTS_KEY = '360_smart_school_post_comments';
const EVENTS_KEY = '360_smart_school_events';
const CACHED_PLACES_KEY = '360_smart_school_cached_places';
const FOLLOW_DATA_KEY = '360_smart_school_follow_data';


// --- Helper Functions ---
const getGroups = (): Group[] => {
    const data = localStorage.getItem(GROUPS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveGroups = (groups: Group[]) => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
};

export const getPosts = (): GroupPost[] => {
    const data = localStorage.getItem(POSTS_KEY);
    return data ? JSON.parse(data) : [];
};

const savePosts = (posts: GroupPost[]) => {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
};

const getStoriesFromStorage = (): Story[] => {
    const data = localStorage.getItem(STORIES_KEY);
    return data ? JSON.parse(data) : [];
};

const saveStories = (stories: Story[]) => {
    localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
};

export const getComments = (): PostComment[] => {
    const data = localStorage.getItem(POST_COMMENTS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveComments = (comments: PostComment[]) => {
    localStorage.setItem(POST_COMMENTS_KEY, JSON.stringify(comments));
};


// --- User Management ---
export const getAllPossibleMembers = () => {
    const schoolUsers = getAllSchoolUsers();
    const admins = getAllAdminUsers();
    const mappedSchoolUsers = schoolUsers.map(u => ({ id: u.studentId, name: u.name, avatar: u.avatarUrl }));
    const mappedAdmins = admins.map(u => ({ id: u.id, name: u.name, avatar: u.avatarUrl }));
    return [...mappedSchoolUsers, ...mappedAdmins];
};

export const findUserById = (userId: string): { id: string; name: string; avatar: string | undefined; } | null => {
    return getAllPossibleMembers().find(u => u.id === userId) || null;
};

// --- Group Management ---
export const getAllGroups = (): Group[] => {
    return getGroups();
};

export const getGroupById = (groupId: string): Group | null => {
    return getGroups().find(g => g.id === groupId) || null;
};

export const createGroup = (data: Omit<Group, 'id' | 'adminId' | 'memberIds' | 'settings'>, adminId: string, memberIds: string[]): Group => {
    const groups = getGroups();
    const newGroup: Group = {
        id: `group_${Date.now()}`,
        name: data.name,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
        description: data.description,
        adminId,
        memberIds: [...new Set([adminId, ...memberIds])], // Creator is always a member
        settings: {
            onlyAdminsCanMessage: false,
        },
    };
    groups.push(newGroup);
    saveGroups(groups);
    return newGroup;
};

export const updateGroupInfo = (groupId: string, userId: string, newInfo: { name: string; description: string; logoUrl: string; bannerUrl?: string; }) => {
    const groups = getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    if (group.adminId !== userId) throw new Error("Only admins can edit group info.");
    
    group.name = newInfo.name;
    group.description = newInfo.description;
    group.logoUrl = newInfo.logoUrl;
    group.bannerUrl = newInfo.bannerUrl;
    
    saveGroups(groups);
    return group;
};

export const updateGroupSettings = (groupId: string, userId: string, newSettings: { onlyAdminsCanMessage: boolean }) => {
    const groups = getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    if (group.adminId !== userId) throw new Error("Only admins can change settings.");

    group.settings = { ...group.settings, ...newSettings };
    saveGroups(groups);
    return group;
};

export const addMemberToGroup = (groupId: string, userId: string): Group => {
    const groups = getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    if (group.memberIds.includes(userId)) return group; // Already a member

    group.memberIds.push(userId);
    saveGroups(groups);
    return group;
};

export const removeMemberFromGroup = (groupId: string, adminId: string, memberIdToRemove: string) => {
    const groups = getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    if (group.adminId !== adminId) throw new Error("Only admins can remove members.");
    if (group.adminId === memberIdToRemove) throw new Error("Admin cannot remove themselves.");

    group.memberIds = group.memberIds.filter(id => id !== memberIdToRemove);
    saveGroups(groups);
    return group;
};


// --- Post Management (Now acting as Message Management) ---
export const getPostsForGroup = (groupId: string): GroupPost[] => {
    return getPosts()
        .filter(p => p.groupId === groupId)
        .sort((a, b) => a.timestamp - b.timestamp); // Sort as a chat (oldest first)
};

export const createPost = (groupId: string, authorId: string, content: string, replyTo?: GroupPost['replyTo']): GroupPost => {
    const posts = getPosts();
    const author = findUserById(authorId);
    if (!author) throw new Error("Author not found.");

    const newPost: GroupPost = {
        id: `post_${Date.now()}`,
        groupId,
        authorId,
        authorName: author.name,
        authorAvatar: author.avatar,
        content,
        timestamp: Date.now(),
        reactions: {},
        replyTo: replyTo,
        views: 0,
    };
    posts.push(newPost);
    savePosts(posts);
    
    logAction(authorId, author.name, 'SOCIAL_POST_CREATE', { groupId });

    // --- Trigger In-App Notifications for group members ---
    const group = getGroupById(groupId);
    if (group) {
        const recipients = group.memberIds.filter(id => id !== authorId);
        if (recipients.length > 0) {
            const notificationMessage = `${author.name}: ${content}`;
            createBroadcastNotification(
                `New message in "${group.name}"`,
                notificationMessage,
                recipients
            );
        }
    }

    return newPost;
};

export const updatePost = (postId: string, authorId: string, newContent: string): GroupPost => {
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
        throw new Error("Post not found.");
    }
    if (posts[postIndex].authorId !== authorId) {
        throw new Error("You can only edit your own posts.");
    }

    posts[postIndex].content = newContent;
    savePosts(posts);
    return posts[postIndex];
};


export const deleteMessage = (postId: string, userId: string): void => {
    const posts = getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error("Message not found.");
    if (post.authorId !== userId) {
        const group = getGroupById(post.groupId);
        if (!group || group.adminId !== userId) {
            throw new Error("You can only delete your own messages.");
        }
    }

    post.isDeleted = true;
    post.content = "This message was deleted";
    post.reactions = {};
    savePosts(posts);
};

export const toggleReaction = (postId: string, userId: string, emoji: string): void => {
    const posts = getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post || post.isDeleted) return;

    if (!post.reactions) {
        post.reactions = {};
    }

    const oppositeEmoji = emoji === '👍' ? '👎' : emoji === '👎' ? '👍' : null;

    // Ensure the emoji key exists
    if (!post.reactions[emoji]) {
        post.reactions[emoji] = [];
    }
    
    const userReactedIndex = post.reactions[emoji].indexOf(userId);

    if (userReactedIndex > -1) {
        // User is removing their reaction
        post.reactions[emoji].splice(userReactedIndex, 1);
        if (post.reactions[emoji].length === 0) {
            delete post.reactions[emoji];
        }
    } else {
        // User is adding a reaction
        post.reactions[emoji].push(userId);
        
        // If it's a like/dislike, remove the opposite reaction from the same user
        if (oppositeEmoji && post.reactions[oppositeEmoji]) {
            const oppositeIndex = post.reactions[oppositeEmoji].indexOf(userId);
            if (oppositeIndex > -1) {
                post.reactions[oppositeEmoji].splice(oppositeIndex, 1);
                if (post.reactions[oppositeEmoji].length === 0) {
                    delete post.reactions[oppositeEmoji];
                }
            }
        }
    }
    
    savePosts(posts);
};

export const incrementPostViewCount = (postId: string): void => {
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex > -1) {
        const post = posts[postIndex];
        post.views = (post.views || 0) + 1;
        posts[postIndex] = post;
        savePosts(posts);
    }
};

// --- New Comment Management Functions ---

export const getCommentsForPost = (postId: string): PostComment[] => {
    return getComments()
        .filter(c => c.postId === postId)
        .sort((a, b) => a.timestamp - b.timestamp);
};

export const addComment = (postId: string, authorId: string, content: string): PostComment => {
    const comments = getComments();
    const author = findUserById(authorId);
    if (!author) throw new Error("Author for comment not found.");

    const newComment: PostComment = {
        id: `comment_${Date.now()}`,
        postId,
        authorId,
        authorName: author.name,
        authorAvatar: author.avatar || `https://picsum.photos/seed/${authorId}/150`,
        content,
        timestamp: Date.now(),
    };
    comments.push(newComment);
    saveComments(comments);
    return newComment;
};


// --- Story Management ---

/**
 * Gets all non-expired stories.
 */
export const getActiveStories = (): Story[] => {
    const now = Date.now();
    const allStories = getStoriesFromStorage();
    const activeStories = allStories.filter(story => story.expiresAt > now);
    
    if (activeStories.length !== allStories.length) {
        saveStories(activeStories);
    }
    return activeStories;
};

/**
 * Gets all active stories, grouped by user ID.
 */
export const getStoriesGroupedByUser = (): Record<string, Story[]> => {
    const activeStories = getActiveStories();
    const grouped: Record<string, Story[]> = {};
    for (const story of activeStories) {
        if (!grouped[story.userId]) {
            grouped[story.userId] = [];
        }
        grouped[story.userId].push(story);
        grouped[story.userId].sort((a, b) => a.timestamp - b.timestamp);
    }
    return grouped;
};

/**
 * Adds a new story to a user's collection of stories.
 */
export const addStory = (storyData: Omit<Story, 'id' | 'timestamp' | 'expiresAt' | 'userName' | 'userAvatar' | 'reactions' | 'viewedBy'>): Story => {
    const allStories = getActiveStories();
    const user = findUserById(storyData.userId);
    if (!user) throw new Error("User not found to create story.");

    const now = Date.now();
    const newStory: Story = {
        ...storyData,
        id: `story_${now}_${Math.random().toString(36).substring(2, 9)}`,
        userName: user.name,
        userAvatar: user.avatar,
        timestamp: now,
        expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours from now
        reactions: {},
        viewedBy: [],
    };

    // Add the new story to the existing list of stories
    allStories.push(newStory);
    saveStories(allStories);
    
    logAction(storyData.userId, user.name, 'STORY_CREATE', {});

    return newStory;
};


/**
 * Toggles a user's reaction on a story, ensuring only one reaction per user.
 * @param storyId The ID of the story to react to.
 * @param userId The ID of the user reacting.
 * @param emoji The emoji used for the reaction.
 */
export const toggleStoryReaction = (storyId: string, userId: string, emoji: string): void => {
    const stories = getStoriesFromStorage();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    if (storyIndex === -1) return;

    const story = stories[storyIndex];
    if (!story.reactions) story.reactions = {};

    const isAlreadyReactedWithThisEmoji = story.reactions[emoji]?.includes(userId);

    // 1. Remove user from all existing reactions on this story
    Object.keys(story.reactions).forEach(existingEmoji => {
        const userIndex = story.reactions[existingEmoji].indexOf(userId);
        if (userIndex > -1) {
            story.reactions[existingEmoji].splice(userIndex, 1);
        }
    });

    // 2. If the user was NOT already reacting with this specific emoji, add their new reaction.
    if (!isAlreadyReactedWithThisEmoji) {
        if (!story.reactions[emoji]) {
            story.reactions[emoji] = [];
        }
        story.reactions[emoji].push(userId);
    }
    
    // 3. Clean up any emoji arrays that became empty
    Object.keys(story.reactions).forEach(key => {
        if (story.reactions[key].length === 0) {
            delete story.reactions[key];
        }
    });

    stories[storyIndex] = story;
    saveStories(stories);
};

export const markStoryAsViewed = (storyId: string, userId: string): void => {
    const stories = getStoriesFromStorage();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    if (storyIndex === -1) return;

    const story = stories[storyIndex];
    if (!story.viewedBy) {
        story.viewedBy = [];
    }

    if (!story.viewedBy.includes(userId)) {
        story.viewedBy.push(userId);
        stories[storyIndex] = story;
        saveStories(stories);
    }
};


// --- Helper Functions for Broadcast ---
const getChannels = (): BroadcastChannel[] => {
    const data = localStorage.getItem(BROADCAST_CHANNELS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveChannels = (channels: BroadcastChannel[]) => {
    localStorage.setItem(BROADCAST_CHANNELS_KEY, JSON.stringify(channels));
};

const getBroadcastMessages = (): BroadcastMessage[] => {
    const data = localStorage.getItem(BROADCAST_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
};

const saveBroadcastMessages = (messages: BroadcastMessage[]) => {
    localStorage.setItem(BROADCAST_MESSAGES_KEY, JSON.stringify(messages));
};

// --- Broadcast Channel Management ---
export const createChannel = (schoolId: string, name: string, description: string, adminIds: string[]): BroadcastChannel => {
    const channels = getChannels();
    const newChannel: BroadcastChannel = {
        id: `channel_${Date.now()}`,
        schoolId,
        name,
        description,
        adminIds,
    };
    channels.push(newChannel);
    saveChannels(channels);
    return newChannel;
};

export const getChannelsForSchool = (schoolId: string): BroadcastChannel[] => {
    return getChannels().filter(c => c.schoolId === schoolId);
};

export const postBroadcastMessage = (channelId: string, authorId: string, content: string): BroadcastMessage => {
    const messages = getBroadcastMessages();
    const author = findUserById(authorId);
    if (!author) throw new Error("Author not found.");

    const newMessage: BroadcastMessage = {
        id: `bcast_${Date.now()}`,
        channelId,
        authorId,
        authorName: author.name,
        authorAvatar: author.avatar,
        content,
        timestamp: Date.now(),
    };
    messages.push(newMessage);
    saveBroadcastMessages(messages);
    return newMessage;
};

export const getMessagesForChannel = (channelId: string): BroadcastMessage[] => {
    return getBroadcastMessages()
        .filter(m => m.channelId === channelId)
        .sort((a, b) => a.timestamp - b.timestamp);
};

// --- NEW FOLLOWER MANAGEMENT SYSTEM ---

// Data structure: Record<userId, { followers: string[], following: string[] }>
type FollowData = Record<string, {
    followers: string[];
    following: string[];
}>;

const getFollowData = (): FollowData => {
    const data = localStorage.getItem(FOLLOW_DATA_KEY);
    return data ? JSON.parse(data) : {};
};

const saveFollowData = (data: FollowData) => {
    localStorage.setItem(FOLLOW_DATA_KEY, JSON.stringify(data));
};

// Ensures a user entry exists in the follow data
const ensureUserEntry = (data: FollowData, userId: string): FollowData => {
    if (!data[userId]) {
        data[userId] = { followers: [], following: [] };
    }
    return data;
};

export const getFollowers = (userId: string): string[] => {
    const data = getFollowData();
    return data[userId]?.followers || [];
};

export const getFollowing = (userId: string): string[] => {
    const data = getFollowData();
    return data[userId]?.following || [];
};

export const getFollowerCount = (userId: string): number => {
    return getFollowers(userId).length;
};

export const getFollowingCount = (userId: string): number => {
    return getFollowing(userId).length;
};

export const isFollowing = (currentUserId: string, targetUserId: string): boolean => {
    return getFollowing(currentUserId).includes(targetUserId);
};

export const toggleFollow = (currentUserId: string, targetUserId: string): boolean => {
    if (currentUserId === targetUserId) return false; // Can't follow self

    let data = getFollowData();
    
    // Ensure entries for both users exist
    data = ensureUserEntry(data, currentUserId);
    data = ensureUserEntry(data, targetUserId);

    const isCurrentlyFollowing = data[currentUserId].following.includes(targetUserId);

    if (isCurrentlyFollowing) {
        // Unfollow
        data[currentUserId].following = data[currentUserId].following.filter(id => id !== targetUserId);
        data[targetUserId].followers = data[targetUserId].followers.filter(id => id !== currentUserId);
    } else {
        // Follow
        data[currentUserId].following.push(targetUserId);
        // FIX: The user who is being followed gets the current user as a follower.
        data[targetUserId].followers.push(currentUserId);
    }

    saveFollowData(data);
    return !isCurrentlyFollowing; // Return the new follow state
};

// --- Event Management ---
const getEvents = (): Event[] => {
    const data = localStorage.getItem(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveEvents = (events: Event[]) => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
};

export const getAllEventsForSchool = (schoolId: string): Event[] => {
    return getEvents().filter(e => e.schoolId === schoolId).sort((a, b) => b.createdAt - a.createdAt);
};

export const createEvent = (data: Omit<Event, 'id' | 'createdAt'>): Event => {
    const events = getEvents();
    const newEvent: Event = {
        ...data,
        id: `event_${Date.now()}`,
        createdAt: Date.now()
    };
    events.push(newEvent);
    saveEvents(events);
    
    const creator = findUserById(data.createdBy);
    logAction(data.createdBy, creator?.name || 'Unknown', 'EVENT_CREATE', { title: data.title });

    return newEvent;
};

export const deleteEvent = (eventId: string): void => {
    let events = getEvents();
    events = events.filter(e => e.id !== eventId);
    saveEvents(events);
};

export const updateEvent = (eventId: string, updatedData: Omit<Event, 'id' | 'createdAt' | 'createdBy' | 'schoolId'>): Event => {
    const events = getEvents();
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
        throw new Error("Event not found for updating.");
    }

    const updatedEvent = {
        ...events[eventIndex],
        ...updatedData,
        // Ensure immutable properties are not changed
        id: events[eventIndex].id,
        createdAt: events[eventIndex].createdAt,
        createdBy: events[eventIndex].createdBy,
        schoolId: events[eventIndex].schoolId,
    };

    events[eventIndex] = updatedEvent;
    saveEvents(events);
    return updatedEvent;
};

// --- NEW Place Cache Management ---
export const getCachedPlaces = (): Place[] => {
    const data = localStorage.getItem(CACHED_PLACES_KEY);
    return data ? JSON.parse(data) : [];
};

export const addPlaceToCache = (place: Place): void => {
    if (!place || !place.uri) return; // Don't cache places without a valid URI
    const cachedPlaces = getCachedPlaces();
    // Avoid duplicates based on URI
    if (!cachedPlaces.some(p => p.uri === place.uri)) {
        // Add to the front and keep the cache size reasonable
        const newCache = [place, ...cachedPlaces].slice(0, 50); 
        localStorage.setItem(CACHED_PLACES_KEY, JSON.stringify(newCache));
    }
};
