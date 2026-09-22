import React, { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { t } from '../../i18n';
import { toast } from 'react-hot-toast';
import HeartIcon from '../../../icons/svg/heart.svg?react';
import GithubIcon from '../../../icons/svg/github.svg?react';
import EthIcon from '../../../icons/svg/eth.svg?react';
import SolIcon from '../../../icons/svg/sol.svg?react';
import KoFiIcon from '../../../icons/svg/ko-fi.svg?react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Address copied');
    } catch {
      toast.error('Failed to copy');
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Copy address"
      title="Copy address"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  );
}

function CreditsModal({ isOpen, onClose }: CreditsModalProps): React.JSX.Element {
  const modalRef = useRef<HTMLDivElement>(null);

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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">About</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Clavis is an open-source, cross-platform encrypted notes app built to keep your passwords, PINs, bank details, and safe codes private and secure.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mt-2">
              Source code, issues, and contributions are welcome on{' '}
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
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Credits</h3>
            </div>
            <ul className="space-y-2">
              <li className="text-sm text-gray-700">
                <span className="font-medium">Concept, design &amp; development:</span> Marcelo Salvador
              </li>
              <li className="text-sm text-gray-500 italic">
                Thanks to all contributors and early testers
              </li>
            </ul>
          </section>

          <section className="bg-amber-50/60 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <HeartIcon className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Support this project</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Clavis is free and open source. If it&apos;s useful to you, consider supporting its development — every bit helps keep it maintained and improving.
            </p>
            <a
              href="https://ko-fi.com/A0383T5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <KoFiIcon className="w-4 h-4" />
              Buy me a coffee
            </a>

            <div className="mt-4 pt-3 border-t border-amber-200">
              <p className="text-sm font-medium text-gray-800 mb-2">Cryptocurrency <span className="font-normal text-gray-600">(any EVM-compatible chain for ETH):</span></p>
              <ul className="space-y-2">
                <li className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">ETH:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all flex-1" translate="no">0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd</code>
                  <CopyButton text="0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd" />
                </li>
                <li className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">SOL:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all flex-1" translate="no">7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k</code>
                  <CopyButton text="7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k" />
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
                <a href="https://etherscan.io/address/0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <EthIcon className="w-4 h-4 text-gray-600" />
                  ETH
                </a>
                <a href="https://solscan.io/account/7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <SolIcon className="w-4 h-4 text-gray-600" />
                  SOL
                </a>
              </div>
            </div>
          </section>

          <p className="text-center italic text-xs text-gray-400 pt-3 border-t border-gray-100">
            <HeartIcon className="w-3 h-3 inline-block mr-1 text-gray-300" />
            From Portugal, with love.
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
