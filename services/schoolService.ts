
// services/schoolService.ts
import { School, Module, StudentTransferProposal, TransferNegotiation, GradingRubric, CompletedAdmission, NegotiationMessage, StudentTransferRequest, SchoolUserRole } from '../types';
import { getAllModules, HOME_PAGE_MODULE_NAME, MESSAGE_MODULE_NAME, SMART_ADMISSION_MODULE_NAME } from './moduleService';
import { findUserById } from './groupService';
import { createDefaultClassesForSchool } from './classService';
import * as settingsService from './settingsService';
import { makePayment, TRANSFER_ESCROW_USER_ID } from './eWalletService';
import { getAllAdminUsers } from './userService';
import * as studentService from './studentService';


const SCHOOLS_KEY = '360_smart_school_schools';
const PROPOSALS_KEY = '360_smart_school_transfer_proposals';
const NEGOTIATIONS_KEY = '360_smart_school_transfer_negotiations';
const REQUESTS_KEY = '360_smart_school_transfer_requests';
const RUBRICS_KEY = '360_smart_school_rubrics';

const getSchools = (): School[] => {
    const schoolsData = localStorage.getItem(SCHOOLS_KEY);
    return schoolsData ? JSON.parse(schoolsData) : [];
};

export const saveSchools = (schools: School[]) => {
    localStorage.setItem(SCHOOLS_KEY, JSON.stringify(schools));
};

export const getAllSchools = (): School[] => {
    return getSchools();
};

export const registerSchool = (schoolData: Omit<School, 'id' | 'modules'>, moduleIds: string[] = []): School => {
    const schools = getSchools();
    if (schools.find(s => s.name.toLowerCase() === schoolData.name.toLowerCase())) {
        throw new Error('A school with this name already exists.');
    }
    
    const allModules = getAllModules();
    
    // Define default modules
    const defaultModuleNames = [HOME_PAGE_MODULE_NAME, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME];
    
    // Use a Set to manage unique module IDs, starting with those selected in the UI
    const finalModuleIds = new Set<string>(moduleIds);

    // Add default modules to the set, ensuring they are included
    allModules.forEach(module => {
        if (defaultModuleNames.includes(module.name)) {
            finalModuleIds.add(module.id);
        }
    });

    const homePageModule = allModules.find(m => m.name === HOME_PAGE_MODULE_NAME);

    // Create the module assignments array from the final, unique set of IDs
    const modulesForSchool: School['modules'] = Array.from(finalModuleIds).map(id => ({
        moduleId: id,
        // The Home Page module is not assignable and should be 'active' by default. Others are 'assigned'.
        status: (id === homePageModule?.id) ? 'active' : 'assigned'
    }));

    // Generate unique 3-digit ID
    let newSchoolId = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 1000) {
        // Generate number between 1 and 999
        const num = Math.floor(Math.random() * 999) + 1;
        // Pad with zeros to ensure 3 digits (e.g., "007", "042", "123")
        newSchoolId = num.toString().padStart(3, '0');
        
        // Check for collision
        if (!schools.some(s => s.id === newSchoolId)) {
            isUnique = true;
        }
        attempts++;
    }

    // Fallback if 3-digit space is full (unlikely for this app scale) or loop fails
    if (!isUnique) {
        newSchoolId = Date.now().toString().slice(-4); 
    }

    const newSchool: School = {
        ...schoolData,
        id: newSchoolId,
        modules: modulesForSchool,
        isHomePagePublished: false,
    };
    schools.push(newSchool);
    saveSchools(schools);

    // Create default classes for the new school
    createDefaultClassesForSchool(newSchool.id);

    return newSchool;
};

const sanitizeSchoolModules = (modules: School['modules']): School['modules'] => {
    if (!modules || !Array.isArray(modules)) {
        return [];
    }
    const assignmentsByModuleId = new Map<string, School['modules'][0]>();
    for (const mod of modules) {
        if (mod && mod.moduleId) {
            // Keep the last one found in case of duplicates
            assignmentsByModuleId.set(mod.moduleId, mod);
        }
    }
    return Array.from(assignmentsByModuleId.values());
};

export const updateSchool = (schoolId: string, updatedData: Omit<School, 'id'>): School => {
    const schools = getSchools();
    if (schools.find(s => s.name.toLowerCase() === updatedData.name.toLowerCase() && s.id !== schoolId)) {
        throw new Error('A school with this name already exists.');
    }
    let updatedSchool: School | undefined;
    const newSchools = schools.map(school => {
        if (school.id === schoolId) {
            updatedSchool = { ...school, ...updatedData };
            if (updatedSchool.modules) {
                 updatedSchool.modules = sanitizeSchoolModules(updatedSchool.modules);
            }
            return updatedSchool;
        }
        return school;
    });
    if (!updatedSchool) throw new Error('School not found.');
    saveSchools(newSchools);
    return updatedSchool;
};

export const deleteSchool = (schoolId: string): void => {
    let schools = getSchools();
    schools = schools.filter(school => school.id !== schoolId);
    saveSchools(schools);
};

export const activateModuleForSchool = (schoolId: string, moduleId: string): School => {
    const schools = getSchools();
    let updatedSchool: School | undefined;

    const newSchools = schools.map(school => {
        if (school.id === schoolId) {
            const moduleExists = school.modules.some(m => m.moduleId === moduleId);
            let newModules;

            if (moduleExists) {
                newModules = school.modules.map(m =>
                    m.moduleId === moduleId ? { ...m, status: 'active' as const } : m
                );
            } else {
                newModules = [...school.modules, { moduleId, status: 'active' as const }];
            }
            
            updatedSchool = { ...school, modules: newModules };
            return updatedSchool;
        }
        return school;
    });

    if (!updatedSchool) throw new Error("School not found.");
    
    saveSchools(newSchools);
    return updatedSchool;
};

export const deactivateModuleForSchool = (schoolId: string, moduleId: string): School => {
    const schools = getSchools();
    let updatedSchool: School | undefined;
    const newSchools = schools.map(school => {
        if (school.id === schoolId) {
            const newModules = school.modules.map(m =>
                m.moduleId === moduleId ? { ...m, status: 'assigned' as const } : m
            );
            updatedSchool = { ...school, modules: newModules };
            return updatedSchool;
        }
        return school;
    });

    if (!updatedSchool) throw new Error("School not found.");
    saveSchools(newSchools);
    return updatedSchool;
};

export const publishModuleForSchool = (schoolId: string, moduleId: string): School => {
    const schools = getSchools();
    let updatedSchool: School | undefined;
    const newSchools = schools.map(school => {
        if (school.id === schoolId) {
            const moduleAssignment = school.modules.find(m => m.moduleId === moduleId);
            if (!moduleAssignment || moduleAssignment.status !== 'active') {
                throw new Error("Only active modules can be published.");
            }
            const newModules = school.modules.map(m =>
                m.moduleId === moduleId ? { ...m, status: 'published' as const } : m
            );
            updatedSchool = { ...school, modules: newModules };
            return updatedSchool;
        }
        return school;
    });

    if (!updatedSchool) throw new Error("School not found.");
    saveSchools(newSchools);
    return updatedSchool;
};

export const unpublishModuleForSchool = (schoolId: string, moduleId: string): School => {
    const schools = getSchools();
    let updatedSchool: School | undefined;
    const newSchools = schools.map(school => {
        if (school.id === schoolId) {
            const moduleAssignment = school.modules.find(m => m.moduleId === moduleId);
            if (!moduleAssignment || moduleAssignment.status !== 'published') {
                throw new Error("Only published modules can be unpublished.");
            }
            const newModules = school.modules.map(m =>
                m.moduleId === moduleId ? { ...m, status: 'active' as const } : m
            );
            updatedSchool = { ...school, modules: newModules };
            return updatedSchool;
        }
        return school;
    });

    if (!updatedSchool) throw new Error("School not found.");
    saveSchools(newSchools);
    return updatedSchool;
};

export const updateModuleRolesForSchool = (schoolId: string, moduleId: string, allowedRoles: SchoolUserRole[]): void => {
    const schools = getSchools();
    const schoolIndex = schools.findIndex(s => s.id === schoolId);
    if (schoolIndex === -1) throw new Error("School not found.");

    const school = schools[schoolIndex];
    const moduleIndex = school.modules.findIndex(m => m.moduleId === moduleId);
    if (moduleIndex === -1) throw new Error("Module assignment not found for this school.");

    school.modules[moduleIndex].allowedRoles = allowedRoles;
    schools[schoolIndex] = school;
    saveSchools(schools);
};

export const publishHomePage = (schoolId: string): void => {
    const schools = getSchools();
    const school = schools.find(s => s.id === schoolId);
    if (!school) throw new Error("School not found.");
    school.isHomePagePublished = true;
    saveSchools(schools);
};

export const unpublishHomePage = (schoolId: string): void => {
    const schools = getSchools();
    const school = schools.find(s => s.id === schoolId);
    if (!school) throw new Error("School not found.");
    school.isHomePagePublished = false;
    saveSchools(schools);
};

export const getProposals = (): StudentTransferProposal[] => {
    const data = localStorage.getItem(PROPOSALS_KEY);
    return data ? JSON.parse(data) : [];
};
const saveProposals = (proposals: StudentTransferProposal[]) => {
    localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
};
export const getNegotiations = (): TransferNegotiation[] => {
    const data = localStorage.getItem(NEGOTIATIONS_KEY);
    return data ? JSON.parse(data) : [];
};
const saveNegotiations = (negotiations: TransferNegotiation[]) => {
    localStorage.setItem(NEGOTIATIONS_KEY, JSON.stringify(negotiations));
};

// --- NEW REQUEST FUNCTIONS ---
export const getRequests = (): StudentTransferRequest[] => {
    const data = localStorage.getItem(REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
};
const saveRequests = (requests: StudentTransferRequest[]) => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
};

export const createRequest = (data: Omit<StudentTransferRequest, 'id' | 'status' | 'timestamp' | 'requestingSchoolName' | 'fulfilledStudentsCount'>): StudentTransferRequest => {
    const requests = getRequests();
    const requestingSchool = getAllSchools().find(s => s.id === data.requestingSchoolId);
    if (!requestingSchool) {
        throw new Error("Requesting school not found.");
    }
    const newRequest: StudentTransferRequest = {
        id: `req_${Date.now()}`,
        requestingSchoolName: requestingSchool.name,
        ...data,
        status: 'open',
        timestamp: Date.now(),
        fulfilledStudentsCount: 0, // Initialize to 0
    };
    requests.unshift(newRequest); // Add to top
    saveRequests(requests);
    return newRequest;
};

export const getOpenMarketRequests = (mySchoolId: string): StudentTransferRequest[] => {
    return getRequests().filter(r => 
        r.requestingSchoolId !== mySchoolId && 
        r.status === 'open' &&
        (r.fulfilledStudentsCount || 0) < r.numberOfStudents // Only show if not fully fulfilled
    );
};

export const getRequestsForSchool = (schoolId: string): StudentTransferRequest[] => {
    return getRequests().filter(r => 
        r.requestingSchoolId === schoolId &&
        (r.fulfilledStudentsCount || 0) < r.numberOfStudents // Only show if not fully fulfilled
    );
};

export const closeRequest = (requestId: string, schoolId: string): void => {
    const requests = getRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId && r.requestingSchoolId === schoolId);
    if (requestIndex > -1) {
        requests[requestIndex].status = 'closed';
        saveRequests(requests);
    }
};
// --- END NEW REQUEST FUNCTIONS ---

export const getOpenMarketProposals = (mySchoolId: string): StudentTransferProposal[] => {
    // MODIFIED: filter out private proposals
    return getProposals().filter(p => !p.targetSchoolId && p.proposingSchoolId !== mySchoolId && p.status === 'open');
};
export const getProposalsForSchool = (schoolId: string): StudentTransferProposal[] => {
    return getProposals().filter(p => p.proposingSchoolId === schoolId);
};
export const getNegotiationsForSchool = (schoolId: string): TransferNegotiation[] => {
    return getNegotiations().filter(n => n.proposingSchoolId === schoolId || n.interestedSchoolId === schoolId)
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
};

export const getNegotiationCountForProposal = (proposalId: string): number => {
    return getNegotiations().filter(n => n.proposalId === proposalId).length;
};

export const startOrGetNegotiation = (proposalId: string, interestedSchoolId: string): TransferNegotiation => {
    const negotiations = getNegotiations();
    const proposal = getProposals().find(p => p.id === proposalId);
    if (!proposal) throw new Error("Proposal not found.");

    const negotiationId = `${proposalId}_${interestedSchoolId}`;
    let negotiation = negotiations.find(n => n.id === negotiationId);

    if (negotiation) {
        return negotiation;
    }

    negotiation = {
        id: negotiationId,
        proposalId,
        proposingSchoolId: proposal.proposingSchoolId,
        interestedSchoolId,
        // FIX: Added requestId from proposal if it exists.
        requestId: proposal.requestId,
        messages: [],
        status: 'active',
        lastUpdated: Date.now(),
        isNegotiable: true,
        isBuyerOfferActive: false,
    };
    negotiations.push(negotiation);
    saveNegotiations(negotiations);
    return negotiation;
};

export const createProposal = (data: Omit<StudentTransferProposal, 'id' | 'status' | 'timestamp' | 'proposingSchoolName'>): StudentTransferProposal => {
    const proposals = getProposals();
    const proposingSchool = getAllSchools().find(s => s.id === data.proposingSchoolId);
    if (!proposingSchool) {
        throw new Error("Proposing school not found.");
    }
    const newProposal: StudentTransferProposal = {
        id: `prop_${Date.now()}`,
        proposingSchoolName: proposingSchool.name,
        ...data,
        status: 'open',
        timestamp: Date.now(),
    };
    proposals.push(newProposal);
    saveProposals(proposals);
    return newProposal;
};

export const addNegotiationMessage = (negotiationId: string, senderId: string, content: string): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) {
        throw new Error("Negotiation not found.");
    }
    
    const negotiation = { ...negotiations[negotiationIndex] };

    const sender = senderId === 'system' ? { name: 'System' } : findUserById(senderId);
    if (!sender) {
        throw new Error("Sender not found.");
    }
    
    const newMessage: NegotiationMessage = {
        senderId,
        senderName: sender.name,
        content,
        timestamp: Date.now(),
        readBy: [senderId],
    };

    negotiation.messages = [...negotiation.messages, newMessage];
    negotiation.lastUpdated = Date.now();
    
    negotiations[negotiationIndex] = negotiation;
    saveNegotiations(negotiations);
    return negotiation;
};

export const markNegotiationMessagesAsRead = (negotiationId: string, currentUserId: string): void => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) return; 
    
    let wasUpdated = false;
    const negotiation = negotiations[negotiationIndex];
    negotiation.messages.forEach(message => {
        if (message.senderId !== currentUserId) { 
            if (!message.readBy) message.readBy = [];
            if (!message.readBy.includes(currentUserId)) {
                message.readBy.push(currentUserId);
                wasUpdated = true;
            }
        }
    });

    if (wasUpdated) {
        negotiations[negotiationIndex] = negotiation;
        saveNegotiations(negotiations);
    }
};

export const updateNegotiationTerms = (negotiationId: string, terms: Partial<Pick<TransferNegotiation, 'isNegotiable' | 'buyerOffer' | 'sellerOffer' | 'finalPrice'>>, actorSchoolName: string): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) throw new Error("Negotiation not found.");
    
    const negotiation = negotiations[negotiationIndex];
    
    // Merge new terms and apply logic
    const updatedNegotiation = { ...negotiation, ...terms, lastUpdated: Date.now() };
    let systemMessage = '';

    if ('buyerOffer' in terms && terms.buyerOffer !== undefined) {
        updatedNegotiation.isBuyerOfferActive = true;
        systemMessage = `[System] ${actorSchoolName} offered UGX ${Number(terms.buyerOffer).toLocaleString()} per student.`;
    }
    if ('sellerOffer' in terms && terms.sellerOffer !== undefined) {
        updatedNegotiation.isBuyerOfferActive = false;
        delete updatedNegotiation.buyerOffer;
        systemMessage = `[System] ${actorSchoolName} countered with UGX ${Number(terms.sellerOffer).toLocaleString()} per student.`;
    }
    if ('finalPrice' in terms && terms.finalPrice !== undefined) {
        updatedNegotiation.isBuyerOfferActive = false;
        delete updatedNegotiation.buyerOffer;
        delete updatedNegotiation.sellerOffer;
        updatedNegotiation.status = 'accepted'; // Automatically set to accepted when final price is set
        systemMessage = `[System] ${actorSchoolName} set a final, non-negotiable price of UGX ${Number(terms.finalPrice).toLocaleString()} per student. The deal is now ready for payment.`;
    }

    negotiations[negotiationIndex] = updatedNegotiation;
    saveNegotiations(negotiations);

    if (systemMessage) {
        addNegotiationMessage(negotiationId, 'system', systemMessage);
    }

    return updatedNegotiation;
};

export const rejectBuyerOffer = (negotiationId: string, sellerSchoolName: string): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) throw new Error("Negotiation not found.");

    const negotiation = negotiations[negotiationIndex];
    const rejectedOfferAmount = negotiation.buyerOffer;

    negotiation.buyerOffer = undefined;
    negotiation.isBuyerOfferActive = false;
    negotiation.lastUpdated = Date.now();
    
    negotiations[negotiationIndex] = negotiation;
    saveNegotiations(negotiations);

    addNegotiationMessage(negotiationId, 'system', `[System] ${sellerSchoolName} has rejected the offer of UGX ${rejectedOfferAmount?.toLocaleString()}.`);

    return negotiation;
};

export const rejectNegotiations = (negotiationId: string, sellerSchoolName: string): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) throw new Error("Negotiation not found.");

    const negotiation = negotiations[negotiationIndex];
    const proposal = getProposals().find(p => p.id === negotiation.proposalId);
    if (!proposal) throw new Error("Original proposal not found.");

    negotiation.isNegotiable = false;
    // Set final price to the original proposal price
    negotiation.finalPrice = proposal.pricePerStudent;
    negotiation.status = 'accepted'; // Move to payment stage for buyer
    negotiation.lastUpdated = Date.now();

    negotiations[negotiationIndex] = negotiation;
    saveNegotiations(negotiations);
    
    addNegotiationMessage(negotiationId, 'system', `[System] ${sellerSchoolName} has rejected further negotiations. The original price of UGX ${proposal.pricePerStudent.toLocaleString()} per student is now final.`);
    
    return negotiation;
};

export const updateNegotiationStatus = (negotiationId: string, status: TransferNegotiation['status']): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) {
        throw new Error("Negotiation not found.");
    }
    const negotiation = negotiations[negotiationIndex];
    
    // Automatic student assignment logic
    if (status === 'payment_made' && !negotiation.assignedStudents) {
        const proposal = getProposals().find(p => p.id === negotiation.proposalId);
        if (!proposal) {
            throw new Error(`Original proposal for negotiation ${negotiationId} not found.`);
        }

        const sellingSchoolId = negotiation.proposingSchoolId;
        const buyingSchoolId = negotiation.interestedSchoolId;
        
        const allAdmissionsInSellingSchool = settingsService.getCompletedAdmissions(sellingSchoolId);
        
        // Filter staged students by proposal criteria
        const eligibleStagedStudents = allAdmissionsInSellingSchool.filter(adm => {
            const isStaged = adm.status === 'transferred' && !adm.transferToSchoolId;
            if (!isStaged) return false;
            if (adm.targetClass !== proposal.className) return false;
            if (proposal.gender !== 'Mixed' && adm.gender !== proposal.gender) return false;
            return true;
        });

        if (eligibleStagedStudents.length < proposal.numberOfStudents) {
            throw new Error(`Insufficient eligible students staged for transfer. Proposed: ${proposal.numberOfStudents}, Available: ${eligibleStagedStudents.length}.`);
        }

        const studentsToAssign = eligibleStagedStudents.slice(0, proposal.numberOfStudents);
        const assignedStudentsData = studentsToAssign.map(s => {
            const indexNumber = 'indexNumber' in s.data ? s.data.indexNumber : s.data.indexNo;
            const studentName = 'candidateName' in s.data ? s.data.candidateName : s.data.name;
            return { studentId: s.applicantId, studentName, indexNumber };
        });
        
        negotiation.assignedStudents = assignedStudentsData;

        // Initiate transfer for each assigned student's admission record
        studentsToAssign.forEach(admissionRecord => {
            settingsService.initiateAdmissionTransfer(
                admissionRecord.id,
                sellingSchoolId,
                buyingSchoolId
            );
        });

        addNegotiationMessage(negotiationId, 'system', `[System] The system has automatically assigned ${studentsToAssign.length} students to this deal. The buyer can now review and complete the transfer.`);
    }

    if (status === 'completed') {
        const proposals = getProposals();
        const proposalIndex = proposals.findIndex(p => p.id === negotiation.proposalId);

        if (proposalIndex === -1 || negotiation.finalPrice === undefined) {
            throw new Error("Cannot complete deal without proposal details or a final price.");
        }
        
        const proposal = proposals[proposalIndex];
        const totalAmount = negotiation.finalPrice * proposal.numberOfStudents;
        
        const allAdmins = getAllAdminUsers();
        const sellingHeadteacher = allAdmins.find(admin => 
            admin.role === 'headteacher' && 
            admin.assignedSchoolIds.includes(negotiation.proposingSchoolId)
        );

        if (!sellingHeadteacher) {
            throw new Error("Could not find the headteacher of the selling school to release funds.");
        }

        // Release funds from escrow to seller
        makePayment(
            TRANSFER_ESCROW_USER_ID,
            sellingHeadteacher.id,
            totalAmount,
            `Funds released for transfer deal #${negotiation.id.slice(-6)}`,
            'disbursement'
        );

        // Finalize student transfers
        if (negotiation.assignedStudents) {
            negotiation.assignedStudents.forEach(assignedStudent => {
                const admission = settingsService.getAdmissionForStudent(assignedStudent.studentId, negotiation.proposingSchoolId);
                if (admission) {
                    // This function handles the student transfer and admission record creation
                    settingsService.respondToTransferOffer(admission.id, negotiation.proposingSchoolId, 'accepted_by_student');
                    
                    // FIX: Check if the applicant is a temporary account or an existing student helper
                    // If helper (active), create a NEW user for the transferred student. 
                    // If temporary (self-applicant), transfer the existing user.
                    const applicantUser = studentService.getUsers().find(u => u.studentId === assignedStudent.studentId);
                    
                    if (applicantUser && applicantUser.accountStatus === 'temporary') {
                        studentService.transferStudent(assignedStudent.studentId, negotiation.interestedSchoolId);
                    } else {
                        // The applicant ID refers to a helper (or invalid user), so we create a fresh account for the student being transferred
                        // using the admission details.
                        studentService.createSchoolUserFromAdmission(admission, negotiation.interestedSchoolId);
                    }
                }
            });
        }

        addNegotiationMessage(negotiationId, 'system', `[System] Funds amounting to UGX ${totalAmount.toLocaleString()} have been released to ${proposal.proposingSchoolName}. Students have been transferred. The deal is now complete.`);
        
        proposals[proposalIndex].status = 'closed';
        saveProposals(proposals);

        // NEW: Update fulfillment count and status on the original request
        if (negotiation.requestId && negotiation.assignedStudents) {
            const requests = getRequests();
            const requestIndex = requests.findIndex(r => r.id === negotiation.requestId);
            if (requestIndex !== -1) {
                const request = requests[requestIndex];
                request.fulfilledStudentsCount = (request.fulfilledStudentsCount || 0) + negotiation.assignedStudents.length;
                if (request.fulfilledStudentsCount >= request.numberOfStudents) {
                    request.status = 'closed';
                }
                saveRequests(requests);
            }
        }
    }


    negotiation.status = status;
    negotiation.lastUpdated = Date.now();
    
    negotiations[negotiationIndex] = negotiation;
    saveNegotiations(negotiations);
    return negotiation;
};

export const assignStudentsToNegotiation = (negotiationId: string, students: { studentId: string; studentName: string; indexNumber: string; }[]): TransferNegotiation => {
    const negotiations = getNegotiations();
    const negotiationIndex = negotiations.findIndex(n => n.id === negotiationId);
    if (negotiationIndex === -1) {
        throw new Error("Negotiation not found.");
    }

    const negotiation = negotiations[negotiationIndex];
    negotiation.assignedStudents = students;
    negotiation.lastUpdated = Date.now();
    
    negotiations[negotiationIndex] = negotiation;
    saveNegotiations(negotiations);
    return negotiation;
};

export const preCheckStudentAvailabilityForProposal = (negotiationId: string): void => {
    const negotiations = getNegotiations();
    const negotiation = negotiations.find(n => n.id === negotiationId);
    if (!negotiation) {
        throw new Error("Negotiation not found for pre-check.");
    }

    const proposal = getProposals().find(p => p.id === negotiation.proposalId);
    if (!proposal) {
        throw new Error(`Original proposal for negotiation ${negotiationId} not found during pre-check.`);
    }

    const sellingSchoolId = negotiation.proposingSchoolId;
    
    const allAdmissionsInSellingSchool = settingsService.getCompletedAdmissions(sellingSchoolId);
    
    const eligibleStagedStudents = allAdmissionsInSellingSchool.filter(adm => {
        const isStaged = adm.status === 'transferred' && !adm.transferToSchoolId;
        if (!isStaged) return false;
        if (adm.targetClass !== proposal.className) return false;
        if (proposal.gender !== 'Mixed' && adm.gender !== proposal.gender) return false;
        return true;
    });

    if (eligibleStagedStudents.length < proposal.numberOfStudents) {
        throw new Error(`Insufficient eligible students staged for transfer. Proposed: ${proposal.numberOfStudents}, Available: ${eligibleStagedStudents.length}. The selling school needs to stage more students to fulfill this deal.`);
    }
};


// --- Grading Rubric Management ---
const getRubrics = (): Record<string, GradingRubric[]> => {
    const data = localStorage.getItem(RUBRICS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveRubrics = (data: Record<string, GradingRubric[]>) => {
    localStorage.setItem(RUBRICS_KEY, JSON.stringify(data));
};

export const getRubricsForSchool = (schoolId: string): GradingRubric[] => {
    const allRubrics = getRubrics();
    return allRubrics[schoolId] || [];
};

export const saveRubric = (rubric: Omit<GradingRubric, 'id'> | GradingRubric): GradingRubric => {
    const allRubrics = getRubrics();
    if (!allRubrics[rubric.schoolId]) {
        allRubrics[rubric.schoolId] = [];
    }
    const schoolRubrics = allRubrics[rubric.schoolId];

    if ('id' in rubric) { // Update
        const index = schoolRubrics.findIndex(r => r.id === rubric.id);
        if (index > -1) {
            schoolRubrics[index] = rubric;
            saveRubrics(allRubrics);
            return rubric;
        }
    }
    
    // Create
    const newRubric: GradingRubric = {
        ...rubric,
        id: `rubric_${Date.now()}`,
    };
    schoolRubrics.push(newRubric);
    saveRubrics(allRubrics);
    return newRubric;
};

export const deleteRubric = (rubricId: string, schoolId: string): void => {
    const allRubrics = getRubrics();
    if (allRubrics[schoolId]) {
        allRubrics[schoolId] = allRubrics[schoolId].filter(r => r.id !== rubricId);
        saveRubrics(allRubrics);
    }
};
