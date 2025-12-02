// services/myInstituteService.ts

import { University, Faculty, Course, MiSubject, CourseRequirement, SubjectCombination, Career, CombinationQualification } from '../types';

const UNIVERSITIES_KEY = '360_smart_school_mi_universities';
const FACULTIES_KEY = '360_smart_school_mi_faculties';
const COURSES_KEY = '360_smart_school_mi_courses';
const SUBJECTS_KEY = '360_smart_school_mi_subjects';
const REQUIREMENTS_KEY = '360_smart_school_mi_requirements';
const COMBINATIONS_KEY = '360_smart_school_mi_combinations';
const COMBINATION_QUALIFICATIONS_KEY = '360_smart_school_mi_combination_qualifications';
const CAREERS_KEY = '360_smart_school_mi_careers';

// --- Helpers ---

const getLocalStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setLocalStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// 1. UNIVERSITIES
// ==========================================

export const getUniversities = (): University[] => getLocalStorage(UNIVERSITIES_KEY);

export const getUniversityById = (id: string): University | undefined => {
    return getUniversities().find(u => u.id === id);
};

export const addUniversity = (data: Omit<University, 'id' | 'createdAt'>): University => {
    const list = getUniversities();
    const newItem: University = { ...data, id: `uni_${Date.now()}`, createdAt: Date.now() };
    list.push(newItem);
    setLocalStorage(UNIVERSITIES_KEY, list);
    return newItem;
};

export const updateUniversity = (id: string, data: Partial<University>): University => {
    const list = getUniversities();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('University not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(UNIVERSITIES_KEY, list);
    return list[index];
};

export const deleteUniversity = (id: string): void => {
    // Cascading delete: Faculties -> Courses
    const faculties = getFaculties().filter(f => f.universityId === id);
    faculties.forEach(f => deleteFaculty(f.id));
    
    const list = getUniversities().filter(i => i.id !== id);
    setLocalStorage(UNIVERSITIES_KEY, list);
};

// ==========================================
// 2. FACULTIES
// ==========================================

export const getFaculties = (): Faculty[] => getLocalStorage(FACULTIES_KEY);

export const getFacultiesForUniversity = (uniId: string): Faculty[] => {
    return getFaculties().filter(f => f.universityId === uniId);
};

export const addFaculty = (data: Omit<Faculty, 'id'>): Faculty => {
    const list = getFaculties();
    const newItem: Faculty = { ...data, id: `fac_${Date.now()}` };
    list.push(newItem);
    setLocalStorage(FACULTIES_KEY, list);
    return newItem;
};

export const updateFaculty = (id: string, data: Partial<Faculty>): Faculty => {
    const list = getFaculties();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Faculty not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(FACULTIES_KEY, list);
    return list[index];
};

export const deleteFaculty = (id: string): void => {
    // Cascading delete: Courses
    const courses = getCourses().filter(c => c.facultyId === id);
    courses.forEach(c => deleteCourse(c.id));

    const list = getFaculties().filter(i => i.id !== id);
    setLocalStorage(FACULTIES_KEY, list);
};

// ==========================================
// 3. COURSES
// ==========================================

export const getCourses = (): Course[] => getLocalStorage(COURSES_KEY);

export const getCoursesForFaculty = (facId: string): Course[] => {
    return getCourses().filter(c => c.facultyId === facId);
};

export const addCourse = (data: Omit<Course, 'id' | 'createdAt'>): Course => {
    const list = getCourses();
    const newItem: Course = { ...data, id: `crs_${Date.now()}`, createdAt: Date.now() };
    list.push(newItem);
    setLocalStorage(COURSES_KEY, list);
    return newItem;
};

export const updateCourse = (id: string, data: Partial<Course>): Course => {
    const list = getCourses();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Course not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(COURSES_KEY, list);
    return list[index];
};

export const deleteCourse = (id: string): void => {
    // Delete requirements linking to this course
    const reqs = getRequirements().filter(r => r.courseId !== id);
    setLocalStorage(REQUIREMENTS_KEY, reqs);
    
    // Delete combination qualifications linking to this course
    const quals = getCombinationQualifications().filter(q => q.courseId !== id);
    setLocalStorage(COMBINATION_QUALIFICATIONS_KEY, quals);
    
    // Clean up references in careers
    const careers = getCareers();
    let careersUpdated = false;
    const newCareers = careers.map(c => {
        if (c.relatedCourses.includes(id)) {
            careersUpdated = true;
            return { ...c, relatedCourses: c.relatedCourses.filter(cid => cid !== id) };
        }
        return c;
    });
    if (careersUpdated) setLocalStorage(CAREERS_KEY, newCareers);

    const list = getCourses().filter(i => i.id !== id);
    setLocalStorage(COURSES_KEY, list);
};

// ==========================================
// 4. SUBJECTS
// ==========================================

export const getSubjects = (): MiSubject[] => getLocalStorage(SUBJECTS_KEY);

export const addSubject = (data: Omit<MiSubject, 'id'>): MiSubject => {
    const list = getSubjects();
    const newItem: MiSubject = { ...data, id: `sub_${Date.now()}` };
    list.push(newItem);
    setLocalStorage(SUBJECTS_KEY, list);
    return newItem;
};

export const updateSubject = (id: string, data: Partial<MiSubject>): MiSubject => {
    const list = getSubjects();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Subject not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(SUBJECTS_KEY, list);
    return list[index];
};

export const deleteSubject = (id: string): void => {
    // Clean up requirements
    const reqs = getRequirements().filter(r => r.subjectId !== id);
    setLocalStorage(REQUIREMENTS_KEY, reqs);
    
    // Clean up combinations (remove subject ID from array)
    const combinations = getCombinations();
    let combosUpdated = false;
    const newCombinations = combinations.map(c => {
        if (c.subjectIds.includes(id)) {
            combosUpdated = true;
            return { ...c, subjectIds: c.subjectIds.filter(sid => sid !== id) };
        }
        return c;
    });
    if (combosUpdated) setLocalStorage(COMBINATIONS_KEY, newCombinations);

    // Clean up careers
    const careers = getCareers();
    let careersUpdated = false;
    const newCareers = careers.map(c => {
        if (c.keySubjects.includes(id)) {
            careersUpdated = true;
            return { ...c, keySubjects: c.keySubjects.filter(sid => sid !== id) };
        }
        return c;
    });
    if (careersUpdated) setLocalStorage(CAREERS_KEY, newCareers);
    
    const list = getSubjects().filter(i => i.id !== id);
    setLocalStorage(SUBJECTS_KEY, list);
};

// ==========================================
// 5. COURSE REQUIREMENTS
// ==========================================

export const getRequirements = (): CourseRequirement[] => getLocalStorage(REQUIREMENTS_KEY);

export const getRequirementsForCourse = (courseId: string): CourseRequirement[] => {
    return getRequirements().filter(r => r.courseId === courseId);
};

export const addRequirement = (data: Omit<CourseRequirement, 'id'>): CourseRequirement => {
    const list = getRequirements();
    const newItem: CourseRequirement = { ...data, id: `req_${Date.now()}_${Math.random().toString(36).substr(2,5)}` };
    list.push(newItem);
    setLocalStorage(REQUIREMENTS_KEY, list);
    return newItem;
};

export const updateRequirement = (id: string, data: Partial<CourseRequirement>): CourseRequirement => {
    const list = getRequirements();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Requirement not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(REQUIREMENTS_KEY, list);
    return list[index];
};

export const deleteRequirement = (id: string): void => {
    const list = getRequirements().filter(i => i.id !== id);
    setLocalStorage(REQUIREMENTS_KEY, list);
};

// ==========================================
// 6. SUBJECT COMBINATIONS
// ==========================================

export const getCombinations = (): SubjectCombination[] => getLocalStorage(COMBINATIONS_KEY);

export const addCombination = (data: Omit<SubjectCombination, 'id'>): SubjectCombination => {
    const list = getCombinations();
    const newItem: SubjectCombination = { ...data, id: `comb_${Date.now()}` };
    list.push(newItem);
    setLocalStorage(COMBINATIONS_KEY, list);
    return newItem;
};

export const updateCombination = (id: string, data: Partial<SubjectCombination>): SubjectCombination => {
    const list = getCombinations();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Combination not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(COMBINATIONS_KEY, list);
    return list[index];
};

export const deleteCombination = (id: string): void => {
    // Clean up qualifications linking to this combination
    const quals = getCombinationQualifications().filter(q => q.combinationId !== id);
    setLocalStorage(COMBINATION_QUALIFICATIONS_KEY, quals);

    const list = getCombinations().filter(i => i.id !== id);
    setLocalStorage(COMBINATIONS_KEY, list);
};

// ==========================================
// 7. COMBINATION QUALIFICATIONS (Link Combos to Courses)
// ==========================================

export const getCombinationQualifications = (): CombinationQualification[] => getLocalStorage(COMBINATION_QUALIFICATIONS_KEY);

export const getQualificationsForCourse = (courseId: string): CombinationQualification[] => {
    return getCombinationQualifications().filter(q => q.courseId === courseId);
};

export const linkCombinationToCourse = (data: Omit<CombinationQualification, 'id'>): CombinationQualification => {
    const list = getCombinationQualifications();
    // Check for duplicate link
    const exists = list.some(q => q.combinationId === data.combinationId && q.courseId === data.courseId);
    if (exists) throw new Error("This combination is already linked to this course.");

    const newItem: CombinationQualification = { ...data, id: `link_${Date.now()}` };
    list.push(newItem);
    setLocalStorage(COMBINATION_QUALIFICATIONS_KEY, list);
    return newItem;
};

export const updateQualification = (id: string, data: Partial<CombinationQualification>): CombinationQualification => {
    const list = getCombinationQualifications();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Qualification link not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(COMBINATION_QUALIFICATIONS_KEY, list);
    return list[index];
};

export const unlinkCombinationFromCourse = (id: string): void => {
    const list = getCombinationQualifications().filter(i => i.id !== id);
    setLocalStorage(COMBINATION_QUALIFICATIONS_KEY, list);
};

// ==========================================
// 8. CAREERS
// ==========================================

export const getCareers = (): Career[] => getLocalStorage(CAREERS_KEY);

export const addCareer = (data: Omit<Career, 'id'>): Career => {
    const list = getCareers();
    const newItem: Career = { ...data, id: `car_${Date.now()}` };
    list.push(newItem);
    setLocalStorage(CAREERS_KEY, list);
    return newItem;
};

export const updateCareer = (id: string, data: Partial<Career>): Career => {
    const list = getCareers();
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Career not found');
    
    list[index] = { ...list[index], ...data };
    setLocalStorage(CAREERS_KEY, list);
    return list[index];
};

export const deleteCareer = (id: string): void => {
    const list = getCareers().filter(i => i.id !== id);
    setLocalStorage(CAREERS_KEY, list);
};

// ==========================================
// STUDENT-FACING LOGIC
// ==========================================

export const checkQualification = (selectedSubjectIds: string[]): Course[] => {
    const allCourses = getCourses();
    const allRequirements = getRequirements();
    const selectedIdsSet = new Set(selectedSubjectIds);

    return allCourses.filter(course => {
        const essentialReqs = allRequirements.filter(r => r.courseId === course.id && r.requirementType === 'Essential');
        // If there are no essential requirements, the student qualifies by default.
        if (essentialReqs.length === 0) {
            return true;
        }
        // The student must have ALL of the essential subjects.
        return essentialReqs.every(req => selectedIdsSet.has(req.subjectId));
    });
};

export const getUniversityForCourse = (courseId: string): University | null => {
    const course = getCourses().find(c => c.id === courseId);
    if (!course) return null;
    const faculty = getFaculties().find(f => f.id === course.facultyId);
    if (!faculty) return null;
    const university = getUniversities().find(u => u.id === faculty.universityId);
    return university || null;
};

export const getFacultyForCourse = (courseId: string): Faculty | null => {
    const course = getCourses().find(c => c.id === courseId);
    if (!course) return null;
    const faculty = getFaculties().find(f => f.id === course.facultyId);
    return faculty || null;
};

export const getCourseWithDetails = (courseId: string) => {
    const course = getCourses().find(c => c.id === courseId);
    if (!course) return null;

    const allSubjects = getSubjects();
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    const requirements = getRequirementsForCourse(courseId).map(req => ({
        ...req,
        subjectName: subjectMap.get(req.subjectId)?.name || 'Unknown Subject'
    })).sort((a, b) => {
        const order = { 'Essential': 1, 'Relevant': 2, 'Desirable': 3 };
        return order[a.requirementType] - order[b.requirementType];
    });

    return { ...course, requirements };
};

export const getCareerWithDetails = (careerId: string) => {
    const career = getCareers().find(c => c.id === careerId);
    if (!career) return null;
    
    const allSubjects = getSubjects();
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    const allCourses = getCourses();
    const courseMap = new Map(allCourses.map(c => [c.id, c]));

    const keySubjects = career.keySubjects.map(id => subjectMap.get(id)).filter((s): s is MiSubject => !!s);
    const relatedCourses = career.relatedCourses.map(id => courseMap.get(id)).filter((c): c is Course => !!c);

    return { ...career, keySubjects, relatedCourses };
};

export const getCombinationWithSubjectDetails = (combinationId: string) => {
    const combination = getCombinations().find(c => c.id === combinationId);
    if (!combination) return null;
    
    const allSubjects = getSubjects();
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    
    const subjects = combination.subjectIds.map(id => subjectMap.get(id)).filter((s): s is MiSubject => !!s);
    
    return { ...combination, subjects };
};

// ==========================================
// SEEDING
// ==========================================

export const seedMyInstituteData = () => {
    if (getUniversities().length > 0) return;
    
    console.log("Seeding My Institute Data...");
    
    // 1. Universities
    const mak = addUniversity({
        name: 'Makerere University',
        shortName: 'MAK',
        category: 'Public',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Makerere_University_Logo.svg/1200px-Makerere_University_Logo.svg.png',
        location: 'Kampala',
        description: 'Uganda’s oldest and premier university.',
        website: 'https://mak.ac.ug',
        contactEmail: 'info@mak.ac.ug',
        contactPhone: '+256 414 542803'
    });

    // 2. Faculties
    const facComputing = addFaculty({
        universityId: mak.id,
        name: 'College of Computing and Information Sciences',
        description: 'A leader in computing research and education.'
    });

    // 3. Subjects
    const subMath = addSubject({ name: 'Mathematics', level: 'A-Level', description: 'Core mathematics', importanceNotes: 'Essential for engineering and CS' });
    const subPhy = addSubject({ name: 'Physics', level: 'A-Level', description: 'Study of matter', importanceNotes: 'Essential for engineering' });
    const subChem = addSubject({ name: 'Chemistry', level: 'A-Level', description: 'Study of substances', importanceNotes: 'Essential for medicine' });
    
    // 4. Courses
    const courseCS = addCourse({
        facultyId: facComputing.id,
        courseName: 'Bachelor of Science in Computer Science',
        courseCode: 'CSC',
        duration: '3 Years',
        award: 'Bachelor',
        description: 'Foundational CS degree.',
        careerPaths: ['Software Engineer', 'Data Scientist'],
        tuitionFee: 2500000
    });

    // 5. Requirements
    addRequirement({
        courseId: courseCS.id,
        subjectId: subMath.id,
        requirementType: 'Essential',
        minimumGrade: 'C'
    });

    // 6. Combinations
    const pcmComb = addCombination({
        combinationName: 'PCM',
        subjectIds: [subMath.id, subPhy.id, subChem.id],
        description: 'Physics, Chemistry, Mathematics'
    });
    
    // 7. Link Combination
    linkCombinationToCourse({
        combinationId: pcmComb.id,
        courseId: courseCS.id,
        weight: 3,
        notes: 'Highly recommended'
    });

    // 8. Careers
    addCareer({
        careerName: 'Software Engineer',
        description: 'Develops software applications.',
        relatedCourses: [courseCS.id],
        keySubjects: [subMath.id]
    });

    console.log("My Institute Data Seeded.");
};