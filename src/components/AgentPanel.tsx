'use client';
import { useState, useEffect, useRef } from 'react';
import FileTree from './FileTree';
import PlanSteps from './PlanSteps';
import { useFileTree } from '@/hooks/useFileTree';
import type { PlanStep, StepResult } from './PlanSteps';
import styles from './AgentPanel.module.css';

export type { PlanStep };

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  thinking: string;
  steps: PlanStep[];
  onClose: () => void;
  onPlanAdjustment?: (oldPlan: PlanStep[], errorMsg: string, userMsg: string) => void;
}

export default function AgentPanel({ isOpen, isLoading, thinking, steps, onClose, onPlanAdjustment }: Props) {
  const [activeTab, setActiveTab] = useState<'process' | 'files'>('process');
  const [selectedPath, setSelectedPath] = useState('');
  const { tree } = useFileTree();

  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const activeStepIdRef = useRef<number | null>(null);
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
  const [halted, setHalted] = useState(false);

  // When steps array changes completely, reset execution.
  // Using the first step ID or length to determine a fresh plan.
  useEffect(() => {
    setActiveStepId(null);
    activeStepIdRef.current = null;
    setStepResults({});
    setHalted(false);
  }, [steps]);

  // The Background Execution Loop
  useEffect(() => {
    if (steps.length === 0 || halted) return;

    // Find the very first step that has no result yet
    const nextStep = steps.find(s => !stepResults[s.id]);
    if (!nextStep) {
      activeStepIdRef.current = null;
      setActiveStepId(null);
      return; 
    }

    if (activeStepIdRef.current === nextStep.id) return; // Already inflight

    async function tickStep() {
      activeStepIdRef.current = nextStep!.id;
      setActiveStepId(nextStep!.id);

      try {
        const prevId = nextStep!.id > 1 ? nextStep!.id - 1 : null;
        let prevResultPayload = undefined;
        if (prevId && stepResults[prevId]) {
          const prevStep = steps.find(s => s.id === prevId);
          prevResultPayload = {
            tool: prevStep?.tool,
            result: stepResults[prevId].result
          };
        }

        const res = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: nextStep!.tool,
            args: nextStep!.args,
            current_step: nextStep!.id,
            previous_step_result: prevResultPayload
          })
        });

        const data = await res.json();
        
        // If the execution engine has moved on or reset, abandon this result.
        if (activeStepIdRef.current !== nextStep!.id) return;

        if (data.success) {
          setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: data.result } }));
        } else {
          setHalted(true);
          setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: data.error } }));
        }
      } catch (err: any) {
        if (activeStepIdRef.current !== nextStep!.id) return;
        setHalted(true);
        setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: err.message } }));
      }
    }

    tickStep();
  }, [steps, stepResults, halted]);

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
            {steps.length > 0 && (
              <PlanSteps
                steps={steps}
                activeStepId={activeStepId}
                stepResults={stepResults}
                onRetryStep={(id, userMsg) => {
                  const errStr = stepResults[id]?.error || 'Unknown Error';
                  onPlanAdjustment?.(steps, errStr, userMsg);
                }}
              />
            )}

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
