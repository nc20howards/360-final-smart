import React from 'react';

interface PinStrengthIndicatorProps {
    pin: string;
    confirmPin?: string;
}

const PinStrengthIndicator: React.FC<PinStrengthIndicatorProps> = ({ pin, confirmPin }) => {
    let message = '';
    let color = 'text-yellow-400';
    let isError = false;

    // Don't show if inputs are empty and it's not a confirmation screen
    if (!pin && (confirmPin !== undefined && !confirmPin)) {
        return null;
    }

    // --- Validation Logic ---
    if (/\D/.test(pin) || (confirmPin && /\D/.test(confirmPin))) {
        message = 'PINs must contain only numbers.';
        isError = true;
    } else if (pin.length > 4 || (confirmPin && confirmPin.length > 4)) {
        message = 'PINs cannot be more than 4 digits.';
        isError = true;
    } else if (pin.length < 4 && pin.length > 0) {
        message = 'PIN must be 4 digits.';
    } else if (pin.length === 4) {
        if (confirmPin !== undefined) { // In setup mode
            if (confirmPin.length > 0 && pin !== confirmPin) {
                message = 'PINs do not match.';
                isError = true;
            } else if (confirmPin.length < 4 && confirmPin.length > 0) {
                 message = 'Confirm your PIN.';
            } else if (pin === confirmPin) {
                message = 'PINs match!';
                color = 'text-green-400';
            } else {
                 message = 'Please confirm your PIN.';
            }
        } else { // In confirmation mode
            // No message needed here, just the visual dots are enough
        }
    }
    
    if (isError) {
        color = 'text-red-400';
    }

    return (
        <div className="mt-4 text-center">
            <div className="flex justify-center space-x-2 mb-2">
                {Array(4).fill(0).map((_, index) => (
                    <div
                        key={index}
                        className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                            isError ? 'bg-red-500' : (index < pin.length ? 'bg-cyan-400' : 'bg-gray-600')
                        }`}
                    />
                ))}
            </div>
            {message && <p className={`text-xs font-semibold ${color}`}>{message}</p>}
        </div>
    );
};

export default PinStrengthIndicator;
