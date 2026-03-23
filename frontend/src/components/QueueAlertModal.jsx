import React from 'react';
import { Bell, X, ArrowRight, MapPin, Clock } from 'lucide-react';

const QueueAlertModal = ({ alert, onClose, onAction }) => {
    if (!alert) return null;

    const isYourTurn = alert.type === 'YOUR_TURN';
    const isMissed = alert.type === 'MISSED';
    
    // Determine theme based on alert type
    const themeClass = isYourTurn 
        ? 'bg-gradient-to-br from-primary to-primary-hover' 
        : isMissed 
            ? 'bg-gradient-to-br from-orange-500 to-amber-600' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600';

    const buttonClass = isYourTurn 
        ? 'bg-primary shadow-primary/20' 
        : isMissed 
            ? 'bg-orange-600 shadow-orange-200' 
            : 'bg-blue-600 shadow-blue-200';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl shadow-primary/20 animate-in zoom-in-95 duration-300 border border-gray-100">
                <div className={`p-8 text-center ${themeClass} text-white relative`}>
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                    
                    <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/30 animate-bounce-slow">
                        <Bell size={40} className="text-white fill-white/20" />
                    </div>
                    
                    <h3 className="text-2xl font-black mb-2 tracking-tight">
                        {isYourTurn ? "It's Your Turn!" : isMissed ? "Queue Position Shifted" : "You're Next in Line!"}
                    </h3>
                    <p className="text-white/80 font-medium whitespace-pre-wrap">
                        {alert.message}
                    </p>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-primary">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">New Status</p>
                                <p className="text-gray-900 font-bold">{isMissed ? 'Waiting (Repositioned)' : 'Ready Now'}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-primary">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Estimated Position</p>
                                <p className="text-gray-900 font-bold"># {alert.data?.position || 'Updating...'}</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onAction();
                            onClose();
                        }}
                        className={`w-full py-4 ${buttonClass} text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] transition-all transform active:scale-95`}
                    >
                        {isYourTurn ? "I'm Heading In" : isMissed ? "I Understand" : "Keep Page Open"}
                        <ArrowRight size={20} />
                    </button>
                    
                    <p className="text-center text-xs text-gray-400 font-medium">
                        {isMissed ? "Please stay alert for your next call." : "Please proceed to the indicated room promptly."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QueueAlertModal;
