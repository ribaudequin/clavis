import React, { useEffect, useRef } from 'react';
import DangerIcon from '../../../icons/svg/danger.svg?react';

interface DeleteConfirmModalProps {
  drawerTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ drawerTitle, onConfirm, onCancel }: DeleteConfirmModalProps): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    window.focus();
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
      <div className="bg-red-50 border-2 border-red-600 rounded-lg p-6 w-96 shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <DangerIcon className="w-16 h-16" />
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
            className="px-4 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
          >
            Delete Drawer
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
