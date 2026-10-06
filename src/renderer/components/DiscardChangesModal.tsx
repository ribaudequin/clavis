import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { t } from '../../i18n';

interface DiscardChangesModalProps {
  onSaveAndLeave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  saving: boolean;
}

export default function DiscardChangesModal({ onSaveAndLeave, onDiscard, onCancel, saving }: DiscardChangesModalProps): React.JSX.Element {
  const saveRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, { isActive: true, onEscape: onCancel });
  useModalKeyboard(modalRef, { onEscape: onCancel });

  useEffect(() => {
    saveRef.current?.focus();
    window.focus();
  }, []);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      aria-describedby="discard-desc"
    >
      <div className="bg-white border border-gray-300 rounded-lg p-6 w-96 shadow-xl">
        <h2 id="discard-title" className="text-lg font-bold text-gray-800 text-center mb-2">
          {t('msg.unsaved_changes_title')}
        </h2>
        <p id="discard-desc" className="text-sm text-gray-600 text-center mb-6">
          {t('msg.unsaved_changes_desc')}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {t('btn.cancel')}
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="px-3 py-1 text-sm text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
          >
            {t('btn.discard_and_leave')}
          </button>
          <button
            ref={saveRef}
            onClick={onSaveAndLeave}
            disabled={saving}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('msg.saving') : t('btn.save_and_leave')}
          </button>
        </div>
      </div>
    </div>
  );
}
