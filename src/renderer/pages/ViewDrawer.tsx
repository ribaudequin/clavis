import React, { useState } from 'react';
import { Result } from '../../shared/types';
import { MAX_PLAINTEXT_BYTES, MAX_CONTENT_CODE_POINTS, countCodePoints } from '../../shared/limits';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DiscardChangesModal from '../components/DiscardChangesModal';
import { t, tError, formatNumber } from '../../i18n';
import { toast } from 'react-hot-toast';

export const CONTENT_COUNTER_DEBOUNCE_MS = 200;

function measureContent(value: string): { codePoints: number; bytes: number } {
  return {
    codePoints: countCodePoints(value),
    bytes: new TextEncoder().encode(value).length,
  };
}

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [metrics, setMetrics] = useState(() => measureContent(initialContent));
  const measuredContentRef = React.useRef(initialContent);

  React.useEffect(() => {
    if (content === measuredContentRef.current) return;
    const timer = setTimeout(() => {
      measuredContentRef.current = content;
      setMetrics(measureContent(content));
    }, CONTENT_COUNTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content]);

  const isDirty = title !== initialTitle || content !== initialContent;

  async function doDelete(): Promise<void> {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const result = await onDelete(drawerId);
      if (!result.ok) {
        toast.error(tError(result.error));
        return;
      }
      toast.success(t('msg.drawer_deleted'));
      onBack();
    } catch {
      // A thrown delete is a rejected bridge call, not a refusal the main process
      // described, so there is no detail to append: use the complete sentence rather
      // than the prefix-shaped `msg.error_delete`, which would render a trailing colon
      // with nothing after it.
      toast.error(t('msg.error_delete_failed'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (title.trim() === '') {
      toast.error(t('msg.title_empty'));
      return;
    }
    setSaving(true);
    spinnerTimeoutRef.current = setTimeout(() => setShowSpinner(true), 250);
    try {
      const result = await onSave(drawerId, password, title, content);
      if (!result.ok) {
        toast.error(tError(result.error));
        return;
      }
      onBack();
    } catch {
      toast.error(t('msg.error_save'));
    } finally {
      if (spinnerTimeoutRef.current) {
        clearTimeout(spinnerTimeoutRef.current);
        spinnerTimeoutRef.current = null;
      }
      setSaving(false);
      setShowSpinner(false);
    }
  }

  function handleDelete(): void {
    setShowDeleteConfirm(true);
  }

  function handleBack(): void {
    if (!isDirty) {
      onBack();
      return;
    }
    setShowDiscardConfirm(true);
  }

  function closeDiscardConfirm(): void {
    setShowDiscardConfirm(false);
    window.focus();
  }

  function handleDiscardAndLeave(): void {
    setShowDiscardConfirm(false);
    onBack();
  }

  function handleSaveAndLeave(): void {
    setShowDiscardConfirm(false);
    void handleSave();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void handleSave();
    }
  }

  // Counted in the two units the ceilings are actually expressed in: code points (what
  // the save schema's .max() counts) and UTF-8 bytes (what encrypt() enforces). Not
  // grapheme clusters — those were both the wrong unit for the label and O(n) work
  // repeated on every keystroke, since content is a controlled textarea. The bar is
  // driven by bytes alone because that is the cap that refuses the save (SAV-01).
  const { codePoints, bytes } = metrics;
  // Formatted per render so a language change is reflected without a content edit.
  const maxBytes = formatNumber(MAX_PLAINTEXT_BYTES);
  const bytePct = Math.min(bytes / MAX_PLAINTEXT_BYTES, 1);
  // Rounded once and reused by both the bar width and the label, so the two cannot
  // disagree — an unrounded width beside a rounded label reads as two different numbers.
  const pct = Math.min(Math.round(bytePct * 100), 100);
  const atRisk = bytePct >= 0.9;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      <header className="bg-white border-b px-6 py-4 flex items-center cursor-default">
        <button onClick={handleBack} className="text-blue-600 hover:text-blue-800 mr-4 text-sm">
          ← {t('btn.back')}
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Clavis</h1>
      </header>

      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full flex flex-col">
        <label htmlFor="drawer-title-input" className="sr-only">{t('label.title')}</label>
        <input
          id="drawer-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving || deleting}
          placeholder={t('label.title')}
          className="w-full border border-input rounded px-3 py-2 text-sm mb-4 bg-white disabled:opacity-50"
        />
        <label htmlFor="drawer-content-textarea" className="sr-only">{t('label.content')}</label>
        <textarea
          id="drawer-content-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={saving || deleting}
          placeholder={t('label.content')}
          className="flex-1 w-full border border-input rounded px-3 py-2 text-sm bg-white resize-none min-h-[300px] disabled:opacity-50"
        />
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          {/* Characters are a count, not a limit. The code-point ceiling can never be the one
              that refuses a save: every code point costs 1-4 UTF-8 bytes, so passing the byte
              cap implies passing it. Showing it as a percentage of anything was therefore
              misleading by construction — it read "half full" next to a full red bar. */}
          <span className="shrink-0">{t('label.characters', { cp: formatNumber(codePoints) })}</span>
          <span aria-hidden="true">·</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className={bytePct >= 1 ? 'bg-red-600' : bytePct >= 0.9 ? 'bg-amber-500' : 'bg-green-500'} style={{ width: `${pct}%`, height: '100%', borderRadius: 9999 }} />
          </div>
          <span className="shrink-0 tabular-nums">{t('label.percent', { pct: String(pct) })}</span>
          <span aria-hidden="true">·</span>
          <span className={atRisk ? 'shrink-0 text-amber-600 font-medium tabular-nums' : 'shrink-0 tabular-nums'}>{t('label.bytes', { b: formatNumber(bytes), max: maxBytes })}</span>
          {bytePct >= 1 && <span className="text-red-600 font-semibold ml-2">{t('label.at_limit', { b: formatNumber(bytes), max: maxBytes })}</span>}
          {bytePct < 1 && codePoints >= Math.round(MAX_CONTENT_CODE_POINTS * 0.9) && <span className="text-amber-600 font-medium ml-2">{t('label.near_code_points')}</span>}
        </div>
      </main>

      <footer className="bg-white border-t px-6 py-4 flex justify-between items-center">
        <button
          onClick={handleDelete}
          disabled={saving || deleting}
          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
        >
          {deleting ? t('msg.deleting') : t('btn.delete_drawer')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
        >
          {saving && showSpinner ? (
            <>
              <span className="inline-block animate-spin">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              </span>
              {t('msg.saving')}
            </>
          ) : (saving ? t('msg.saving') : t('btn.save_and_back'))}
        </button>
      </footer>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          drawerTitle={title}
          onConfirm={doDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            window.focus();
          }}
        />
      )}

      {showDiscardConfirm && (
        <DiscardChangesModal
          onSaveAndLeave={handleSaveAndLeave}
          onDiscard={handleDiscardAndLeave}
          onCancel={closeDiscardConfirm}
          saving={saving}
        />
      )}
    </div>
  );
}

export default ViewDrawer;
