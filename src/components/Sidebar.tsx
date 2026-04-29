'use client';
import { useState, useCallback } from 'react';
import FileTree from './FileTree';
import ContextMenu from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import type { TreeNode } from '@/types/electron';
import { useFileTree } from '@/hooks/useFileTree';
import styles from './Sidebar.module.css';

interface Props {
  open: boolean;
  onSelectFile?: (path: string, name: string) => void;
}

export default function Sidebar({ open, onSelectFile }: Props) {
  const { tree, loading, error, refresh } = useFileTree();
  const [selectedPath, setSelectedPath] = useState('');

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Create state (inline input at folder level)
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [createValue, setCreateValue] = useState('');

  /* ── FS helpers ────────────────────────────────────── */
  const fsAction = useCallback(async (body: Record<string, string>) => {
    try {
      const res = await fetch('/api/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('FS action failed:', data.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('FS action error:', e);
      return false;
    }
  }, []);

  /* ── Context menu handler ─────────────────────────── */
  const handleContextAction = useCallback((e: React.MouseEvent, node: TreeNode) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  /* ── Rename ───────────────────────────────────────── */
  const startRename = useCallback((node: TreeNode) => {
    setRenamingPath(node.path);
    setRenameValue(node.name);
    setCtxMenu(null);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const cleanPath = renamingPath.replace(/^.*Workspace[\\/]/, '');
    const ok = await fsAction({ action: 'rename', filePath: cleanPath, newName: renameValue.trim() });
    setRenamingPath(null);
    if (ok) refresh();
  }, [renamingPath, renameValue, fsAction, refresh]);

  /* ── Create file / folder ─────────────────────────── */
  const startCreate = useCallback((parentPath: string, type: 'file' | 'folder') => {
    setCreating({ parentPath, type });
    setCreateValue('');
    setCtxMenu(null);
  }, []);

  const commitCreate = useCallback(async () => {
    if (!creating || !createValue.trim()) {
      setCreating(null);
      return;
    }
    const cleanParent = creating.parentPath.replace(/^.*Workspace[\\/]/, '');
    const newPath = cleanParent ? `${cleanParent}/${createValue.trim()}` : createValue.trim();
    const action = creating.type === 'folder' ? 'mkdir' : 'create';
    const ok = await fsAction({ action, filePath: newPath });
    setCreating(null);
    if (ok) refresh();
  }, [creating, createValue, fsAction, refresh]);

  /* ── Delete ───────────────────────────────────────── */
  const handleDelete = useCallback(async (node: TreeNode) => {
    setCtxMenu(null);
    const confirmed = window.confirm(`Delete "${node.name}"? This cannot be undone.`);
    if (!confirmed) return;
    const cleanPath = node.path.replace(/^.*Workspace[\\/]/, '');
    const ok = await fsAction({ action: 'delete', filePath: cleanPath });
    if (ok) refresh();
  }, [fsAction, refresh]);

  /* ── Build context menu items ─────────────────────── */
  const getMenuItems = (node: TreeNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: 'Rename',
        icon: <RenameIcon />,
        onClick: () => startRename(node),
      },
    ];

    if (node.type === 'folder') {
      items.push(
        {
          label: 'New File',
          icon: <NewFileIcon />,
          onClick: () => startCreate(node.path, 'file'),
        },
        {
          label: 'New Folder',
          icon: <NewFolderIcon />,
          onClick: () => startCreate(node.path, 'folder'),
        },
      );
    }

    items.push({
      label: 'Delete',
      icon: <DeleteIcon />,
      onClick: () => handleDelete(node),
      danger: true,
    });

    return items;
  };

  /* ── Render tree node with rename/create overlays ── */
  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map((node, i) => {
      // If this node is being renamed, show inline input instead
      if (renamingPath === node.path) {
        return (
          <div key={node.path} className={styles.renameRow}>
            <input
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingPath(null);
              }}
              onBlur={commitRename}
              autoFocus
            />
          </div>
        );
      }

      return (
        <div key={node.path ?? i}>
          <FileTree
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            onSelectFile={onSelectFile}
            onContextAction={handleContextAction}
          />
          {/* If creating inside this folder, show inline input */}
          {creating && node.type === 'folder' && creating.parentPath === node.path && (
            <div className={styles.createRow}>
              <span className={styles.createIcon}>
                {creating.type === 'folder' ? '📁' : '📄'}
              </span>
              <input
                className={styles.renameInput}
                placeholder={creating.type === 'folder' ? 'Folder name…' : 'File name…'}
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCreate();
                  if (e.key === 'Escape') setCreating(null);
                }}
                onBlur={commitCreate}
                autoFocus
              />
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.inner}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className={styles.header}>
          <span className={styles.headerIcon}>◆</span>
          <span className={styles.headerTitle}>Workspace</span>
          <button
            id="refresh-workspace-btn"
            className={styles.headerBtn}
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh workspace"
          >
            <RefreshIcon />
          </button>
        </div>

        {/* ── Section label ──────────────────────────────── */}
        <div className={styles.sectionLabel}>Files</div>

        {/* ── Tree ───────────────────────────────────────── */}
        <div className={styles.treeContainer}>
          {loading && (
            <div className={styles.stateBox}>
              <LoadingDots />
              <span className={styles.stateText}>Loading workspace…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.stateBox}>
              <span className={styles.stateText}>⚠ {error}</span>
            </div>
          )}

          {!loading && !error && tree.length === 0 && (
            <div className={styles.stateBox}>
              <span className={styles.stateText}>No files yet</span>
              <span className={styles.stateHint}>Add files to the Workspace folder</span>
            </div>
          )}

          {!loading && !error && renderTree(tree)}
        </div>

      </div>

      {/* ── Context Menu ─────────────────────────────────── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getMenuItems(ctxMenu.node)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </aside>
  );
}

/* ── Inline icons ──────────────────────────────────────────────────────────── */
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <polyline points="8,2 12,2 12,6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LoadingDots() {
  return <span className={styles.loadingDots}><span/><span/><span/></span>;
}

function RenameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function NewFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function NewFolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
