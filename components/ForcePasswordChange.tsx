
import React, { useState } from 'react';
import { User } from '../types';
import { changePassword } from '../services/studentService';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface ForcePasswordChangeProps {
    user: User;
    onSuccess: (updatedUser: User) => void;
}

const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ user, onSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);
        try {
            const updatedUser = changePassword(user.studentId, newPassword);
            onSuccess(updatedUser);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to change password.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
          <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
              <h1 className="text-2xl font-bold text-center text-cyan-400">Change Your Password</h1>
              <p className="text-center text-gray-400">For your security, you must change your temporary password before you can continue.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                      <div className="relative">
                          <input 
                              id="newPassword" 
                              type={showNewPassword ? "text" : "password"} 
                              value={newPassword} 
                              onChange={e => setNewPassword(e.target.value)} 
                              required 
                              className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400 pr-10" 
                          />
                          <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                            >
                                {showNewPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                          </button>
                      </div>
                  </div>
                  <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                      <div className="relative">
                          <input 
                              id="confirmPassword" 
                              type={showConfirmPassword ? "text" : "password"} 
                              value={confirmPassword} 
                              onChange={e => setConfirmPassword(e.target.value)} 
                              required 
                              className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400 pr-10" 
                          />
                          <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                            >
                                {showConfirmPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                          </button>
                      </div>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                  {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md">{error}</div>}
                  <button type="submit" disabled={isLoading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isLoading ? 'Changing...' : 'Set New Password'}
                  </button>
              </form>
          </div>
      </div>
    );
};

export default ForcePasswordChange;
