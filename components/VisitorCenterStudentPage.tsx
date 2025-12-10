// components/VisitorCenterStudentPage.tsx
import React, { useState, useEffect } from 'react';
import { User, School, Appointment, AppointmentStatus } from '../types';
import * as visitorService from '../services/visitorService';
import * as studentService from '../services/studentService';
import { AppointmentIcon, SearchUserIcon } from './Icons';
import UserAvatar from './UserAvatar';

interface VisitorCenterStudentPageProps {
    user: User;
    school: School;
}

const VisitorCenterStudentPage: React.FC<VisitorCenterStudentPageProps> = ({ user, school }) => {
    const [activeTab, setActiveTab] = useState<'appointments' | 'history'>('appointments');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [staffMembers, setStaffMembers] = useState<User[]>([]);

    // Form state
    const [visitorName, setVisitorName] = useState('');
    const [hostUserId, setHostUserId] = useState('');
    const [reason, setReason] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        setAppointments(visitorService.getAppointmentsCreatedBy(user.studentId));
        const allUsers = studentService.getSchoolUsersBySchoolIds([school.id]);
        const staff = allUsers.filter(u => u.role !== 'student' && u.role !== 'parent' && u.role !== 'old_student' && u.role !== 'carrier');
        setStaffMembers(staff);
    }, [user.studentId, school.id]);
    
    const showFeedback = (message: string, isSuccess: boolean) => {
        if(isSuccess) {
            setSuccess(message);
            setTimeout(() => setSuccess(''), 4000);
        } else {
            setError(message);
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleSubmitAppointment = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!visitorName || !hostUserId || !reason || !scheduledTime) {
            setError("All fields are required.");
            return;
        }
        
        const host = staffMembers.find(s => s.studentId === hostUserId);
        if (!host) {
            setError("Selected staff member not found.");
            return;
        }

        try {
            visitorService.scheduleAppointment({
                schoolId: school.id,
                hostUserId,
                hostName: host.name,
                hostRole: host.role,
                visitorName,
                reason,
                scheduledTime: new Date(scheduledTime).getTime(),
                createdBy: user.studentId
            });
            showFeedback("Appointment requested successfully!", true);
            // Reset form
            setVisitorName(''); setHostUserId(''); setReason(''); setScheduledTime('');
            // Refresh list
            setAppointments(visitorService.getAppointmentsCreatedBy(user.studentId));
        } catch (err) {
            showFeedback((err as Error).message, false);
        }
    };
    
    const handleCancelAppointment = (id: string) => {
        if (window.confirm("Are you sure you want to cancel this appointment request?")) {
            try {
                visitorService.cancelAppointment(id, user.studentId);
                showFeedback("Appointment cancelled.", true);
                setAppointments(visitorService.getAppointmentsCreatedBy(user.studentId));
            } catch (err) {
                showFeedback((err as Error).message, false);
            }
        }
    };

    const getStatusChip = (status: AppointmentStatus) => {
        switch (status) {
            case AppointmentStatus.PENDING: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300">Pending</span>;
            case AppointmentStatus.CONFIRMED: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">Confirmed</span>;
            case AppointmentStatus.REJECTED: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300">Rejected</span>;
            case AppointmentStatus.COMPLETED: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-500/20 text-gray-300">Completed</span>;
            default: return null;
        }
    };

    const renderAppointmentsTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Book an Appointment</h3>
                {error && <div className="bg-red-500/20 text-red-300 p-2 rounded mb-4 text-sm">{error}</div>}
                {success && <div className="bg-green-500/20 text-green-300 p-2 rounded mb-4 text-sm">{success}</div>}
                <form onSubmit={handleSubmitAppointment} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-400">Visitor's Full Name</label>
                        <input value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400">Staff Member to Visit</label>
                        <select value={hostUserId} onChange={e => setHostUserId(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded">
                            <option value="">-- Select Staff --</option>
                            {staffMembers.map(staff => <option key={staff.studentId} value={staff.studentId}>{staff.name} ({staff.role.replace(/_/g, ' ')})</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400">Date & Time</label>
                        <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400">Reason for Visit</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full mt-1 p-2 bg-gray-700 rounded"/>
                    </div>
                    <button type="submit" className="w-full py-2 bg-cyan-600 rounded font-semibold">Request Appointment</button>
                </form>
            </div>
            <div className="lg:col-span-2">
                <h3 className="text-xl font-bold mb-4">Your Appointment Requests</h3>
                <div className="space-y-3">
                    {appointments.map(app => (
                        <div key={app.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg text-white">{app.visitorName}</p>
                                <p className="text-sm text-gray-300">To see: {app.hostName} ({app.hostRole.replace(/_/g, ' ')})</p>
                                <p className="text-xs text-gray-400 mt-1">{new Date(app.scheduledTime).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                {getStatusChip(app.status)}
                                {app.status === AppointmentStatus.PENDING && (
                                    <button onClick={() => handleCancelAppointment(app.id)} className="text-xs text-red-400 hover:underline mt-2">Cancel</button>
                                )}
                            </div>
                        </div>
                    ))}
                    {appointments.length === 0 && <p className="text-gray-400 text-center py-8">You have not booked any appointments.</p>}
                </div>
            </div>
        </div>
    );

    const renderHistoryTab = () => (
        <div className="text-center p-8 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-bold">Visitor History</h3>
            <p className="text-gray-400 mt-2">This feature is coming soon.</p>
        </div>
    );

    return (
        <div>
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6 max-w-sm">
                <button onClick={() => setActiveTab('appointments')} className={`w-full py-2 text-sm font-semibold rounded-md flex items-center justify-center gap-2 ${activeTab === 'appointments' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                    <AppointmentIcon/> Appointments
                </button>
                <button onClick={() => setActiveTab('history')} className={`w-full py-2 text-sm font-semibold rounded-md flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                    <SearchUserIcon/> History
                </button>
            </div>
            {activeTab === 'appointments' ? renderAppointmentsTab() : renderHistoryTab()}
        </div>
    );
};

export default VisitorCenterStudentPage;
