'use client';
import styles from './TabBar.module.css';

interface Tab {
  id: string;
  title: string;
  type: 'chat' | 'file';
  isDirty?: boolean;
}

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeDoc?: { title: string; onDownload: () => void; onSave: () => void } | null;
}

export default function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  sidebarOpen,
  onToggleSidebar,
  activeDoc,
}: Props) {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <header className={styles.tabBar}>

      {/* ── Left: App Identity ──────────────────────────── */}
      <div className={styles.left}>
        <button
          id="sidebar-toggle"
          className={styles.sidebarToggle}
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen
            ? <SidebarIcon open />
            : <SidebarIcon open={false} />}
        </button>
        <span className={styles.appIcon}>◆</span>
        <span className={styles.appTitle}>Workspace</span>
      </div>

      {/* ── Center: Tabs ────────────────────────────────── */}
      <nav className={styles.tabs} aria-label="Open tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
            onClick={() => onTabSelect(tab.id)}
            aria-selected={tab.id === activeTabId}
          >
            {tab.type === 'chat' ? <ChatIcon /> : <DocIcon />}
            <span className={styles.tabTitle}>
              {tab.title}
              {tab.isDirty && <span className={styles.dirtyDot} title="Unsaved changes" />}
            </span>

            {/* If it's the active file tab, show Save/Download actions */}
            {tab.id === activeTabId && tab.type === 'file' && activeDoc && (
              <div className={styles.docActions}>
                <span className={styles.docActionBtn} onClick={(e) => { e.stopPropagation(); activeDoc.onDownload(); }} title="Download">
                  <DownloadIcon />
                </span>
                <span className={styles.docActionBtn} onClick={(e) => { e.stopPropagation(); activeDoc.onSave(); }} title="Save">
                  <SaveIcon />
                </span>
              </div>
            )}

            <span
              className={styles.tabClose}
              role="button"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
            >
              ×
            </span>
          </button>
        ))}

        <button
          id="add-tab-btn"
          className={styles.addTab}
          onClick={onTabAdd}
          title="New chat"
          aria-label="New chat tab"
        >
          +
        </button>
      </nav>

      {/* ── Right: Window Controls ──────────────────────── */}
      <div className={styles.winControls}>
        <button className={styles.winBtn} onClick={handleMinimize} title="Minimize" aria-label="Minimize">
          <WinMinimize />
        </button>
        <button className={styles.winBtn} onClick={handleMaximize} title="Maximize" aria-label="Maximize">
          <WinMaximize />
        </button>
        <button className={`${styles.winBtn} ${styles.winClose}`} onClick={handleClose} title="Close" aria-label="Close">
          <WinClose />
        </button>
      </div>

    </header>
  );
}

/* ── Inline SVG Icons ──────────────────────────────────────────────────────── */
function SidebarIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1={open ? '5' : '11'} y1="2" x2={open ? '5' : '11'} y2="14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 3V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  );
}

function WinMinimize() {
  return <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="5" width="9" height="1.2" rx="0.6" fill="currentColor" /></svg>;
}
function WinMaximize() {
  return <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>;
}
function WinClose() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11">
      <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
