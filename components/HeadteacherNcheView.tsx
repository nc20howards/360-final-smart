import React, { useState, useMemo } from 'react';
import { User, School } from '../types';
import StudentNcheView from './StudentNcheView';

interface HeadteacherNcheViewProps {
    school: School;
    students: User[];
}

const isOLevelStudent = (className: string | undefined): boolean => {
    if (!className) return false;
    const normalized = className.toUpperCase().replace(/[\s.-]/g, ''); // S.1 -> S1
    return normalized.startsWith('S') && ['1', '2', '3', '4'].includes(normalized.substring(1));
};

const isALevelStudent = (className: string | undefined): boolean => {
    if (!className) return false;
    const normalized = className.toUpperCase().replace(/[\s.-]/g, '');
    return normalized.startsWith('S') && ['5', '6'].includes(normalized.substring(1));
};

const HeadteacherNcheView: React.FC<HeadteacherNcheViewProps> = ({ school, students }) => {
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const eligibleStudents = useMemo(() => {
        return students.filter(student =>
            (student.unebPassSlip || 
             (isOLevelStudent(student.class) && student.internalExams && student.internalExams.length > 0) ||
             (isALevelStudent(student.class) && student.internalExams && student.internalExams.length > 0)
            ) &&
            (student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             student.studentId.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, searchTerm]);

    if (selectedStudent) {
        return (
            <div>
                <button onClick={() => setSelectedStudent(null)} className="text-sm text-cyan-400 hover:underline mb-4">
                    &larr; Back to Student List
                </button>
                <StudentNcheView user={selectedStudent} />
            </div>
        );
    }

    return (
        <div>
            <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">NCHE Guidance Portal</h2>
                    <p className="text-gray-400 mt-1">Select a student to view their academic report and provide guidance.</p>
                </div>
            </header>

            <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                <div className="mb-4">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search for a student by name or ID..."
                        className="w-full max-w-lg px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                </div>

                {eligibleStudents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eligibleStudents.map(student => {
                             const guidanceType = student.unebPassSlip?.level === 'U.A.C.E' ? "A'Level Eligibility"
                                                : student.unebPassSlip?.level === 'U.C.E' ? "U.C.E. Guidance"
                                                : isALevelStudent(student.class) ? "A'Level Internal Guidance"
                                                : "O'Level Guidance";
                            return (
                                <button
                                    key={student.studentId}
                                    onClick={() => setSelectedStudent(student)}
                                    className="bg-gray-700 p-4 rounded-lg text-left hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <div className="flex items-center space-x-3">
                                        <img src={student.avatarUrl || `https://i.pravatar.cc/150?u=${student.studentId}`} alt={student.name} className="w-12 h-12 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-white">{student.name}</p>
                                            <p className="text-sm text-gray-400">ID: {student.studentId} | {student.class}</p>
                                            <span className="mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300">{guidanceType}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-400">No students with guidance reports were found.</p>
                        <p className="text-sm text-gray-500 mt-2">This includes students with U.A.C.E./U.C.E. results and S.1-S.6 students with uploaded internal results.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeadteacherNcheView;