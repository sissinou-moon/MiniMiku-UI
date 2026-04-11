'use client';
import styles from './TabBar.module.css';

interface Tab {
  id: string;
  title: string;
}

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  sidebarOpen,
  onToggleSidebar,
}: Props) {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose    = () => window.electronAPI?.close();

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
      <nav className={styles.tabs} aria-label="Open chats">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
            onClick={() => onTabSelect(tab.id)}
            aria-selected={tab.id === activeTabId}
          >
            <ChatIcon />
            <span className={styles.tabTitle}>{tab.title}</span>
            {tabs.length > 1 && (
              <span
                className={styles.tabClose}
                role="button"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              >
                ×
              </span>
            )}
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
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <line x1={open ? '5' : '11'} y1="2" x2={open ? '5' : '11'} y2="14" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 3V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function WinMinimize() {
  return <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="5" width="9" height="1.2" rx="0.6" fill="currentColor"/></svg>;
}
function WinMaximize() {
  return <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>;
}
function WinClose() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11">
      <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
