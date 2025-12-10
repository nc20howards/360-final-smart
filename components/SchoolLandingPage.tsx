
import React from 'react';
import { School } from '../types';
import { getHomePageContent } from '../services/homePageService';
import HomePagePreview from './HomePagePreview';
import { getAllModules, SMART_ADMISSION_MODULE_NAME } from '../services/moduleService';

interface SchoolLandingPageProps {
    school: School;
    onProceed?: () => void;
    proceedButtonText?: string;
    isNewUserFlow?: boolean;
    onBackToSelection?: () => void;
    onShowAdmission?: () => void;
}

const SchoolLandingPage: React.FC<SchoolLandingPageProps> = (props) => {
    const content = getHomePageContent(props.school.id);

    // Check if Smart Admission module is explicitly published for this school
    const allModules = getAllModules();
    const admissionModuleDef = allModules.find(m => m.name === SMART_ADMISSION_MODULE_NAME);
    const schoolAdmissionModule = props.school.modules.find(m => m.moduleId === admissionModuleDef?.id);
    
    // It must be strictly 'published' to be accessible by students/public
    const isAdmissionEnabled = schoolAdmissionModule?.status === 'published';

    return (
        <HomePagePreview
            content={content}
            onProceedToPortal={props.onProceed}
            proceedButtonText={props.proceedButtonText}
            isNewUserFlow={props.isNewUserFlow}
            onBackToSelection={props.onBackToSelection}
            onAdmissionClick={props.onShowAdmission}
            isAdmissionEnabled={isAdmissionEnabled}
        />
    );
};

export default SchoolLandingPage;
