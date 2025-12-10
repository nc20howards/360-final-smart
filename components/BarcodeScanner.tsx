
import React, { useEffect, useRef, useState } from 'react';

// Make TypeScript aware of the globally loaded library
declare var ZXingBrowser: any;

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanError: (error: Error) => void;
    onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing camera...');
    const [error, setError] = useState('');
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

    const codeReaderRef = useRef(new ZXingBrowser.BrowserMultiFormatReader());
    const controlsRef = useRef<any>(null);

    // Effect 1: Enumerate devices on mount and handle permissions
    useEffect(() => {
        const enumerateDevices = async () => {
            try {
                // We must request permissions first to get device labels
                await navigator.mediaDevices.getUserMedia({ video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevs = devices.filter(d => d.kind === 'videoinput');
                if (videoDevs.length === 0) {
                    setError('No camera found on this device.');
                } else {
                    setVideoDevices(videoDevs);
                }
            } catch (err) {
                const errorMessage = (err as Error).message;
                if (errorMessage.includes('Permission denied')) {
                    setError('Camera permission denied. Please allow camera access in your browser settings.');
                } else {
                    setError('Could not access media devices. Please check permissions.');
                }
            }
        };
        enumerateDevices();
    }, []);

    // Effect 2: Start/restart scanning when the selected device changes
    useEffect(() => {
        if (videoDevices.length === 0 || !videoRef.current) {
            return;
        }

        const startScan = async () => {
            // Stop any previous stream before starting a new one
            if (controlsRef.current) {
                controlsRef.current.stop();
            }
            
            const selectedDeviceId = videoDevices[selectedDeviceIndex]?.deviceId;
            if (!selectedDeviceId) {
                setError("Selected camera is not available.");
                return;
            }

            try {
                setStatus('Scanning... Please align the barcode.');
                controlsRef.current = await codeReaderRef.current.decodeFromVideoDevice(
                    selectedDeviceId,
                    videoRef.current,
                    (result: any, err: any) => {
                        if (result) {
                            onScanSuccess(result.getText());
                        }
                        if (err) {
                            const ignoredErrors = ['NotFoundException', 'ChecksumException', 'FormatException'];
                            const errorMessage = err.toString();
                            // Filter out "No MultiFormat Readers..." error which is common when no code is in view
                            if (!ignoredErrors.includes(err.name) && !errorMessage.includes("No MultiFormat Readers were able to detect the code")) {
                                 console.error('Scan error:', err);
                            }
                        }
                    }
                );
            } catch (err) {
                const errorMessage = (err as Error).message;
                setError(`Failed to start camera: ${errorMessage}`);
                onScanError(err as Error);
            }
        };

        startScan();

        // Cleanup for this specific stream
        return () => {
            if (controlsRef.current) {
                controlsRef.current.stop();
                controlsRef.current = null;
            }
        };
    }, [videoDevices, selectedDeviceIndex, onScanSuccess, onScanError]);

    // Final cleanup for when the component unmounts entirely
    useEffect(() => {
        return () => {
            if (controlsRef.current) {
                controlsRef.current.stop();
            }
        };
    }, []);

    const handleSwitchCamera = () => {
        if (videoDevices.length > 1) {
            setSelectedDeviceIndex(prevIndex => (prevIndex + 1) % videoDevices.length);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[200] p-4">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-white">Scan Barcode</h3>
                     {videoDevices.length > 1 && (
                        <button onClick={handleSwitchCamera} className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600" title="Switch Camera">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.695v4.992h-4.992" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-4 border-dashed border-cyan-500/50 m-8"></div>
                </div>
                {error ? (
                    <p className="text-red-400 text-center mt-4">{error}</p>
                ) : (
                    <p className="text-gray-300 text-center mt-4">{status}</p>
                )}
                <button onClick={onClose} className="w-full mt-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default BarcodeScanner;
