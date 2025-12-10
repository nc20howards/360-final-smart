import React from 'react';

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: number | string;
    colorClassName: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, colorClassName }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 flex items-center space-x-4">
            <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center ${colorClassName}`}>
                {icon}
            </div>
            <div>
                <p className="text-4xl font-bold text-white">{value}</p>
                <p className="text-lg text-gray-400">{title}</p>
            </div>
        </div>
    );
};

export default StatCard;
