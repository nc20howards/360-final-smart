import React, { useState, useEffect } from 'react';
import * as miService from '../services/myInstituteService';
import { University, Faculty, Course, Career, MiSubject } from '../types';
import ConfirmationModal from './ConfirmationModal';

const MyInstituteAdminPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'universities' | 'careers' | 'subjects'>('universities');
    const [universities, setUniversities] = useState<University[]>([]);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [careers, setCareers] = useState<Career[]>([]);
    const [subjects, setSubjects] = useState<MiSubject[]>([]);

    // Selection State for Drill-down
    const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
    const [selectedFacId, setSelectedFacId] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'add_uni' | 'add_fac' | 'add_course' | 'add_career' | 'add_subject' | null>(null);
    const [formData, setFormData] = useState<any>({});
    
    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<{id: string, type: string} | null>(null);

    useEffect(() => {
        refreshAll();
    }, []);

    const refreshAll = () => {
        setUniversities(miService.getUniversities());
        setFaculties(miService.getFaculties());
        setCourses(miService.getCourses());
        setCareers(miService.getCareers());
        setSubjects(miService.getSubjects());
    };

    const handleSave = () => {
        if (modalType === 'add_uni') {
            miService.addUniversity(formData);
        } else if (modalType === 'add_fac') {
            miService.addFaculty({ ...formData, universityId: selectedUniId });
        } else if (modalType === 'add_course') {
            miService.addCourse({ ...formData, facultyId: selectedFacId, careerPaths: [] });
        } else if (modalType === 'add_career') {
            miService.addCareer({ ...formData, relatedCourses: [], keySubjects: [] });
        } else if (modalType === 'add_subject') {
            miService.addSubject(formData);
        }
        refreshAll();
        setIsModalOpen(false);
        setFormData({});
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        if (deleteTarget.type === 'uni') miService.deleteUniversity(deleteTarget.id);
        if (deleteTarget.type === 'fac') miService.deleteFaculty(deleteTarget.id);
        if (deleteTarget.type === 'course') miService.deleteCourse(deleteTarget.id);
        if (deleteTarget.type === 'career') miService.deleteCareer(deleteTarget.id);
        if (deleteTarget.type === 'subject') miService.deleteSubject(deleteTarget.id);
        
        setDeleteTarget(null);
        refreshAll();
    };

    // --- Renderers ---

    const renderUniversities = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Universities</h3>
                <button onClick={() => { setModalType('add_uni'); setIsModalOpen(true); }} className="px-4 py-2 bg-cyan-600 rounded">Add University</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {universities.map(u => (
                    <div key={u.id} onClick={() => { setSelectedUniId(u.id); setSelectedFacId(null); }} className={`p-4 rounded-lg cursor-pointer border ${selectedUniId === u.id ? 'bg-cyan-900 border-cyan-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                        <div className="flex items-center gap-3">
                            <img src={u.logoUrl} className="w-12 h-12 rounded bg-white p-1" alt={u.shortName} />
                            <div>
                                <p className="font-bold text-white">{u.shortName}</p>
                                <p className="text-xs text-gray-400">{u.category}</p>
                            </div>
                        </div>
                         <div className="mt-2 flex justify-end">
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({id: u.id, type: 'uni'}); }} className="text-red-400 text-xs hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedUniId && (
                <div className="mt-8 pt-8 border-t border-gray-700 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Faculties for {universities.find(u => u.id === selectedUniId)?.shortName}</h3>
                        <button onClick={() => { setModalType('add_fac'); setIsModalOpen(true); }} className="px-3 py-1 bg-gray-600 rounded text-sm">Add Faculty</button>
                    </div>
                    <div className="space-y-2">
                        {faculties.filter(f => f.universityId === selectedUniId).map(f => (
                            <div key={f.id} onClick={() => setSelectedFacId(f.id)} className={`p-3 rounded flex justify-between items-center cursor-pointer ${selectedFacId === f.id ? 'bg-cyan-800' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                <span>{f.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({id: f.id, type: 'fac'}); }} className="text-red-400 text-xs">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedFacId && (
                <div className="mt-8 pt-8 border-t border-gray-700 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Courses</h3>
                        <button onClick={() => { setModalType('add_course'); setIsModalOpen(true); }} className="px-3 py-1 bg-gray-600 rounded text-sm">Add Course</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {courses.filter(c => c.facultyId === selectedFacId).map(c => (
                            <div key={c.id} className="bg-gray-700 p-4 rounded relative">
                                <p className="font-bold text-cyan-400">{c.courseCode}</p>
                                <p className="text-white">{c.courseName}</p>
                                <p className="text-xs text-gray-400">{c.award} - {c.duration}</p>
                                {c.tuitionFee && <p className="text-sm font-bold text-green-400 mt-1">UGX {c.tuitionFee.toLocaleString()}</p>}
                                <button onClick={() => setDeleteTarget({id: c.id, type: 'course'})} className="absolute top-2 right-2 text-red-400 hover:text-red-300">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderCareers = () => (
        <div className="space-y-4">
            <div className="flex justify-between">
                <h3 className="text-xl font-bold">Careers</h3>
                <button onClick={() => { setModalType('add_career'); setIsModalOpen(true); }} className="px-4 py-2 bg-cyan-600 rounded">Add Career</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {careers.map(c => (
                    <div key={c.id} className="bg-gray-800 p-4 rounded shadow relative group">
                        <h4 className="font-bold text-white">{c.careerName}</h4>
                        <p className="text-sm text-gray-400 mt-2">{c.description}</p>
                        <button onClick={() => setDeleteTarget({id: c.id, type: 'career'})} className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100">Delete</button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSubjects = () => (
        <div className="space-y-4">
             <div className="flex justify-between">
                <h3 className="text-xl font-bold">Subjects</h3>
                <button onClick={() => { setModalType('add_subject'); setIsModalOpen(true); }} className="px-4 py-2 bg-cyan-600 rounded">Add Subject</button>
            </div>
            <table className="w-full text-left bg-gray-800 rounded overflow-hidden">
                <thead className="bg-gray-700 text-gray-400">
                    <tr><th className="p-3">Name</th><th className="p-3">Level</th><th className="p-3">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {subjects.map(s => (
                        <tr key={s.id}>
                            <td className="p-3">{s.name}</td>
                            <td className="p-3">{s.level}</td>
                            <td className="p-3"><button onClick={() => setDeleteTarget({id: s.id, type: 'subject'})} className="text-red-400">Delete</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {deleteTarget && <ConfirmationModal isOpen={true} title="Confirm Delete" message="Are you sure? This might delete related data." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmButtonVariant="danger"/>}
            
            {/* Simple Modal for Forms */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 p-6 rounded w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold">Add New Item</h3>
                        {modalType === 'add_uni' && (
                            <>
                                <input placeholder="Name" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, name: e.target.value})}/>
                                <input placeholder="Short Name (e.g. MAK)" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, shortName: e.target.value})}/>
                                <select className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, category: e.target.value})}>
                                    <option value="Public">Public</option><option value="Private">Private</option>
                                </select>
                                <input placeholder="Logo URL" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, logoUrl: e.target.value})}/>
                            </>
                        )}
                        {modalType === 'add_fac' && <input placeholder="Faculty Name" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, name: e.target.value})}/>}
                        {modalType === 'add_course' && (
                            <>
                                <input placeholder="Course Name" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, courseName: e.target.value})}/>
                                <input placeholder="Code (e.g. CSC)" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, courseCode: e.target.value})}/>
                                <input placeholder="Duration" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, duration: e.target.value})}/>
                                <input type="number" placeholder="Tuition Fee (UGX)" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, tuitionFee: Number(e.target.value)})}/>
                                <select className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, award: e.target.value})}>
                                    <option value="Bachelor">Bachelor</option><option value="Diploma">Diploma</option><option value="Certificate">Certificate</option>
                                </select>
                                <textarea placeholder="Description" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, description: e.target.value})} />
                            </>
                        )}
                        {modalType === 'add_career' && (
                            <>
                                <input placeholder="Career Name" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, careerName: e.target.value})}/>
                                <textarea placeholder="Description" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, description: e.target.value})}/>
                            </>
                        )}
                         {modalType === 'add_subject' && (
                            <>
                                <input placeholder="Subject Name" className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, name: e.target.value})}/>
                                <select className="w-full p-2 bg-gray-700 rounded" onChange={e => setFormData({...formData, level: e.target.value})}>
                                    <option value="O-Level">O-Level</option><option value="A-Level">A-Level</option>
                                </select>
                            </>
                        )}

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 rounded">Save</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-6">
                <h2 className="text-3xl font-bold text-white">My Institute Management</h2>
                <p className="text-gray-400">Manage universities, courses, and career guidance data.</p>
            </header>

            <div className="flex gap-2 mb-6 border-b border-gray-700">
                <button onClick={() => setActiveTab('universities')} className={`px-4 py-2 border-b-2 ${activeTab === 'universities' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400'}`}>Institutions & Courses</button>
                <button onClick={() => setActiveTab('careers')} className={`px-4 py-2 border-b-2 ${activeTab === 'careers' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400'}`}>Careers</button>
                <button onClick={() => setActiveTab('subjects')} className={`px-4 py-2 border-b-2 ${activeTab === 'subjects' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400'}`}>Subjects</button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'universities' && renderUniversities()}
                {activeTab === 'careers' && renderCareers()}
                {activeTab === 'subjects' && renderSubjects()}
            </div>
        </div>
    );
};

export default MyInstituteAdminPage;
