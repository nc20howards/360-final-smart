import React, { useState, useEffect, useCallback } from 'react';
import { School, AdminUser, ElectionSettings, VotingCategory, Contestant } from '../types';
import * as voteService from '../services/voteService';
import ConfirmationModal from './ConfirmationModal';
import UserAvatar from './UserAvatar';

interface EVoteAdminPageProps {
    school: School;
    user: AdminUser;
}

const toDateTimeLocal = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    // This trick adjusts the date so that toISOString() outputs the local time
    // instead of UTC time.
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    try {
        return date.toISOString().slice(0, 16);
    } catch (e) {
        // Handle potential errors with invalid dates
        return '';
    }
};

const EVoteAdminPage: React.FC<EVoteAdminPageProps> = ({ school, user }) => {
    const [settings, setSettings] = useState<ElectionSettings | null>(null);
    const [categories, setCategories] = useState<VotingCategory[]>([]);
    const [contestants, setContestants] = useState<Contestant[]>([]);
    
    const [modal, setModal] = useState<'category' | 'contestant' | 'deleteCategory' | 'deleteContestant' | null>(null);
    const [itemToDelete, setItemToDelete] = useState<VotingCategory | Contestant | null>(null);
    
    const [editingCategory, setEditingCategory] = useState<VotingCategory | null>(null);
    const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
    
    const [categoryForm, setCategoryForm] = useState({ title: '' });
    const [contestantForm, setContestantForm] = useState<Omit<Contestant, 'id' | 'votes' | 'schoolId'>>({ categoryId: '', name: '', nickname: '', class: '', manifesto: '', avatarUrl: '' });

    const refreshData = useCallback(() => {
        setSettings(voteService.getElectionSettings(school.id));
        setCategories(voteService.getCategoriesForSchool(school.id));
        setContestants(voteService.getContestantsForSchool(school.id));
    }, [school.id]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 2000); // Poll for live results
        return () => clearInterval(interval);
    }, [refreshData]);

    const handleSettingsChange = (field: keyof ElectionSettings, value: any) => {
        if (settings) {
            const newSettings = { ...settings, [field]: value };
            setSettings(newSettings);
            voteService.saveElectionSettings(newSettings);
        }
    };

    const handleCategorySubmit = () => {
        if (!categoryForm.title.trim()) return;
        if (editingCategory) {
            voteService.updateCategory(editingCategory.id, categoryForm.title);
        } else {
            voteService.addCategory(school.id, categoryForm.title);
        }
        refreshData();
        setModal(null);
    };

    const handleContestantSubmit = () => {
        if (!contestantForm.name || !contestantForm.class || !contestantForm.manifesto) return;
        if (editingContestant) {
            voteService.updateContestant(editingContestant.id, contestantForm);
        } else {
            voteService.addContestant({ ...contestantForm, schoolId: school.id });
        }
        refreshData();
        setModal(null);
    };
    
    const confirmDelete = () => {
        if (!itemToDelete) return;
        if (modal === 'deleteCategory') {
            voteService.deleteCategory(itemToDelete.id);
        } else if (modal === 'deleteContestant') {
            voteService.deleteContestant(itemToDelete.id);
        }
        refreshData();
        setModal(null);
        setItemToDelete(null);
    };

    if (!settings) return <div>Loading Election Data...</div>;

    const totalVotes = contestants.reduce((sum, c) => sum + c.votes, 0);

    const renderModals = () => (
        <>
            {(modal === 'category') && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold">{editingCategory ? 'Edit' : 'Add'} Category</h3>
                        <input value={categoryForm.title} onChange={e => setCategoryForm({title: e.target.value})} placeholder="Category Title (e.g., Head Prefect)" className="w-full p-2 bg-gray-700 rounded"/>
                        <div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handleCategorySubmit} className="px-4 py-2 bg-cyan-600 rounded">Save</button></div>
                    </div>
                </div>
            )}
             {(modal === 'contestant') && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold">{editingContestant ? 'Edit' : 'Add'} Contestant</h3>
                        <div className="overflow-y-auto pr-2 space-y-4">
                            <select value={contestantForm.categoryId} onChange={e => setContestantForm({...contestantForm, categoryId: e.target.value})} className="w-full p-2 bg-gray-700 rounded"><option value="">Select Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                            <input value={contestantForm.name} onChange={e => setContestantForm({...contestantForm, name: e.target.value})} placeholder="Full Name" required className="w-full p-2 bg-gray-700 rounded"/>
                            <input value={contestantForm.nickname} onChange={e => setContestantForm({...contestantForm, nickname: e.target.value})} placeholder="Nickname (Optional)" className="w-full p-2 bg-gray-700 rounded"/>
                            <input value={contestantForm.class} onChange={e => setContestantForm({...contestantForm, class: e.target.value})} placeholder="Class (e.g., S.5 Arts)" required className="w-full p-2 bg-gray-700 rounded"/>
                            <input value={contestantForm.avatarUrl} onChange={e => setContestantForm({...contestantForm, avatarUrl: e.target.value})} placeholder="Photo URL (Optional)" className="w-full p-2 bg-gray-700 rounded"/>
                            <textarea value={contestantForm.manifesto} onChange={e => setContestantForm({...contestantForm, manifesto: e.target.value})} placeholder="Manifesto" required rows={4} className="w-full p-2 bg-gray-700 rounded"/>
                        </div>
                        <div className="flex justify-end gap-2 flex-shrink-0"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handleContestantSubmit} className="px-4 py-2 bg-cyan-600 rounded">Save</button></div>
                    </div>
                </div>
            )}
            {(modal === 'deleteCategory' || modal === 'deleteContestant') && (
                <ConfirmationModal isOpen={true} title={`Delete ${modal === 'deleteCategory' ? 'Category' : 'Contestant'}`} message={<p>Are you sure? This action cannot be undone.</p>} onConfirm={confirmDelete} onCancel={() => setModal(null)} confirmButtonVariant="danger"/>
            )}
        </>
    );

    return (
        <div className="space-y-6">
            {renderModals()}
            {/* Settings & Live Results */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-bold mb-4">Election Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="text-sm">Start Time</label>
                            <input
                                type="datetime-local"
                                value={toDateTimeLocal(settings.startTime)}
                                onChange={e => handleSettingsChange('startTime', new Date(e.target.value).getTime())}
                                className="w-full p-2 bg-gray-700 rounded mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm">End Time</label>
                            <input
                                type="datetime-local"
                                value={toDateTimeLocal(settings.endTime)}
                                onChange={e => handleSettingsChange('endTime', new Date(e.target.value).getTime())}
                                className="w-full p-2 bg-gray-700 rounded mt-1"
                            />
                        </div>
                        <div className="md:col-span-2 flex items-center space-x-3 justify-center pt-2"><label className="font-semibold">Voting Status:</label><button onClick={() => handleSettingsChange('isVotingOpen', !settings.isVotingOpen)} className={`px-4 py-2 rounded-md font-bold ${settings.isVotingOpen ? 'bg-red-600' : 'bg-green-600'}`}>{settings.isVotingOpen ? 'Close Voting' : 'Open Voting'}</button></div>
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-bold mb-4">Live Results ({totalVotes} total votes)</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {categories.map(category => {
                            const categoryContestants = contestants.filter(c => c.categoryId === category.id).sort((a,b) => b.votes - a.votes);
                            const categoryTotalVotes = categoryContestants.reduce((sum, c) => sum + c.votes, 0);
                            return (
                                <div key={category.id}>
                                    <h4 className="font-semibold text-cyan-400 mb-2 text-sm">{category.title}</h4>
                                    {categoryContestants.slice(0, 2).map(c => {
                                        const percentage = categoryTotalVotes > 0 ? (c.votes / categoryTotalVotes) * 100 : 0;
                                        return (
                                        <div key={c.id} className="mb-2"><div className="flex justify-between text-xs mb-1"><span>{c.name}</span><span>{c.votes} votes</span></div><div className="w-full bg-gray-700 rounded-full h-1.5"><div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div></div></div>
                                    )})}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Contestant Management */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Manage Contestants</h3><button onClick={() => { setEditingCategory(null); setCategoryForm({title:''}); setModal('category'); }} className="px-4 py-2 bg-cyan-600 text-sm font-semibold rounded-md">+ Add Category</button></div>
                <div className="space-y-6">
                    {categories.map(category => (
                        <div key={category.id}>
                            <div className="flex justify-between items-center mb-2"><h4 className="text-lg font-semibold">{category.title}</h4><div className="space-x-2"><button onClick={() => { setContestantForm({ categoryId: category.id, name: '', nickname: '', class: '', manifesto: '', avatarUrl: '' }); setEditingContestant(null); setModal('contestant'); }} className="px-3 py-1 bg-cyan-600 text-xs rounded-md">Add Contestant</button><button onClick={() => { setEditingCategory(category); setCategoryForm({title: category.title}); setModal('category'); }} className="px-3 py-1 bg-gray-600 text-xs rounded-md">Edit</button><button onClick={() => { setItemToDelete(category); setModal('deleteCategory'); }} className="px-3 py-1 bg-red-600 text-xs rounded-md">Delete</button></div></div>
                            <div className="space-y-2">
                                {contestants.filter(c => c.categoryId === category.id).map(c => (
                                    <div key={c.id} className="bg-gray-700 p-2 rounded-md flex justify-between items-center">
                                        <div className="flex items-center gap-3"><UserAvatar name={c.name} avatarUrl={c.avatarUrl} className="w-10 h-10 rounded-full" /><div><p className="font-semibold">{c.name} {c.nickname && `(${c.nickname})`}</p><p className="text-xs text-gray-400">{c.class}</p></div></div>
                                        <div className="space-x-2"><button onClick={() => { setContestantForm(c); setEditingContestant(c); setModal('contestant'); }} className="px-3 py-1 bg-gray-600 text-xs rounded-md">Edit</button><button onClick={() => { setItemToDelete(c); setModal('deleteContestant'); }} className="px-3 py-1 bg-red-600 text-xs rounded-md">Delete</button></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EVoteAdminPage;
