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
  setActiveMarkdownDoc?: React.Dispatch<React.SetStateAction<import('./MarkdownPanel').MarkdownDoc | null>>;
  onPlanAdjustment?: (oldPlan: PlanStep[], errorMsg: string, userMsg: string) => void;
}

export default function AgentPanel({ isOpen, isLoading, thinking, steps, onClose, setActiveMarkdownDoc, onPlanAdjustment }: Props) {
  const [activeTab, setActiveTab] = useState<'process' | 'files'>('process');
  const [selectedPath, setSelectedPath] = useState('');
  const { tree } = useFileTree();

  const handleFileSelect = async (path: string) => {
    setSelectedPath(path);
    if (path.endsWith('.md')) {
      try {
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', filePath: path })
        });
        const data = await res.json();
        if (data.success && setActiveMarkdownDoc) {
          setActiveMarkdownDoc({
            content: data.content,
            filePath: path,
            title: path.split('/').pop() || path
          });
        }
      } catch (e) {
        console.error('Failed to open md file', e);
      }
    }
  };

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
        if (nextStep!.tool === 'llm_execution') {
          const titleAttr = (nextStep!.args.title as string) || 'LLM Output';
          let promptData = (nextStep!.args.data as string) || '';
          
          try {
            promptData = promptData.replace(/\$(\d+)\.output/g, (match, stepIdStr) => {
              const sid = parseInt(stepIdStr, 10);
              if (!stepResults[sid]) throw new Error(`Dependency error: Step ${sid} hasn't completed yet.`);
              if (!stepResults[sid].success) throw new Error(`Dependency error: Step ${sid} failed. Cannot proceed.`);
              
              // We inject the result string directly.
              let val = stepResults[sid].result;
              return typeof val === 'string' ? val : JSON.stringify(val);
            });
          } catch (e: any) {
            setHalted(true);
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: e.message } }));
            return;
          }

          setActiveMarkdownDoc?.({ content: '', title: titleAttr });

          const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000/llm/text';
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptData })
          });

          if (!res.body) throw new Error('No body in response');
          
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullContent = '';
          let fullThink = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            let newThink = '';
            let newContent = '';

            for (const part of parts) {
              if (!part.trim()) continue;
              const lines = part.split('\n');
              let event = '';
              let dataLines: string[] = [];

              for (const line of lines) {
                if (line.startsWith('event: ')) event = line.substring(7).trim();
                else if (line.startsWith('data: ')) dataLines.push(line.substring(6));
                else if (line.startsWith('data:')) dataLines.push(line.substring(5));
              }

              const data = dataLines.join('\n');
              if (event === 'think') newThink += data;
              else if (event === 'content' || (!event && dataLines.length > 0)) newContent += data;
            }

            if (newThink) {
              fullThink += newThink;
              setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink } }));
            }

            if (newContent) {
              fullContent += newContent;
              setActiveMarkdownDoc?.(prev => prev ? { ...prev, content: fullContent } : { content: fullContent, title: titleAttr });
            }
          }

          setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink } }));

        } else {
          // Standard tool execution
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

          if (activeStepIdRef.current !== nextStep!.id) return;

          if (data.success) {
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: data.result } }));
          } else {
            setHalted(true);
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: data.error } }));
          }
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
                onSelect={handleFileSelect}
              />
            ))}
          </div>
        )}

      </div>
    </aside>
  );
}
