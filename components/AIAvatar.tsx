import React from 'react';

interface AIAvatarProps {
    status: 'thinking' | 'idle';
}

const AIAvatar: React.FC<AIAvatarProps> = ({ status }) => {
    const baseClasses = "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-900 border-2 border-cyan-500 shadow-lg";

    if (status === 'thinking') {
        return (
            <div className={baseClasses}>
                <div className="flex items-end space-x-1 h-3">
                    <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className={baseClasses}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              {/* Head */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 100-12 6 6 0 000 12z" />
              {/* Neck */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75v2.25" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6" />
              {/* Eyes */}
              <path d="M10.5 12.75a.375.375 0 11-.75 0 .375.375 0 01.75 0z" fill="currentColor" />
              <path d="M14.25 12.75a.375.375 0 11-.75 0 .375.375 0 01.75 0z" fill="currentColor" />
              {/* Antenna */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75V4.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5m-1.125 0a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0" />
            </svg>
        </div>
    );
};

export default AIAvatar;
