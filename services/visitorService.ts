// services/visitorService.ts
import { Visitor, Appointment, AppointmentStatus } from '../types';
import { createBroadcastNotification } from './notificationService';
import { findUserById } from './groupService';

const VISITORS_KEY = '360_smart_school_visitors';
const APPOINTMENTS_KEY = '360_smart_school_appointments';

const getVisitorsData = (): Record<string, Visitor[]> => {
    const data = localStorage.getItem(VISITORS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveVisitorsData = (data: Record<string, Visitor[]>) => {
    localStorage.setItem(VISITORS_KEY, JSON.stringify(data));
};

const getAppointmentsData = (): Record<string, Appointment[]> => {
    const data = localStorage.getItem(APPOINTMENTS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveAppointmentsData = (data: Record<string, Appointment[]>) => {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(data));
};

export const getVisitors = (schoolId: string): Visitor[] => {
    const allData = getVisitorsData();
    return (allData[schoolId] || []).sort((a, b) => b.signInTime - a.signInTime);
};

export const addVisitor = (schoolId: string, data: Omit<Visitor, 'id' | 'schoolId' | 'signInTime' | 'signOutTime'>): Visitor => {
    const allData = getVisitorsData();
    if (!allData[schoolId]) {
        allData[schoolId] = [];
    }
    
    const newVisitor: Visitor = {
        ...data,
        id: `visitor_${Date.now()}`,
        schoolId,
        signInTime: Date.now(),
        signOutTime: null,
    };

    allData[schoolId].unshift(newVisitor);
    saveVisitorsData(allData);
    return newVisitor;
};

export const signOutVisitor = (visitorId: string, schoolId: string): void => {
    const allData = getVisitorsData();
    if (!allData[schoolId]) {
        throw new Error("No visitors found for this school.");
    }
    const visitorIndex = allData[schoolId].findIndex(v => v.id === visitorId);
    if (visitorIndex === -1) throw new Error("Visitor not found.");
    if (allData[schoolId][visitorIndex].signOutTime) return;
    allData[schoolId][visitorIndex].signOutTime = Date.now();
    saveVisitorsData(allData);
};

export const getAppointmentsForSchool = (schoolId: string): Appointment[] => {
    const allData = getAppointmentsData();
    return (allData[schoolId] || []).sort((a, b) => a.scheduledTime - b.scheduledTime);
};

export const getAppointmentsCreatedBy = (userId: string): Appointment[] => {
    const allAppointments: Appointment[] = Object.values(getAppointmentsData()).flat();
    return allAppointments.filter(app => app.createdBy === userId).sort((a, b) => b.scheduledTime - a.scheduledTime);
};

export const scheduleAppointment = (data: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Appointment => {
    const allData = getAppointmentsData();
    if (!allData[data.schoolId]) allData[data.schoolId] = [];

    const newAppointment: Appointment = {
        ...data,
        id: `appt_${Date.now()}`,
        createdAt: Date.now(),
        status: AppointmentStatus.PENDING,
    };

    allData[data.schoolId].unshift(newAppointment);
    saveAppointmentsData(allData);
    return newAppointment;
};

export const updateAppointmentStatus = (appointmentId: string, schoolId: string, status: AppointmentStatus.CONFIRMED | AppointmentStatus.REJECTED, adminName: string): void => {
    const allData = getAppointmentsData();
    if (!allData[schoolId]) throw new Error("School has no appointment data.");
    
    const appointmentIndex = allData[schoolId].findIndex(app => app.id === appointmentId);
    if (appointmentIndex === -1) throw new Error("Appointment not found.");
    
    const appointment = allData[schoolId][appointmentIndex];
    appointment.status = status;
    saveAppointmentsData(allData);

    const studentId = appointment.createdBy;
    const statusText = status === AppointmentStatus.CONFIRMED ? 'confirmed' : 'rejected';

    createBroadcastNotification(
        `Appointment ${statusText}`,
        `Your appointment with ${appointment.hostName} on ${new Date(appointment.scheduledTime).toLocaleDateString()} has been ${statusText} by ${adminName}.`,
        [studentId]
    );
};

export const cancelAppointment = (appointmentId: string, userId: string): void => {
    const allData = getAppointmentsData();
    let schoolIdOfAppointment: string | null = null;
    let appointmentIndex = -1;

    for (const schoolId in allData) {
        const index = allData[schoolId].findIndex(app => app.id === appointmentId);
        if (index > -1) {
            schoolIdOfAppointment = schoolId;
            appointmentIndex = index;
            break;
        }
    }

    if (!schoolIdOfAppointment || appointmentIndex === -1) throw new Error("Appointment not found.");
    
    const appointment = allData[schoolIdOfAppointment][appointmentIndex];
    if (appointment.createdBy !== userId) throw new Error("You can only cancel appointments you created.");
    if (appointment.status !== AppointmentStatus.PENDING && appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new Error("Only pending or confirmed appointments can be cancelled.");
    }

    appointment.status = AppointmentStatus.CANCELLED;
    allData[schoolIdOfAppointment][appointmentIndex] = appointment;
    saveAppointmentsData(allData);

    const cancellingUser = findUserById(userId);
    const cancellingUserName = cancellingUser ? cancellingUser.name : 'A student';
    
    createBroadcastNotification(
        'Appointment Cancelled',
        `${cancellingUserName} has cancelled their appointment scheduled for ${new Date(appointment.scheduledTime).toLocaleString()}.`,
        [appointment.hostUserId]
    );
};
