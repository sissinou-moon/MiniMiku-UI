'use client';
import { useState } from 'react';
import FileTree from './FileTree';
import { useFileTree } from '@/hooks/useFileTree';
import styles from './Sidebar.module.css';

interface Props {
  open: boolean;
  onSelectFile?: (path: string, name: string) => void;
}

export default function Sidebar({ open, onSelectFile }: Props) {
  const { tree, loading, error, refresh } = useFileTree();
  const [selectedPath, setSelectedPath] = useState('');

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

          {!loading && !error && tree.map((node, i) => (
            <FileTree
              key={node.path ?? i}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>

      </div>
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
