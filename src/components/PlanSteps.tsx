'use client';
import styles from './PlanSteps.module.css';

export interface PlanStep {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  goal: string;
}

const TOOL_COLORS: Record<string, { color: string; bg: string }> = {
  browser_action: { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  open_app:       { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  app_action:     { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  file_action:    { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  llm_execution:  { color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  type_text:      { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
};

function toolStyle(tool: string) {
  const c = TOOL_COLORS[tool] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
  return { color: c.color, background: c.bg, borderColor: c.color + '55' };
}

export default function PlanSteps({ steps }: { steps: PlanStep[] }) {
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
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
