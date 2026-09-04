import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { EyeOpenIcon, EyeClosedIcon } from './EyeIcons';

interface PasswordModalProps {
  drawerTitle: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
}

function PasswordModal({ drawerTitle, onClose, onSubmit, error }: PasswordModalProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalKeyboard(modalRef, {
    onEscape: onClose,
    onEnter: () => {
      if (!isLoading && password.trim()) handleSubmit();
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useFocusTrap(modalRef, { isActive: true, onEscape: onClose });

  async function handleSubmit(e?: React.FormEvent): Promise<void> {
    if (e) e.preventDefault();
    if (password.trim() === '') return;
    setIsLoading(true);
    try {
      await onSubmit(password);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
      aria-describedby="password-error"
    >
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 id="password-modal-title" className="text-lg font-semibold mb-4">
          {drawerTitle}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password-input" className="block text-sm text-gray-600 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password-input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full border rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                placeholder="Enter password"
                autoComplete="current-password"
                aria-invalid={error ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
            {error && (
              <p id="password-error" className="text-red-500 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Unlocking...' : 'Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordModal;
