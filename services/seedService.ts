
import { registerSchool, getAllSchools, saveSchools } from './schoolService';
import { createAdminUser, getAllAdminUsers } from './userService';
import { createModule, getAllModules, HOME_PAGE_MODULE_NAME, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, STUDENT_TRANSFER_MODULE_NAME, NEWS_FEED_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME, VISITOR_CENTER_MODULE_NAME, KIOSK_MODE_MODULE_NAME } from './moduleService';
import { createSchoolUser, assignSellerToShop } from './studentService';
// FIX: Changed UnebResultEntry to UnebPassSlip to match the type exported from `types` and updated the seed data structure accordingly.
import { UnebPassSlip, Module, School, User } from '../types';
import { addResults as addUnebResults } from './unebResultService';
import { createChannel } from './groupService';
import * as canteenService from './canteenService';
import { seedNcheData } from './ncheService';
import * as classService from './classService';
import { getListings, createListing } from './marketplaceService';
import * as topicService from './topicService';
import { seedMyInstituteData } from './myInstituteService';


const SEED_FLAG_KEY = '360_smart_school_seeded';

/**
 * A one-time operation to fix historical data corruption.
 * It finds duplicate modules by name, merges their school assignments, and deletes the duplicates.
 */
const reconcileAndCleanModuleData = () => {
    // Use raw, unsanitized getters to work with potentially corrupted data
    const getRawModules = (): Module[] => JSON.parse(localStorage.getItem('360_smart_school_modules') || '[]');
    const getRawSchools = (): School[] => JSON.parse(localStorage.getItem('360_smart_school_schools') || '[]');

    const modules = getRawModules();
    const schools = getRawSchools();

    const modulesByName = new Map<string, Module[]>();

    // 1. Group modules by name (case-insensitive)
    for (const mod of modules) {
        if (!mod || !mod.name) continue;
        const nameKey = mod.name.toLowerCase();
        if (!modulesByName.has(nameKey)) {
            modulesByName.set(nameKey, []);
        }
        modulesByName.get(nameKey)!.push(mod);
    }
    
    let dataWasChanged = false;

    // 2. Find groups with duplicates and process them
    for (const moduleGroup of modulesByName.values()) {
        if (moduleGroup.length <= 1) continue;

        dataWasChanged = true;
        console.log(`Reconciling duplicate module: "${moduleGroup[0].name}"`);

        // 2a. Choose canonical and duplicate IDs
        const canonicalModule = moduleGroup[0];
        const duplicateModuleIds = moduleGroup.slice(1).map(m => m.id);
        
        // 2b. Re-map assignments in schools
        schools.forEach(school => {
            const relevantAssignments = (school.modules || []).filter(m => 
                m.moduleId === canonicalModule.id || duplicateModuleIds.includes(m.moduleId)
            );

            if (relevantAssignments.length > 0) {
                // Remove all old assignments for this module name
                school.modules = (school.modules || []).filter(m => 
                    m.moduleId !== canonicalModule.id && !duplicateModuleIds.includes(m.moduleId)
                );

                // Determine the highest status from all assignments found to preserve user settings
                const statusOrder = { 'published': 3, 'active': 2, 'assigned': 1 };
                let highestStatus: 'published' | 'active' | 'assigned' = 'assigned';
                let highestRank = 0;
                
                for (const assignment of relevantAssignments) {
                    const rank = statusOrder[assignment.status] || 0;
                    if (rank > highestRank) {
                        highestRank = rank;
                        highestStatus = assignment.status;
                    }
                }
                
                // Add back a single, canonical assignment with the highest status
                school.modules.push({ moduleId: canonicalModule.id, status: highestStatus });
            }
        });
    }
    
    // 3. If changes were made, save the cleaned data
    if (dataWasChanged) {
        console.log("Saving reconciled school and module data...");
        // 3a. Filter the modules list to only keep the canonical ones
        const finalModules = Array.from(modulesByName.values()).map(group => group[0]);
        
        localStorage.setItem('360_smart_school_modules', JSON.stringify(finalModules));
        saveSchools(schools);
    }
};

/**
 * A one-time migration to find and fix modules with duplicate IDs.
 * This is crucial for fixing existing data corruption.
 */
const migrateDuplicateModuleIDs = () => {
    const MIGRATION_FLAG_KEY = '360_smart_school_migrated_module_ids_v1';
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
        return; // Migration already ran
    }

    console.log("Running migration to fix duplicate module IDs...");
    const getRawModules = (): Module[] => JSON.parse(localStorage.getItem('360_smart_school_modules') || '[]');
    const saveRawModules = (modules: Module[]) => localStorage.setItem('360_smart_school_modules', JSON.stringify(modules));
    
    const modules = getRawModules();
    const seenIds = new Set<string>();
    let wasModified = false;

    const updatedModules = modules.map(mod => {
        if (!mod || !mod.id) return mod; // Skip invalid entries

        if (seenIds.has(mod.id)) {
            const oldId = mod.id;
            const newId = `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.warn(`Duplicate module ID "${oldId}" found for module "${mod.name}". Assigning new ID "${newId}". School assignments for this module may need to be recreated by an admin.`);
            wasModified = true;
            return { ...mod, id: newId };
        } else {
            seenIds.add(mod.id);
            return mod;
        }
    });

    if (wasModified) {
        saveRawModules(updatedModules);
        console.log("Module ID migration complete.");
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
};

const renameCheckModule = () => {
    const FLAG = '360_smart_school_rename_check_v1';
    if (localStorage.getItem(FLAG)) return;
    
    const modulesStr = localStorage.getItem('360_smart_school_modules');
    if (modulesStr) {
        const modules = JSON.parse(modulesStr);
        let updated = false;
        modules.forEach((m: any) => {
            if (m.name === 'Check') {
                m.name = MY_INSTITUTE_MODULE_NAME;
                m.description = 'Dashboard for institute status and verification.';
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem('360_smart_school_modules', JSON.stringify(modules));
        }
    }
    localStorage.setItem(FLAG, 'true');
}


/**
 * Populates localStorage with initial sample data.
 * Core modules are checked and created on every load to ensure they always exist.
 * Schools, users, and other data are only seeded once.
 */
export const seedInitialData = () => {
    // --- 0. Run Migrations (Every Time) ---
    try {
        migrateDuplicateModuleIDs();
        reconcileAndCleanModuleData();
        renameCheckModule();
    } catch (error) {
        console.error("Failed to run data migrations:", error);
    }
    
    const TOPICS_KEY = '360_smart_school_topics';
    const TOPIC_MIGRATION_FLAG_KEY = '360_smart_school_topic_migration_v1';

    if (!localStorage.getItem(TOPIC_MIGRATION_FLAG_KEY)) {
        console.log("Running migration for topics data structure...");
        try {
            const rawData = localStorage.getItem(TOPICS_KEY);
            if (rawData) {
                const oldData = JSON.parse(rawData);
                const newData: Record<string, any[]> = {};
                let needsMigration = false;
                
                for (const schoolId in oldData) {
                    if (Array.isArray(oldData[schoolId]) && oldData[schoolId].length > 0 && typeof oldData[schoolId][0] === 'string') {
                        needsMigration = true;
                        newData[schoolId] = oldData[schoolId].map((topicName: string) => ({
                            id: `topic_${schoolId}_${topicName.replace(/\s/g, '_')}_${Math.random()}`,
                            schoolId: schoolId,
                            name: topicName,
                        }));
                    } else {
                        // Data is already in new format or empty
                        newData[schoolId] = oldData[schoolId];
                    }
                }
                
                if (needsMigration) {
                    localStorage.setItem(TOPICS_KEY, JSON.stringify(newData));
                    console.log("Topic data migration completed.");
                }
            }
            localStorage.setItem(TOPIC_MIGRATION_FLAG_KEY, 'true');
        } catch (error) {
            console.error("Failed to migrate topics data:", error);
        }
    }


    // --- 1. Ensure Core Modules Exist (Runs every time) ---
    // This part is crucial and runs on every app load to ensure core modules
    // are always present, even if localStorage is cleared or corrupted.
    try {
        const defaultModules = [
            { name: HOME_PAGE_MODULE_NAME, description: 'Allows schools to create and edit a customizable public home page.', isAssignable: false },
            { name: SMART_ADMISSION_MODULE_NAME, description: 'Manage student admissions, including self-service portals and administrative processing.', isAssignable: true },
            { name: MESSAGE_MODULE_NAME, description: 'A comprehensive messaging platform for one-on-one chats, group discussions, and school announcements.', isAssignable: true },
            { name: E_WALLET_MODULE_NAME, description: 'A secure digital wallet for school-related payments, allowances, and fees.', isAssignable: true },
            { name: ONLINE_MODULE_NAME, description: 'A social feed for school-wide interaction, news, and announcements.', isAssignable: true },
            { name: SMART_STUDENT_ID_MODULE_NAME, description: 'Create, customize, and issue digital and printable student ID cards with QR codes.', isAssignable: true },
            { name: E_CANTEEN_MODULE_NAME, description: 'A digital menu and ordering system for the school canteen.', isAssignable: true },
            { name: NCHE_MODULE_NAME, description: 'A portal for students to explore higher education institutions and check program eligibility based on their UNEB results.', isAssignable: true },
            { name: STUDENT_TRANSFER_MODULE_NAME, description: 'A marketplace for schools to request or propose the transfer of students to manage capacity.', isAssignable: true },
            { name: NEWS_FEED_MODULE_NAME, description: 'Provides students with a feed of the latest news, summarized by AI from Google Search.', isAssignable: true },
            { name: E_VOTE_MODULE_NAME, description: 'Facilitates democratic student elections with live result tracking.', isAssignable: true },
            { name: MY_INSTITUTE_MODULE_NAME, description: 'Dashboard for institute status and verification.', isAssignable: true },
            { name: VISITOR_CENTER_MODULE_NAME, description: 'Manages visitor check-in and logs using AI-powered ID scanning.', isAssignable: true },
            { name: KIOSK_MODE_MODULE_NAME, description: 'A dedicated interface for public terminals, providing access to features like E-Vote, Canteen Attendance, and Visitor Check-in.', isAssignable: true },
        ];

        // Get the current list of modules from storage.
        const allModules = getAllModules();
        const existingModuleNames = new Set(allModules.map(m => m.name.toLowerCase()));

        // Find which modules are missing.
        const missingModules = defaultModules.filter(
            defaultModule => !existingModuleNames.has(defaultModule.name.toLowerCase())
        );

        // If any modules are missing, create them.
        if (missingModules.length > 0) {
            console.log(`Found ${missingModules.length} missing core modules. Creating them...`);
            missingModules.forEach(moduleDef => {
                try {
                    createModule({ name: moduleDef.name, description: moduleDef.description, isAssignable: moduleDef.isAssignable });
                    console.log(`Successfully created module: "${moduleDef.name}"`);
                } catch (e) {
                    // Log error but continue, in case of a race condition where another tab created it.
                    console.error(`Error creating module "${moduleDef.name}":`, e);
                }
            });
        }
    } catch (error) {
        console.error("A critical error occurred while ensuring core modules exist:", error);
    }
    
    // --- MIGRATION STEP: Ensure all schools have default classes (Runs every time) ---
    try {
        const allSchools = getAllSchools();
        allSchools.forEach(school => {
            const schoolClasses = classService.getClassesForSchool(school.id);
            if (schoolClasses.length === 0) {
                console.log(`Seeding default classes for existing school: ${school.name}`);
                classService.createDefaultClassesForSchool(school.id);
            }
        });
    } catch (error) {
        console.error("Failed to migrate default classes for existing schools:", error);
    }


    // --- 2. Seed One-Time Data (Schools, Users, etc.) ---
    // Check if this part has already been run.
    if (localStorage.getItem(SEED_FLAG_KEY)) {
        return;
    }

    console.log("Seeding initial school and user data for 360 Smart School...");

    try {
        // We need the modules to assign them, so get the fresh list which is now guaranteed to be complete.
        const modules = getAllModules();
        const homePageModule = modules.find(m => m.name === HOME_PAGE_MODULE_NAME);
        const smartAdmissionModule = modules.find(m => m.name === SMART_ADMISSION_MODULE_NAME);
        const messageModule = modules.find(m => m.name === MESSAGE_MODULE_NAME);
        const eWalletModule = modules.find(m => m.name === E_WALLET_MODULE_NAME);
        const onlineModule = modules.find(m => m.name === ONLINE_MODULE_NAME);
        const smartStudentIdModule = modules.find(m => m.name === SMART_STUDENT_ID_MODULE_NAME);
        const eCanteenModule = modules.find(m => m.name === E_CANTEEN_MODULE_NAME);
        const ncheModule = modules.find(m => m.name === NCHE_MODULE_NAME);
        const studentTransferModule = modules.find(m => m.name === STUDENT_TRANSFER_MODULE_NAME);
        const newsFeedModule = modules.find(m => m.name === NEWS_FEED_MODULE_NAME);
        const eVoteModule = modules.find(m => m.name === E_VOTE_MODULE_NAME);
        const myInstituteModule = modules.find(m => m.name === MY_INSTITUTE_MODULE_NAME);
        const visitorCenterModule = modules.find(m => m.name === VISITOR_CENTER_MODULE_NAME);
        const kioskModule = modules.find(m => m.name === KIOSK_MODE_MODULE_NAME);


        if (!homePageModule || !smartAdmissionModule || !messageModule || !eWalletModule || !onlineModule || !smartStudentIdModule || !eCanteenModule || !ncheModule || !studentTransferModule || !newsFeedModule || !eVoteModule || !myInstituteModule || !visitorCenterModule || !kioskModule) {
            throw new Error("Core modules are missing, cannot proceed with school seeding.");
        }

        // --- Create Schools and Assign Modules ---
        // Note: The Home Page module is now added automatically by registerSchool.
        // We only need to pass the other modules we want to assign.
        const school1Modules = [smartAdmissionModule.id, messageModule.id, eWalletModule.id, onlineModule.id, smartStudentIdModule.id, eCanteenModule.id, ncheModule.id, studentTransferModule.id, newsFeedModule.id, eVoteModule.id, myInstituteModule.id, visitorCenterModule.id, kioskModule.id];
        
        const school1 = registerSchool({
            name: 'Northwood High School',
            address: '123 Education Lane, Anytown'
        }, school1Modules);

        const school2 = registerSchool({
            name: 'Green Valley Academy',
            address: '456 Learning Blvd, Sometown'
        });

        // --- Create Admin Users ---
        const defaultPassword = 'admin';

        createAdminUser({
            name: 'Dr. Evelyn Reed',
            email: 'headteacher1@school.com',
            role: 'headteacher',
            assignedSchoolIds: [school1.id],
            password: defaultPassword
        });
        console.log(`Created Headteacher for ${school1.name}: Dr. Evelyn Reed (email: headteacher1@school.com, password: ${defaultPassword})`);

        createAdminUser({
            name: 'Mr. David Chen',
            email: 'headteacher2@school.com',
            role: 'headteacher',
            assignedSchoolIds: [school2.id],
            password: defaultPassword
        });
        console.log(`Created Headteacher for ${school2.name}: Mr. David Chen (email: headteacher2@school.com, password: ${defaultPassword})`);

        createAdminUser({
            name: 'UNEB Administrator',
            email: 'uneb@admin.com',
            role: 'uneb_admin',
            assignedSchoolIds: [],
            password: defaultPassword
        });
        console.log(`Created UNEB Admin: UNEB Administrator (email: uneb@admin.com, password: ${defaultPassword})`);
        
        createAdminUser({
            name: 'NCHE Administrator',
            email: 'nche@admin.com',
            role: 'nche_admin',
            assignedSchoolIds: [],
            password: defaultPassword
        });
        console.log(`Created NCHE Admin: NCHE Administrator (email: nche@admin.com, password: ${defaultPassword})`);
        
        // --- Create Broadcast Channels ---
        const allAdminUsers = getAllAdminUsers();
        const headteacher1 = allAdminUsers.find(u => u.email === 'headteacher1@school.com');
        const headteacher2 = allAdminUsers.find(u => u.email === 'headteacher2@school.com');

        if (headteacher1) {
            createChannel(school1.id, 'School Announcements', `Official news and updates from ${school1.name}`, [headteacher1.id]);
            console.log(`Created Announcement channel for ${school1.name}`);
        }
        if (headteacher2) {
            createChannel(school2.id, 'School Announcements', `Official news and updates from ${school2.name}`, [headteacher2.id]);
            console.log(`Created Announcement channel for ${school2.name}`);
        }

        // --- Seed a sample topic ---
        topicService.addTopic(school1.id, 'Introduction to Algebra');
        console.log(`Created sample topic "Introduction to Algebra" for ${school1.name}`);

        const sampleUacePassSlip: UnebPassSlip = {
            indexNo: 'U0001/501',
            name: 'Grace Nakato',
            year: '2023',
            level: 'U.A.C.E',
            schoolName: 'Northwood High School',
            subjects: [
                { name: 'Mathematics', grade: 'A' },
                { name: 'Physics', grade: 'B' },
                { name: 'Chemistry', grade: 'B' },
                { name: 'General Paper', grade: 'C3' },
            ],
        };

        // --- Create Student Users ---
        createSchoolUser({ name: 'Alice Johnson', studentId: 'S001', class: 'S.3', schoolId: school1.id, password: defaultPassword, role: 'student' });
        createSchoolUser({ name: 'Bob Williams', studentId: 'S002', class: 'S.5', schoolId: school1.id, password: defaultPassword, role: 'student' });
        createSchoolUser({ name: 'Charlie Brown', studentId: 'S003', class: 'S.1', schoolId: school2.id, password: defaultPassword, role: 'student' });
        const studentWithResults = createSchoolUser({ name: sampleUacePassSlip.name, studentId: sampleUacePassSlip.indexNo, class: 'S.6', schoolId: school1.id, password: defaultPassword, role: 'student', unebPassSlip: sampleUacePassSlip });
        console.log(`Created 4 sample students with password: ${defaultPassword}. Student ${studentWithResults.name} has U.A.C.E results.`);

        // --- Create Teacher Users ---
        createSchoolUser({ name: 'Mr. John Smith', studentId: 'teacher1', schoolId: school1.id, password: 'admin', role: 'teacher' });
        createSchoolUser({ name: 'Ms. Jane Doe', studentId: 'teacher2', schoolId: school1.id, password: 'admin', role: 'teacher' });
        console.log(`Created 2 sample teachers (teacher1, teacher2) for ${school1.name} with password: "admin"`);
        
        // --- Create Sample UNEB Results Data for Smart Admission Lookup ---
        console.log("Seeding sample UNEB result data for admission testing...");
        const sampleUnebResults: UnebPassSlip[] = [
            sampleUacePassSlip,
            {
                indexNo: 'U0001/502',
                name: 'David Okello',
                year: '2023',
                // FIX: Added missing 'level' property to match the UnebPassSlip type.
                level: 'U.A.C.E',
                schoolName: 'Northwood High School',
                subjects: [
                    { name: 'Mathematics', grade: 'A' },
                    { name: 'Physics', grade: 'B' },
                    { name: 'Chemistry', grade: 'B' },
                    { name: 'General Paper', grade: 'C3' },
                ],
            },
            {
                indexNo: 'U0001/503',
                name: 'Aisha Nanteza',
                year: '2023',
                // FIX: Added missing 'level' property to match the UnebPassSlip type.
                level: 'U.A.C.E',
                schoolName: 'Northwood High School',
                subjects: [
                    { name: 'Biology', grade: 'B' },
                    { name: 'Chemistry', grade: 'C' },
                    { name: 'Agriculture', grade: 'A' },
                    { name: 'General Paper', grade: 'C5' },
                ],
            },
        ];
        // FIX: The addUnebResults function expects a single array argument with objects that mimic
        // a parsed CSV, not three arguments. This transforms the data into the correct format.
        const resultsToUpload = sampleUnebResults.map(slip => {
            let examinationType = '';
            if (slip.level === 'U.A.C.E') examinationType = 'UGANDA ADVANCED CERTIFICATE OF EDUCATION';
            else if (slip.level === 'U.C.E') examinationType = 'UGANDA CERTIFICATE OF EDUCATION';
            else if (slip.level === 'P.L.E') examinationType = 'PRIMARY LEAVING EXAMINATION';
        
            return {
                candidateName: slip.name,
                indexNumber: slip.indexNo,
                yearOfExamination: slip.year,
                examinationType: examinationType,
                // This will be parsed by addResults, but for seeding, we can simplify
                subjects: slip.subjects.map(s => `${s.name}:${s.grade}:WORD`).join('|'),
                dateOfBirth: slip.dateOfBirth || '',
                schoolName: slip.schoolName || '',
                schoolAddress: slip.schoolAddress || '',
                entryCode: slip.entryCode || '',
                gradeAggregate: slip.aggregate || '',
                overallResult: slip.result || '',
                note: '',
            };
        });
        addUnebResults(resultsToUpload);
        console.log(`Created 3 sample UNEB result slips. Try looking up index numbers like U0001/501 in the Smart Admission module.`);
        
        // --- Create Sample E-Canteen Data ---
        console.log("Seeding sample E-Canteen data...");
        // This function now returns the created shop
        const shop1 = canteenService.seedInitialCanteenData(school1.id); 
        const shop2 = canteenService.addShop(school1.id, "Juice Bar", "Fresh juices and healthy snacks.");
        canteenService.addCategory(shop2.id, "Fresh Juices");

        const seller1 = createSchoolUser({ name: 'Canteen Seller One', studentId: 'Seller1', schoolId: school1.id, password: defaultPassword, role: 'canteen_seller' });
        const seller2 = createSchoolUser({ name: 'Canteen Seller Two', studentId: 'Seller2', schoolId: school1.id, password: defaultPassword, role: 'canteen_seller' });

        assignSellerToShop(seller1.studentId, shop1.id);
        assignSellerToShop(seller2.studentId, shop2.id);
        console.log(`Created 2 sample sellers for ${school1.name}: Seller1 (Main Tuck Shop) and Seller2 (Juice Bar). Password is "${defaultPassword}"`);

        // --- Seed NCHE Data ---
        seedNcheData();

        // --- Seed My Institute Data ---
        seedMyInstituteData();

        // --- Seed Marketplace Data ---
        if (getListings().length === 0) {
            console.log('Seeding marketplace listings...');
            createListing({
                sellerId: 'S001',
                sellerName: 'Alice Johnson',
                sellerAvatar: 'https://picsum.photos/seed/S001/150',
                title: 'Slightly Used "Intro to Physics" Textbook',
                description: 'Great condition, only used for one semester. No highlights or markings. Perfect for S.5 students.',
                price: 50000,
                category: 'Books',
                condition: 'used',
                location: 'Northwood High Campus',
                media: [{ type: 'image', url: 'https://picsum.photos/seed/physics-book/800/600' }],
                status: 'available',
                availableUnits: 5,
            });
            createListing({
                sellerId: 'S002',
                sellerName: 'Bob Williams',
                sellerAvatar: 'https://picsum.photos/seed/S002/150',
                title: 'Casio Scientific Calculator FX-991EX',
                description: 'Barely used, in perfect working condition. Comes with the original case. Essential for A-Level Maths.',
                price: 80000,
                category: 'Electronics',
                condition: 'used',
                location: 'Green Valley Academy',
                media: [{ type: 'image', url: 'https://picsum.photos/seed/calculator/800/600' }],
                status: 'available',
                availableUnits: 3,
            });
            createListing({
                sellerId: 'teacher1',
                sellerName: 'Mr. John Smith',
                sellerAvatar: 'https://picsum.photos/seed/teacher1/150',
                title: 'Private Tutoring - Mathematics',
                description: 'Offering one-on-one tutoring sessions for O-Level and A-Level mathematics. 50,000 UGX per hour. Contact for details.',
                price: 50000,
                category: 'Services',
                condition: 'new',
                location: 'Online / Northwood Campus',
                media: [{ type: 'image', url: 'https://picsum.photos/seed/tutoring/800/600' }],
                status: 'available',
                availableUnits: 99,
            });
            createListing({
                sellerId: 'S003',
                sellerName: 'Charlie Brown',
                sellerAvatar: 'https://picsum.photos/seed/S003/150',
                title: 'School Uniform - Blazer',
                description: 'Green Valley Academy blazer for S.1-S.4. Good condition, size medium.',
                price: 45000,
                category: 'Clothing',
                condition: 'used',
                location: 'Green Valley Academy',
                media: [{ type: 'image', url: 'https://picsum.photos/seed/blazer/800/600' }],
                status: 'available',
                availableUnits: 1,
            });
        }
        
        console.log("Seeding complete. Refresh the page to see the data.");

        localStorage.setItem(SEED_FLAG_KEY, 'true');

    } catch (error) {
        console.error("Error during data seeding:", error);
    }
};
