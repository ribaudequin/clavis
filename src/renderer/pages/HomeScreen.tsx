import React, { useState, useEffect } from 'react';
import { DrawerListItem, EncryptedDrawer } from '../../shared/types';
import PasswordModal from '../components/PasswordModal';
import ViewDrawer from './ViewDrawer';

interface ElectronAPI {
  listDrawers: () => Promise<DrawerListItem[]>;
  createDrawer: (title: string, password: string) => Promise<EncryptedDrawer>;
  unlockDrawer: (id: string, password: string) => Promise<{ title: string; content: string; iconData: string } | null>;
  saveDrawer: (id: string, password: string, title: string, content: string) => Promise<boolean>;
  deleteDrawer: (id: string) => Promise<boolean>;
  exportDrawer: (id: string) => Promise<string | null>;
  importDrawer: (filePath: string) => Promise<boolean>;
  openFile: () => Promise<string | null>;
}

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

  const api = (): ElectronAPI => window.electronAPI;

  async function loadDrawers(): Promise<void> {
    const data = await api().listDrawers();
    setDrawers(data);
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
    const content = await api().exportDrawer(id);
    if (!content) {
      alert('Error exporting.');
      return;
    }
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.clavis`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Delete this drawer? This action cannot be undone.')) return;
    await api().deleteDrawer(id);
    loadDrawers();
  }

  async function handleImport(): Promise<void> {
    const filePath = await api().openFile();
    if (!filePath) return;
    try {
      const ok = await api().importDrawer(filePath);
      if (ok) {
        alert('Imported successfully');
        await loadDrawers();
      } else {
        alert('Error importing');
      }
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
      if (!result) {
        setUnlockError('Incorrect password.');
        return;
      }
      setUnlockDrawerId(null);
      setViewState({
        drawerId: unlockDrawerId,
        password,
        title: result.title,
        content: result.content,
      });
    } catch {
      setUnlockError('Incorrect password.');
    }
  }

  function closeUnlockModal(): void {
    setUnlockDrawerId(null);
    setUnlockError(null);
  }

  async function handleSaveDrawer(id: string, password: string, title: string, content: string): Promise<boolean> {
    return api().saveDrawer(id, password, title, content);
  }

  async function handleDeleteDrawer(id: string): Promise<void> {
    await api().deleteDrawer(id);
    setViewState(null);
    loadDrawers();
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
         </div>
       </header>

      <main className="px-6 py-6 max-w-4xl mx-auto">
        {drawers.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No drawers created.</p>
        ) : (
          <div className="space-y-2">
            {drawers.map((drawer) => (
              <div
                key={drawer.id}
                onClick={() => handleDrawerClick(drawer.id, drawer.title)}
                className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                <div>{renderIcon(drawer.iconData)}</div>
                <span className="flex-1 text-gray-800">{drawer.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(drawer.id); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Export
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(drawer.id); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateDrawerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
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
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Credits</h2>
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
            
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-2">Maintained by</h3>
                <p className="text-sm text-gray-600">Marcelo Salvador</p>
              </div>
              
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-2">Design</h3>
                <p className="text-sm text-gray-600">Wireframes and UI mockups documented in the <code className="bg-gray-100 px-1 rounded">wireframes</code> directory</p>
              </div>
              
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-2">Icons</h3>
                <p className="text-sm text-gray-600">Deterministic icon generation system documented in <code className="bg-gray-100 px-1 rounded">wireframes/04-esquema-icones.md</code></p>
              </div>
              
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-2">Security Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• AES-256-GCM encryption for drawer contents</li>
                  <li>• Argon2id memory-hard key derivation</li>
                  <li>• Sandboxed Electron renderer</li>
                  <li>• Content Security Policy (CSP) enforcement</li>
                  <li>• UUID validation for drawer IDs</li>
                  <li>• File permissions (0o600 for .clavis files)</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-2">Architecture</h3>
                <p className="text-sm text-gray-600">Electron + TypeScript + React + Tailwind CSS</p>
              </div>
              
               <div>
                 <h3 className="text-md font-medium text-gray-800 mb-2">Support</h3>
                 <p className="text-sm text-gray-600 mb-3">If you find this project useful, consider supporting its development:</p>
                 <div className="flex gap-4">
                   <a href="https://ko-fi.com/A0383T5" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                     </svg>
                     Ko-fi
                   </a>
                   <a href="https://github.com/ribaudequin/clavis" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                     </svg>
                     GitHub
                   </a>
                   <a href="https://etherscan.io/address/0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.5 9h-4l2-4.5-6.5 8.5h4l-2 4.5 6.5-8.5z" />
                     </svg>
                     ETH
                   </a>
                   <a href="https://solscan.io/account/7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 16h4v2h-4zm0-8h4v8h-4zm0-4h4v4h-4z" />
                     </svg>
                     SOL
                   </a>
                 </div>
               </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                OK
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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(): Promise<void> {
    if (title.trim() === '') { alert('Title cannot be empty.'); return; }
    if (password !== confirmPassword) { alert('Passwords do not match.'); return; }
    if (password.length < 8) { alert('The password must be at least 8 characters long.'); return; }
    try {
      await window.electronAPI.createDrawer(title, password);
      onCreated();
    } catch {
      alert('Error creating drawer.');
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 className="text-lg font-semibold mb-4">New Drawer</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Drawer title"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Password to encrypt"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Confirm password to encrypt"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
