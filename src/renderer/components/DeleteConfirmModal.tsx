import React, { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import DangerIcon from '../../../icons/svg/danger.svg?react';

interface DeleteConfirmModalProps {
  drawerTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ drawerTitle, onConfirm, onCancel }: DeleteConfirmModalProps): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useFocusTrap(modalRef, { isActive: true, onEscape: onCancel });
  useModalKeyboard(modalRef, { onEscape: onCancel });

  useEffect(() => {
    cancelRef.current?.focus();
    window.focus();
  }, []);

  async function handleConfirm() {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div className="bg-red-50 border-2 border-red-600 rounded-lg p-6 w-96 shadow-xl">
        <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
          <DangerIcon className="w-12 h-12" />
        </div>
        <h2 id="delete-confirm-title" className="text-lg font-bold text-red-800 text-center mb-2">
          Delete Drawer
        </h2>
        {drawerTitle && (
          <p className="text-sm text-red-700 text-center mb-2 font-medium">&quot;{drawerTitle}&quot;</p>
        )}
        <p className="text-sm text-red-800 text-center mb-6">
          This action is <span className="font-bold">irreversible</span>. Once deleted, the drawer and all its contents cannot be recovered.
        </p>
        <div className="flex justify-center gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isConfirming ? 'Deleting...' : 'Delete Drawer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
