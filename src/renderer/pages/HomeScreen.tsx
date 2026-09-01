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
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          New Drawer
        </button>
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
