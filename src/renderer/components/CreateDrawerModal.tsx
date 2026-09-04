import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { EyeOpenIcon, EyeClosedIcon } from '../components/EyeIcons';
import { toast } from 'react-hot-toast';

interface CreateDrawerModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateDrawerModal({ onClose, onCreated }: CreateDrawerModalProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, { isActive: true, onEscape: onClose });
  useModalKeyboard(modalRef, { onEscape: onClose });

  useEffect(() => {
    titleRef.current?.focus();
    window.focus();
  }, []);

  function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
    if (pw.length > 0 && pw.length < 8) return { score: 1, label: 'Too short (min 8 chars)', color: '#fca5a5' };
    if (pw.length === 0) return { score: 0, label: '', color: '#e5e7eb' };
    let score = 1;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    const colors = ['#e5e7eb', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#4ade80'];
    const idx = Math.min(score, 5);
    return { score, label: labels[idx], color: colors[idx] };
  }

  async function handleSubmit(e?: React.FormEvent): Promise<void> {
    if (e) e.preventDefault();
    if (title.trim() === '') {
      toast.error('Title cannot be empty.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await window.electronAPI.createDrawer(title, password);
      if (!result.ok) {
        toast.error(`Error: ${result.error.message}`);
        return;
      }
      toast.success('Drawer created successfully.');
      onCreated();
    } catch {
      toast.error('Error creating drawer.');
    } finally {
      setIsLoading(false);
    }
  }

  const strength = getPasswordStrength(password);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-drawer-title"
    >
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 id="create-drawer-title" className="text-lg font-semibold mb-4">
          New Drawer
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="drawer-title" className="block text-sm text-gray-600 mb-1">
                Title
              </label>
              <input
                id="drawer-title"
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
                placeholder="Drawer title"
              />
            </div>
            <div>
              <label htmlFor="drawer-password" className="block text-sm text-gray-600 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="drawer-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                  placeholder="Password to encrypt"
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div className="mt-2" aria-live="polite">
                  <div className="flex gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded"
                        style={{
                          height: '6px',
                          backgroundColor: i < strength.score ? strength.color : '#e5e7eb',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="drawer-confirm-password" className="block text-sm text-gray-600 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="drawer-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                  placeholder="Confirm password to encrypt"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
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
              {isLoading ? 'Creating...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateDrawerModal;
