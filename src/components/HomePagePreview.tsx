import React, { useState, useRef, useEffect } from 'react';
import { HomePageContent, SchoolUserRole } from '../types';

interface HomePagePreviewProps {
    content: HomePageContent | null;
    onProceedToPortal?: () => void;
    proceedButtonText?: string;
    isNewUserFlow?: boolean;
    onBackClick?: () => void;
    onAdmissionClick?: () => void;
}

const HomePagePreview: React.FC<HomePagePreviewProps> = ({ content, onProceedToPortal, proceedButtonText = "User Portal", isNewUserFlow, onBackClick, onAdmissionClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const registrationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (registrationRef.current && !registrationRef.current.contains(event.target as Node)) {
                setIsRegistrationOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!content) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 text-red-500">Could not load page content.</div>;
    }

    const handleMobileLinkClick = () => {
        setIsMenuOpen(false);
    };

    const handleRegistrationSelect = (role: SchoolUserRole) => {
        setIsRegistrationOpen(false);
        if (role === 'student') {
            onAdmissionClick?.();
        } else {
            alert(`Registration for "${role.replace('_', ' ')}" is not yet implemented. Please contact the school directly.`);
        }
    };
    
    const isBgWhite = content.hero.headerBackgroundColor?.toLowerCase() === '#ffffff';
    const finalTextColor = isBgWhite ? '#000000' : (content.hero.headerTextColor || '#FFFFFF');

    const headerStyle = {
        backgroundColor: content.hero.headerBackgroundColor || '#FFFFFF'
    };
    const headerTextStyle = {
        color: finalTextColor
    };

    const registrationOptions: { role: SchoolUserRole; label: string }[] = [
        { role: 'student', label: 'Student' },
        { role: 'teacher', label: 'Teacher' },
        { role: 'parent', label: 'Parent' },
        { role: 'old_student', label: 'Old Student' },
        { role: 'canteen_seller', label: 'Seller' },
    ];

    return (
        <div className="bg-white text-gray-800 font-sans">
            <header className="shadow-md sticky top-0 z-50 relative" style={headerStyle}>
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        {isNewUserFlow && onBackClick && (
                            <button onClick={onBackClick} className="mr-2 p-2 rounded-full hover:bg-black/10" style={headerTextStyle} aria-label="Go back">
                                &larr;
                            </button>
                        )}
                        {content.hero.logoUrl && (
                            <div className="bg-white p-1 rounded-full shadow-md border border-gray-200">
                                <img
                                    src={content.hero.logoUrl}
                                    alt="School Logo"
                                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-contain"
                                />
                            </div>
                        )}
                        <div className="text-xl sm:text-2xl font-bold" style={headerTextStyle}>{content.hero.title.split(' to ')[1] || 'School Home'}</div>
                    </div>
                    
                    <div className="hidden sm:flex items-center space-x-1 md:space-x-3">
                        <a href="#welcome" className="px-3 py-2 rounded-md hover:opacity-75 transition-opacity" style={headerTextStyle}>About</a>
                        <a href="#news" className="px-3 py-2 rounded-md hover:opacity-75 transition-opacity" style={headerTextStyle}>News</a>
                        <a href="#campuses" className="px-3 py-2 rounded-md hover:opacity-75 transition-opacity" style={headerTextStyle}>Smart Campuses</a>
                        {isNewUserFlow ? (
                            <>
                                {/* <button onClick={onAdmissionClick} className="ml-4 px-5 py-2 bg-cyan-600 text-white rounded-md font-semibold hover:bg-cyan-700 transition-colors shadow-sm">Online Admission</button> */}
                                <div className="relative ml-4" ref={registrationRef}>
                                    <button onClick={() => setIsRegistrationOpen(p => !p)} className="px-5 py-2 border border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400 rounded-md font-semibold hover:bg-cyan-600 hover:text-white transition-colors">User Registration</button>
                                    {isRegistrationOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                            {registrationOptions.map(opt => (
                                                <button key={opt.role} onClick={() => handleRegistrationSelect(opt.role)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{opt.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : onProceedToPortal && (
                            <button onClick={onProceedToPortal} className="ml-4 px-5 py