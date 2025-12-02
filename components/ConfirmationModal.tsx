import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonVariant?: 'primary' | 'danger';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonVariant = 'primary',
}) => {
  if (!isOpen) return null;

  const confirmButtonClass =
    confirmButtonVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-cyan-600 hover:bg-cyan-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[102] p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-slide-in-left-fade">
        <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
        <div className="text-gray-300 mb-6">{message}</div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-md font-semibold transition-colors ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
