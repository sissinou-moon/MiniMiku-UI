'use client';
import { useState } from 'react';
import FileTree from './FileTree';
import PlanSteps from './PlanSteps';
import { useFileTree } from '@/hooks/useFileTree';
import type { PlanStep } from './PlanSteps';
import styles from './AgentPanel.module.css';

export type { PlanStep };

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  thinking: string;
  steps: PlanStep[];
  onClose: () => void;
}

export default function AgentPanel({ isOpen, isLoading, thinking, steps, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'process' | 'files'>('process');
  const [selectedPath, setSelectedPath] = useState('');
  const { tree } = useFileTree();

  if (!isOpen) return null;

  return (
    <aside className={styles.panel}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.switcher}>
          <button
            className={`${styles.switchBtn} ${activeTab === 'process' ? styles.active : ''}`}
            onClick={() => setActiveTab('process')}
          >
            <span className={styles.switchDot} style={{ background: activeTab === 'process' ? '#60A5FA' : 'transparent' }} />
            Current Process
          </button>
          <button
            className={`${styles.switchBtn} ${activeTab === 'files' ? styles.active : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <span className={styles.switchDot} style={{ background: activeTab === 'files' ? '#34D399' : 'transparent' }} />
            Files
          </button>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close panel" aria-label="Close agent panel">
          ✕
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className={styles.content}>

        {/* ─── Current Process ─── */}
        {activeTab === 'process' && (
          <div className={styles.processTab}>

            {thinking ? (
              <details className={styles.thinkBox}>
                <summary>
                  <span className={styles.thinkLabel}>Thinking Process</span>
                  <span className={styles.thinkBadge}>{thinking.split(' ').length} tokens</span>
                </summary>
                <div className={styles.thinkText}>{thinking}</div>
              </details>
            ) : isLoading ? (
              <div className={styles.thinkBoxSkeleton} />
            ) : null}

            {/* Loading dots while planning */}
            {isLoading && (
              <div className={styles.loadingRow}>
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingLabel}>Generating plan…</span>
              </div>
            )}

            {/* Plan steps */}
            {steps.length > 0 && <PlanSteps steps={steps} />}

            {/* Empty state */}
            {!isLoading && !thinking && steps.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>◈</div>
                <p>No active process</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Files ─── */}
        {activeTab === 'files' && (
          <div className={styles.filesTab}>
            {tree.map((node, i) => (
              <FileTree
                key={node.path ?? i}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            ))}
          </div>
        )}

      </div>
    </aside>
  );
}
