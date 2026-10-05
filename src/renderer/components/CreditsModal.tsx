import React, { useRef, useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { t } from '../../i18n';
import { toast } from 'react-hot-toast';
import HeartIcon from '../../../icons/svg/heart.svg?react';
import KoFiIcon from '../../../icons/svg/ko-fi.svg?react';
import GithubIcon from '../../../icons/svg/github.svg?react';
import EthIcon from '../../../icons/svg/eth.svg?react';
import SolIcon from '../../../icons/svg/sol.svg?react';
import ClavisIcon from '../../../icons/svg/clavis.svg?react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('msg.address_copied'));
    } catch {
      toast.error(t('msg.copy_failed'));
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label={t('btn.copy_address')}
      title={t('btn.copy_address')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  );
}

function CreditsModal({ isOpen, onClose }: CreditsModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function check(): Promise<void> {
      try {
        const res = await (window as { electronAPI?: { checkUpdate?: () => Promise<{ tag_name?: string } | null>; getAppVersion?: () => Promise<string> } }).electronAPI?.checkUpdate?.();
        const tag = (res?.tag_name || '').replace(/^v/, '');
        const current = await (window as { electronAPI?: { getAppVersion?: () => Promise<string> } }).electronAPI?.getAppVersion?.();
        if (!cancelled && tag && current && tag !== String(current || '').replace(/^v/, '')) {
          setNewVersion(res?.tag_name || null);
        }
      } catch {
        // ignore
      }
    }
    check();
    return () => { cancelled = true; };
  }, [isOpen]);

  useFocusTrap(modalRef, { isActive: isOpen, onEscape: onClose });
  useModalKeyboard(modalRef, { onEscape: onClose });

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto overscroll-behave-contain animate-in zoom-in-95 duration-200"
      >
        <div className="relative p-6 pb-2">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <HeartIcon className="w-5 h-5 text-red-500" />
            </div>
            <h2 id="credits-title" className="text-xl font-bold text-gray-900 text-pretty leading-tight">
              {t('label.credits_title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('btn.close')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="px-6 pb-2 space-y-3">
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ClavisIcon className="w-4 h-4 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">{t('label.about')}</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('msg.about_description')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mt-2">
              {t('msg.source_welcome')}{' '}
              <a href="https://github.com/ribaudequin/clavis" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                GitHub
              </a>.
            </p>
          </section>

          <section className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('label.credits')}</h3>
            </div>
            <ul className="space-y-2">
              <li className="text-sm text-gray-700">
                <span className="font-medium">{t('label.credits_role')}</span> Marcelo Salvador
              </li>
              <li className="text-sm text-gray-500 italic">
                {t('msg.thanks_contributors')}
              </li>
            </ul>
          </section>

          <section className="bg-amber-50/60 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <HeartIcon className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">{t('label.support_project')}</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {t('msg.support_description')}
            </p>
            <a
              href="https://ko-fi.com/A0383T5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <KoFiIcon className="w-4 h-4" />
              {t('btn.buy_coffee')}
            </a>

            <div className="mt-4 pt-3 border-t border-amber-200">
              <p className="text-sm font-medium text-gray-800 mb-2">{t('label.cryptocurrency')} <span className="font-normal text-gray-600">{t('msg.crypto_network_hint')}</span></p>
              <ul className="space-y-2">
                <li className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">ETH:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all flex-1" translate="no">0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4</code>
                  <CopyButton text="0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4" />
                </li>
                <li className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">SOL:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all flex-1" translate="no">Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf</code>
                  <CopyButton text="Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf" />
                </li>
              </ul>
              <div className="flex gap-2 mt-3">
                <a href="https://ko-fi.com/A0383T5" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <KoFiIcon className="w-4 h-4 text-gray-600" />
                  Ko-fi
                </a>
                <a href="https://github.com/ribaudequin/clavis" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <GithubIcon className="w-4 h-4 text-gray-600" />
                  GitHub
                </a>
                <a href="https://etherscan.io/address/0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <EthIcon className="w-4 h-4 text-gray-600" />
                  ETH
                </a>
                <a href="https://solscan.io/account/Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <SolIcon className="w-4 h-4 text-gray-600" />
                  SOL
                </a>
              </div>
              {newVersion ? (
                <a href="https://github.com/ribaudequin/clavis/releases/latest" target="_blank" rel="noopener noreferrer" className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all">
                  <GithubIcon className="w-5 h-5 text-white" />
                  {t('msg.update_available', { version: newVersion })}
                </a>
              ) : null}
            </div>
          </section>

          <p className="text-center italic text-xs text-gray-400 pt-3 border-t border-gray-100">
            <HeartIcon className="w-3 h-3 inline-block mr-1 text-gray-300" />
            {t('msg.from_portugal')}
          </p>
        </div>

        <div className="px-6 pb-6 pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
          >
            {t('btn.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditsModal;