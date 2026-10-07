import React, { useState, useEffect, Suspense, lazy } from 'react';
import { DrawerListItem, EncryptedDrawer, ElectronAPI, ErrorCode } from '../../shared/types';
import { SkeletonLoaders } from '../components/SkeletonLoader';
import { t, tError } from '../../i18n';
import { toast } from 'react-hot-toast';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const ViewDrawer = lazy(() => import('./ViewDrawer'));
const CreateDrawerModal = lazy(() => import('../components/CreateDrawerModal'));
const PasswordModal = lazy(() => import('../components/PasswordModal'));
const DeleteConfirmModal = lazy(() => import('../components/DeleteConfirmModal'));
const CreditsModal = lazy(() => import('../components/CreditsModal'));
const HeartIcon = lazy(() => import('../../../icons/svg/heart.svg?react'));

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
  const [importing, setImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState('');

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
    let colors: string[] = [];
    try {
      colors = JSON.parse(iconData);
      if (!Array.isArray(colors)) colors = [];
    } catch {
      colors = [];
    }
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
        toast.error(tError(result.error));
        return;
      }
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.clavis`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('msg.drawer_exported'));
    } finally {
      setExportingId(null);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setConfirmDeleteId(id);
  }

  async function confirmDelete(): Promise<void> {
    if (!confirmDeleteId) {
      setConfirmDeleteId(null);
      return;
    }
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      const result = await api().deleteDrawer(id);
      if (!result.ok) {
        toast.error(tError(result.error));
        window.focus();
        return;
      }
      toast.success(t('msg.drawer_deleted'));
      await loadDrawers();
    } finally {
      setDeletingId(null);
      window.focus();
      // Ensure next modal can receive focus on Windows after dialog closes
      setTimeout(() => window.focus(), 0);
    }
  }

  async function handleImport(): Promise<void> {
    setImporting(true);
    try {
      const result = await api().openFile();
      if (!result.ok) {
        toast.error(tError(result.error));
        return;
      }
      if (!result.data) return;
      try {
        const importResult = await api().importDrawer(result.data.token);
        if (!importResult.ok) {
          toast.error(tError(importResult.error));
          return;
        }
        toast.success(t('msg.imported'));
        await loadDrawers();
      } catch {
        toast.error(t('msg.error_import'));
      }
    } finally {
      setImporting(false);
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
        setUnlockError(tError(result.error));
        return;
      }
      if (result.data === null) {
        setUnlockError(t('label.drawer_not_found'));
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
      setUnlockError(tError({ code: ErrorCode.DECRYPT_FAILED, message: 'Failed to unlock drawer' }));
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
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
        <ViewDrawer
          drawerId={viewState.drawerId}
          password={viewState.password}
          initialTitle={viewState.title}
          initialContent={viewState.content}
          onSave={handleSaveDrawer}
          onDelete={handleDeleteDrawer}
          onBack={() => {
            // P0.9 — Clear password from React state after ViewDrawer unmounts
            setViewState(null);
            loadDrawers();
          }}
        />
      </Suspense>
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
              {t('btn.new')}
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {importing ? t('btn.importing') : t('btn.import')}
            </button>
              <Suspense fallback={<div className="w-5 h-5 animate-pulse bg-gray-200 rounded" />}>
                <button
                  onClick={() => setShowCreditsModal(true)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  aria-label={t('label.credits_title')}
                  title={t('label.credits_title')}
                >
                  <HeartIcon className="w-5 h-5" style={{ color: 'var(--heart-surface)' }} />
                </button>
              </Suspense>
          </div>
       </header>

     <main className="px-6 py-6 max-w-4xl mx-auto">
       {loadingDrawers ? (
         <SkeletonLoaders count={3} />
       ) : drawers.length === 0 ? (
         <div className="text-center py-12">
           <p className="text-gray-500 mb-4">{t('msg.no_drawers')}</p>
           <button
             onClick={() => setShowCreateModal(true)}
             className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
           >
             {t('btn.create_first')}
           </button>
         </div>
       ) : (
         <ul className="space-y-2" role="list">
           {drawers.map((drawer) => (
             <li
               key={drawer.id}
               className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50"
             >
               <button
                 type="button"
                 onClick={() => !exportingId && !deletingId && handleDrawerClick(drawer.id, drawer.title)}
                 disabled={!!exportingId || !!deletingId}
                 className="flex-1 flex items-center gap-3 text-left disabled:opacity-50"
               >
                 <div aria-hidden="true">{renderIcon(drawer.iconData)}</div>
                 <span className="flex-1 text-gray-800">{drawer.title}</span>
               </button>
               <button
                 type="button"
                 onClick={(e) => { e.stopPropagation(); handleExport(drawer.id); }}
                 disabled={exportingId === drawer.id}
                 className="text-xs text-gray-600 hover:text-gray-700 disabled:opacity-50"
               >
                 {exportingId === drawer.id ? t('btn.exporting') : t('btn.export')}
               </button>
               <button
                 type="button"
                 onClick={(e) => { e.stopPropagation(); handleDelete(drawer.id); setConfirmDeleteTitle(drawer.title); }}
                 disabled={deletingId === drawer.id}
                 className="text-xs text-red-700 hover:text-red-800 disabled:opacity-50"
               >
                 {deletingId === drawer.id ? t('btn.deleting') : t('btn.delete')}
               </button>
             </li>
           ))}
         </ul>
       )}
     </main>

     {showCreateModal && (
       <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50" />}>
          <CreateDrawerModal
            key={`create-${drawers.length}`}
            existingTitles={drawers.map((drawer) => drawer.title)}
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
       </Suspense>
     )}

     {unlockDrawerId && (
       <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50" />}>
         <PasswordModal
           drawerTitle={unlockDrawerTitle}
           onClose={closeUnlockModal}
           onSubmit={handleUnlockSubmit}
           error={unlockError}
         />
       </Suspense>
     )}

     {confirmDeleteId && (
       <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50" />}>
         <DeleteConfirmModal
           drawerTitle={confirmDeleteTitle}
           onConfirm={confirmDelete}
           onCancel={() => {
             setConfirmDeleteId(null);
             window.focus();
           }}
         />
       </Suspense>
     )}

     {showCreditsModal && (
       <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50" />}>
         <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
       </Suspense>
     )}
   </div>
 );
}

export default HomeScreen;
