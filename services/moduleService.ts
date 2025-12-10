


import { Module } from '../types';
import { getAllSchools, saveSchools } from './schoolService';

const MODULES_KEY = '360_smart_school_modules';
export const HOME_PAGE_MODULE_NAME = 'Home Page';
export const SMART_ADMISSION_MODULE_NAME = 'Smart Admission';
export const MESSAGE_MODULE_NAME = 'Message';
export const E_WALLET_MODULE_NAME = 'E-Wallet';
export const ONLINE_MODULE_NAME = 'Online';
export const SMART_STUDENT_ID_MODULE_NAME = 'Smart Student ID';
export const E_CANTEEN_MODULE_NAME = 'E-Canteen';
export const NCHE_MODULE_NAME = 'NCHE Portal';
export const STUDENT_TRANSFER_MODULE_NAME = 'Student Transfer';
export const NEWS_FEED_MODULE_NAME = 'News Feed';
export const E_VOTE_MODULE_NAME = 'E-Vote';
export const MY_INSTITUTE_MODULE_NAME = 'My Institute';
export const VISITOR_CENTER_MODULE_NAME = 'Visitor Center';
export const KIOSK_MODE_MODULE_NAME = 'Kiosk Mode';
// FIX: Export EXPLORATION_MODULE_NAME to resolve import errors.
export const EXPLORATION_MODULE_NAME = 'Exploration';


// Helper to get modules from localStorage
const getModules = (): Module[] => {
    const modules = localStorage.getItem(MODULES_KEY);
    return modules ? JSON.parse(modules) : [];
};

// Helper to save modules to localStorage
const saveModules = (modules: Module[]) => {
    localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
};

/**
 * Retrieves all registered modules. This function now includes a sanitization step
 * to remove any duplicate modules (by name, case-insensitive), ensuring data integrity
 * for the rest of the application and fixing historical data corruption.
 * It also ensures all modules have the `isAssignable` property for backward compatibility.
 * @returns An array of all unique modules.
 */
export const getAllModules = (): Module[] => {
    const modules = getModules();
    const uniqueModules = new Map<string, Module>();

    // De-duplicate based on name (case-insensitive), keeping the last-seen module entry.
    // This cleans up any corrupted data from previous versions.
    for (const mod of modules) {
        if (mod && mod.name) {
            // Ensure isAssignable property exists, defaulting to true.
            mod.isAssignable = mod.isAssignable ?? true;
            uniqueModules.set(mod.name.toLowerCase(), mod);
        }
    }

    return Array.from(uniqueModules.values());
};


/**
 * Creates a new module.
 * @param moduleData The module data to create.
 * @returns The newly created module.
 * @throws An error if a module with the same name already exists (case-insensitive).
 */
export const createModule = (moduleData: Omit<Module, 'id'>): Module => {
    const modules = getModules();
    // Enforce case-insensitive uniqueness check to prevent data corruption.
    const existingModule = modules.find(m => m.name.toLowerCase() === moduleData.name.toLowerCase());
    if (existingModule) {
        throw new Error('A module with this name already exists.');
    }
    const newModule: Module = {
        ...moduleData,
        id: `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More robust unique ID
        isAssignable: moduleData.isAssignable ?? true, // Respect passed value, default to true
    };
    modules.push(newModule);
    saveModules(modules);
    return newModule;
};

/**
 * Updates an existing module's details.
 * @param moduleId The ID of the module to update.
 * @param updatedData The new data for the module.
 * @returns The updated module.
 * @throws An error if the module is not found or if the new name is taken (case-insensitive).
 */
export const updateModule = (moduleId: string, updatedData: Omit<Module, 'id'>): Module => {
    const modules = getModules();
    let updatedModule: Module | undefined;

    // Enforce case-insensitive uniqueness check during updates.
    const existingModuleWithName = modules.find(m => m.name.toLowerCase() === updatedData.name.toLowerCase() && m.id !== moduleId);
    if (existingModuleWithName) {
        throw new Error('A module with this name already exists.');
    }

    const newModules = modules.map(mod => {
        if (mod.id === moduleId) {
            updatedModule = { ...mod, ...updatedData };
            return updatedModule;
        }
        return mod;
    });

    if (!updatedModule) {
        throw new Error('Module not found.');
    }

    saveModules(newModules);
    return updatedModule;
};

/**
 * Toggles the assignable status of a module.
 * @param moduleId The ID of the module to toggle.
 * @returns The updated module.
 */
export const toggleModuleAssignability = (moduleId: string): Module => {
    const modules = getModules();
    const moduleIndex = modules.findIndex(m => m.id === moduleId);

    if (moduleIndex === -1) {
        throw new Error('Module not found.');
    }

    const module = modules[moduleIndex];
    // Default to true if undefined, then flip the boolean
    module.isAssignable = !(module.isAssignable ?? true);
    
    modules[moduleIndex] = module;
    saveModules(modules);
    return module;
};

/**
 * Atomically updates a module's details and its assignments across all schools.
 * This function reads all schools, modifies them in memory, and saves them once to ensure data consistency.
 * The logic is hardened to prevent duplicate assignments.
 * @param moduleId The ID of the module to update.
 * @param moduleData The new name and description for the module.
 * @param assignedSchoolIds An array of school IDs that should have this module assigned.
 */
export const updateModuleAndAssignments = (
    moduleId: string,
    moduleData: Omit<Module, 'id'>,
    assignedSchoolIds: string[]
): void => {
    // 1. Update the module's own details (name, description)
    updateModule(moduleId, moduleData);

    // 2. Update school assignments in a single, atomic, and immutable operation
    const allSchools = getAllSchools();
    const newSchools = allSchools.map(school => {
        let schoolModules = school.modules || [];
        const hasModule = schoolModules.some(m => m.moduleId === moduleId);
        const shouldHaveModule = assignedSchoolIds.includes(school.id);

        if (!hasModule && shouldHaveModule) {
            // Add the module assignment
            schoolModules = [...schoolModules, { moduleId, status: 'assigned' }];
        } else if (hasModule && !shouldHaveModule) {
            // Remove the module assignment
            schoolModules = schoolModules.filter(m => m.moduleId !== moduleId);
        }
        
        return { ...school, modules: schoolModules };
    });

    saveSchools(newSchools);
};


/**
 * Deletes a module by its ID and removes its assignment from all schools.
 * @param moduleId The ID of the module to delete.
 */
export const deleteModule = (moduleId: string): void => {
    // First, remove the module from the modules list
    let modules = getModules();
    modules = modules.filter(module => module.id !== moduleId);
    saveModules(modules);

    // Then, find any schools that have this module and unassign it
    let schools = getAllSchools();
    schools.forEach(school => {
        if (school.modules) {
            // Use filter to ensure all instances of the assignment are removed.
            school.modules = school.modules.filter(m => m.moduleId !== moduleId);
        }
    });
    saveSchools(schools);
};
