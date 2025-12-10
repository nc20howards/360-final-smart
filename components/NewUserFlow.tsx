import React, { useState } from 'react';
import { School, User, AdminUser } from '../types';
import SchoolSelectionPage from './SchoolSelectionPage';
import SchoolLandingPage from './SchoolLandingPage';
import { StudentAdmissionPortal } from './StudentPage';
import Auth from './Auth';
import ForcePasswordChange from './ForcePasswordChange';

interface NewUserFlowProps {
    onShowLogin: () => void;
    onLoginSuccess: (user: User | AdminUser) => void;
}

const NewUserFlow: React.FC<NewUserFlowProps> = ({ onShowLogin, onLoginSuccess }) => {
    type Step = 'select_school' | 'landing_page' | 'admission_portal' | 'temp_login' | 'temp_password_change';

    const [step, setStep] = useState<Step>('select_school');
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [tempCredentials, setTempCredentials] = useState<{ studentId: string; tempPass: string } | null>(null);
    const [tempUser, setTempUser] = useState<User | null>(null);

    const handleSchoolSelect = (school: School) => {
        setSelectedSchool(school);
        setStep('landing_page');
    };

    const handleShowAdmission = () => {
        setStep('admission_portal');
    };

    const handleAdmissionSuccess = (creds: { studentId: string; tempPass: string }) => {
        setTempCredentials(creds);
        setStep('temp_login');
    };

    const handleTempLoginSuccess = (user: User | AdminUser) => {
        if ('studentId' in user && user.mustChangePassword) {
            setTempUser(user as User);
            setStep('temp_password_change');
        } else {
            onLoginSuccess(user);
        }
    };

    const handleTempPasswordChangeSuccess = (updatedUser: User) => {
        onLoginSuccess(updatedUser);
    };

    if (step === 'select_school') {
        return <SchoolSelectionPage onSchoolSelected={handleSchoolSelect} onBackToLogin={onShowLogin} />;
    }

    if (step === 'landing_page' && selectedSchool) {
        return (
            <SchoolLandingPage 
                school={selectedSchool} 
                isNewUserFlow={true}
                onShowAdmission={handleShowAdmission}
                onBackToSelection={() => setStep('select_school')}
            />
        );
    }

    if (step === 'admission_portal' && selectedSchool) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
                 <StudentAdmissionPortal 
                    school={selectedSchool}
                    onBack={() => setStep('landing_page')}
                    isNewUserFlow={true}
                    onAdmissionSuccess={handleAdmissionSuccess}
                />
            </div>
        );
    }

    if (step === 'temp_login') {
        // We can pre-fill the username if we have it
        const initialIdentifier = tempCredentials ? tempCredentials.studentId : '';
        return <Auth onLoginSuccess={handleTempLoginSuccess} onNewUser={() => {}} initialIdentifier={initialIdentifier} />;
    }

    if (step === 'temp_password_change' && tempUser) {
        return <ForcePasswordChange user={tempUser} onSuccess={handleTempPasswordChangeSuccess} />;
    }

    return null;
};

export default NewUserFlow;
