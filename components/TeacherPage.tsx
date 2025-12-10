
import React, { useState, useEffect, useRef } from 'react';
import { User, SchoolClass, Topic, InternalExamResult, School, Module } from '../types';
import ProfilePage from './ProfilePage';
import NotificationBell from './NotificationBell';
import { APP_TITLE, SUBJECT_LIST } from '../constants';
import * as classService from '../services/classService';
import * as studentService from '../services/studentService';
import * as topicService from '../services/topicService';
import UserAvatar from './UserAvatar';
import ConfirmationModal from './ConfirmationModal';
import { createBroadcastNotification } from '../services/notificationService';
import TeacherCalendarView from './TeacherCalendarView';
import { getAllSchools } from '../services/schoolService';
import { getHomePageContent } from '../services/homePageService';
import { getAllModules, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, NEWS_FEED_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME, VISITOR_CENTER_MODULE_NAME, KIOSK_MODE_MODULE_NAME, EXPLORATION_MODULE_NAME } from '../services/moduleService';

// --- Imports for Dynamic Modules ---
import { StudentAdmissionPortal } from './StudentPage';
import EWalletPage from './EWalletPage';
import SocialHubPage from './SocialHubPage';
import { OnlineFeedPage } from './OnlineFeedPage';
import ECanteenStudentPage from './ECanteenStudentPage';
import StudentNcheView from './StudentNcheView';
import EVoteStudentPage from './EVoteStudentPage';
import MyInstituteStudentPage from './MyInstituteStudentPage';
import KioskPage from './KioskPage';
import VisitorCenterStudentPage from './VisitorCenterStudentPage';
import { SmartIdCard, SmartIdCardFront, SmartIdCardBack } from './SmartIdCard';
import * as smartIdService from '../services/smartIdService';
import * as customIdTemplateService from '../services/customIdTemplateService';
import CustomSmartIdCard, { CustomSmartIdCardDownloadable } from './CustomSmartIdCard';


// --- SVG Icons ---
import { 
    DashboardIcon, ResultsIcon, TopicsIcon, AnnounceIcon, HamburgerIcon, CloseIcon, 
    EditIcon, DeleteIcon, UsersIcon, AcademicCapIcon, CalendarIcon, GradeBookIcon, LessonPlanIcon, SearchIcon,
    EWalletIcon, SmartAdmissionIcon, OnlineIcon, IdCardIcon, CanteenIcon, NcheIcon, NewsIcon, GenericModuleIcon, KioskIcon, MessagesIcon, VotingIcon
} from './Icons';


interface TeacherTask {
    id: string;
    text: string;
    completed: boolean;
}

// --- Dashboard View Sub-Component ---
const TeacherDashboardView: React.FC<{ user: User }> = ({ user }) => {
    const [tasks, setTasks] = useState<TeacherTask[]>([]);
    const [newTask, setNewTask] = useState('');
    const [taskToDelete, setTaskToDelete] = useState<TeacherTask | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem(`360_smart_school_teacher_tasks_${user.studentId}`);
        if (stored) setTasks(JSON.parse(stored));
    }, [user.studentId]);

    const saveTasks = (newTasks: TeacherTask[]) => {
        setTasks(newTasks);
        localStorage.setItem(`360_smart_school_teacher_tasks_${user.studentId}`, JSON.stringify(newTasks));
    };

    const handleAddTask = () => {
        if (!newTask.trim()) return;
        const task: TeacherTask = { id: Date.now().toString(), text: newTask.trim(), completed: false };
        saveTasks([...tasks, task]);
        setNewTask('');
    };

    const toggleTask = (id: string) => {
        saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const confirmDeleteTask = () => {
        if (taskToDelete) {
            saveTasks(tasks.filter(t => t.id !== taskToDelete.id));
            setTaskToDelete(null);
        }
    };

    const filteredTasks = tasks.filter(task => 
        task.text.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfirmationModal 
                isOpen={!!taskToDelete} 
                title="Delete Task" 
                message={<p>Are you sure you want to delete the task "{taskToDelete?.text}"?</p>} 
                onConfirm={confirmDeleteTask} 
                onCancel={() => setTaskToDelete(null)} 
                confirmButtonVariant="danger"
            />
            
            <div className="bg-gray-800 p-8 rounded-lg">
                <p className="text-xl">Welcome, {user.name}!</p>
                <p className="text-gray-400 mt-2">This is your dedicated portal. Use the sidebar to navigate through your available tools.</p>
            </div>

            {/* Task List Widget */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-bold text-white mb-4">My Tasks</h3>
                
                {/* Search Input */}
                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tasks..."
                        className="w-full pl-10 p-2 bg-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                    />
                </div>

                <div className="flex gap-2 mb-4">
                    <input 
                        value={newTask} 
                        onChange={e => setNewTask(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                        placeholder="Add a new task..." 
                        className="flex-grow p-2 bg-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                    />
                    <button onClick={handleAddTask} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">+</button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredTasks.map(task => (
                        <div key={task.id} className="flex justify-between items-center p-2 bg-gray-700/50 rounded-md group">
                            <label className="flex items-center space-x-3 cursor-pointer flex-grow">
                                <input 
                                    type="checkbox" 
                                    checked={task.completed} 
                                    onChange={() => toggleTask(task.id)} 
                                    className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                                />
                                <span className={`${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
                            </label>
                            <button 
                                onClick={() => setTaskToDelete(task)}
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                title="Delete Task"
                            >
                                <DeleteIcon />
                            </button>
                        </div>
                    ))}
                    {filteredTasks.length === 0 && searchQuery && <p className="text-gray-500 text-center text-sm">No tasks match your search.</p>}
                    {tasks.length === 0 && !searchQuery && <p className="text-gray-500 text-center text-sm">No tasks yet. Add one above!</p>}
                </div>
            </div>
        </div>
    );
};


// --- Announcements View Sub-Component ---
const TeacherAnnouncementsView: React.FC<{ user: User }> = ({ user }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const showFeedback = (msg: string) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(''), 4000);
    };

    const handleSendAnnouncement = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim() || !user.schoolId) return;

        setIsLoading(true);
        try {
            const schoolUsers = studentService.getSchoolUsersBySchoolIds([user.schoolId]);
            const studentIds = schoolUsers.filter(u => u.role === 'student').map(s => s.studentId);
            
            if (studentIds.length === 0) {
                showFeedback("There are no students in this school to send notifications to.");
                setIsLoading(false);
                return;
            }

            createBroadcastNotification(title, message, studentIds);

            showFeedback(`Announcement sent to ${studentIds.length} student(s).`);
            setTitle('');
            setMessage('');
        } catch (error) {
            showFeedback("Failed to send announcement.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Send Announcement</h2>
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl mx-auto">
                {feedback && <div className="bg-green-500/20 text-green-300 p-3 rounded-md mb-4 text-sm">{feedback}</div>}
                <form onSubmit={handleSendAnnouncement} className="space-y-4">
                    <div>
                        <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                        <input
                            id="announcement-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Upcoming Sports Day"
                            required
                            className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                        />
                    </div>
                    <div>
                        <label htmlFor="announcement-message" className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                        <textarea
                            id="announcement-message"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Enter the details of your announcement here..."
                            required
                            rows={5}
                            className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                        />
                    </div>
                    <div className="text-right">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending...' : 'Send to All Students'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Topics View Sub-Component ---
const TeacherTopicsView: React.FC<{ user: User }> = ({ user }) => {
    const [topics, setTopics] = useState<Topic[]>([]);
    const [newTopic, setNewTopic] = useState('');
    const [feedback, setFeedback] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ message: React.ReactNode; onConfirm: () => void; } | null>(null);

    useEffect(() => {
        if (user.schoolId) {
            const savedTopics = topicService.getTopicsForSchool(user.schoolId);
            setTopics(savedTopics);
        }
    }, [user.schoolId]);

    const showFeedback = (message: string) => {
        setFeedback(message);
        setTimeout(() => setFeedback(''), 4000);
    };
    
    const handleAddTopic = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTopic.trim() && user.schoolId) {
            try {
                topicService.addTopic(user.schoolId, newTopic.trim());
                setTopics(topicService.getTopicsForSchool(user.schoolId));
                showFeedback(`Topic "${newTopic.trim()}" added.`);
                setNewTopic('');
            } catch (error) {
                showFeedback((error as Error).message);
            }
        }
    };

    const handleDeleteTopic = (topicToDelete: Topic) => {
        setConfirmModal({
            message: `Are you sure you want to delete the topic "${topicToDelete.name}"?`,
            onConfirm: () => {
                if (user.schoolId) {
                    topicService.deleteTopic(topicToDelete.id, user.schoolId);
                    setTopics(topicService.getTopicsForSchool(user.schoolId));
                    showFeedback(`Topic "${topicToDelete.name}" deleted.`);
                }
                setConfirmModal(null);
            }
        });
    };

    return (
        <div>
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    title="Confirm Deletion"
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmButtonVariant="danger"
                    confirmText="Delete"
                />
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Manage Term Topics</h2>
            <div className="bg-gray-800 p-6 rounded-lg space-y-6 max-w-2xl mx-auto">
                <p className="text-gray-400 text-sm">
                    Enter the topics for this term. These will appear for students in the Exploration module.
                </p>

                {feedback && <div className="bg-green-500/20 text-green-300 p-3 rounded-md text-sm">{feedback}</div>}

                <form onSubmit={handleAddTopic} className="flex items-center gap-2">
                    <input
                        value={newTopic}
                        onChange={e => setNewTopic(e.target.value)}
                        placeholder="Enter a new topic and press Add"
                        className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                    />
                    <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold whitespace-nowrap">
                        + Add
                    </button>
                </form>

                <div className="border-t border-gray-700 pt-4">
                    <h3 className="font-semibold mb-2">Current Topics:</h3>
                    {topics.length > 0 ? (
                        <ul className="space-y-2">
                            {topics.map((topic) => (
                                <li key={topic.id} className="flex justify-between items-center p-2 bg-gray-700 rounded-md">
                                    <span>{topic.name}</span>
                                    <button
                                        onClick={() => handleDeleteTopic(topic)}
                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-full"
                                        title={`Delete ${topic.name}`}
                                    >
                                        <DeleteIcon />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-center py-4">No topics have been added for this term.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Grade Book View ---
const TeacherGradeBookView: React.FC<{ user: User }> = ({ user }) => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStream, setSelectedStream] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('Term 1, 2024'); // Example
    const [selectedSubject, setSelectedSubject] = useState('');
    
    const [students, setStudents] = useState<User[]>([]);
    const [grades, setGrades] = useState<Record<string, { score: number; remarks: string }>>({});
    
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        if (user.schoolId) {
            setClasses(classService.getClassesForSchool(user.schoolId));
        }
    }, [user.schoolId]);

    const selectedClass = classes.find(c => c.name === selectedClassId);

    const loadStudentsAndGrades = () => {
        if (selectedClassId && selectedSubject && selectedTerm && user.schoolId) {
            const classStudents = studentService.getSchoolUsersBySchoolIds([user.schoolId])
                .filter(u => u.class === selectedClassId && (selectedStream ? u.stream === selectedStream : true) && u.role === 'student');
            
            setStudents(classStudents);

            const initialGrades: Record<string, { score: number; remarks: string }> = {};
            classStudents.forEach(student => {
                const termResult = student.internalExams?.find(r => r.term === selectedTerm);
                const subjectPerf = termResult?.subjects.find(s => s.name === selectedSubject);
                initialGrades[student.studentId] = {
                    score: subjectPerf?.score ?? 0,
                    remarks: subjectPerf?.remarks ?? ''
                };
            });
            setGrades(initialGrades);
        } else {
            setStudents([]);
            setGrades({});
        }
    };
    
    useEffect(() => {
        loadStudentsAndGrades();
    }, [selectedClassId, selectedStream, selectedTerm, selectedSubject, user.schoolId]);

    const handleGradeChange = (studentId: string, field: 'score' | 'remarks', value: string | number) => {
        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { score: 0, remarks: '' }),
                [field]: field === 'score' ? Number(value) : value,
            },
        }));
    };

    const handleSave = () => {
        if (!user.schoolId || !selectedClassId || !selectedSubject || !selectedTerm) return;
        
        setIsLoading(true);
        setFeedback('');

        const gradesToSave = Object.entries(grades).map(([studentId, data]) => ({
            studentId,
            score: Number((data as any).score),
            remarks: (data as any).remarks
        }));

        try {
            studentService.saveGradesForSubject(user.schoolId, selectedClassId, selectedStream, selectedSubject, selectedTerm, gradesToSave);
            setFeedback('Grades saved successfully!');
            setTimeout(() => setFeedback(''), 3000);
        } catch (error) {
            setFeedback('Failed to save grades.');
        } finally {
            setIsLoading(false);
        }
    };

    const subjectsForClass = user.teachingAssignments?.[selectedClassId] || [];
    const availableSubjects = subjectsForClass.length > 0 ? subjectsForClass : SUBJECT_LIST;
    
    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Grade Book</h2>
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedStream(''); setSelectedSubject(''); }} className="p-2 bg-gray-700 rounded">
                        <option value="">-- Select Class --</option>
                        {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={selectedStream} onChange={e => setSelectedStream(e.target.value)} disabled={!selectedClass || selectedClass.streams.length === 0} className="p-2 bg-gray-700 rounded disabled:bg-gray-600">
                        <option value="">All Streams</option>
                        {selectedClass?.streams.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} placeholder="Term (e.g., Term 1, 2024)" className="p-2 bg-gray-700 rounded" />
                     <select 
                        value={selectedSubject} 
                        onChange={e => setSelectedSubject(e.target.value)} 
                        className="p-2 bg-gray-700 rounded disabled:bg-gray-600"
                        disabled={!selectedClassId}
                    >
                        <option value="">-- Select Subject --</option>
                        {availableSubjects.map(subject => (
                            <option key={subject} value={subject}>{subject}</option>
                        ))}
                    </select>
                </div>

                {students.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left">Student Name</th>
                                    <th className="px-4 py-2 text-left">Score (0-100)</th>
                                    <th className="px-4 py-2 text-left">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => (
                                    <tr key={student.studentId} className="border-b border-gray-700 last:border-b-0">
                                        <td className="px-4 py-2">{student.name}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={grades[student.studentId]?.score ?? ''}
                                                onChange={e => handleGradeChange(student.studentId, 'score', e.target.value)}
                                                className="w-24 p-1 bg-gray-600 rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={grades[student.studentId]?.remarks ?? ''}
                                                onChange={e => handleGradeChange(student.studentId, 'remarks', e.target.value)}
                                                className="w-full p-1 bg-gray-600 rounded"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-4 text-right">
                            {feedback && <span className="text-green-400 mr-4">{feedback}</span>}
                            <button onClick={handleSave} disabled={isLoading} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:bg-gray-500">
                                {isLoading ? 'Saving...' : 'Save Grades'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">Please select a class, term, and subject to enter grades.</p>
                )}
            </div>
        </div>
    );
};

interface TeacherPageProps {
    user: User;
    onLogout: () => void;
}

export const TeacherPage: React.FC<TeacherPageProps> = ({ user, onLogout }) => {
    const [view, setView] = useState<'dashboard' | 'grade_book' | 'topics' | 'announcements' | 'calendar' | 'my_teaching_load' | 'lesson_plan'>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [school, setSchool] = useState<School | null>(null);
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
    
    // Settings for ID Card Module
    const [idCardSettings, setIdCardSettings] = useState<any>(null);
    const [idCardTemplateType, setIdCardTemplateType] = useState<'default' | 'custom'>('default');


    useEffect(() => {
        if (user.schoolId) {
            const schoolData = getAllSchools().find(s => s.id === user.schoolId);
            if(schoolData) {
                setSchool(schoolData);
                const allModules = getAllModules();
                const publishedModules = schoolData.modules
                    .filter(m => {
                        const isPublished = m.status === 'published';
                        if (!isPublished) return false;
                        // Enforce role-based access control here too
                        const rolesAllowed = m.allowedRoles === undefined || m.allowedRoles.includes(user.role);
                        return rolesAllowed;
                    })
                    .map(m => allModules.find(mod => mod.id === m.moduleId))
                    .filter((m): m is Module => !!m);
                setAvailableModules(publishedModules);
                
                setIdCardSettings(smartIdService.getSmartIdSettings(schoolData.id));
                setIdCardTemplateType(smartIdService.getSmartIdSettings(schoolData.id).templateType);
            }
            setClasses(classService.getClassesForSchool(user.schoolId));
        }
    }, [user.schoolId, user.role]);

    const navItems = [
        { view: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
        { view: 'my_teaching_load', name: 'My Teaching Load', icon: <AcademicCapIcon /> },
        { view: 'grade_book', name: 'Grade Book', icon: <GradeBookIcon /> },
        { view: 'topics', name: 'Topics', icon: <TopicsIcon /> },
        { view: 'announcements', name: 'Announcements', icon: <AnnounceIcon /> },
        { view: 'calendar', name: 'Calendar', icon: <CalendarIcon /> },
        { view: 'lesson_plan', name: 'Lesson Plan', icon: <LessonPlanIcon /> },
    ];
    
    // Add dynamic modules to navigation
    const dynamicNavItems = availableModules.map(m => {
        let icon = <GenericModuleIcon />;
        if (m.name === SMART_ADMISSION_MODULE_NAME) icon = <SmartAdmissionIcon />;
        if (m.name === MESSAGE_MODULE_NAME) icon = <MessagesIcon />;
        if (m.name === E_WALLET_MODULE_NAME) icon = <EWalletIcon />;
        if (m.name === ONLINE_MODULE_NAME) icon = <OnlineIcon />;
        if (m.name === SMART_STUDENT_ID_MODULE_NAME) icon = <IdCardIcon />;
        if (m.name === E_CANTEEN_MODULE_NAME) icon = <CanteenIcon />;
        if (m.name === NCHE_MODULE_NAME) icon = <NcheIcon />;
        if (m.name === KIOSK_MODE_MODULE_NAME) icon = <KioskIcon />;
        if (m.name === NEWS_FEED_MODULE_NAME) icon = <NewsIcon />;
        if (m.name === E_VOTE_MODULE_NAME) icon = <VotingIcon />;
        
        return { view: m.id, name: m.name, icon };
    });
    
    const allNavItems = [...navItems, ...dynamicNavItems];

    const MyTeachingLoadView: React.FC<{ user: User, onUpdate: (updatedUser: User) => void }> = ({ user, onUpdate }) => {
        const [assignments, setAssignments] = useState(user.teachingAssignments || {});
        const [feedback, setFeedback] = useState('');
        const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
    
        useEffect(() => {
            if (user.schoolId) {
                setSchoolClasses(classService.getClassesForSchool(user.schoolId));
            }
        }, [user.schoolId]);
    
        const handleSubjectToggle = (className: string, subjectName: string) => {
            setAssignments(prev => {
                const currentSubjects = prev[className] || [];
                const newSubjects = currentSubjects.includes(subjectName)
                    ? currentSubjects.filter(s => s !== subjectName)
                    : [...currentSubjects, subjectName];
                return { ...prev, [className]: newSubjects };
            });
        };
    
        const handleSave = () => {
            const updatedUser = { ...user, teachingAssignments: assignments };
            studentService.updateSchoolUser(user.studentId, { teachingAssignments: assignments });
            onUpdate(updatedUser);
            setFeedback('Teaching load saved successfully!');
            setTimeout(() => setFeedback(''), 3000);
        };
    
        return (
             <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">My Teaching Load</h2>
                <div className="bg-gray-800 p-6 rounded-lg space-y-6 max-w-4xl mx-auto">
                    <p className="text-gray-400 text-sm">Select the subjects you teach for each class. This will filter the subject list in your Grade Book.</p>
                    {feedback && <div className="bg-green-500/20 text-green-300 p-3 rounded-md text-sm">{feedback}</div>}
                    <div className="space-y-6">
                        {schoolClasses.map(cls => (
                            <div key={cls.id} className="border-t border-gray-700 pt-4">
                                <h3 className="text-lg font-semibold text-white mb-3">{cls.name}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {SUBJECT_LIST.map(subject => (
                                        <label key={subject} className="flex items-center space-x-2 p-2 bg-gray-700 rounded-md cursor-pointer hover:bg-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={(assignments[cls.name] || []).includes(subject)}
                                                onChange={() => handleSubjectToggle(cls.name, subject)}
                                                className="form-checkbox h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 rounded"
                                            />
                                            <span className="text-sm">{subject}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right border-t border-gray-700 pt-4 mt-6">
                        <button onClick={handleSave} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">
                            Save Teaching Load
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderMainContent = () => {
        // First check if view is a dynamic module
        const activeModule = availableModules.find(m => m.id === view);
        if (activeModule && school) {
             switch (activeModule.name) {
                case KIOSK_MODE_MODULE_NAME:
                    return <KioskPage user={currentUser} school={school} />;
                case VISITOR_CENTER_MODULE_NAME:
                    return <VisitorCenterStudentPage user={currentUser} school={school} />;
                case SMART_ADMISSION_MODULE_NAME:
                    // Render admission portal but with ability to logout (as user props)
                     return <StudentAdmissionPortal 
                                user={currentUser} 
                                school={school} 
                                onBack={() => setView('dashboard')} 
                                onLogout={onLogout}
                           />;
                case E_WALLET_MODULE_NAME:
                    return <EWalletPage user={currentUser} />;
                case MESSAGE_MODULE_NAME:
                    return <SocialHubPage user={currentUser} onLogout={onLogout} />;
                case ONLINE_MODULE_NAME:
                case NEWS_FEED_MODULE_NAME:
                    return <OnlineFeedPage user={currentUser} onLogout={onLogout} onBackToDashboard={() => setView('dashboard')} />;
                case SMART_STUDENT_ID_MODULE_NAME:
                      return (
                        <div className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h2 className="text-2xl font-bold text-white mb-8">My Smart ID Card</h2>
                            <div className="transform scale-75 sm:scale-100 origin-top">
                                {idCardTemplateType === 'custom' && idCardSettings ? (
                                     <CustomSmartIdCardDownloadable user={currentUser} school={school} template={customIdTemplateService.getCustomIdTemplate(school.id)} />
                                ) : (
                                    <div className="space-y-8">
                                         <SmartIdCardFront user={currentUser} school={school} settings={idCardSettings || smartIdService.getSmartIdSettings(school.id)} />
                                         <SmartIdCardBack user={currentUser} school={school} settings={idCardSettings || smartIdService.getSmartIdSettings(school.id)} />
                                    </div>
                                )}
                            </div>
                        </div>
                     );
                case E_CANTEEN_MODULE_NAME:
                    return <ECanteenStudentPage school={school} user={currentUser} />;
                case NCHE_MODULE_NAME:
                    return <StudentNcheView user={currentUser} />;
                case E_VOTE_MODULE_NAME:
                    return <EVoteStudentPage user={currentUser} school={school} />;
                case MY_INSTITUTE_MODULE_NAME:
                    return <MyInstituteStudentPage />;
                case EXPLORATION_MODULE_NAME:
                    return <div className="p-8 text-center text-gray-400">Exploration content placeholder.</div>;
                default:
                    return <div className="p-8 text-center text-gray-400">Module "{activeModule.name}" loaded.</div>;
            }
        }

        switch (view) {
            case 'my_teaching_load':
                return <MyTeachingLoadView user={currentUser} onUpdate={setCurrentUser} />;
            case 'grade_book':
                return <TeacherGradeBookView user={currentUser} />;
            case 'topics':
                return <TeacherTopicsView user={user} />;
            case 'announcements':
                return <TeacherAnnouncementsView user={user} />;
            case 'calendar':
                return <TeacherCalendarView user={user} />;
            case 'lesson_plan':
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Lesson Plan</h2>
                        <div className="bg-gray-800 p-8 rounded-lg text-center">
                            <p className="text-gray-400">Lesson Plan feature coming soon.</p>
                        </div>
                    </div>
                );
            case 'dashboard':
            default:
                return <TeacherDashboardView user={currentUser} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
             {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as User);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                    classes={classes}
                />
            )}
             {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <aside className={`fixed inset-y-0 left-0 bg-gray-800 text-white transform ${isSidebarOpen ? 'translate-x-0 w-64 p-4' : '-translate-x-full w-64 p-4'} lg:sticky lg:translate-x-0 z-40 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'lg:w-20 lg:p-2' : 'lg:w-64 lg:p-4'}`}>
                 <div className="flex items-center justify-between mb-8 h-10">
                    <div className={`flex items-center space-x-3 overflow-hidden ${isSidebarCollapsed && 'lg:justify-center lg:w-full'}`}>
                        <AcademicCapIcon />
                        <h1 className={`text-xl font-bold text-cyan-400 truncate ${isSidebarCollapsed && 'lg:hidden'}`}>{APP_TITLE}</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded-md hover:bg-gray-700"><CloseIcon /></button>
                </div>
                 <nav className="space-y-2 flex-grow overflow-y-auto">
                    {allNavItems.map(item => (
                         <button
                            key={item.view}
                            onClick={() => {
                                setView(item.view);
                                setIsSidebarOpen(false);
                                setIsSidebarCollapsed(true);
                            }}
                            className={`w-full flex items-center space-x-3 p-3 rounded-md transition-colors ${isSidebarCollapsed && 'lg:justify-center'} ${view === item.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                            title={item.name}
                        >
                            {item.icon}
                            <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{item.name}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-800 border-l border-gray-700 shadow-md">
                     <div className="flex items-center space-x-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1"><HamburgerIcon /></button>
                        <button onClick={() => setIsSidebarCollapsed(prev => !prev)} className="hidden lg:block p-1"><HamburgerIcon /></button>
                    </div>
                     <div className="flex items-center space-x-4">
                        <NotificationBell userId={user.studentId} />
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"/>
                            <div>
                                <p className="font-semibold">{currentUser.name}</p>
                                <p className="text-sm text-gray-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <button onClick={onLogout} className="p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto border-l border-gray-700">
                    <div className="container mx-auto">
                        {renderMainContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};
