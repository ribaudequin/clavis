import React, { useState, useEffect } from 'react';
import { DrawerListItem, EncryptedDrawer, ElectronAPI } from '../../shared/types';
import PasswordModal from '../components/PasswordModal';
import ViewDrawer from './ViewDrawer';
import HeartIcon from '../../../icons/svg/heart.svg?react';
import GithubIcon from '../../../icons/svg/github.svg?react';
import EthIcon from '../../../icons/svg/eth.svg?react';
import SolIcon from '../../../icons/svg/sol.svg?react';
import KoFiIcon from '../../../icons/svg/ko-fi.svg?react';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface ViewState {
  drawerId: string;
  password: string;
  title: string;
  content: string;
}

function HomeScreen(): React.JSX.Element {
  const [drawers, setDrawers] = useState<DrawerListItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [unlockDrawerId, setUnlockDrawerId] = useState<string | null>(null);
  const [unlockDrawerTitle, setUnlockDrawerTitle] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [loadingDrawers, setLoadingDrawers] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const api = (): ElectronAPI => window.electronAPI;

  async function loadDrawers(): Promise<void> {
    setLoadingDrawers(true);
    try {
      const result = await api().listDrawers();
      if (!result.ok) {
        console.error('Failed to list drawers:', result.error);
        return;
      }
      setDrawers(result.data);
    } finally {
      setLoadingDrawers(false);
    }
  }

  useEffect(() => {
    loadDrawers();
  }, []);

  function renderIcon(iconData: string): React.JSX.Element {
    const colors: string[] = JSON.parse(iconData);
    return (
      <div className="grid grid-cols-3 grid-rows-3 w-8 h-8 gap-0.5">
        {colors.map((color, i) => (
          <div key={i} className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
        ))}
      </div>
    );
  }

  async function handleExport(id: string): Promise<void> {
    setExportingId(id);
    try {
      const result = await api().exportDrawer(id);
      if (!result.ok) {
        alert(`Error exporting: ${result.error.message}`);
        return;
      }
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.clavis`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Delete this drawer? This action cannot be undone.')) {
      window.focus();
      return;
    }
    window.focus();
    setDeletingId(id);
    try {
      const result = await api().deleteDrawer(id);
      if (!result.ok) {
        alert(`Error deleting: ${result.error.message}`);
        window.focus();
        return;
      }
      await loadDrawers();
    } finally {
      setDeletingId(null);
      window.focus();
      // Ensure next modal can receive focus on Windows after native confirm steals it
      setTimeout(() => window.focus(), 0);
    }
  }

  async function handleImport(): Promise<void> {
    const result = await api().openFile();
    if (!result.ok) {
      alert(`Error: ${result.error.message}`);
      return;
    }
    if (!result.data) return;
    try {
      const importResult = await api().importDrawer(result.data.token);
      if (!importResult.ok) {
        alert(`Error importing: ${importResult.error.message}`);
        return;
      }
      alert('Imported successfully');
      await loadDrawers();
    } catch {
      alert('Error importing');
    }
  }

  function handleDrawerClick(id: string, title: string): void {
    setUnlockDrawerId(id);
    setUnlockDrawerTitle(title);
    setUnlockError(null);
  }

  async function handleUnlockSubmit(password: string): Promise<void> {
    if (!unlockDrawerId) return;
    try {
      const result = await api().unlockDrawer(unlockDrawerId, password);
      if (!result.ok) {
        setUnlockError(result.error.message);
        return;
      }
      if (result.data === null) {
        setUnlockError('Drawer not found.');
        return;
      }
      setUnlockDrawerId(null);
      setViewState({
        drawerId: unlockDrawerId,
        password,
        title: result.data.title,
        content: result.data.content,
      });
    } catch {
      setUnlockError('Incorrect password.');
    }
  }

  function closeUnlockModal(): void {
    setUnlockDrawerId(null);
    setUnlockError(null);
  }

  async function handleSaveDrawer(
    id: string,
    password: string,
    title: string,
    content: string
  ): Promise<import('../../shared/types').Result<void>> {
    return api().saveDrawer(id, password, title, content);
  }

  async function handleDeleteDrawer(id: string): Promise<import('../../shared/types').Result<void>> {
    return api().deleteDrawer(id);
  }

  if (viewState) {
    return (
      <ViewDrawer
        drawerId={viewState.drawerId}
        password={viewState.password}
        initialTitle={viewState.title}
        initialContent={viewState.content}
        onSave={handleSaveDrawer}
        onDelete={handleDeleteDrawer}
        onBack={() => { setViewState(null); loadDrawers(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
       <header className="bg-white border-b px-6 py-4 flex justify-between items-center cursor-default">
         <h1 className="text-xl font-semibold text-gray-800">Clavis</h1>
         <div className="flex gap-2 items-center">
           <button
             onClick={() => setShowCreateModal(true)}
             className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
           >
             New Drawer
           </button>
             <button
               onClick={() => setShowCreditsModal(true)}
               className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
               aria-label="Credits"
               title="Credits"
             >
               <HeartIcon className="w-5 h-5 text-gray-600" />
             </button>
         </div>
       </header>

      <main className="px-6 py-6 max-w-4xl mx-auto">
        {loadingDrawers ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : drawers.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No drawers created.</p>
        ) : (
          <div className="space-y-2">
            {drawers.map((drawer) => (
              <div
                key={drawer.id}
                onClick={() => !exportingId && !deletingId && handleDrawerClick(drawer.id, drawer.title)}
                className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                <div>{renderIcon(drawer.iconData)}</div>
                <span className="flex-1 text-gray-800">{drawer.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(drawer.id); }}
                  disabled={exportingId === drawer.id}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  {exportingId === drawer.id ? 'Exporting...' : 'Export'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(drawer.id); }}
                  disabled={deletingId === drawer.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === drawer.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateDrawerModal
          key={`create-${drawers.length}`}
          onClose={() => {
            setShowCreateModal(false);
            window.focus();
          }}
          onCreated={() => {
            setShowCreateModal(false);
            window.focus();
            loadDrawers();
          }}
        />
      )}

      {unlockDrawerId && (
        <PasswordModal
          drawerTitle={unlockDrawerTitle}
          onClose={closeUnlockModal}
          onSubmit={handleUnlockSubmit}
          error={unlockError}
        />
      )}

      {showCreditsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg p-6 w-[480px] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Credits &amp; support</h2>
              <button
                onClick={() => setShowCreditsModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close credits"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <p>
                Clavis is an open-source, cross-platform encrypted notes app built to keep your passwords, PINs, bank details, and safe codes private and secure.
              </p>
              <p>
                Source code, issues, and contributions are welcome on{' '}
                <a href="https://github.com/ribaudequin/clavis" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  GitHub
                </a>.
              </p>

              <div>
                <h3 className="text-md font-medium text-gray-800 mb-1">Credits</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><span className="font-medium">Concept, design &amp; development:</span> Marcelo Salvador</li>
                  <li><span className="font-medium">Thanks to:</span> all contributors and early testers</li>
                </ul>
              </div>

              <div>
                <h3 className="text-md font-medium text-gray-800 mb-1">Support this project</h3>
                <p className="mb-1">Clavis is free and open source. If it&apos;s useful to you, consider supporting its development — every bit helps keep it maintained and improving.</p>
                <p>
                  <span className="font-medium">Ko-fi:</span>{' '}
                  <a href="https://ko-fi.com/A0383T5" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    https://ko-fi.com/A0383T5
                  </a>
                </p>
                <p className="mt-2 font-medium">Cryptocurrency <span className="font-normal">(any EVM-compatible chain for ETH):</span></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li><span className="font-medium">ETH:</span> <code className="bg-gray-100 px-1 rounded text-xs break-all">0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd</code></li>
                  <li><span className="font-medium">SOL:</span> <code className="bg-gray-100 px-1 rounded text-xs break-all">7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k</code></li>
                </ul>
                <div className="flex gap-4 mt-3">
                  <a href="https://ko-fi.com/A0383T5" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <KoFiIcon className="w-5 h-5 text-gray-600" />
                    Ko-fi
                  </a>
                  <a href="https://github.com/ribaudequin/clavis" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <GithubIcon className="w-5 h-5 text-gray-600" />
                    GitHub
                  </a>
                  <a href="https://etherscan.io/address/0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <EthIcon className="w-5 h-5 text-gray-600" />
                    ETH
                  </a>
                  <a href="https://solscan.io/account/7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <SolIcon className="w-5 h-5 text-gray-600" />
                    SOL
                  </a>
                </div>
              </div>

              <p className="text-center italic pt-2 border-t">From Portugal, with love.</p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateDrawerModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Windows: after native confirm() steals focus, explicitly focus first input
    titleRef.current?.focus();
    window.focus();
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(): Promise<void> {
    if (title.trim() === '') { alert('Title cannot be empty.'); return; }
    if (password !== confirmPassword) { alert('Passwords do not match.'); return; }
    if (password.length < 8) { alert('The password must be at least 8 characters long.'); return; }
    setIsLoading(true);
    try {
      const result = await window.electronAPI.createDrawer(title, password);
      if (!result.ok) {
        alert(`Error: ${result.error.message}`);
        return;
      }
      onCreated();
    } catch {
      alert('Error creating drawer.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 className="text-lg font-semibold mb-4">New Drawer</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input
              ref={titleRef}
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
              placeholder="Drawer title"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
              placeholder="Password to encrypt"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
              placeholder="Confirm password to encrypt"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
