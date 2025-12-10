


import React, { useState, useRef, useEffect } from 'react';
import { HomePageContent, SchoolUserRole } from '../types';

interface HomePagePreviewProps {
    content: HomePageContent | null;
    onProceedToPortal?: () => void;
    proceedButtonText?: string;
    isNewUserFlow?: boolean;
    onBackClick?: () => void;
    onAdmissionClick?: () => void;
    isAdmissionEnabled?: boolean;
}

const HomePagePreview: React.FC<HomePagePreviewProps> = ({ 
    content, 
    onProceedToPortal, 
    proceedButtonText = "User Portal", 
    isNewUserFlow, 
    onBackClick, 
    onAdmissionClick,
    isAdmissionEnabled = false 
}) => {
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
                                <div className="relative ml-4" ref={registrationRef}>
                                    <button 
                                        onClick={() => setIsRegistrationOpen(p => !p)} 
                                        disabled={!isAdmissionEnabled}
                                        className={`px-5 py-2 border rounded-md font-semibold transition-colors ${isAdmissionEnabled ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400 hover:bg-cyan-600 hover:text-white' : 'opacity-50 cursor-not-allowed border-gray-400 text-gray-400'}`}
                                        title={!isAdmissionEnabled ? "Admission is currently closed" : ""}
                                    >
                                        {isAdmissionEnabled ? "User Registration" : "Registration Closed"}
                                    </button>
                                    {isRegistrationOpen && isAdmissionEnabled && (
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                            {registrationOptions.map(opt => (
                                                <button key={opt.role} onClick={() => handleRegistrationSelect(opt.role)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{opt.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : onProceedToPortal && (
                            <button onClick={onProceedToPortal} className="ml-4 px-5 py-2 bg-cyan-600 text-white rounded-md font-semibold hover:bg-cyan-700 transition-colors shadow-sm">
                                {proceedButtonText}
                            </button>
                        )}
                    </div>

                    <div className="sm:hidden">
                         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="focus:outline-none" aria-label="Open menu" style={headerTextStyle}>
                            {isMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                            )}
                        </button>
                    </div>
                </nav>
                
                {isMenuOpen && (
                    <div 
                        className="sm:hidden absolute top-full right-4 mt-2 w-60 rounded-lg shadow-xl border z-50 p-2 space-y-2"
                        style={{ ...headerStyle, borderColor: isBgWhite ? '#E5E7EB' : 'rgba(0,0,0,0.1)' }}
                    >
                        <a href="#welcome" onClick={handleMobileLinkClick} className="block px-4 py-3 hover:bg-black/10 rounded-lg" style={headerTextStyle}>About</a>
                        <a href="#news" onClick={handleMobileLinkClick} className="block px-4 py-3 hover:bg-black/10 rounded-lg" style={headerTextStyle}>News</a>
                        <a href="#campuses" onClick={handleMobileLinkClick} className="block px-4 py-3 hover:bg-black/10 rounded-lg" style={headerTextStyle}>Smart Campuses</a>
                         {isNewUserFlow ? (
                            <>
                                {isAdmissionEnabled ? (
                                    <button onClick={() => handleRegistrationSelect('student')} className="w-full text-center block px-4 py-3 font-semibold text-cyan-600 border border-cyan-600 hover:bg-cyan-600 hover:text-white rounded-lg">Register as Student</button>
                                ) : (
                                    <button disabled className="w-full text-center block px-4 py-3 font-semibold text-gray-400 border border-gray-400 rounded-lg cursor-not-allowed">Registration Closed</button>
                                )}
                            </>
                        ) : onProceedToPortal && (
                            <div className="p-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                                <button onClick={() => { onProceedToPortal(); handleMobileLinkClick(); }} className="w-full text-center block px-4 py-3 font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-md">
                                    {proceedButtonText}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            <div className="px-4 sm:px-6 lg:px-8 pt-8">
                <div className="rounded-2xl shadow-lg overflow-hidden">
                    <section
                        className="relative h-[60vh] bg-gray-500 bg-center text-white flex items-center justify-center overflow-hidden"
                    >
                        {content.hero.backgroundType === 'slider' && content.hero.sliderImages.length > 0 ? (
                             <div 
                                className="absolute inset-0 flex"
                                style={{
                                    width: `${content.hero.sliderImages.length * 2 * 100}vw`,
                                    animation: `marquee-scroll ${content.hero.sliderImages.length * 8}s linear infinite`,
                                }}
                            >
                                {[...content.hero.sliderImages, ...content.hero.sliderImages].map((image, index) => (
                                    <div
                                        key={`${image.id}-${index}`}
                                        className="w-screen h-full flex-shrink-0 bg-cover bg-no-repeat bg-center"
                                        style={{ backgroundImage: `url(${image.url})` }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div
                                className="absolute inset-0 bg-cover bg-no-repeat bg-center"
                                style={{ backgroundImage: `url(${content.hero.imageUrl})` }}
                            />
                        )}

                        <div className="absolute inset-0 bg-black opacity-60"></div>
                        <div className="relative text-center z-10 p-4">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">{content.hero.title}</h1>
                            <p className="text-base sm:text-lg md:text-xl mb-8">{content.hero.subtitle}</p>
                            <button 
                                onClick={isAdmissionEnabled ? onAdmissionClick : undefined} 
                                disabled={!isAdmissionEnabled}
                                className={`px-8 py-3 rounded-full font-semibold transition-colors ${isAdmissionEnabled ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}
                            >
                                {isAdmissionEnabled ? content.hero.buttonText : "Admission Closed"}
                            </button>
                        </div>
                    </section>
                    {/* FIX: The <marquee> tag is obsolete and not recognized by TypeScript's JSX. Using React.createElement to construct it dynamically to avoid type errors. */}
                    {content.hero.marquee.enabled && (
                        <div className="bg-cyan-700 text-white font-semibold py-3 overflow-hidden">
                            {React.createElement('marquee', { behavior: 'scroll', direction: 'left' }, content.hero.marquee.text)}
                        </div>
                    )}
                </div>
            </div>
            
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 mt-8">
                <section id="welcome" className="mb-16 sm:mb-20">
                    <div className="grid md:grid-cols-3 gap-12 items-center">
                        <div className="md:col-span-2">
                             <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">{content.welcome.title}</h2>
                             <p className="text-base sm:text-lg leading-relaxed mb-6">{content.welcome.mainText}</p>
                             <div className="flex flex-wrap gap-3 sm:gap-4">
                                {content.welcome.coreValues.map((value, index) => (
                                    <span key={index} className="bg-cyan-100 text-cyan-800 font-semibold px-4 py-2 rounded-full text-sm sm:text-base">{value}</span>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-lg shadow-lg text-center">
                            <img src={content.welcome.director.imageUrl} alt={content.welcome.director.name} className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white shadow-md"/>
                            <h4 className="font-bold text-xl">{content.welcome.director.name}</h4>
                            <p className="text-gray-600 mb-3">{content.welcome.director.title}</p>
                            <p className="text-gray-700 italic text-sm sm:text-base">"{content.welcome.director.quote}"</p>
                        </div>
                    </div>
                </section>
                
                <section id="why" className="bg-gray-100 -mx-6 px-6 py-16 sm:py-20">
                    <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">{content.whyChooseUs.title}</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {content.whyChooseUs.items.map(item => (
                            <div key={item.id} className="bg-white p-8 rounded-lg shadow-md">
                                <h3 className="font-bold text-xl sm:text-2xl mb-3">{item.title}</h3>
                                <p>{item.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="campuses" className="py-16 sm:py-20">
                    <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">{content.campuses.title}</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {content.campuses.items.map(item => (
                            <div key={item.id} className="rounded-lg shadow-lg overflow-hidden">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-56 object-cover"/>
                                <div className="p-6">
                                    <h3 className="font-bold text-xl mb-2">{item.name}</h3>
                                    <p className="text-gray-700">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="news" className="bg-gray-100 -mx-6 px-6 py-16 sm:py-20">
                     <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">{content.news.title}</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                         {content.news.items.map(item => (
                            <div key={item.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
                                <img src={item.imageUrl} alt={item.title} className="w-full h-56 object-cover"/>
                                <div className="p-6 flex-grow flex flex-col">
                                    <p className="text-sm text-gray-500 mb-2">{new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <h3 className="font-bold text-xl mb-3 flex-grow">{item.title}</h3>
                                    <p className="text-gray-700 mb-4">{item.excerpt}</p>
                                    <a href="#" className="text-cyan-600 hover:text-cyan-800 font-semibold self-start">Read More &rarr;</a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>
            
            <footer className="bg-gray-800 text-white">
                <div className="container mx-auto px-6 py-8 text-center">
                    <p>&copy; {new Date().getFullYear()} {content.hero.title.split(' to ')[1] || 'Our School'}. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default HomePagePreview;
