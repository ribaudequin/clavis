import React, { useState } from 'react';

interface ViewDrawerProps {
  drawerId: string;
  password: string;
  initialTitle: string;
  initialContent: string;
  onSave: (id: string, password: string, title: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

function ViewDrawer({ drawerId, password, initialTitle, initialContent, onSave, onDelete, onBack }: ViewDrawerProps): React.JSX.Element {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (title.trim() === '') {
      alert('Título não pode ser vazio.');
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave(drawerId, password, title, content);
      if (ok) {
        onBack();
      } else {
        alert('Erro ao guardar.');
      }
    } catch {
      alert('Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(): void {
    if (!confirm('Eliminar esta gaveta? Esta ação não pode ser revertida.')) return;
    onDelete(drawerId);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center">
        <h1 className="text-xl font-semibold text-gray-800">Clavis</h1>
      </header>

      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full flex flex-col">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da gaveta"
          className="w-full border rounded px-3 py-2 text-sm mb-4 bg-white"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Texto da gaveta"
          className="flex-1 w-full border rounded px-3 py-2 text-sm bg-white resize-none min-h-[300px]"
        />
      </main>

      <footer className="bg-white border-t px-6 py-4 flex justify-between items-center">
        <button
          onClick={handleDelete}
          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
        >
          eliminar gaveta
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'A guardar...' : 'Salvar gaveta e voltar para o menu'}
        </button>
      </footer>
    </div>
  );
}

export default ViewDrawer;
