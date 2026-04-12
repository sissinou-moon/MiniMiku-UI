'use client';
import { useState } from 'react';
import styles from './PlanSteps.module.css';

export interface PlanStep {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  goal: string;
}

export interface StepResult {
  success: boolean;
  result: any;
  error?: string;
  think?: string;
}

const TOOL_COLORS: Record<string, { color: string; bg: string }> = {
  browser_action: { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  open_app: { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  app_action: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  file_action: { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  llm_execution: { color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  type_text: { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
};

function toolStyle(tool: string) {
  const c = TOOL_COLORS[tool] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
  return { color: c.color, background: c.bg, borderColor: c.color + '55' };
}

export default function PlanSteps({
  steps,
  activeStepId,
  stepResults,
  onRetryStep,
}: {
  steps: PlanStep[];
  activeStepId?: number | null;
  stepResults?: Record<number, StepResult>;
  onRetryStep?: (id: number, userMessage: string) => void;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerDots}>
          <span className={styles.dot} style={{ background: '#FF5F56' }} />
          <span className={styles.dot} style={{ background: '#FFBD2E' }} />
          <span className={styles.dot} style={{ background: '#27C93F' }} />
        </div>
        <span className={styles.headerTitle}>execution_plan.json</span>
        <span className={styles.headerCount}>{steps.length} steps</span>
      </div>

      <div className={styles.steps}>
        {steps.map((step, idx) => (
          <div key={step.id} className={styles.step}>

            {/* Left gutter: number + line */}
            <div className={styles.gutter}>
              <div className={styles.num}>{step.id}</div>
              {idx < steps.length - 1 && <div className={styles.connector} />}
            </div>

            {/* Body */}
            <div className={styles.body}>
              <div className={styles.stepHead}>
                <span className={styles.toolBadge} style={toolStyle(step.tool)}>
                  {step.tool}
                </span>
                <span className={styles.goal}>{step.goal}</span>
              </div>

              {Object.keys(step.args).length > 0 && (
                <div className={styles.argsBox}>
                  {Object.entries(step.args).map(([k, v]) => (
                    <div key={k} className={styles.argRow}>
                      <span className={styles.argKey}>{k}</span>
                      <span className={styles.argSep}>:</span>
                      <span className={styles.argVal}>
                        {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Indicator */}
              {activeStepId === step.id && !stepResults?.[step.id] && (
                <div className={styles.statusIndicator}>
                  <div className={styles.spinner} />
                  <span>Executing step...</span>
                </div>
              )}

              {/* Result Box */}
              {stepResults?.[step.id] && (
                <div className={styles.resultBox}>
                  {stepResults[step.id].success ? (
                    <div className={styles.successContainer}>
                      <div className={styles.resultHeader}>
                        <span className={styles.successText}>[Done]</span>
                        <button
                          className={styles.copyBtn}
                          onClick={(e) => {
                            const data = stepResults[step.id].result;

                            let textToCopy = "";

                            if (Array.isArray(data)) {
                              textToCopy = data
                                .map(item =>
                                  typeof item === "string"
                                    ? item
                                    : JSON.stringify(item, null, 2)
                                )
                                .join("\n\n");
                            } else if (typeof data === "object") {
                              textToCopy = JSON.stringify(data, null, 2);
                            } else {
                              textToCopy = String(data);
                            }

                            navigator.clipboard.writeText(textToCopy);

                            const btn = e.currentTarget;
                            const original = btn.innerHTML;
                            btn.innerHTML = "Copied!";
                            btn.style.color = "#34D399";

                            setTimeout(() => {
                              btn.innerHTML = original;
                              btn.style.color = "";
                            }, 1500);
                          }}
                          title="Copy result"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Copy
                        </button>
                      </div>
                      <div className={styles.resultContent}>
                        {stepResults[step.id].think && (
                          <details className={styles.thinkBoxLocal} style={{ marginBottom: '8px' }}>
                            <summary style={{ cursor: 'pointer', color: '#888', fontSize: '13px' }}>
                              <span>Thinking Process</span>
                              <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                {stepResults[step.id].think?.split(' ').length} tokens
                              </span>
                            </summary>
                            <div style={{ marginTop: '4px', fontSize: '13px', color: '#ccc', whiteSpace: 'pre-wrap' }}>
                              {stepResults[step.id].think}
                            </div>
                          </details>
                        )}
                        {Array.isArray(stepResults[step.id].result) ? (
                          <div className={styles.searchResults}>
                            {(stepResults[step.id].result as any[]).map((res, i) => (
                              <div key={i} className={styles.searchItem}>
                                <a href={res.url} target="_blank" rel="noopener noreferrer" className={styles.searchTitle}>
                                  {res.title || 'Untitled'}
                                </a>
                                <div className={styles.searchSnippet}>{res.snippet}</div>
                                <div className={styles.searchUrl}>{res.url}</div>
                              </div>
                            ))}
                          </div>
                        ) : typeof stepResults[step.id].result === 'string' ? (
                          stepResults[step.id].result
                        ) : (
                          JSON.stringify(stepResults[step.id].result, null, 2)
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={styles.errorText}>[Error] {stepResults[step.id].error}</span>
                      {onRetryStep && (
                        <div className={styles.errorInputRow}>
                          <input
                            type="text"
                            className={styles.errorInput}
                            placeholder="Type a solution..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onRetryStep(step.id, e.currentTarget.value);
                              }
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
