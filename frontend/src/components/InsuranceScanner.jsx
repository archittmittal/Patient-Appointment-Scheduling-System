import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
import { Camera, RefreshCw, CheckCircle, AlertCircle, Loader2, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InsuranceScanner = ({ onScanComplete, onClose }) => {
    const webcamRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);

    // Pre-process image for better OCR
    const preprocessImage = (imageSrc) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw image
                ctx.drawImage(img, 0, 0);

                // Convert to grayscale and increase contrast
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    // Increase contrast
                    const threshold = 128;
                    const contrast = 1.5;
                    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                    const newValue = factor * (avg - 128) + 128;
                    
                    data[i] = newValue;
                    data[i + 1] = newValue;
                    data[i + 2] = newValue;
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
        });
    };

    const capture = useCallback(async () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setCapturedImage(imageSrc);
        setIsScanning(true);
        setError(null);
        setProgress(0);

        try {
            const processedImage = await preprocessImage(imageSrc);
            
            const worker = await createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                    }
                }
            });

            const { data: { text, confidence } } = await worker.recognize(processedImage);
            await worker.terminate();

            // Simple parsing logic (can be improved with regex)
            const result = parseOCRText(text, confidence / 100);
            
            setIsScanning(false);
            setCapturedImage(null); // Clear PHI from memory
            onScanComplete(result);
        } catch (err) {
            console.error(err);
            setError("Failed to read card. Please try again or enter manually.");
            setIsScanning(false);
        }
    }, [webcamRef, onScanComplete]);

    const handleClose = useCallback(() => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
            webcamRef.current.video.srcObject.getTracks().forEach(track => track.stop());
        }
        onClose();
    }, [onClose]);

    const parseOCRText = (text, confidenceScore) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        
        // Basic heuristic-based parsing
        let memberId = "";
        let groupId = "";
        let provider = "";

        // Look for common keywords
        lines.forEach(line => {
            const upper = line.toUpperCase();
            if (upper.includes('ID:') || upper.includes('MEMBER ID')) {
                memberId = line.replace(/.*ID[:\s]*/i, '').trim();
            } else if (upper.includes('GROUP')) {
                groupId = line.replace(/.*GROUP[:\s]*/i, '').trim();
            }
        });

        // If not found, try to find patterns
        if (!memberId) {
            const idMatch = text.match(/[A-Z0-9]{8,12}/);
            if (idMatch) memberId = idMatch[0];
        }

        return {
            rawText: text,
            memberId,
            groupId,
            provider,
            confidence: confidenceScore || 0
        };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden max-w-lg w-full relative border border-white/20"
            >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
                
                <button 
                    onClick={handleClose}
                    className="absolute top-6 right-6 z-10 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 rounded-2xl transition-all duration-300"
                >
                    <X size={20} />
                </button>

                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
                            <Camera size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight dark:text-white">Smart Scan</h3>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Position card within the frame</p>
                        </div>
                    </div>

                    <div className="relative aspect-[1.58/1] bg-gray-900 rounded-[2rem] overflow-hidden mb-8 shadow-inner group">
                        {!isScanning && (
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                videoConstraints={{ facingMode: "environment" }}
                                onUserMediaError={(err) => setError("Camera access denied. Please enable permissions.")}
                            />
                        )}

                        {isScanning && capturedImage && (
                            <motion.img 
                                initial={{ filter: 'grayscale(1)' }}
                                animate={{ filter: 'grayscale(0)' }}
                                src={capturedImage} 
                                className="w-full h-full object-cover opacity-80" 
                                alt="Captured" 
                            />
                        )}

                        {/* Viewfinder Overlay with Glass Corners */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[85%] h-[80%] relative">
                                {/* Corner Accents */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl" />
                            </div>
                        </div>

                        {/* Scanning Animation */}
                        <AnimatePresence>
                            {isScanning && (
                                <>
                                    <motion.div 
                                        initial={{ top: '0%' }}
                                        animate={{ top: '100%' }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#10b981] z-10"
                                    />
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.2 }}
                                        className="absolute inset-0 bg-emerald-500 mix-blend-overlay"
                                    />
                                </>
                            )}
                        </AnimatePresence>

                        {isScanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-[2px] text-white">
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="mb-4"
                                >
                                    <Loader2 size={48} className="text-emerald-400" />
                                </motion.div>
                                <p className="font-bold tracking-widest text-xs uppercase">Analyzing Card... {progress}%</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-6 p-4 bg-red-50/50 dark:bg-red-900/20 backdrop-blur-sm border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-3 text-sm font-medium"
                        >
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            {error}
                        </motion.div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={capture}
                            disabled={isScanning}
                            className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-emerald-400 disabled:to-teal-400 text-white rounded-[1.25rem] font-black transition-all duration-300 shadow-[0_10px_25px_rgba(16,185,129,0.4)] hover:shadow-[0_15px_30px_rgba(16,185,129,0.6)] flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95"
                        >
                            {isScanning ? <RefreshCw className="animate-spin" size={20} /> : <Camera size={20} />}
                            {isScanning ? 'PROCESSING' : 'INITIATE SCAN'}
                        </button>
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-2">
                        <Shield size={12} className="text-green-500" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Secure Processing
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default InsuranceScanner;
