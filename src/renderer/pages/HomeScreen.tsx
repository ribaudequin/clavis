import React, { useState, useEffect } from 'react';
import { DrawerListItem } from '../../shared/types';

interface ElectronAPI {
  listDrawers: () => Promise<DrawerListItem[]>;
  createDrawer: (title: string, password: string) => Promise<void>;
  deleteDrawer: (id: string) => Promise<boolean>;
  exportDrawer: (id: string) => Promise<string>;
  importDrawer: (content: string) => Promise<boolean>;
  openFile: () => Promise<void>;
  onFileSelected: (cb: (filePath: string | null) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

function HomeScreen(): React.JSX.Element {
  const [drawers, setDrawers] = useState<DrawerListItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.clavis`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Eliminar esta gaveta? Esta ação não pode ser revertida.')) return;
    await api().deleteDrawer(id);
    loadDrawers();
  }

  async function handleImport(): Promise<void> {
    api().onFileSelected(async (filePath) => {
      if (!filePath) return;
      try {
        const content = await api().importDrawer(filePath);
        if (content) {
          alert('Importado com sucesso');
          loadDrawers();
        } else {
          alert('Erro ao importar');
        }
      } catch {
        alert('Erro ao importar');
      }
    });
    await api().openFile();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">Clavis</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Nova Gaveta
        </button>
      </header>

      <main className="px-6 py-6 max-w-4xl mx-auto">
        {drawers.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Nenhuma gaveta criada.</p>
        ) : (
          <div className="space-y-2">
            {drawers.map((drawer) => (
              <div
                key={drawer.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                <div>{renderIcon(drawer.iconData)}</div>
                <span className="flex-1 text-gray-800">{drawer.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(drawer.id); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Exportar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(drawer.id); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Eliminar
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

  async function handleSubmit(): Promise<void> {
    if (!title.trim()) { alert('Título não pode ser vazio.'); return; }
    if (password !== confirmPassword) { alert('Passwords não coincidem.'); return; }
    if (password.length === 0) { alert('Password não pode ser vazia.'); return; }
    try {
      await window.electronAPI.createDrawer(title, password);
      onCreated();
    } catch {
      alert('Erro ao criar gaveta.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 className="text-lg font-semibold mb-4">Nova Gaveta</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Título da gaveta"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Password para encriptar"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Confirmar Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Confirmar password para encriptar"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancelar
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
