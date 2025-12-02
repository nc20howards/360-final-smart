// services/explorationService.ts
import { ExplorationItem } from '../types';

const EXPLORATIONS_KEY = '360_smart_school_explorations';

const getItems = (): ExplorationItem[] => {
    const data = localStorage.getItem(EXPLORATIONS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveItems = (items: ExplorationItem[]) => {
    localStorage.setItem(EXPLORATIONS_KEY, JSON.stringify(items));
};

export const getExplorationItems = (): ExplorationItem[] => {
    return getItems();
};

export const addExplorationItem = (itemData: Omit<ExplorationItem, 'id'>): ExplorationItem => {
    const items = getItems();
    const newItem: ExplorationItem = {
        ...itemData,
        id: `exp_${Date.now()}`,
    };
    items.push(newItem);
    saveItems(items);
    return newItem;
};

export const updateExplorationItem = (itemId: string, updatedData: Partial<Omit<ExplorationItem, 'id'>>): ExplorationItem => {
    const items = getItems();
    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
        throw new Error("Exploration item not found.");
    }
    const updatedItem = { ...items[itemIndex], ...updatedData };
    items[itemIndex] = updatedItem;
    saveItems(items);
    return updatedItem;
};

export const deleteExplorationItem = (itemId: string): void => {
    let items = getItems();
    items = items.filter(item => item.id !== itemId);
    saveItems(items);
};
