// components/VisitorCenterPage.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Visitor, Appointment, AppointmentStatus } from '../types';
import * as visitorService from '../services/visitorService';
import * as apiService from '../services/apiService';
import UserAvatar from './UserAvatar';

interface VisitorCenterPageProps {
    schoolId: string;
}

const VisitorCenterPage: React.FC<VisitorCenterPageProps> = ({ schoolId }) => {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Modal state
    const [step, setStep] = useState<'camera_id' | 'camera_selfie' | 'form' | 'success'>('camera_id');
    const [capturedIdPhoto, setCapturedIdPhoto] = useState<string | null>(null);
    const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState({ name: '', idNumber: '', reasonForVisit: '' });
    const [verificationResult, setVerificationResult] = useState<{ matchConfidence: 'High' | 'Medium' | 'Low'; isMatch: boolean } | null>(null);
    const [isDetailsEditable, setIsDetailsEditable] = useState(false);
    const [verificationProgress, setVerificationProgress] = useState<number | null>(null);
    const [backgroundRemovalStatus, setBackgroundRemovalStatus] = useState<string | null>(null);
    
    // Camera state and refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    
    // Alignment State
    const [isAligned, setIsAligned] = useState(false);
    const [isCheckingAlignment, setIsCheckingAlignment] = useState(false);
    const alignmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    // History View State
    const [activeVisitorCenterTab, setActiveVisitorCenterTab] = useState<'current' | 'history'>('current');
    const [filterName, setFilterName] = useState('');
    const [filterIdNumber, setFilterIdNumber] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const refreshVisitors = useCallback(() => {
        setVisitors(visitorService.getVisitors(schoolId));
    }, [schoolId]);

    useEffect(() => {
        refreshVisitors();
        const interval = setInterval(refreshVisitors, 5000);
        return () => clearInterval(interval);
    }, [schoolId, refreshVisitors]);

    const stopCameraStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (alignmentTimeoutRef.current) {
            clearTimeout(alignmentTimeoutRef.current);
            alignmentTimeoutRef.current = null;
        }
        setIsAligned(false);
        setIsCheckingAlignment(false);
    }, []);

    const startCameraStream = useCallback(async () => {
        if (!videoRef.current || !selectedDeviceId) return;

        stopCameraStream(); // Ensure any existing stream is stopped cleanly

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    deviceId: { exact: selectedDeviceId },
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                } 
            });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setFormError('');
            setIsAligned(false); // Reset alignment on camera start
        } catch (error) {
            console.error('Camera access error:', error);
            setFormError('Could not access camera. Please check permissions and ensure it is not in use.');
            stopCameraStream();
        }
    }, [selectedDeviceId, stopCameraStream]);
    
    const handleCheckAlignment = () => {
        if (isCheckingAlignment) return;
        setIsCheckingAlignment(true);

        alignmentTimeoutRef.current = setTimeout(() => {
            setIsAligned(true);
            setIsCheckingAlignment(false);
        }, 1500); // 1.5 second simulation
    };

    // Effect for enumerating devices and setting initial selected device based on current step
    useEffect(() => {
        if (!isModalOpen || (step !== 'camera_id' && step !== 'camera_selfie')) {
            setVideoDevices([]);
            setSelectedDeviceId(undefined);
            stopCameraStream();
            return;
        }

        const enumerateAndSelect = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true }); 
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevs = devices.filter(d => d.kind === 'videoinput');
                
                if (videoDevs.length > 0) {
                    setVideoDevices(videoDevs);
                    const preferEnvironment = step === 'camera_id';
                    
                    const preferredCam = videoDevs.find(d => 
                        preferEnvironment 
                            ? (d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'))
                            : (d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user'))
                    );

                    let selectedCam = preferredCam || videoDevs[0];
                    
                    if (!preferredCam && videoDevs.length > 1) {
                         selectedCam = preferEnvironment ? videoDevs[videoDevs.length - 1] : videoDevs[0];
                    }

                    setSelectedDeviceId(selectedCam.deviceId);
                } else {
                    setFormError("No camera found on this device.");
                    stopCameraStream();
                }
            } catch (err) {
                console.error('Error enumerating cameras:', err);
                setFormError("Could not access camera. Please grant permission.");
                stopCameraStream();
            }
        };

        enumerateAndSelect();
        return () => stopCameraStream();
    }, [isModalOpen, step, stopCameraStream]);

    // Effect for starting/stopping stream based on selectedDeviceId and visibility
    useEffect(() => {
        if (isModalOpen && (step === 'camera_id' || step === 'camera_selfie') && selectedDeviceId) {
            startCameraStream();
        } else {
            stopCameraStream();
        }
        return () => {
            stopCameraStream();
        };
    }, [isModalOpen, step, selectedDeviceId, startCameraStream, stopCameraStream]);

    const resetModal = () => {
        setIsModalOpen(false);
        setStep('camera_id');
        setCapturedIdPhoto(null);
        setCapturedSelfie(null);
        setIsProcessing(false);
        setFormError('');
        setFormData({ name: '', idNumber: '', reasonForVisit: '' });
        setVerificationResult(null);
        setIsDetailsEditable(false);
        setVideoDevices([]);
        setSelectedDeviceId(undefined);
        setBackgroundRemovalStatus(null);
        stopCameraStream();
    };

    const handleCapture = async () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const photoUrl = canvas.toDataURL('image/jpeg');
            const base64Data = photoUrl.split(',')[1];

            setBackgroundRemovalStatus("Removing background...");
            
            try {
                const processedImage = await apiService.removeImageBackground(base64Data, 'image/jpeg');
                
                if (step === 'camera_id') {
                    setCapturedIdPhoto(processedImage);
                    setStep('camera_selfie');
                } else if (step === 'camera_selfie') {
                    setCapturedSelfie(processedImage);
                    stopCameraStream();
                    processVerification(processedImage);
                }
            } catch (error) {
                console.error("Background removal error, using original:", error);
                 if (step === 'camera_id') {
                    setCapturedIdPhoto(photoUrl);
                    setStep('camera_selfie');
                } else if (step === 'camera_selfie') {
                    setCapturedSelfie(photoUrl);
                    stopCameraStream();
                    processVerification(photoUrl);
                }
            } finally {
                 setBackgroundRemovalStatus(null);
                 setIsAligned(false);
            }
        }
    };

    const processVerification = async (selfieUrl: string) => {
        if (!capturedIdPhoto) return;

        setIsProcessing(true);
        setStep('form');
        setFormError('');
        setVerificationProgress(0);

        const progressInterval = setInterval(() => {
            setVerificationProgress(prev => {
                if (prev === null) return 10;
                if (prev >= 95) {
                    clearInterval(progressInterval);
                    return 95;
                }
                return prev + Math.floor(Math.random() * 10) + 5;
            });
        }, 250);
        
        const idParts = capturedIdPhoto.split(',');
        const selfieParts = selfieUrl.split(',');
        
        const idMime = idParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const idBase64 = idParts[1];
        
        const selfieMime = selfieParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const selfieBase64 = selfieParts[1];

        try {
            const result = await apiService.verifyVisitorIdentity(idBase64, selfieBase64, idMime, selfieMime);
            
            clearInterval(progressInterval);
            setVerificationProgress(100);

            setTimeout(() => {
                setFormData(prev => ({ ...prev, name: result.name, idNumber: result.idNumber }));
                setVerificationResult({ matchConfidence: result.matchConfidence, isMatch: result.isMatch });

                if (!result.name && !result.idNumber) {
                    setFormError("Could not extract details automatically. Please enter them manually.");
                    setIsDetailsEditable(true);
                }
                setIsProcessing(false);
            }, 500);

        } catch (err) {
            clearInterval(progressInterval);
            setVerificationProgress(100);
            
            setTimeout(() => {
                setFormError((err as Error).message);
                setIsDetailsEditable(true);
                setVerificationResult(null); 
                setIsProcessing(false);
            }, 500);
        }
    };
    
    const handleSignIn = () => {
        if (!capturedIdPhoto || !formData.name.trim() || !formData.idNumber.trim() || !formData.reasonForVisit.trim()) {
            setFormError("All fields are required.");
            return;
        }
        
        visitorService.addVisitor(schoolId, {
            name: formData.name,
            idNumber: formData.idNumber,
            idPhotoUrl: capturedIdPhoto,
            reasonForVisit: formData.reasonForVisit,
            matchConfidence: verificationResult?.matchConfidence,
            isVerifiedMatch: verificationResult?.isMatch
        });
        
        refreshVisitors();
        setStep('success');
    };

    const handleSwitchCamera = useCallback(() => {
        if (videoDevices.length > 1) {
            const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
            const nextIndex = (currentIndex + 1) % videoDevices.length;
            setSelectedDeviceId(videoDevices[nextIndex].deviceId);
            setIsAligned(false);
            if (alignmentTimeoutRef.current) clearTimeout(alignmentTimeoutRef.current);
        }
    }, [videoDevices, selectedDeviceId]);
    
    const handleSignOut = (id: string) => {
        try {
            visitorService.signOutVisitor(id, schoolId);
            refreshVisitors();
        } catch (error) {
            alert("Could not sign out visitor.");
        }
    };

    const currentlySignedIn = visitors.filter(v => v.signOutTime === null);
    const signedOutToday = visitors.filter(v => v.signOutTime !== null && new Date(v.signOutTime).toDateString() === new Date().toDateString());

    const filteredHistoryVisitors = useMemo(() => {
        let filtered = visitors;

        if (filterName.trim()) {
            filtered = filtered.filter(v => v.name.toLowerCase().includes(filterName.toLowerCase()));
        }
        if (filterIdNumber.trim()) {
            filtered = filtered.filter(v => v.idNumber.toLowerCase().includes(filterIdNumber.toLowerCase()));
        }
        if (filterStartDate) {
            const start = new Date(filterStartDate).getTime();
            filtered = filtered.filter(v => v.signInTime >= start);
        }
        if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(v => v.signInTime <= end.getTime());
        }

        return filtered;
    }, [visitors, filterName, filterIdNumber, filterStartDate, filterEndDate]);


    const renderCameraView = () => {
        const isIdStep = step === 'camera_id';

        let buttonContent;
        let buttonAction;
        let buttonDisabled = !!backgroundRemovalStatus || isCheckingAlignment;
        let buttonClass = `px-8 py-3 rounded-lg font-bold shadow-lg transition-all transform active:scale-95`;

        if (isAligned) {
            buttonContent = isIdStep ? "Capture ID" : "Verify Face";
            buttonAction = handleCapture;
            buttonClass += ' bg-green-600 hover:bg-green-500 text-white cursor-pointer';
        } else if (isCheckingAlignment) {
            buttonContent = "Checking...";
            buttonAction = () => {};
            buttonClass += ' bg-yellow-600 text-white cursor-wait animate-pulse';
        } else {
            buttonContent = "Check Alignment";
            buttonAction = handleCheckAlignment;
            buttonClass += ' bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer';
        }

        return (
            <div className="text-center space-y-4">
                <h3 className="text-xl font-bold text-white">{isIdStep ? "Step 1: Capture ID Card" : "Step 2: Verify Identity"}</h3>
                <p className="text-gray-400 text-sm">{isIdStep ? "Align the ID card within the frame." : "Please look at the camera for a quick selfie check."}</p>
                
                <div className="relative w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover rounded-lg ${!isIdStep ? 'scale-x-[-1]' : ''}`}></video>
                    
                    {/* Alignment Guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div 
                            className={`
                                ${isIdStep ? 'w-[85%] h-[80%]' : 'w-[200px] h-[250px] rounded-full'} 
                                border-2 transition-colors duration-300
                                ${isAligned ? 'border-green-500 border-solid shadow-[0_0_20px_rgba(34,197,94,0.5)]' : isIdStep ? 'border-dashed border-cyan-500/50' : 'border-dashed border-yellow-500/50'}
                            `}
                        >
                             {isAligned && (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                    <svg className="w-16 h-16 text-green-500 drop-shadow-lg animate-fade-in-up" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {backgroundRemovalStatus && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-cyan-400 font-semibold animate-pulse">{backgroundRemovalStatus}</p>
                        </div>
                    )}
                </div>

                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                
                <div className="flex justify-center gap-4">
                    <button 
                        onClick={buttonAction} 
                        disabled={buttonDisabled} 
                        className={buttonClass}
                    >
                        {buttonContent}
                    </button>
                    {videoDevices.length > 1 && (
                        <button onClick={handleSwitchCamera} disabled={!!backgroundRemovalStatus || isCheckingAlignment} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold disabled:opacity-50">Switch Camera</button>
                    )}
                </div>
            </div>
        );
    };

    const renderFormView = () => (
        <>
            <h3 className="text-xl font-bold text-white">Verification Results</h3>
            {isProcessing ? (
                <div className="text-center p-12 space-y-4">
                    <h4 className="text-lg font-semibold text-cyan-400">Matching Verification</h4>
                    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div 
                            className="bg-cyan-500 h-4 rounded-full transition-all duration-300 ease-linear" 
                            style={{ width: `${verificationProgress || 0}%` }}
                        ></div>
                    </div>
                    <p className="font-mono font-bold text-2xl text-white">{verificationProgress || 0}%</p>
                    <p className="text-gray-400 animate-pulse">Analyzing ID card and selfie...</p>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-6 max-h-[60vh] overflow-y-auto">
                    <div className="w-full sm:w-1/3 flex flex-col gap-2">
                         <p className="text-xs text-gray-400 font-semibold text-center">Captured ID</p>
                        <img src={capturedIdPhoto!} alt="Captured ID" className="w-full rounded-lg object-contain border border-gray-700 bg-gray-800" />
                         <p className="text-xs text-gray-400 font-semibold text-center mt-2">Live Selfie</p>
                        <img src={capturedSelfie!} alt="Live Selfie" className="w-full rounded-lg object-contain border border-gray-700 bg-gray-800" />
                    </div>
                    
                    <div className="w-full sm:w-2/3 space-y-4">
                        {verificationResult && (
                            <div className={`p-3 rounded-lg border text-center ${verificationResult.isMatch ? 'bg-green-500/10 border-green-500/50' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                                <p className={`font-bold text-lg ${verificationResult.isMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {verificationResult.isMatch ? "Identity Verified" : "Identity Warning"}
                                </p>
                                <p className="text-sm text-gray-300">Confidence: {verificationResult.matchConfidence}</p>
                                {!verificationResult.isMatch && <p className="text-xs text-gray-400 mt-1">Faces do not appear to match. Please verify manually.</p>}
                            </div>
                        )}

                        {formError && <p className="text-red-400 text-sm">{formError}</p>}
                        
                        <div>
                            <label className="text-xs text-gray-400">Full Name</label>
                            <input
                                readOnly={!isDetailsEditable}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Full Name"
                                className={`w-full p-2 rounded mt-1 ${isDetailsEditable ? 'bg-gray-700 focus:ring-2 focus:ring-cyan-500' : 'bg-gray-900 border border-gray-700 cursor-not-allowed'}`}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">ID Number</label>
                            <input
                                readOnly={!isDetailsEditable}
                                value={formData.idNumber}
                                onChange={e => setFormData({ ...formData, idNumber: e.target.value })}
                                placeholder="ID Number"
                                className={`w-full p-2 rounded mt-1 ${isDetailsEditable ? 'bg-gray-700 focus:ring-2 focus:ring-cyan-500' : 'bg-gray-900 border border-gray-700 cursor-not-allowed'}`}
                            />
                        </div>
                        {!isDetailsEditable && (
                            <button onClick={() => setIsDetailsEditable(true)} className="w-full text-sm text-cyan-400 hover:underline text-left">Correct Details</button>
                        )}
                        <div>
                            <label className="text-xs text-gray-400">Reason for Visit</label>
                            <input
                                value={formData.reasonForVisit}
                                onChange={e => setFormData({ ...formData, reasonForVisit: e.target.value })}
                                placeholder="Reason for Visit"
                                className="w-full p-2 bg-gray-700 rounded mt-1 focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>
                </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700 mt-4 flex-shrink-0">
                {!isProcessing && (
                    <>
                        <button onClick={() => setStep('camera_id')} className="px-4 py-2 bg-gray-600 rounded font-semibold hover:bg-gray-500">Restart</button>
                        <button onClick={handleSignIn} className="px-6 py-2 bg-cyan-600 rounded font-semibold hover:bg-cyan-700">Confirm Sign In</button>
                    </>
                )}
            </div>
        </>
    );

    const renderSuccessView = () => (
        <div className="text-center space-y-4">
            <h3 className="text-2xl font-bold text-green-400">Signed In Successfully!</h3>
            <div className="bg-gray-700/50 p-4 rounded-lg inline-block">
                 <UserAvatar name={formData.name} avatarUrl={capturedIdPhoto!} className="w-24 h-24 rounded-full mx-auto mb-3" />
                 <p className="text-white font-bold">{formData.name}</p>
                 <p className="text-gray-400 text-sm">{formData.idNumber}</p>
            </div>
            <div className="flex justify-center gap-4 pt-4">
                <button onClick={() => { resetModal(); setActiveVisitorCenterTab('current'); }} className="px-8 py-3 bg-cyan-600 rounded-lg font-bold hover:bg-cyan-700">Return to Main</button>
            </div>
        </div>
    );

    const renderVisitorModal = () => (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-3xl flex flex-col max-h-[95vh] shadow-2xl border border-gray-700">
                <header className="p-4 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Visitor Check-In</h3>
                    <button onClick={resetModal} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="p-6 flex-grow overflow-y-auto">
                    {(step === 'camera_id' || step === 'camera_selfie') && renderCameraView()}
                    {step === 'form' && renderFormView()}
                    {step === 'success' && renderSuccessView()}
                </div>
            </div>
        </div>
    );

    const renderCurrentActivityView = () => (
        <div className="space-y-6">
            <button onClick={() => { setIsModalOpen(true); setStep('camera_id'); }} className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold text-white shadow-md transition-colors">
                + Add New Visitor
            </button>

            <div>
                <h3 className="text-xl font-bold mb-4">Currently Signed In ({currentlySignedIn.length})</h3>
                <div className="space-y-4">
                    {currentlySignedIn.length > 0 ? (
                        currentlySignedIn.map(visitor => (
                            <div key={visitor.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between border border-gray-700">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <UserAvatar name={visitor.name} avatarUrl={visitor.idPhotoUrl} className="w-12 h-12 rounded-full" />
                                        {visitor.isVerifiedMatch && (
                                            <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[10px] p-0.5 rounded-full border border-gray-800" title="Verified Identity">✅</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{visitor.name}</p>
                                        <p className="text-sm text-gray-400">{visitor.reasonForVisit}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                     <p className="text-xs text-gray-500 mb-2">In since {new Date(visitor.signInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                     <button onClick={() => handleSignOut(visitor.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold transition-colors">Sign Out</button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-400 text-center py-8 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">No visitors currently signed in.</p>
                    )}
                </div>
            </div>
            
            {signedOutToday.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-300">Signed Out Today ({signedOutToday.length})</h3>
                    <div className="space-y-4">
                        {signedOutToday.map(visitor => (
                            <div key={visitor.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={visitor.name} avatarUrl={visitor.idPhotoUrl} className="w-10 h-10 rounded-full grayscale" />
                                    <div>
                                        <p className="font-semibold text-white">{visitor.name}</p>
                                        <p className="text-sm text-gray-400">{visitor.reasonForVisit}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500">Out at {new Date(visitor.signOutTime!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderHistoryView = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                <h3 className="font-bold text-lg mb-4 text-white">Filter History</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        placeholder="Filter by Name"
                        className="p-2 bg-gray-700 rounded-md w-full text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                    <input
                        type="text"
                        value={filterIdNumber}
                        onChange={e => setFilterIdNumber(e.target.value)}
                        placeholder="Filter by ID Number"
                        className="p-2 bg-gray-700 rounded-md w-full text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={e => setFilterStartDate(e.target.value)}
                            className="p-2 bg-gray-700 rounded-md w-full text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={e => setFilterEndDate(e.target.value)}
                            className="p-2 bg-gray-700 rounded-md w-full text-white"
                        />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4 text-white">Records ({filteredHistoryVisitors.length})</h3>
                <div className="space-y-4">
                    {filteredHistoryVisitors.length > 0 ? (
                        filteredHistoryVisitors.map(visitor => (
                            <div key={visitor.id} className="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between border border-gray-700 hover:bg-gray-750 transition-colors">
                                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                                    <UserAvatar name={visitor.name} avatarUrl={visitor.idPhotoUrl} className="w-12 h-12 rounded-full" />
                                    <div>
                                        <p className="font-semibold text-white">{visitor.name}</p>
                                        <p className="text-sm text-gray-400">ID: {visitor.idNumber}</p>
                                        <p className="text-xs text-gray-500">{visitor.reasonForVisit}</p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right flex flex-col gap-1">
                                    <p className="text-xs text-gray-400">In: {new Date(visitor.signInTime).toLocaleString()}</p>
                                    {visitor.signOutTime ? (
                                        <p className="text-xs text-gray-400">Out: {new Date(visitor.signOutTime).toLocaleString()}</p>
                                    ) : (
                                        <span className="self-start sm:self-end px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-300 border border-green-500/30">Active</span>
                                    )}
                                    {visitor.isVerifiedMatch !== undefined && (
                                        <span className={`self-start sm:self-end text-[10px] px-1.5 rounded border ${visitor.isVerifiedMatch ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'}`}>
                                            {visitor.isVerifiedMatch ? 'Verified ID' : 'ID Mismatch'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-400 text-center py-8">No visitor records found matching your filters.</p>
                    )}
                </div>
            </div>
        </div>
    );


    return (
        <div className="h-full">
            {isModalOpen && renderVisitorModal()}

            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Visitor Center</h2>
            
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg mb-6 border border-gray-700">
                <button 
                    onClick={() => setActiveVisitorCenterTab('current')} 
                    className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${activeVisitorCenterTab === 'current' ? 'bg-cyan-600 text-white shadow-sm' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    Current Activity
                </button>
                <button 
                    onClick={() => setActiveVisitorCenterTab('history')} 
                    className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${activeVisitorCenterTab === 'history' ? 'bg-cyan-600 text-white shadow-sm' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    History Log
                </button>
            </div>

            {activeVisitorCenterTab === 'current' && renderCurrentActivityView()}
            {activeVisitorCenterTab === 'history' && renderHistoryView()}
        </div>
    );
};

export default VisitorCenterPage;