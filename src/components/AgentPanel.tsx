'use client';
import { useState, useEffect, useRef } from 'react';
import FileTree from './FileTree';
import PlanSteps from './PlanSteps';
import { useFileTree } from '@/hooks/useFileTree';
import type { PlanStep, StepResult } from './PlanSteps';
import styles from './AgentPanel.module.css';

export type { PlanStep };

// Helper: incrementally extract a JSON string value starting from the opening quote.
// Handles escape sequences (\n, \", \\, \uXXXX, etc.).
// Returns the unescaped value extracted so far and whether the closing quote was found.
function extractJsonStringValue(text: string, openQuoteIdx: number): { value: string; complete: boolean } {
  let value = '';
  let i = openQuoteIdx + 1; // skip opening quote
  let escaped = false;

  while (i < text.length) {
    const ch = text[i];
    if (escaped) {
      switch (ch) {
        case 'n': value += '\n'; break;
        case 'r': value += '\r'; break;
        case 't': value += '\t'; break;
        case '"': value += '"'; break;
        case '\\': value += '\\'; break;
        case '/': value += '/'; break;
        case 'b': value += '\b'; break;
        case 'f': value += '\f'; break;
        case 'u': {
          if (i + 4 < text.length) {
            value += String.fromCharCode(parseInt(text.substring(i + 1, i + 5), 16));
            i += 4;
          } else {
            return { value, complete: false };
          }
          break;
        }
        default: value += ch; break;
      }
      escaped = false;
      i++;
      continue;
    }
    if (ch === '\\') {
      if (i + 1 >= text.length) return { value, complete: false }; // boundary
      escaped = true;
      i++;
      continue;
    }
    if (ch === '"') return { value, complete: true }; // closing quote
    value += ch;
    i++;
  }
  return { value, complete: false };
}

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  thinking: string;
  steps: PlanStep[];
  onClose: () => void;
  setActiveMarkdownDoc?: (doc: import('./MarkdownPanel').MarkdownDoc) => void;
  onAddChatMessage?: (content: string) => void;
  onStreamChatMessage?: (messageId: string, content: string) => void;
  onPlanAdjustment?: (oldPlan: PlanStep[], errorMsg: string, userMsg: string) => void;
  onSelectFile?: (path: string) => void;
}

export default function AgentPanel({ isOpen, isLoading, thinking, steps, onClose, setActiveMarkdownDoc, onAddChatMessage, onStreamChatMessage, onPlanAdjustment, onSelectFile }: Props) {
  const [activeTab, setActiveTab] = useState<'process' | 'files'>('process');
  const [selectedPath, setSelectedPath] = useState('');
  const { tree } = useFileTree();

  const handleFileSelect = async (path: string) => {
    setSelectedPath(path);
    if (onSelectFile) {
      onSelectFile(path);
      return;
    }
    // Fallback if no centralized handler
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
  const stepResultsRef = useRef<Record<number, StepResult>>({}); // Always up-to-date, avoids stale closures
  const [halted, setHalted] = useState(false);

  // Keep ref synced with state on every render
  stepResultsRef.current = stepResults;

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
    const nextStep = steps.find(s => !stepResults[s.id]?.finalized);
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
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: e.message, finalized: true } }));
            return;
          }

          const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000/llm/text';
          console.log('[llm_execution] started with prompt: ', promptData);
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
              setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink, finalized: false } }));
            }

            if (newContent) {
              fullContent += newContent;
            }
          }

          setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink, finalized: true } }));

        } else if (nextStep!.tool === 'llm_decision') {
          // ── llm_decision: stream from decision endpoint, parse incrementally ──
          let promptData = '';
          try {
            const rawData = (nextStep!.args.data as string) || '';
            const userQuestion = (nextStep!.args.user_question as string) || '';

            const resolveRefs = (str: string) => str.replace(/\$(\d+)\.outputs?/g, (_match: string, stepIdStr: string) => {
              const sid = parseInt(stepIdStr, 10);
              const latestResults = stepResultsRef.current;
              if (!latestResults[sid]) throw new Error(`Dependency error: Step ${sid} hasn't completed yet.`);
              if (!latestResults[sid].success) throw new Error(`Dependency error: Step ${sid} failed.`);
              const val = latestResults[sid].result;
              return typeof val === 'string' ? val : JSON.stringify(val);
            });

            const resolvedData = resolveRefs(rawData);
            const resolvedQuestion = resolveRefs(userQuestion);
            promptData = `User Question: ${resolvedQuestion}\n\nData:\n${resolvedData}`;
          } catch (e: any) {
            setHalted(true);
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: e.message, finalized: true } }));
            return;
          }

          const decisionUrl = 'http://localhost:8000/llm/text/decision';
          console.log('[llm_decision] started with prompt length:', promptData.length);
          const res = await fetch(decisionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptData })
          });

          if (!res.body) throw new Error('No body in decision response');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullContent = '';
          let fullThink = '';

          // ── Incremental JSON parsing state ──
          let detectedType: string | null = null;

          // file_needed streaming state
          let contentFieldQuoteIdx = -1;
          let lastStreamedContentLen = 0;
          let contentDone = false;
          let resumeFieldQuoteIdx = -1;
          let lastStreamedResumeLen = 0;
          let resumeDone = false;
          let mdTabOpened = false;
          const resumeMsgId = `msg-${Date.now()}-decision-resume`;

          // direct_answer / answer streaming state
          let answerFieldQuoteIdx = -1;
          let lastStreamedAnswerLen = 0;
          let answerDone = false;
          const answerMsgId = `msg-${Date.now()}-decision-answer`;

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
              setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink, finalized: false } }));
            }

            if (newContent) {
              fullContent += newContent;

              // ── Detect type if not yet known ──
              if (!detectedType) {
                const typeMatch = fullContent.match(/"type"\s*:\s*"(file_needed|direct_answer|answer)"/);
                if (typeMatch) {
                  detectedType = typeMatch[1];
                  console.log('[llm_decision] Detected streaming type:', detectedType);
                }
              }

              // ── file_needed: stream content → MarkdownPanel, then resume → Chat ──
              if (detectedType === 'file_needed') {
                // Find the opening quote of the "content" field value
                if (contentFieldQuoteIdx === -1) {
                  const m = fullContent.match(/"content"\s*:\s*"/);
                  if (m) {
                    contentFieldQuoteIdx = m.index! + m[0].length - 1;
                    // Open the MarkdownPanel tab immediately
                    if (!mdTabOpened && setActiveMarkdownDoc) {
                      setActiveMarkdownDoc({ content: '', title: 'Decision Report' });
                      mdTabOpened = true;
                    }
                  }
                }

                // Stream content value into MarkdownPanel
                if (contentFieldQuoteIdx !== -1 && !contentDone) {
                  const { value: contentVal, complete } = extractJsonStringValue(fullContent, contentFieldQuoteIdx);
                  if (contentVal.length > lastStreamedContentLen && setActiveMarkdownDoc) {
                    setActiveMarkdownDoc({ content: contentVal, title: 'Decision Report' });
                    lastStreamedContentLen = contentVal.length;
                  }
                  if (complete) {
                    contentDone = true;
                    console.log('[llm_decision] Content field streaming complete, length:', contentVal.length);
                  }
                }

                // Once content is complete, look for "resume" field
                if (contentDone && resumeFieldQuoteIdx === -1) {
                  const m = fullContent.match(/"resume"\s*:\s*"/);
                  if (m) {
                    resumeFieldQuoteIdx = m.index! + m[0].length - 1;
                  }
                }

                // Stream resume value into chat
                if (resumeFieldQuoteIdx !== -1 && !resumeDone) {
                  const { value: resumeVal, complete } = extractJsonStringValue(fullContent, resumeFieldQuoteIdx);
                  if (resumeVal.length > lastStreamedResumeLen) {
                    onStreamChatMessage?.(resumeMsgId, resumeVal);
                    lastStreamedResumeLen = resumeVal.length;
                  }
                  if (complete) {
                    resumeDone = true;
                    console.log('[llm_decision] Resume field streaming complete');
                  }
                }
              }

              // ── direct_answer/answer: stream answer → Chat ──
              if (detectedType === 'direct_answer' || detectedType === 'answer') {
                if (answerFieldQuoteIdx === -1) {
                  const m = fullContent.match(/"(?:answer|content)"\s*:\s*"/);
                  if (m) {
                    answerFieldQuoteIdx = m.index! + m[0].length - 1;
                  }
                }

                if (answerFieldQuoteIdx !== -1 && !answerDone) {
                  const { value: answerVal, complete } = extractJsonStringValue(fullContent, answerFieldQuoteIdx);
                  if (answerVal.length > lastStreamedAnswerLen) {
                    onStreamChatMessage?.(answerMsgId, answerVal);
                    lastStreamedAnswerLen = answerVal.length;
                  }
                  if (complete) answerDone = true;
                }
              }
            }
          }

          // ── Fallback: if streaming parsing didn't detect type, try batch parse ──
          if (!detectedType) {
            console.warn('[llm_decision] Streaming parse failed to detect type, trying batch parse');
            try {
              let cleaned = fullContent.trim();
              cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
              cleaned = cleaned.replace(/\n?\s*```\s*$/, '');
              const parsed = JSON.parse(cleaned);
              if (parsed.type === 'file_needed') {
                if (parsed.content) setActiveMarkdownDoc?.({ content: parsed.content, title: 'Decision Report' });
                onAddChatMessage?.(parsed.resume || 'Report generated. See the Markdown panel.');
              } else {
                onAddChatMessage?.(parsed.answer || parsed.content || '');
              }
            } catch {
              console.error('[llm_decision] Batch parse also failed');
              onAddChatMessage?.('I processed your request but encountered a formatting issue. Check the agent panel for details.');
            }
          }

          setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: fullContent, think: fullThink, finalized: true } }));

        } else {
          // Standard tool execution
          let processedArgs = { ...nextStep!.args };

          try {
            // Converts a step result value to a plain string suitable for keyboard input
            const resultToString = (val: any): string => {
              if (typeof val === 'string') return val;
              if (Array.isArray(val)) {
                return val.map((item: any) => {
                  if (item && typeof item === 'object') {
                    const parts: string[] = [];
                    if (item.title) parts.push(`## ${item.title}`);
                    if (item.snippet) parts.push(item.snippet);
                    if (item.url) parts.push(`URL: ${item.url}`);
                    return parts.join('\n');
                  }
                  return String(item);
                }).join('\n\n');
              }
              return JSON.stringify(val, null, 2);
            };

            const processValue = (val: any): any => {
              if (typeof val === 'string') {
                const exactMatch = val.match(/^\$(\d+)\.outputs?$/);
                if (exactMatch) {
                  const sid = parseInt(exactMatch[1], 10);
                  const latestResults = stepResultsRef.current;
                  console.log(`[processValue] Looking up $${sid}.output — available step IDs: [${Object.keys(latestResults).join(', ')}]`);
                  if (!latestResults[sid]) throw new Error(`Dependency error: Step ${sid} hasn't completed yet. Available: [${Object.keys(latestResults).join(', ')}]`);
                  if (!latestResults[sid].success) throw new Error(`Dependency error: Step ${sid} failed.`);
                  const raw = latestResults[sid].result;
                  console.log(`[processValue] $${sid}.output resolved to:`, typeof raw === 'string' ? raw.slice(0, 100) : raw);
                  // Always return a string so keyboard/paste actions work correctly
                  return resultToString(raw);
                }
                return val.replace(/\$(\d+)\.outputs?/g, (match, stepIdStr) => {
                  const sid = parseInt(stepIdStr, 10);
                  const latestResults = stepResultsRef.current;
                  if (!latestResults[sid]) throw new Error(`Dependency error: Step ${sid} hasn't completed yet.`);
                  if (!latestResults[sid].success) throw new Error(`Dependency error: Step ${sid} failed.`);
                  return resultToString(latestResults[sid].result);
                });
              }
              if (Array.isArray(val)) return val.map(processValue);
              if (val !== null && typeof val === 'object') {
                const newObj: any = {};
                for (const k in val) newObj[k] = processValue(val[k]);
                return newObj;
              }
              return val;
            };

            processedArgs = processValue(nextStep!.args);
            console.log('[processedArgs after substitution]', processedArgs);
          } catch (e: any) {
            setHalted(true);
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: e.message, finalized: true } }));
            return;
          }

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
              args: processedArgs,
              current_step: nextStep!.id,
              previous_step_result: prevResultPayload
            })
          });

          const data = await res.json();

          if (activeStepIdRef.current !== nextStep!.id) return;

          if (data.success) {
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: true, result: data.result, finalized: true } }));
          } else {
            setHalted(true);
            setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: data.error, finalized: true } }));
          }
        }
      } catch (err: any) {
        if (activeStepIdRef.current !== nextStep!.id) return;
        setHalted(true);
        setStepResults(prev => ({ ...prev, [nextStep!.id]: { success: false, result: 'Failed', error: err.message, finalized: true } }));
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
