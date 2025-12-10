import React from 'react';
import { User, School, InternalExamResult } from '../types';
import { getHomePageContent } from '../services/homePageService';

interface ReportCardProps {
    user: User;
    school: School;
    result: InternalExamResult;
}

const ReportCard: React.FC<ReportCardProps> = ({ user, school, result }) => {
    // Data extraction and calculation
    const schoolInfo = getHomePageContent(school.id);
    const totalMarks = result.subjects.reduce((sum, sub) => sum + sub.score, 0);
    const averageMarks = result.average; // Already calculated
    const classPosition = result.classPosition.split(' ')[0] || 'N/A'; // e.g., "3rd" -> "3"
    
    // Parse year from term string like "Term 1, 2024"
    const year = result.term.match(/\d{4}/)?.[0] || new Date().getFullYear().toString();
    const term = result.term.split(',')[0] || 'N/A';
    
    // Placeholder for Division/Grade Level logic
    const getDivision = (avg: number) => {
        if (avg >= 75) return '1st Grade';
        if (avg >= 60) return '2nd Grade';
        if (avg >= 45) return '3rd Grade';
        return '4th Grade';
    };
    const division = getDivision(averageMarks);

    return (
        <div className="w-[794px] h-[1123px] bg-white text-gray-900 p-10 font-sans border border-gray-200 shadow-2xl relative overflow-hidden" id="report-card-content">
            
            {/* Background Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-10 pointer-events-none">
                <img src={schoolInfo.hero.logoUrl} alt={`${school.name} watermark`} className="w-[450px] h-[450px] object-contain" />
            </div>

            {/* Content Wrapper */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <header className="flex justify-between items-center mb-6 flex-shrink-0">
                    <img src={schoolInfo.hero.logoUrl} alt={`${school.name} logo`} className="w-24 h-24 object-contain" />
                    <div className="text-center">
                        <h1 className="text-5xl font-extrabold tracking-wider text-black">REPORT CARD</h1>
                        <h2 className="uppercase font-bold text-[20px] text-gray-800 mt-1 tracking-wide">{school.name.toUpperCase()}</h2>
                        <p className="text-sm italic text-gray-600 mt-1">"{schoolInfo.hero.subtitle}"</p>
                    </div>
                    <img src={user.avatarUrl || `https://picsum.photos/seed/${user.studentId}/150`} alt={user.name} className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300" />
                </header>

                {/* Student Info */}
                <section className="mb-6 text-base flex-shrink-0">
                    <div className="grid grid-cols-4 gap-x-6 gap-y-2">
                        <strong className="text-gray-600">StudentID</strong><span className="font-semibold col-span-1">{user.studentId}</span>
                        <strong className="text-gray-600">Gender</strong><span className="font-semibold col-span-1">Male</span> {/* Placeholder */}
                        
                        <strong className="text-gray-600">Name</strong><span className="font-semibold col-span-1">{user.name}</span>
                        <strong className="text-gray-600">Term</strong><span className="font-semibold col-span-1">{term}</span>
                        
                        <strong className="text-gray-600">Class</strong><span className="font-semibold col-span-1">{user.class}</span>
                        <strong className="text-gray-600">Year</strong><span className="font-semibold col-span-1">{year}</span>

                        <strong className="text-gray-600">Stream</strong><span className="font-semibold col-span-1">{user.stream || 'N/A'}</span>
                    </div>
                </section>

                {/* Academic Records Table */}
                <section className="flex-grow">
                    <table className="w-full border-collapse border border-gray-400">
                        <thead className="text-black">
                            <tr>
                                <th className="p-2 text-left border border-gray-400 font-semibold">Subject</th>
                                <th className="p-2 text-center border border-gray-400 font-semibold w-32">Score/Marks</th>
                                <th className="p-2 text-center border border-gray-400 font-semibold w-24">Grade</th>
                                <th className="p-2 text-left border border-gray-400 font-semibold">Teacher Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.subjects.map((subject, index) => (
                                <tr key={index} className="border-b border-gray-400">
                                    <td className="p-2 border-l border-r border-gray-400 font-medium">{subject.name}</td>
                                    <td className="p-2 text-center border-r border-gray-400">{subject.score}</td>
                                    <td className="p-2 text-center border-r border-gray-400 font-semibold">{subject.grade}</td>
                                    <td className="p-2 border-r border-gray-400 text-gray-700">{subject.remarks || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
                
                {/* Summary Section */}
                <section className="mt-4 mb-4 flex-shrink-0">
                     <div className="grid grid-cols-4 gap-x-6 gap-y-1 text-base">
                        <strong className="text-black">Total Marks</strong><span className="font-semibold col-span-1">{totalMarks}</span>
                        <strong className="text-black">Average Marks</strong><span className="font-semibold col-span-1">{averageMarks.toFixed(1)}</span>
                        <strong className="text-black col-start-1">Division/Grade Level</strong><span className="font-semibold col-span-1">{division}</span>
                        <strong className="text-black">Class Position</strong><span className="font-semibold col-span-1">{classPosition}</span>
                    </div>
                </section>

                {/* Behavioral/Extra Section */}
                <section className="mb-8 flex-shrink-0">
                     <table className="w-full border-collapse border border-gray-400">
                         <tbody>
                            <tr className="border-b border-gray-400">
                                <td className="p-2 border-r border-gray-400 font-semibold w-1/2">Attendance</td>
                                <td className="p-2 font-semibold w-1/2">Conduct/Discipline</td>
                            </tr>
                            <tr className="border-b border-gray-400 h-10">
                                <td className="p-2 border-r border-gray-400">Good</td>
                                <td className="p-2">Good</td>
                            </tr>
                            <tr className="border-b border-gray-400">
                                 <td className="p-2 border-r border-gray-400 font-semibold">CoCurricular Activity</td>
                                 <td className="p-2">Basketball</td>
                            </tr>
                            <tr className="h-10">
                                <td className="p-2 border-r border-gray-400 font-semibold">Overall Remarks</td>
                                 <td className="p-2">Satisfactory</td>
                            </tr>
                         </tbody>
                     </table>
                </section>

                {/* Footer Signatures */}
                <footer className="mt-auto pt-8 flex justify-between items-end text-sm flex-shrink-0">
                    <div className="w-1/3 text-center">
                        <div className="border-t-2 border-gray-400 pt-1">Class Teacher</div>
                    </div>
                     <div className="w-1/3 text-center">
                        <div className="border-t-2 border-gray-400 pt-1">Head Teacher</div>
                    </div>
                    <div className="w-1/3 text-center">
                        <div className="border-t-2 border-gray-400 pt-1">Parent/Guardian</div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ReportCard;