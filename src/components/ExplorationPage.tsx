
import React from 'react';
import { User, AdminUser } from '../types';

// FIX: Add placeholder component content to fix "not a module" error.
interface ExplorationPageProps {
    user: User | AdminUser;
}

const ExplorationPage: React.FC<ExplorationPageProps> = ({ user }) => {
    return (
        <div className="p-8 text-center text-gray-400">
            Exploration module content coming soon.
        </div>
    );
};

export default ExplorationPage;
