import React, { useState, useEffect, useMemo } from 'react';
import { User, HigherEducationInstitution, Program, OLevelGuidance, UnebPassSlip } from '../types';
import * as ncheService from '../services/ncheService';

const StarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
const AcademicCapIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /></svg>;
const BuildingLibraryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm3 2a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 100 2h6a1 1 0 100-2H6zm1 4a1 1 0 110-2h6a1 1 0 110 2H7z" clipRule="evenodd" /></svg>;
const BriefcaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2zm-2 4V4a1 1 0 112 0v2h2V4a3 3 0 10-6 0v2h2z" clipRule="evenodd" /></svg>;
const CashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.196.567-.267v1.698a2.5 2.5 0 004 0V7.151c.22.071.408.164.567.267C13.863 7.84 14.25 8.354 14.25 9c0 .646-.387 1.16-1.25 1.582V11a2.5 2.5 0 01-4 0v-.418C8.387 10.16 8 9.646 8 9c0-.646.387-1.16 1.25-1.582h-.817z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.766 1.824 2.272a4.535 4.535 0 011.676.662V13a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C15.398 11.766 16 11.009 16 10c0-.99-.602-1.766-1.824-2.272a4.535 4.535 0 00-1.676-.662V5z" clipRule="evenodd" /></svg>;

const isOLevelStudent = (className: string | undefined): boolean => {
    if (!className) return false;
    const normalized = className.toUpperCase().replace(/[\s.-]/g, '');
    return normalized.startsWith('S') && ['1', '2', '3', '4'].includes(normalized.substring(1));
};

const isALevelStudent = (className: string | undefined): boolean => {
    if (!className) return false;
    const normalized = className.toUpperCase().replace(/[\s.-]/g, '');
    return normalized.startsWith('S') && ['5', '6'].includes(normalized.substring(1));
};

// --- O'Level & U.C.E. Guidance View ---
const OLevelGuidanceView: React.FC<{ guidance: OLevelGuidance | null, title: string, subtitle: string }> = ({ guidance, title, subtitle }) => {
    if (!guidance) {
        return <div>Loading guidance...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-2xl font-bold text-white mb-4">{title}</h3>
                <p className="text-gray-400">{subtitle}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h4 className="flex items-center gap-2 font-bold text-xl text-cyan-400 mb-4"><StarIcon/> Top Performing Subjects</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {guidance.topSubjects.map(sub => (
                        <div key={sub.name} className="bg-gray-700 p-3 rounded-md text-center">
                            <p className="font-semibold">{sub.name}</p>
                            <p className="text-lg font-bold text-green-400">{'score' in sub ? `${sub.score}%` : sub.grade}</p>
                        </div>
                    ))}
                </div>
                {guidance.topSubjects.length === 0 && <p className="text-gray-400">No subjects met the top performance criteria.</p>}
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h4 className="flex items-center gap-2 font-bold text-xl text-cyan-400 mb-4"><AcademicCapIcon /> Potential A'Level Combinations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {guidance.combinationSuggestions.map(combo => (
                        <div key={combo.code} className="bg-gray-700 p-4 rounded-lg">
                            <h5 className="font-bold text-lg text-white">{combo.code} - {combo.name}</h5>
                            <p className="text-sm text-gray-400 mb-2">{combo.subjects.join(', ')}</p>
                            <p className="text-sm text-gray-300 mb-3">{combo.description}</p>
                            <p className="text-xs font-semibold text-gray-400">Leads to careers in: <span className="text-gray-300 font-normal">{combo.careerProspects.join(', ')}</span></p>
                        </div>
                    ))}
                </div>
                {guidance.combinationSuggestions.length === 0 && <p className="text-gray-400">No specific A'Level combinations could be suggested based on your top subjects.</p>}
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h4 className="flex items-center gap-2 font-bold text-xl text-cyan-400 mb-4"><BuildingLibraryIcon /> Possible Tertiary Programs After S.4</h4>
                <div className="space-y-3">
                    {guidance.tertiarySuggestions.map(prog => (
                        <div key={prog.id} className="bg-gray-700 p-4 rounded-lg">
                            <h5 className="font-bold text-lg text-white">{prog.name} ({prog.level})</h5>
                            <p className="text-sm text-gray-300">{prog.durationYears} Years</p>
                            {prog.requirements.uceRequirements && <p className="text-xs text-gray-400 mt-2"><strong>Requirement:</strong> {prog.requirements.uceRequirements}</p>}
                            {prog.estimatedFees && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><CashIcon /> Est. Fees: UGX {prog.estimatedFees.toLocaleString()}/year</p>}
                            {prog.careerProspects && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5"><BriefcaseIcon/> Careers: {prog.careerProspects.join(', ')}</p>}
                        </div>
                    ))}
                </div>
                {guidance.tertiarySuggestions.length === 0 && <p className="text-gray-400">No direct-entry tertiary programs match your current results.</p>}
            </div>
        </div>
    );
};

// --- A'Level (S.5-S.6) Internal Guidance View ---
const ALevelInternalGuidanceView: React.FC<{ guidance: any | null }> = ({ guidance }) => {
    const { performance, eligiblePrograms } = guidance;
    const institutions = ncheService.getAllInstitutions();

    const programsByInstitution = useMemo(() => {
        const grouped: Record<string, Program[]> = {};
        eligiblePrograms.forEach((prog: Program) => {
            if (!grouped[prog.institutionId]) grouped[prog.institutionId] = [];
            grouped[prog.institutionId].push(prog);
        });
        return grouped;
    }, [eligiblePrograms]);

    if (!performance) {
        return <div>Loading guidance...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-2xl font-bold text-white mb-2">A'Level Guidance Report (Based on Internal Exams)</h3>
                <p className="text-gray-400">This report analyzes your latest school exam results to project your university eligibility.</p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-xl grid grid-cols-3 gap-4 text-center">
                <div><p className="text-3xl font-bold text-cyan-400">{performance.totalPoints}</p><p className="text-gray-400">Projected Points</p></div>
                <div><p className="text-3xl font-bold text-cyan-400">{performance.principalPasses}</p><p className="text-gray-400">Principal Passes</p></div>
                <div><p className="text-3xl font-bold text-cyan-400">{performance.subsidiaryPasses}</p><p className="text-gray-400">Subsidiary Passes</p></div>
            </div>

            <div>
                <h4 className="flex items-center gap-2 font-bold text-xl text-cyan-400 mb-4"><AcademicCapIcon/> Potential University Programs</h4>
                {Object.entries(programsByInstitution).length === 0 ? (
                    <p className="text-gray-400 bg-gray-800 p-6 rounded-lg">Based on your current results, no specific university programs could be matched. Keep working hard!</p>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(programsByInstitution).map(([instId, programs]) => {
                            const institution = institutions.find(i => i.id === instId);
                            if (!institution) return null;
                            return (
                                <div key={instId} className="bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-4 mb-4"><img src={institution.logoUrl} alt={institution.name} className="w-12 h-12 rounded-full bg-white p-1" /><div><h3 className="text-xl font-bold text-white">{institution.name}</h3><p className="text-sm text-gray-400">{institution.ownership} {institution.type}</p></div></div>
                                    <div className="space-y-3">
                                        {(programs as Program[]).map(prog => (
                                            <div key={prog.id} className="bg-gray-700 p-4 rounded-lg">
                                                <p className="font-semibold text-cyan-400">{prog.name}</p>
                                                <p className="text-sm text-gray-300">{prog.faculty} - {prog.durationYears} Years</p>
                                                {prog.estimatedFees && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><CashIcon /> Est. Fees: UGX {prog.estimatedFees.toLocaleString()}/year</p>}
                                                {prog.careerProspects && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5"><BriefcaseIcon/> Careers: {prog.careerProspects.join(', ')}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main View Component ---
interface StudentNcheViewProps {
    user: User;
}

const StudentNcheView: React.FC<StudentNcheViewProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'eligibility' | 'explore'>('eligibility');
    const [eligiblePrograms, setEligiblePrograms] = useState<Program[]>([]);
    const [institutions, setInstitutions] = useState<HigherEducationInstitution[]>([]);
    const [allPrograms, setAllPrograms] = useState<Program[]>([]);
    const [selectedInstitution, setSelectedInstitution] = useState<HigherEducationInstitution | null>(null);

    // Memoize guidance calculations
    const oLevelGuidance = useMemo(() => {
        const latestResult = user.internalExams?.sort((a,b) => b.term.localeCompare(a.term))[0];
        if (latestResult) return ncheService.getOLevelGuidance(latestResult);
        return null;
    }, [user.internalExams]);

    const uceGuidance = useMemo(() => {
        if (user.unebPassSlip && user.unebPassSlip.level === 'U.C.E') {
            return ncheService.getUceGuidance(user.unebPassSlip);
        }
        return null;
    }, [user.unebPassSlip]);
    
    const isS5_S6 = isALevelStudent(user.class);
    const aLevelInternalGuidance = useMemo(() => {
        if (!isS5_S6) return null;
        const latestResult = user.internalExams?.sort((a,b) => b.term.localeCompare(a.term))[0];
        if (latestResult) return ncheService.getALevelGuidanceFromInternalExams(latestResult);
        return null;
    }, [user.internalExams, user.class, isS5_S6]);
    
    useEffect(() => {
        if (user.unebPassSlip && user.unebPassSlip.level === 'U.A.C.E') {
            setEligiblePrograms(ncheService.findEligiblePrograms(user.unebPassSlip));
        }
        setInstitutions(ncheService.getAllInstitutions());
        setAllPrograms(ncheService.getAllPrograms());
    }, [user.unebPassSlip]);

    const programsByInstitution = useMemo(() => {
        const grouped: Record<string, Program[]> = {};
        eligiblePrograms.forEach(prog => {
            if (!grouped[prog.institutionId]) grouped[prog.institutionId] = [];
            grouped[prog.institutionId].push(prog);
        });
        return grouped;
    }, [eligiblePrograms]);
    
    const programsForSelectedInstitution = selectedInstitution ? allPrograms.filter(p => p.institutionId === selectedInstitution.id) : [];

    const renderEligibilityView = () => {
        if (isS5_S6) {
            if (!aLevelInternalGuidance) {
                 return (
                    <div className="text-center p-8 bg-gray-800 rounded-lg">
                        <h3 className="text-xl font-bold">Awaiting A'Level Results</h3>
                        <p className="text-gray-400 mt-2">Your university eligibility report will be generated once your teacher uploads your internal exam results.</p>
                    </div>
                );
            }
            return <ALevelInternalGuidanceView guidance={aLevelInternalGuidance} />;
        }
        
        if (isOLevelStudent(user.class)) {
            if (!oLevelGuidance) {
                 return (
                    <div className="text-center p-8 bg-gray-800 rounded-lg">
                        <h3 className="text-xl font-bold">Awaiting School Results</h3>
                        <p className="text-gray-400 mt-2">Your guidance report will be generated once your teacher uploads your termly exam results.</p>
                    </div>
                );
            }
            return <OLevelGuidanceView guidance={oLevelGuidance} title="Your O'Level Guidance Report" subtitle={`Based on your performance in ${user.internalExams?.sort((a,b) => b.term.localeCompare(a.term))[0].term}.`} />;
        }

        if (uceGuidance) {
             return <OLevelGuidanceView guidance={uceGuidance} title="Your U.C.E. Guidance Report" subtitle={`Based on your official ${uceGuidance.topSubjects.length > 0 ? uceGuidance.topSubjects[0].grade : ''} UNEB results.`} />;
        }

        if (!user.unebPassSlip || user.unebPassSlip.level !== 'U.A.C.E') {
            return (
                <div className="text-center p-8 bg-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold">Awaiting U.A.C.E Results</h3>
                    <p className="text-gray-400 mt-2">Program eligibility is calculated based on your official U.A.C.E results.</p>
                </div>
            );
        }
        if (eligiblePrograms.length === 0) {
            return (
                <div className="text-center p-8 bg-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold">No Eligible Programs Found</h3>
                    <p className="text-gray-400 mt-2">Based on your U.A.C.E results, no matching programs were found. Use the "Explore" tab to see all course requirements.</p>
                </div>
            );
        }

        return (
             <div className="space-y-6">
                {Object.entries(programsByInstitution).map(([instId, programs]) => {
                    const institution = institutions.find(i => i.id === instId);
                    if (!institution) return null;
                    return (
                        <div key={instId} className="bg-gray-800 p-4 rounded-lg">
                            <div className="flex items-center gap-4 mb-4"><img src={institution.logoUrl} alt={institution.name} className="w-12 h-12 rounded-full bg-white p-1" /><div><h3 className="text-xl font-bold text-white">{institution.name}</h3><p className="text-sm text-gray-400">{institution.ownership} {institution.type}</p></div></div>
                            <div className="space-y-3">
                                {(programs as Program[]).map(prog => (
                                    <div key={prog.id} className="bg-gray-700 p-4 rounded-lg">
                                        <p className="font-semibold text-cyan-400">{prog.name}</p>
                                        <p className="text-sm text-gray-300">{prog.faculty} - {prog.durationYears} Years</p>
                                        {prog.estimatedFees && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><CashIcon /> Est. Fees: UGX {prog.estimatedFees.toLocaleString()}/year</p>}
                                        {prog.careerProspects && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5"><BriefcaseIcon /> Careers: {prog.careerProspects.join(', ')}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderExploreView = () => {
        if (selectedInstitution) {
            return (
                <div>
                    <button onClick={() => setSelectedInstitution(null)} className="text-sm text-cyan-400 hover:underline mb-4">&larr; Back to all institutions</button>
                    <div className="flex items-center gap-4 mb-4"><img src={selectedInstitution.logoUrl} alt={selectedInstitution.name} className="w-16 h-16 rounded-full bg-white p-1" /><div><h3 className="text-2xl font-bold text-white">{selectedInstitution.name}</h3><p className="text-gray-400">{selectedInstitution.ownership} {selectedInstitution.type}</p></div></div>
                    <div className="space-y-3">
                        {programsForSelectedInstitution.map(prog => (
                            <div key={prog.id} className="bg-gray-800 p-4 rounded-lg"><p className="font-semibold text-cyan-400">{prog.name}</p><p className="text-sm text-gray-300">{prog.faculty} - {prog.level} ({prog.durationYears} Years)</p></div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {institutions.map(inst => (
                    <button key={inst.id} onClick={() => setSelectedInstitution(inst)} className="bg-gray-800 p-4 rounded-lg text-center hover:bg-gray-700 transition-colors"><img src={inst.logoUrl} alt={inst.name} className="w-20 h-20 rounded-full mx-auto bg-white p-1 mb-3" /><h4 className="font-bold text-white">{inst.name}</h4><p className="text-sm text-gray-400">{inst.acronym}</p></button>
                ))}
            </div>
        );
    };

    return (
        <div>
            <header className="mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-white">NCHE Portal</h2><p className="text-gray-400 mt-1">Explore higher education opportunities and guidance.</p></header>
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6"><button onClick={() => setActiveTab('eligibility')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'eligibility' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>My Guidance</button><button onClick={() => setActiveTab('explore')} className={`w-full py-2 text-sm font-semibold rounded-md ${activeTab === 'explore' ? 'bg-cyan-600' : 'hover:bg-gray-600'}`}>Explore Institutions</button></div>
            {activeTab === 'eligibility' ? renderEligibilityView() : renderExploreView()}
        </div>
    );
};

export default StudentNcheView;