import React from 'react';

interface PasswordStrengthIndicatorProps {
    password?: string;
}

const checkPasswordStrength = (password: string) => {
    let score = 0;
    const feedback = {
        label: 'Too Weak',
        color: 'bg-red-500',
        width: '0%',
        suggestions: [] as string[],
    };

    if (!password) return feedback;

    // Add points for length
    if (password.length >= 8) {
        score++;
        feedback.width = '25%';
    } else {
        feedback.suggestions.push('At least 8 characters');
    }

    // Add points for lowercase
    if (/[a-z]/.test(password)) {
        score++;
    } else {
        feedback.suggestions.push('A lowercase letter');
    }

    // Add points for uppercase
    if (/[A-Z]/.test(password)) {
        score++;
    } else {
        feedback.suggestions.push('An uppercase letter');
    }

    // Add points for numbers
    if (/\d/.test(password)) {
        score++;
    } else {
        feedback.suggestions.push('A number');
    }

    // Add points for special characters
    if (/[^A-Za-z0-9]/.test(password)) {
        score++;
    } else {
        feedback.suggestions.push('A special character (e.g., !@#$)');
    }

    switch (score) {
        case 1:
        case 2:
            feedback.label = 'Weak';
            feedback.color = 'bg-red-500';
            feedback.width = '25%';
            break;
        case 3:
            feedback.label = 'Medium';
            feedback.color = 'bg-yellow-500';
            feedback.width = '50%';
            break;
        case 4:
            feedback.label = 'Strong';
            feedback.color = 'bg-green-500';
            feedback.width = '75%';
            break;
        case 5:
            feedback.label = 'Very Strong';
            feedback.color = 'bg-green-500';
            feedback.width = '100%';
            break;
        default:
            break;
    }
    
    // Override label if length is too short
    if (password.length > 0 && password.length < 8) {
        feedback.label = "Too Short";
    }

    return feedback;
};

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password = '' }) => {
    const { label, color, width, suggestions } = checkPasswordStrength(password);

    if (!password) {
        return null;
    }

    return (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-gray-300">Password Strength:</p>
                <p className="text-sm font-bold text-white">{label}</p>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-300 ${color}`} style={{ width: width }}></div>
            </div>
            {suggestions.length > 0 && width !== '100%' && (
                <div className="mt-2 text-xs text-yellow-300">
                    Suggestions: {suggestions.join(', ')}
                </div>
            )}
        </div>
    );
};

export default PasswordStrengthIndicator;
