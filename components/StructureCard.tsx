
import React from 'react';

interface StructureCardProps {
    title: string;
    children: React.ReactNode;
}

const StructureCard: React.FC<StructureCardProps> = ({ title, children }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <div className="text-gray-300">
                {children}
            </div>
        </div>
    );
};

export default StructureCard;
