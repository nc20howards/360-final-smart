import React, { useState, useEffect, useRef } from 'react';
import { User, Group, GroupPost } from '../types';
import * as groupService from '../services/groupService';
import { translateText } from '../services/apiService';
import ConfirmationModal from './ConfirmationModal';

// Reusable Icon components
const ReplyIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>;
const DeleteIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PlusIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const TranslateIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13-4-4m0 0l4-4m-4 4h12" /></svg>;


// --- Group Info Panel Component ---
interface GroupInfoPanelProps {
    group: Group;
    isAdmin: boolean;
    onClose: () => void;
    onGroupUpdate: () => void;
    currentUserId: string;
}

const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ group, isAdmin, onClose, onGroupUpdate, currentUserId }) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [editInfo, setEditInfo] = useState({ name: group.name, description: group.description, logoUrl: group.logoUrl, bannerUrl: group.bannerUrl || '' });
    const [settings, setSettings] = useState(group.settings);
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);

    // When the group prop changes (e.g., parent refreshed), update the local state
    useEffect(() => {
        setEditInfo({ name: group.name, description: group.description, logoUrl: group.logoUrl, bannerUrl: group.bannerUrl || '' });
        setSettings(group.settings);
    }, [group]);

    const handleSaveInfo = () => {
        try {
            groupService.updateGroupInfo(group.id, currentUserId, editInfo);
            onGroupUpdate();
            alert("Group info updated!");
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleSaveSettings = () => {
         try {
            groupService.updateGroupSettings(group.id, currentUserId, settings);
            onGroupUpdate();
            alert("Settings updated!");
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleAddMember = (memberId: string) => {
        groupService.addMemberToGroup(group.id, memberId);
        onGroupUpdate();
    };

    const handleRemoveMember = (memberId: string) => {
        setConfirmModal({
            title: "Remove Member",
            message: "Are you sure you want to remove this member?",
            onConfirm: () => {
                try {
                    groupService.removeMemberFromGroup(group.id, currentUserId, memberId);
                    onGroupUpdate();
                } catch(error) {
                    alert((error as Error).message);
                }
                setConfirmModal(null);
            }
        });
    };

    return (
        <div className="absolute top-0 right-0 h-full w-full sm:w-2/3 md:w-1/2 lg:w-1/3 bg-gray-800 z-30 shadow-2xl p-4 flex flex-col animate-slide-in-right">
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmButtonVariant="danger"
                    confirmText="Remove"
                />
            )}
            <header className="flex justify-between items-center pb-4 border-b border-gray-700">
                <h3 className="text-xl font-bold">Group Info</h3>
                <button onClick={onClose}><CloseIcon/></button>
            </header>
            <div className="flex-grow overflow-y-auto space-y-6 pt-4">
                {isAdmin ? (
                     <div className="space-y-2">
                        <label className="text-xs text-gray-400">Banner URL</label>
                        <input value={editInfo.bannerUrl} onChange={(e) => setEditInfo({...editInfo, bannerUrl: e.target.value})} className="w-full bg-gray-700 p-1 rounded text-sm"/>
                    </div>
                ) : (
                    editInfo.bannerUrl && <img src={editInfo.bannerUrl} alt={`${editInfo.name} banner`} className="w-full h-32 object-cover rounded-lg mb-4" />
                )}
                <div className="text-center space-y-2">
                    <img src={editInfo.logoUrl} className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-gray-700 -mt-20"/>
                    {isAdmin ? (
                        <input value={editInfo.logoUrl} onChange={(e) => setEditInfo({...editInfo, logoUrl: e.target.value})} className="w-full text-center bg-gray-700 p-1 rounded text-sm" placeholder="Image URL"/>
                    ) : null}
                    {isAdmin ? (
                         <input value={editInfo.name} onChange={(e) => setEditInfo({...editInfo, name: e.target.value})} className="text-2xl font-bold bg-transparent text-center w-full focus:bg-gray-700 p-1 rounded"/>
                    ) : (
                        <h2 className="text-2xl font-bold">{group.name}</h2>
                    )}
                    {isAdmin ? (
                        <textarea value={editInfo.description} onChange={(e) => setEditInfo({...editInfo, description: e.target.value})} className="w-full bg-gray-700 p-1 rounded text-sm text-center text-gray-300 resize-none" rows={2}/>
                    ) : (
                        <p className="text-gray-300">{group.description}</p>
                    )}
                    {isAdmin && <button onClick={handleSaveInfo} className="px-4 py-1.5 bg-cyan-600 rounded-md text-sm">Save Info</button>}
                </div>

                {isAdmin && (
                    <div className="bg-gray-700 p-3 rounded-lg space-y-3">
                         <h4 className="font-bold">Group Settings</h4>
                         <label className="flex items-center justify-between cursor-pointer">
                            <span>Only admins can send messages</span>
                            <input type="checkbox" checked={settings.onlyAdminsCanMessage} onChange={(e) => setSettings({ ...settings, onlyAdminsCanMessage: e.target.checked })} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"/>
                         </label>
                         <button onClick={handleSaveSettings} className="w-full px-4 py-1.5 bg-cyan-600 rounded-md text-sm">Save Settings</button>
                    </div>
                )}

                <div className="bg-gray-700 p-3 rounded-lg">
                    <h4 className="font-bold mb-3">{group.memberIds.length} Members</h4>
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                        {group.memberIds.map(id => {
                            const member = groupService.findUserById(id);
                            return (
                                <li key={id} className="flex justify-between items-center">
                                    <div className="flex items-center space-x-2">
                                        <img src={member?.avatar} className="w-8 h-8 rounded-full" />
                                        <span>{member?.name} {group.adminId === id && <span className="text-xs text-cyan-400">(Admin)</span>}</span>
                                    </div>
                                    {isAdmin && group.adminId !== id && (
                                        <button onClick={() => handleRemoveMember(id)} className="text-red-500 text-xs">Remove</button>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                     {isAdmin && (
                        <div className="mt-3">
                            <button onClick={() => setIsAddingMember(!isAddingMember)} className="w-full text-cyan-400 text-sm p-1 hover:bg-gray-600 rounded">{isAddingMember ? 'Cancel' : 'Add Member'}</button>
                            {isAddingMember && (
                                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                    {groupService.getAllPossibleMembers().filter(m => !group.memberIds.includes(m.id)).map(m => (
                                        <li key={m.id} className="flex justify-between items-center p-1 hover:bg-gray-600 rounded">
                                            <span className="text-sm">{m.name}</span>
                                            <button onClick={() => handleAddMember(m.id)} className="text-xs bg-cyan-600 px-2 py-0.5 rounded">Add</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Member Selector Component ---
interface MemberSelectorProps {
    allMembers: { id: string; name: string; avatar: string; }[];
    selectedMemberIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    currentUserId: string;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({ allMembers, selectedMemberIds, onSelectionChange, currentUserId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const availableMembers = allMembers.filter(m => 
        m.id !== currentUserId && 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleMember = (memberId: string) => {
        if (selectedMemberIds.includes(memberId)) {
            onSelectionChange(selectedMemberIds.filter(id => id !== memberId));
        } else {
            onSelectionChange([...selectedMemberIds, memberId]);
        }
    };
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 bg-gray-600 rounded-md text-left"
            >
                {selectedMemberIds.length > 0 ? `${selectedMemberIds.length} member(s) selected` : 'Invite members (optional)'}
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-lg z-10">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search for users..."
                        className="w-full px-3 py-2 bg-gray-900 border-b border-gray-600 focus:outline-none"
                    />
                    <ul className="max-h-48 overflow-y-auto">
                        {availableMembers.map(member => (
                            <li 
                                key={member.id} 
                                onClick={() => handleToggleMember(member.id)}
                                className="flex items-center space-x-3 p-2 hover:bg-gray-700 cursor-pointer"
                            >
                                <input 
                                    type="checkbox"
                                    checked={selectedMemberIds.includes(member.id)}
                                    readOnly
                                    className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-cyan-600 focus:ring-cyan-500"
                                />
                                <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                                <span>{member.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


// --- Main GroupsPage Component ---
interface GroupsPageProps {
    user: User;
}

const GroupsPage: React.FC<GroupsPageProps> = ({ user }) => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [posts, setPosts] = useState<GroupPost[]>([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupLogo, setNewGroupLogo] = useState('');
    const [newGroupBanner, setNewGroupBanner] = useState('');
    const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [replyToMessage, setReplyToMessage] = useState<GroupPost | null>(null);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    
    // New states for translation
    const [translations, setTranslations] = useState<Record<string, { text: string; isOriginal: boolean }>>({});
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);

    const currentUserId = 'studentId' in user ? user.studentId : (user as any).id;

    const refreshGroups = () => {
        const allGroups = groupService.getAllGroups();
        setGroups(allGroups);
        // If the selected group was updated, refresh its state too
        if (selectedGroup) {
            const updatedSelectedGroup = allGroups.find(g => g.id === selectedGroup.id);
            setSelectedGroup(updatedSelectedGroup || null);
        }
    };

    const refreshPosts = () => {
        if (selectedGroup) {
            setPosts(groupService.getPostsForGroup(selectedGroup.id));
        }
    };
    
    useEffect(() => {
        refreshGroups();
    }, []);

    useEffect(() => {
        if (!selectedGroup) return;

        setTranslations({}); // Clear translations when switching groups
        refreshPosts();
        const interval = setInterval(refreshPosts, 3000); // Poll for new messages
        return () => clearInterval(interval);
    }, [selectedGroup]);

    const handleCreateGroup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        const logo = newGroupLogo.trim() || `https://picsum.photos/seed/${newGroupName}/200`;
        const banner = newGroupBanner.trim() || `https://picsum.photos/seed/${newGroupName}-banner/800/200`;

        groupService.createGroup(
            {
                name: newGroupName,
                description: newGroupDescription || `Welcome to the ${newGroupName} group!`,
                logoUrl: logo,
                bannerUrl: banner,
            },
            currentUserId,
            newGroupMembers
        );
        refreshGroups();
        // Reset all form states
        setNewGroupName('');
        setNewGroupLogo('');
        setNewGroupDescription('');
        setNewGroupBanner('');
        setNewGroupMembers([]);
        setIsCreatingGroup(false);
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostContent.trim() || !selectedGroup) return;

        const canSendMessage = !selectedGroup.settings.onlyAdminsCanMessage || selectedGroup.adminId === currentUserId;
        if (!canSendMessage) {
            alert("Only admins can send messages in this group.");
            return;
        }
        
        const replyToData = replyToMessage ? {
            messageId: replyToMessage.id,
            authorName: replyToMessage.authorName,
            content: replyToMessage.content.length > 40 ? `${replyToMessage.content.substring(0, 40)}...` : replyToMessage.content
        } : undefined;

        // FIX: The function call had an extra 'undefined' argument. This has been removed.
        groupService.createPost(selectedGroup.id, currentUserId, newPostContent, replyToData);
        refreshPosts();
        setNewPostContent('');
        setReplyToMessage(null);
    };

    const handleDeleteMessage = (postId: string) => {
        setConfirmModal({
            title: "Delete Message",
            message: "Are you sure you want to delete this message? This action cannot be undone.",
            onConfirm: () => {
                try {
                    groupService.deleteMessage(postId, currentUserId);
                    refreshPosts();
                } catch (error) {
                    alert((error as Error).message);
                }
                setConfirmModal(null);
            }
        });
    };

    const handleToggleReaction = (postId: string, emoji: string) => {
        groupService.toggleReaction(postId, currentUserId, emoji);
        refreshPosts();
    };

    const handleTranslate = async (message: GroupPost) => {
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

    const renderGroupList = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">All Groups</h2>
                <button
                    onClick={() => setIsCreatingGroup(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
                >
                    <PlusIcon />
                    <span>Create Group</span>
                </button>
            </div>
            {isCreatingGroup && (
                <form onSubmit={handleCreateGroup} className="bg-gray-700 p-4 rounded-lg mb-6 space-y-3">
                     <input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group Name"
                        required
                        className="w-full px-3 py-2 bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <textarea
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                        placeholder="Group Description"
                        required
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                     <input
                        value={newGroupLogo}
                        onChange={(e) => setNewGroupLogo(e.target.value)}
                        placeholder="Logo Image URL (optional)"
                        className="w-full px-3 py-2 bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                        value={newGroupBanner}
                        onChange={(e) => setNewGroupBanner(e.target.value)}
                        placeholder="Banner Image URL (optional)"
                        className="w-full px-3 py-2 bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <MemberSelector
                        allMembers={groupService.getAllPossibleMembers()}
                        selectedMemberIds={newGroupMembers}
                        onSelectionChange={setNewGroupMembers}
                        currentUserId={currentUserId}
                    />
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={() => setIsCreatingGroup(false)} className="px-4 py-1.5 bg-gray-500 hover:bg-gray-400 rounded-md text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm">Create</button>
                    </div>
                </form>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <div key={group.id} onClick={() => setSelectedGroup(group)} className="bg-gray-700 rounded-lg shadow-lg p-4 flex flex-col items-center text-center cursor-pointer hover:bg-gray-600 transition-colors">
                        <img src={group.logoUrl} alt={group.name} className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-gray-600"/>
                        <h3 className="font-bold text-lg text-white">{group.name}</h3>
                        <p className="text-sm text-gray-400">{group.memberIds.length} members</p>
                    </div>
                ))}
            </div>
        </div>
    );
    
    const renderSingleGroup = (group: Group) => {
        const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
        const canSendMessage = !group.settings.onlyAdminsCanMessage || group.adminId === currentUserId;

        return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg">
            <header className="p-3 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsGroupInfoOpen(true)}>
                    <img src={group.logoUrl} alt={group.name} className="w-10 h-10 rounded-full object-cover"/>
                    <div>
                        <h2 className="font-bold text-lg">{group.name}</h2>
                        <p className="text-xs text-gray-400">{group.memberIds.length} members</p>
                    </div>
                </div>
                <button onClick={() => setSelectedGroup(null)} className="text-cyan-400 hover:underline text-sm">
                    &larr; All Groups
                </button>
            </header>

            <main className="flex-grow p-4 overflow-y-auto space-y-4">
                {posts.map(post => {
                    const isMine = post.authorId === currentUserId;
                    const canDelete = isMine || selectedGroup?.adminId === currentUserId;
                    const translationInfo = translations[post.id];
                    const contentToShow = translationInfo && !translationInfo.isOriginal ? translationInfo.text : post.content;
                    const isTranslated = !!translationInfo;
                    return (
                        <div key={post.id} id={`post-${post.id}`} className={`group flex items-end gap-2 ${isMine ? 'justify-end' : ''}`}>
                            {!isMine && <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full self-start flex-shrink-0" />}
                            <div className={`relative max-w-md p-2.5 rounded-lg ${isMine ? 'bg-cyan-700' : 'bg-gray-700'}`}>
                                {!isMine && !post.isDeleted && <p className="text-xs font-bold text-cyan-300 mb-1">{post.authorName}</p>}
                                
                                {post.replyTo && (
                                    <a href={`#post-${post.replyTo.messageId}`} 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const el = document.getElementById(`post-${post.replyTo.messageId}`);
                                            if (el) {
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                el.classList.add('animate-pulse-custom'); // This class is defined in index.html
                                                setTimeout(() => el.classList.remove('animate-pulse-custom'), 2000);
                                            }
                                        }}
                                        className="p-2 bg-black/20 rounded-md mb-2 border-l-2 border-cyan-400 block cursor-pointer hover:bg-black/30"
                                    >
                                        <p className="text-xs font-semibold text-cyan-200">{post.replyTo.authorName}</p>
                                        <p className="text-xs text-gray-300 italic truncate">{post.replyTo.content}</p>
                                    </a>
                                )}
                                
                                <p className={`whitespace-pre-wrap ${post.isDeleted ? 'italic text-gray-400' : ''}`}>{contentToShow}</p>
                                
                                {translatingId === post.id && <p className="text-xs italic text-gray-400 mt-1">Translating...</p>}
                                {isTranslated && (
                                    <button onClick={() => toggleTranslation(post.id)} className="text-xs text-cyan-300 hover:underline mt-1 font-semibold">
                                        {translationInfo.isOriginal ? 'Show Translation' : 'Show Original'}
                                    </button>
                                )}
                                
                                <div className="text-right text-xs mt-1 opacity-70">
                                    {new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>

                                {post.reactions && Object.keys(post.reactions).length > 0 && (
                                     <div className={`flex flex-wrap gap-1 mt-1 pt-1 border-t border-black/20 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        {Object.entries(post.reactions).filter(([, userIds])=> (userIds as string[]).length > 0).map(([emoji, userIds]) => (
                                             <div key={emoji} className="bg-gray-900/40 rounded-full px-2 py-0.5 flex items-center text-xs">
                                                 <span>{emoji}</span>
                                                 <span className="ml-1 text-gray-300 font-semibold">{(userIds as string[]).length}</span>
                                             </div>
                                        ))}
                                     </div>
                                )}

                                {/* Hover actions */}
                                {!post.isDeleted && (
                                <div className={`absolute top-0 ${isMine ? 'left-[-80px]' : 'right-[-80px]'} h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                                    <div className="flex bg-gray-900/80 rounded-full p-0.5">
                                        <button onClick={() => setReplyToMessage(post)} title="Reply" className="p-1 hover:bg-gray-600 rounded-full"><ReplyIcon /></button>
                                        <button onClick={() => handleTranslate(post)} title="Translate" className="p-1 hover:bg-gray-600 rounded-full"><TranslateIcon /></button>
                                        {canDelete && <button onClick={() => handleDeleteMessage(post.id)} title="Delete" className="p-1 hover:bg-gray-600 rounded-full"><DeleteIcon /></button>}
                                    </div>
                                </div>
                                )}
                            </div>
                            {isMine && <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full self-start flex-shrink-0" />}
                        </div>
                    )
                })}
            </main>

            <footer className="p-3 border-t border-gray-700 bg-gray-800">
                {replyToMessage && (
                    <div className="p-2 bg-gray-700 rounded-t-lg flex justify-between items-center">
                        <div className="border-l-2 border-cyan-400 pl-2">
                            <p className="text-xs font-semibold text-cyan-200">Replying to {replyToMessage.authorName}</p>
                            <p className="text-xs text-gray-300 italic truncate">{replyToMessage.content}</p>
                        </div>
                        <button onClick={() => setReplyToMessage(null)}><CloseIcon /></button>
                    </div>
                )}
                {canSendMessage ? (
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button type="submit" className="p-3 bg-cyan-600 rounded-full text-white hover:bg-cyan-700 disabled:bg-gray-600"
                            disabled={!newPostContent.trim()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} transform="rotate(90)">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </button>
                    </form>
                ) : (
                    <div className="text-center text-sm text-gray-400 p-2 bg-gray-700 rounded-full">Only admins can send messages in this group.</div>
                )}
            </footer>
        </div>
        )
    };
    
    return (
        <div className="h-full relative text-white">
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmButtonVariant="danger"
                    confirmText="Delete"
                />
            )}
            {selectedGroup ? renderSingleGroup(selectedGroup) : renderGroupList()}
             {selectedGroup && isGroupInfoOpen && (
                <GroupInfoPanel
                    group={selectedGroup}
                    isAdmin={selectedGroup.adminId === currentUserId}
                    onClose={() => setIsGroupInfoOpen(false)}
                    onGroupUpdate={refreshGroups}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
};

export default GroupsPage;
