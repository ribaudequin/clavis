import React, { useState } from 'react';
import { Result } from '../../shared/types';

interface ViewDrawerProps {
  drawerId: string;
  password: string;
  initialTitle: string;
  initialContent: string;
  onSave: (id: string, password: string, title: string, content: string) => Promise<Result<void>>;
  onDelete: (id: string) => Promise<Result<void>>;
  onBack: () => void;
}

function ViewDrawer({ drawerId, password, initialTitle, initialContent, onSave, onDelete, onBack }: ViewDrawerProps): React.JSX.Element {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(): Promise<void> {
    if (title.trim() === '') {
      alert('Title cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const result = await onSave(drawerId, password, title, content);
      if (!result.ok) {
        alert(`Error saving drawer: ${result.error.message}`);
        return;
      }
      onBack();
    } catch {
      alert('Error saving drawer.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm('Delete this drawer? This action cannot be undone.')) {
      window.focus();
      return;
    }
    window.focus();
    setDeleting(true);
    try {
      const result = await onDelete(drawerId);
      if (!result.ok) {
        alert(`Error deleting: ${result.error.message}`);
        window.focus();
        return;
      }
      onBack();
    } catch {
      window.focus();
    } finally {
      setDeleting(false);
      setTimeout(() => window.focus(), 0);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center cursor-default">
        <h1 className="text-xl font-semibold text-gray-800">Clavis</h1>
      </header>

      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full flex flex-col">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          placeholder="Drawer title"
          className="w-full border rounded px-3 py-2 text-sm mb-4 bg-white disabled:opacity-50"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={saving}
          placeholder="Drawer content"
          className="flex-1 w-full border rounded px-3 py-2 text-sm bg-white resize-none min-h-[300px] disabled:opacity-50"
        />
      </main>

      <footer className="bg-white border-t px-6 py-4 flex justify-between items-center">
        <button
          onClick={handleDelete}
          disabled={saving || deleting}
          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'delete drawer'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save drawer and back to menu'}
        </button>
      </footer>
    </div>
  );
}

export default ViewDrawer;
