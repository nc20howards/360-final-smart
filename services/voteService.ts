

// services/voteService.ts

import { ElectionSettings, VotingCategory, Contestant, VoteRecord, DraftVoteRecord } from '../types';
import { getSchoolUsersBySchoolIds } from './studentService';
import { logAction } from './auditLogService';

const ELECTION_SETTINGS_KEY = '360_smart_school_election_settings';
const VOTING_CATEGORIES_KEY = '360_smart_school_voting_categories';
const CONTESTANTS_KEY = '360_smart_school_contestants';
const VOTE_RECORDS_KEY = '360_smart_school_vote_records';
const DRAFT_VOTE_RECORDS_KEY = '360_smart_school_draft_vote_records';

// --- Helpers ---
const getSettings = (): Record<string, ElectionSettings> => JSON.parse(localStorage.getItem(ELECTION_SETTINGS_KEY) || '{}');
const saveSettings = (data: Record<string, ElectionSettings>) => localStorage.setItem(ELECTION_SETTINGS_KEY, JSON.stringify(data));
const getCategories = (): VotingCategory[] => JSON.parse(localStorage.getItem(VOTING_CATEGORIES_KEY) || '[]');
const saveCategories = (data: VotingCategory[]) => localStorage.setItem(VOTING_CATEGORIES_KEY, JSON.stringify(data));
const getContestants = (): Contestant[] => JSON.parse(localStorage.getItem(CONTESTANTS_KEY) || '[]');
const saveContestants = (data: Contestant[]) => localStorage.setItem(CONTESTANTS_KEY, JSON.stringify(data));
const getVoteRecords = (): VoteRecord[] => JSON.parse(localStorage.getItem(VOTE_RECORDS_KEY) || '[]');
const saveVoteRecords = (data: VoteRecord[]) => localStorage.setItem(VOTE_RECORDS_KEY, JSON.stringify(data));
const getDraftVoteRecords = (): DraftVoteRecord[] => JSON.parse(localStorage.getItem(DRAFT_VOTE_RECORDS_KEY) || '[]');
const saveDraftVoteRecords = (data: DraftVoteRecord[]) => localStorage.setItem(DRAFT_VOTE_RECORDS_KEY, JSON.stringify(data));

// --- Settings Management ---
export const getElectionSettings = (schoolId: string): ElectionSettings => {
    const allSettings = getSettings();
    const now = Date.now();
    const defaults: ElectionSettings = {
        schoolId,
        startTime: now,
        endTime: now + 24 * 60 * 60 * 1000,
        isVotingOpen: false,
    };
    return allSettings[schoolId] || defaults;
};

export const saveElectionSettings = (settings: ElectionSettings): void => {
    const allSettings = getSettings();
    allSettings[settings.schoolId] = settings;
    saveSettings(allSettings);
};

// --- Category Management ---
export const getCategoriesForSchool = (schoolId: string): VotingCategory[] => {
    return getCategories().filter(c => c.schoolId === schoolId).sort((a, b) => a.order - b.order);
};

export const addCategory = (schoolId: string, title: string): VotingCategory => {
    const all = getCategories();
    const newCategory: VotingCategory = { id: `vote_cat_${Date.now()}`, schoolId, title, order: all.length };
    all.push(newCategory);
    saveCategories(all);
    return newCategory;
};

export const updateCategory = (categoryId: string, title: string): void => {
    const all = getCategories();
    const index = all.findIndex(c => c.id === categoryId);
    if (index > -1) {
        all[index].title = title;
        saveCategories(all);
    }
};

export const deleteCategory = (categoryId: string): void => {
    let all = getCategories();
    all = all.filter(c => c.id !== categoryId);
    saveCategories(all);
    // Also delete contestants in this category
    let contestants = getContestants();
    contestants = contestants.filter(c => c.categoryId !== categoryId);
    saveContestants(contestants);
};

// --- Contestant Management ---
export const getContestantsForSchool = (schoolId: string): Contestant[] => {
    return getContestants().filter(c => c.schoolId === schoolId);
};

export const addContestant = (data: Omit<Contestant, 'id' | 'votes'>): Contestant => {
    const all = getContestants();
    const newContestant: Contestant = { ...data, id: `const_${Date.now()}`, votes: 0 };
    all.push(newContestant);
    saveContestants(all);
    return newContestant;
};

export const updateContestant = (contestantId: string, data: Partial<Omit<Contestant, 'id' | 'schoolId' | 'votes'>>): void => {
    const all = getContestants();
    const index = all.findIndex(c => c.id === contestantId);
    if (index > -1) {
        all[index] = { ...all[index], ...data };
        saveContestants(all);
    }
};

export const deleteContestant = (contestantId: string): void => {
    let all = getContestants();
    all = all.filter(c => c.id !== contestantId);
    saveContestants(all);
};

// --- Draft Vote Management ---

/**
 * Saves or updates a student's draft vote choices.
 */
export const saveDraftVote = (studentId: string, schoolId: string, choices: Record<string, string>): void => {
    const records = getDraftVoteRecords();
    const existingRecordIndex = records.findIndex(r => r.schoolId === schoolId && r.studentId.toLowerCase() === studentId.toLowerCase());

    if (existingRecordIndex > -1) {
        records[existingRecordIndex].choices = choices;
    } else {
        records.push({ studentId, schoolId, choices });
    }
    saveDraftVoteRecords(records);
};

/**
 * Retrieves a student's saved draft vote.
 */
export const getDraftVote = (studentId: string, schoolId: string): DraftVoteRecord | null => {
    const records = getDraftVoteRecords();
    return records.find(r => r.schoolId === schoolId && r.studentId.toLowerCase() === studentId.toLowerCase()) || null;
};

/**
 * Clears a student's draft vote, typically after casting a final vote.
 */
export const clearDraftVote = (studentId: string, schoolId: string): void => {
    let records = getDraftVoteRecords();
    records = records.filter(r => !(r.schoolId === schoolId && r.studentId.toLowerCase() === studentId.toLowerCase()));
    saveDraftVoteRecords(records);
};

// --- Voting Logic ---
export const hasStudentVoted = (studentId: string, schoolId: string): boolean => {
    const records = getVoteRecords();
    return records.some(r => r.schoolId === schoolId && r.studentId.toLowerCase() === studentId.toLowerCase());
};

/**
 * Retrieves the specific vote record for a student if it exists.
 */
export const getStudentVoteRecord = (studentId: string, schoolId: string): VoteRecord | null => {
    const records = getVoteRecords();
    return records.find(r => r.schoolId === schoolId && r.studentId.toLowerCase() === studentId.toLowerCase()) || null;
};

export const castVote = (studentId: string, schoolId: string, choices: Record<string, string>): void => {
    const settings = getElectionSettings(schoolId);
    const now = Date.now();
    
    if (!settings.isVotingOpen) {
        throw new Error("Voting is currently closed by the administrator.");
    }

    if (now < settings.startTime || now > settings.endTime) {
        throw new Error("Voting is not open at this time.");
    }
    
    const studentsInSchool = getSchoolUsersBySchoolIds([schoolId]);
    const student = studentsInSchool.find(s => s.studentId.toLowerCase() === studentId.toLowerCase());
    
    if (!student) {
        throw new Error("Invalid Student ID for this school.");
    }
    
    if (hasStudentVoted(studentId, schoolId)) {
        throw new Error("This Student ID has already been used to vote.");
    }

    const newRecord: VoteRecord = { studentId, schoolId, timestamp: now, choices };
    const records = getVoteRecords();
    records.push(newRecord);
    saveVoteRecords(records);
    
    // Increment vote counts
    const allContestants = getContestants();
    Object.values(choices).forEach(contestantId => {
        const contestant = allContestants.find(c => c.id === contestantId);
        if (contestant) {
            contestant.votes += 1;
        }
    });
    saveContestants(allContestants);

    // Clear the draft vote after successfully casting the final vote.
    clearDraftVote(studentId, schoolId);

    logAction(studentId, student.name, 'CAST_VOTE', { schoolId });
};
