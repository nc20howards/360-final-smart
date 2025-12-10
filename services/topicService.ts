// services/topicService.ts
import { Topic } from '../types';

const TOPICS_KEY = '360_smart_school_topics';

// This function now expects Topic objects.
// A migration in seedService will handle old data.
const getTopicsData = (): Record<string, Topic[]> => {
    const data = localStorage.getItem(TOPICS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveTopicsData = (data: Record<string, Topic[]>) => {
    localStorage.setItem(TOPICS_KEY, JSON.stringify(data));
};

export const getTopicsForSchool = (schoolId: string): Topic[] => {
    const data = getTopicsData();
    return (data[schoolId] || []).sort((a,b) => a.name.localeCompare(b.name));
};

export const saveTopicsForSchool = (schoolId: string, topics: Topic[]): void => {
    const data = getTopicsData();
    data[schoolId] = topics;
    saveTopicsData(data);
};

export const addTopic = (schoolId: string, topicName: string): Topic => {
    const topics = getTopicsForSchool(schoolId);
    if (topics.some(t => t.name.toLowerCase() === topicName.toLowerCase())) {
        throw new Error("This topic already exists.");
    }
    const newTopic: Topic = {
        id: `topic_${Date.now()}`,
        schoolId,
        name: topicName,
    };
    saveTopicsForSchool(schoolId, [...topics, newTopic]);
    return newTopic;
};

export const deleteTopic = (topicId: string, schoolId: string): void => {
    const topics = getTopicsForSchool(schoolId);
    const updatedTopics = topics.filter(t => t.id !== topicId);
    saveTopicsForSchool(schoolId, updatedTopics);
};

export const linkRubricToTopic = (topicId: string, schoolId: string, rubricId: string | null): void => {
    const topics = getTopicsForSchool(schoolId);
    const topicIndex = topics.findIndex(t => t.id === topicId);
    if (topicIndex > -1) {
        if (rubricId) {
            topics[topicIndex].rubricId = rubricId;
        } else {
            delete topics[topicIndex].rubricId;
        }
        saveTopicsForSchool(schoolId, topics);
    } else {
        throw new Error("Topic not found to link rubric.");
    }
};