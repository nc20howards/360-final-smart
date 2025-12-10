
// src/components/SmartIdCard.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, School, SmartIDSettings } from '../types';
import { getHomePageContent } from '../services/homePageService';

// Tell TypeScript that QRCode and JsBarcode exist globally
declare var QRCode: any;
declare var JsBarcode: any;

interface SmartIdCardProps {
    user: User;
    school: School;
    settings: SmartIDSettings;
}

// --- New Barcode Generation Logic ---

/**
 * Determines the academic level prefix for a user.
 * @param user The user object.
 * @returns 'AL' for A-Level, 'OL' for O-Level, or 'GN' for General/Staff.
 */
const getLevelPrefix = (user: User): string => {
    const className = user.class?.toUpperCase().replace(/[\s.-]/g, '') || '';
    if (['S5', 'S6'].includes(className)) {
        return 'AL'; // A-Level
    }
    if (['S1', 'S2', 'S3', 'S4'].includes(className)) {
        return 'OL'; // O-Level
    }
    return 'GN'; // General / Staff / Unclassified
};

/**
 * Generates a new 10-character barcode string for a user.
 * Format: [LEVEL_PREFIX][STUDENT_ID][RANDOM_PADDING]
 * @param user The user object.
 * @returns A 10-character alphanumeric string.
 */
const generateBarcodeData = (user: User): string => {
    const prefix = getLevelPrefix(user); // 2 chars
    const studentId = user.studentId || '';
    const base = prefix + studentId;
    const targetLength = 10;

    if (base.length >= targetLength) {
        // If the base is already 10 or more, truncate it.
        return base.substring(0, targetLength);
    } else {
        // If it's shorter, pad with random characters.
        const randomLength = targetLength - base.length;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomPart = '';
        for (let i = 0; i < randomLength; i++) {
            randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return base + randomPart;
    }
};


// Helper to get properties from user object.
// FIX: Handle non-renderable property types like objects and booleans to prevent runtime errors.
const getUserProperty = (user: User, prop: keyof User): string => {
    const value = user[prop];
    if (value === null || value === undefined) {
        return 'N/A';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
        if (prop === 'unebPassSlip' && value) {
            return 'Verified'; // Or some other meaningful text
        }
        // A generic fallback for any other potential object properties
        return '[Object Data]';
    }
    return String(value);
};

export const SmartIdCardFront: React.FC<SmartIdCardProps> = ({ user, school, settings }) => {
    const schoolLogo = getHomePageContent(school.id).hero.logoUrl;
    const classDisplay = user.class ? (user.stream ? `${user.class} / ${user.stream}` : user.class) : 'N/A';
    const qrCodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (qrCodeRef.current && qrCodeRef.current.innerHTML === "") {
            const qrCodeData = JSON.stringify({
                studentId: user.studentId,
                name: user.name,
                schoolId: school.id,
            });
            try {
                new QRCode(qrCodeRef.current, {
                    text: qrCodeData,
                    width: 100,
                    height: 100,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (e) {
                console.error("QRCode generation error:", e);
            }
        }
    }, [user.studentId, user.name, school.id]);

    return (
        <div className="w-[512px] h-[320px] rounded-2xl shadow-2xl bg-white text-gray-800 flex flex-col font-sans relative overflow-hidden select-none">
            {/* Top Banner */}
            <div
                className="h-[140px] relative"
                style={{ backgroundColor: settings.primaryColor }}
            >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.03)_75%),linear-gradient(45deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.03)_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]"></div>
                <div className="relative h-full flex items-center justify-center gap-6">
                    <img src={schoolLogo} alt="School Logo" className="w-24 h-24 rounded-full object-contain bg-white/80 p-1 flex-shrink-0"/>
                    <h2 className="font-bold text-3xl leading-tight tracking-wide" style={{ color: settings.textColor }}>{school.name}</h2>
                </div>
            </div>

            {/* Plaque Container */}
            <div className="flex justify-center items-center">
                <div
                    className="-mt-5 z-10 font-bold uppercase tracking-wider px-8 py-2 rounded-lg shadow-md text-base flex items-center justify-center"
                    style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                >
                    Student ID Card
                </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-between gap-4 px-6 pt-6">
                {/* Left Side: Photo and Details */}
                <div className="flex items-center gap-4">
                    {/* Student Portrait */}
                    <div className="flex-shrink-0">
                         <img
                            src={user.avatarUrl || `https://picsum.photos/seed/${user.studentId}/150`}
                            alt={user.name}
                            className="w-32 h-32 rounded-lg object-cover border-4 border-gray-200 shadow-lg"
                        />
                    </div>
                
                    {/* Student Details */}
                     <div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                            <div className="flex justify-between w-full text-gray-500 font-medium"><span>Name</span><span>:</span></div>
                            <p className="font-bold break-words text-left">{user.name}</p>

                            <div className="flex justify-between w-full text-gray-500 font-medium"><span>Student ID</span><span>:</span></div>
                            <p className="font-bold break-words text-left">{user.studentId}</p>

                            <div className="flex justify-between w-full text-gray-500 font-medium"><span>Class</span><span>:</span></div>
                            <p className="font-bold break-words text-left">{classDisplay}</p>

                            <div className="flex justify-between w-full text-gray-500 font-medium"><span>Year</span><span>:</span></div>
                            <p className="font-bold break-words text-left">2020-2024</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: QR Code */}
                <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
                    <div ref={qrCodeRef} className="p-1 bg-white rounded-md shadow-md"></div>
                    <p className="text-xs text-gray-500">Scan for Verification</p>
                </div>
            </div>
        </div>
    );
};

export const SmartIdCardBack: React.FC<SmartIdCardProps> = ({ user, school, settings }) => {
    const barcodeRef = useRef<SVGSVGElement>(null);
    const barcodeData = useMemo(() => generateBarcodeData(user), [user]);

    useEffect(() => {
        if (barcodeRef.current && barcodeData) {
            try {
                JsBarcode(barcodeRef.current, barcodeData, {
                    format: "CODE128",
                    displayValue: false,
                    fontSize: 14,
                    margin: 10,
                    height: 50,
                    width: 2,
                });
            } catch(e) {
                console.error("JsBarcode error:", e);
            }
        }
    }, [barcodeData]);

    return (
        <div 
            className="w-[512px] h-[320px] rounded-2xl shadow-2xl p-6 flex flex-col bg-gray-100 text-gray-800"
        >
            <div className="h-4 w-full bg-gray-800 rounded-full"></div>
            
            <div className="mt-4 flex justify-between items-start text-left">
                <div className="w-1/2 pr-4 space-y-2">
                    <h4 className="text-lg font-bold pb-1 mb-2" style={{ borderBottom: `2px solid ${settings.primaryColor}` }}>Additional Information</h4>
                    {settings.customFields.map(field => (
                        <div key={field.id} className="text-sm">
                            <p className="font-bold text-gray-600">{field.label}:</p>
                            <p className="font-medium">{getUserProperty(user, field.userProperty)}</p>
                        </div>
                    ))}
                </div>
                <div className="w-1/2 pl-4 space-y-2 text-right">
                     <h4 className="text-lg font-bold pb-1 mb-2" style={{ borderBottom: `2px solid ${settings.primaryColor}` }}>Return Information</h4>
                     <p className="text-sm">If found, please return to:</p>
                     <p className="font-medium">{school.name}</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-end pb-2 space-y-1">
                <div className="w-64 h-24 bg-white p-2 rounded-lg shadow-inner flex flex-col justify-center items-center">
                    <svg ref={barcodeRef} className="w-full h-full"></svg>
                </div>
                <p className="text-xs font-mono tracking-widest">{barcodeData}</p>
            </div>
        </div>
    );
};

export const SmartIdCard: React.FC<SmartIdCardProps> = ({ user, school, settings }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div className="w-full h-full" style={{ perspective: '1000px' }} onClick={() => setIsFlipped(!isFlipped)}>
            <div
                className="w-full h-full relative"
                style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                    <SmartIdCardFront user={user} school={school} settings={settings} />
                </div>
                <div className="absolute w-full h-full" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                    <SmartIdCardBack user={user} school={school} settings={settings} />
                </div>
            </div>
        </div>
    );
};

export default SmartIdCard;
