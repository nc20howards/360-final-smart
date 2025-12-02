import React, { useState, useEffect, useMemo } from 'react';
import * as miService from '../services/myInstituteService';
import * as apiService from '../services/apiService';
import { University, Faculty, Course, Career, MiSubject, SubjectCombination } from '../types';

const MyInstituteStudentPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'institutions' | 'qualifier' | 'careers'>('institutions');

    // Data states
    const [universities, setUniversities] = useState<University[]>([]);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [subjects, setSubjects] = useState<MiSubject[]>([]);
    const [careers, setCareers] = useState<Career[]>([]);
    const [combinations, setCombinations] = useState<SubjectCombination[]>([]);

    // UI State
    const [selectedUni, setSelectedUni] = useState<University | null>(null);
    const [expandedFaculties, setExpandedFaculties] = useState<Set<string>>(new Set());
    const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
    
    // Qualifier state
    const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
    const [qualifiedCourses, setQualifiedCourses] = useState<Course[]>([]);
    
    // AI state
    const [careerInterests, setCareerInterests] = useState('');
    const [isAISuggesting, setIsAISuggesting] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState('');
    
    useEffect(() => {
        setUniversities(miService.getUniversities());
        setFaculties(miService.getFaculties());
        setCourses(miService.getCourses());
        setSubjects(miService.getSubjects());
        setCareers(miService.getCareers());
        setCombinations(miService.getCombinations());
    }, []);

    const toggleFaculty = (facId: string) => {
        setExpandedFaculties(prev => {
            const newSet = new Set(prev);
            if (newSet.has(facId)) {
                newSet.delete(facId);
            } else {
                newSet.add(facId);
            }
            return newSet;
        });
    };

    const handleSubjectSelection = (subjectId: string) => {
        const newSet = new Set(selectedSubjects);
        if (newSet.has(subjectId)) {
            newSet.delete(subjectId);
        } else {
            newSet.add(subjectId);
        }
        setSelectedSubjects(newSet);
    };

    useEffect(() => {
        const qualified = miService.checkQualification(Array.from(selectedSubjects));
        setQualifiedCourses(qualified);
    }, [selectedSubjects]);

    const qualifiedCoursesByUni = useMemo(() => {
        const grouped: Record<string, { university: University, courses: Course[] }> = {};
        qualifiedCourses.forEach(course => {
            const university = miService.getUniversityForCourse(course.id);
            if (university) {
                if (!grouped[university.id]) {
                    grouped[university.id] = { university, courses: [] };
                }
                grouped[university.id].courses.push(course);
            }
        });
        return Object.values(grouped);
    }, [qualifiedCourses]);

    const handleGetAISuggestions = async () => {
        if (selectedSubjects.size === 0 && !careerInterests.trim()) {
            alert("Please select at least one subject or enter your career interests.");
            return;
        }
        setIsAISuggesting(true);
        setAiSuggestions('');
        try {
            const selectedSubjectNames = subjects.filter(s => selectedSubjects.has(s.id)).map(s => s.name);
            const allCourseNames = courses.map(c => c.courseName);
            const allUniversityNames = universities.map(u => u.name);
            
            const suggestions = await apiService.getAICourseSuggestions(selectedSubjectNames, careerInterests, allCourseNames, allUniversityNames);
            setAiSuggestions(suggestions);
        } catch (error) {
            setAiSuggestions("Sorry, I couldn't get AI suggestions. Please try again.");
        } finally {
            setIsAISuggesting(false);
        }
    };


    const renderCourseModal = () => {
        if (!viewingCourse) return null;
        const courseDetails = miService.getCourseWithDetails(viewingCourse.id);
        if (!courseDetails) return null;

        return (
            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" onClick={() => setViewingCourse(null)}>
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-2xl font-bold text-white">{courseDetails.courseName}</h3>
                            <p className="text-cyan-400">{courseDetails.award} - {courseDetails.duration}</p>
                        </div>
                        <button onClick={() => setViewingCourse(null)} className="text-2xl text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <div className="overflow-y-auto pr-2 space-y-4">
                        {courseDetails.tuitionFee && (
                            <div className="bg-green-500/10 p-4 rounded-lg text-center">
                                <p className="text-sm font-semibold text-green-300">Annual Tuition Fee</p>
                                <p className="text-3xl font-bold text-white">UGX {courseDetails.tuitionFee.toLocaleString()}</p>
                            </div>
                        )}
                        <p className="text-gray-300">{courseDetails.description}</p>
                        
                        {courseDetails.requirements.length > 0 && (
                             <div>
                                <h4 className="font-bold text-lg text-white mb-2">Requirements</h4>
                                <div className="space-y-2">
                                    {courseDetails.requirements.map(req => (
                                        <div key={req.id} className="p-2 bg-gray-700 rounded-md flex justify-between items-center text-sm">
                                            <span className="font-semibold text-gray-200">{req.subjectName}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${req.requirementType === 'Essential' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{req.requirementType}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderInstitutions = () => (
        <div className="animate-fade-in-up">
            {selectedUni ? (
                <div>
                    <button onClick={() => setSelectedUni(null)} className="text-sm text-cyan-400 hover:underline mb-4">&larr; Back to all universities</button>
                    <div className="flex items-center gap-4 mb-6">
                        <img src={selectedUni.logoUrl} alt={selectedUni.name} className="w-16 h-16 rounded-full bg-white p-1" />
                        <div>
                            <h3 className="text-2xl font-bold text-white">{selectedUni.name}</h3>
                            <p className="text-gray-400">{selectedUni.category} Institution</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {faculties.filter(f => f.universityId === selectedUni.id).map(faculty => (
                            <div key={faculty.id} className="bg-gray-800 rounded-lg">
                                <button onClick={() => toggleFaculty(faculty.id)} className="w-full text-left p-4 flex justify-between items-center">
                                    <h4 className="font-bold text-xl text-cyan-400">{faculty.name}</h4>
                                    <span>{expandedFaculties.has(faculty.id) ? '−' : '+'}</span>
                                </button>
                                {expandedFaculties.has(faculty.id) && (
                                    <div className="p-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {courses.filter(c => c.facultyId === faculty.id).map(course => (
                                            <button key={course.id} onClick={() => setViewingCourse(course)} className="text-left p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors">
                                                <p className="font-semibold text-white">{course.courseName}</p>
                                                <p className="text-xs text-gray-400">{course.award} - {course.duration}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {universities.map(uni => (
                        <button key={uni.id} onClick={() => setSelectedUni(uni)} className="bg-gray-800 p-6 rounded-lg text-center hover:bg-gray-700 transition-colors">
                            <img src={uni.logoUrl} alt={uni.name} className="w-20 h-20 rounded-full mx-auto bg-white p-1 mb-3" />
                            <h4 className="font-bold text-white">{uni.name}</h4>
                            <p className="text-sm text-gray-400">{uni.shortName}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderQualifier = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
            <div className="lg:col-span-1 bg-gray-800 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-4">Select Your A-Level Subjects</h3>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {subjects.filter(s => s.level !== 'O-Level').map(subject => (
                        <label key={subject.id} className="flex items-center gap-3 p-2 bg-gray-700 rounded-md cursor-pointer hover:bg-gray-600">
                            <input
                                type="checkbox"
                                checked={selectedSubjects.has(subject.id)}
                                onChange={() => handleSubjectSelection(subject.id)}
                                className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span>{subject.name}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-2 space-y-8">
                 <div>
                    <h3 className="font-bold text-lg mb-4 text-white">AI Course Advisor</h3>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-1">Your Career Interests (Optional)</label>
                        <input 
                            value={careerInterests} 
                            onChange={e => setCareerInterests(e.target.value)}
                            placeholder="e.g., 'building apps', 'healthcare', 'business'"
                            className="w-full bg-gray-700 rounded p-2 text-white mb-3"
                        />
                        <button onClick={handleGetAISuggestions} disabled={isAISuggesting} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold disabled:bg-gray-500">
                            {isAISuggesting ? 'Thinking...' : 'Get AI Suggestions'}
                        </button>
                        {aiSuggestions && (
                            <div className="mt-4 p-3 bg-gray-900/50 rounded-md border border-gray-700">
                                <p className="whitespace-pre-wrap text-sm text-gray-300">{aiSuggestions}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-4 text-white">Courses You Qualify For ({qualifiedCourses.length})</h3>
                    <p className="text-sm text-gray-400 mb-4">Based on 'Essential' subject requirements.</p>
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                        {qualifiedCoursesByUni.map(({ university, courses: qualified }) => (
                            <div key={university.id}>
                                <h4 className="font-semibold text-cyan-400 mb-2">{university.name}</h4>
                                <div className="space-y-2">
                                    {qualified.map(course => (
                                        <button key={course.id} onClick={() => setViewingCourse(course)} className="w-full text-left p-3 bg-gray-800 rounded-md hover:bg-gray-700">
                                            <p className="font-semibold text-white">{course.courseName}</p>
                                            <p className="text-xs text-gray-400">{course.award} - {course.duration}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {selectedSubjects.size > 0 && qualifiedCourses.length === 0 && <p className="text-gray-400 bg-gray-800 p-4 rounded-md">No courses match your selected subjects based on essential requirements.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
    
    const renderCareers = () => (
        <div className="space-y-4 animate-fade-in-up">
            {careers.map(career => {
                const careerDetails = miService.getCareerWithDetails(career.id);
                if (!careerDetails) return null;
                return (
                    <div key={career.id} className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="font-bold text-xl text-white">{careerDetails.careerName}</h3>
                        <p className="text-gray-400 text-sm mb-4">{careerDetails.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold text-cyan-400 text-sm mb-2">Key Subjects</h4>
                                <div className="flex flex-wrap gap-2">
                                    {careerDetails.keySubjects.map(sub => <span key={sub.id} className="px-2 py-1 bg-gray-700 text-xs rounded-full">{sub.name}</span>)}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-cyan-400 text-sm mb-2">Related Courses</h4>
                                <div className="space-y-1">
                                    {careerDetails.relatedCourses.map(course => <button onClick={() => setViewingCourse(course)} key={course.id} className="block text-left text-sm text-gray-300 hover:underline">{course.courseName}</button>)}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );

    return (
        <div className="space-y-8">
            {renderCourseModal()}
            <header>
                <h2 className="text-3xl font-bold text-white">My Institute</h2>
                <p className="text-gray-400 mt-1">Explore institutions, find courses you qualify for, and discover career paths.</p>
            </header>
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
                <button onClick={() => setActiveTab('institutions')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'institutions' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Institutions</button>
                <button onClick={() => setActiveTab('qualifier')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'qualifier' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Course Qualifier</button>
                <button onClick={() => setActiveTab('careers')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'careers' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Career Guide</button>
            </div>
            
            {activeTab === 'institutions' && renderInstitutions()}
            {activeTab === 'qualifier' && renderQualifier()}
            {activeTab === 'careers' && renderCareers()}
        </div>
    );
};

export default MyInstituteStudentPage;
