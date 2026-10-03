import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { EyeOpenIcon, EyeClosedIcon } from '../components/EyeIcons';
import { t } from '../../i18n';
import { toast } from 'react-hot-toast';

interface CreateDrawerModalProps {
  onClose: () => void;
  onCreated: () => void;
  existingTitles?: string[];
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function findDuplicateTitle(title: string, existingTitles?: string[]): string | null {
  if (!existingTitles) return null;
  const target = normalizeTitle(title);
  if (target === '') return null;
  return existingTitles.find((candidate) => normalizeTitle(candidate) === target) ?? null;
}

function CreateDrawerModal({ onClose, onCreated, existingTitles }: CreateDrawerModalProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const changeTitleRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, { isActive: true, onEscape: onClose });
  useModalKeyboard(modalRef, { onEscape: onClose });

  useEffect(() => {
    titleRef.current?.focus();
    window.focus();
  }, []);

  useEffect(() => {
    if (duplicateTitle !== null) {
      changeTitleRef.current?.focus();
    }
  }, [duplicateTitle]);

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

  async function createDrawer(): Promise<void> {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.createDrawer(title, password);
      if (!result.ok) {
        toast.error(`Error: ${result.error.message}`);
        return;
      }
      toast.success(t('msg.drawer_created'));
      onCreated();
    } catch {
      toast.error(t('msg.error_create'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent): Promise<void> {
    if (e) e.preventDefault();
    if (title.trim() === '') {
      toast.error(t('msg.title_empty'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('msg.password_mismatch'));
      return;
    }
    if (password.length < 8) {
      toast.error(t('msg.password_too_short'));
      return;
    }
    const duplicate = findDuplicateTitle(title, existingTitles);
    if (duplicate !== null) {
      setDuplicateTitle(duplicate);
      return;
    }
    await createDrawer();
  }

  async function handleCreateAnyway(): Promise<void> {
    await createDrawer();
  }

  function handleChangeTitle(): void {
    setDuplicateTitle(null);
    titleRef.current?.focus();
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
          {t('label.new_drawer')}
        </h2>
        {duplicateTitle === null ? (
          <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="drawer-title" className="block text-sm text-gray-600 mb-1">
                {t('label.title')}
              </label>
              <input
                id="drawer-title"
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
                placeholder={t('label.title')}
              />
            </div>
            <div>
              <label htmlFor="drawer-password" className="block text-sm text-gray-600 mb-1">
                {t('label.password')}
              </label>
              <div className="relative">
                <input
                  id="drawer-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                  placeholder={t('label.password')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  aria-label={showPassword ? t('label.hide_password') : t('label.show_password')}
                  aria-pressed={showPassword}
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
                {t('label.confirm_password')}
              </label>
              <div className="relative">
                <input
                  id="drawer-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                  placeholder={t('label.confirm_password')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  aria-label={showConfirmPassword ? t('label.hide_password') : t('label.show_password')}
                  aria-pressed={showConfirmPassword}
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
              {t('btn.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? t('btn.creating') : t('btn.ok')}
            </button>
          </div>
        </form>
        ) : (
          <div className="space-y-3">
            <div role="alert" className="bg-yellow-50 border border-yellow-300 rounded p-3">
              <p className="text-sm text-yellow-800">{t('msg.title_duplicate')}</p>
              <p className="text-sm text-yellow-800 font-medium mt-1 break-words">{duplicateTitle}</p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                ref={changeTitleRef}
                type="button"
                onClick={handleChangeTitle}
                disabled={isLoading}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                {t('btn.change_title')}
              </button>
              <button
                type="button"
                onClick={handleCreateAnyway}
                disabled={isLoading}
                className="px-3 py-1 text-sm text-white bg-yellow-600 rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                {isLoading ? t('btn.creating') : t('btn.create_anyway')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateDrawerModal;
