'use client';
import styles from './ChatMessage.module.css';
import Showdown from 'showdown';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  thinkContent?: string;
  isPlanningInput?: boolean;
  timestamp: Date;
}

interface Props { message: Message; }

// Markdown converter for AI messages
const mdConverter = new Showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  ghCodeBlocks: true,
  simplifiedAutoLink: true,
  openLinksInNewWindow: true,
  emoji: true,
});

function fmt(d: Date) {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function getDisplayContent(content: string): string {
  if (!content.includes('```json') || !content.includes('"type"')) {
    return content;
  }

  // First check if it's fully closed and valid
  const blockMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (blockMatch) {
    try {
      const parsed = JSON.parse(blockMatch[1]);
      if (parsed.type === 'direct_answer' && typeof parsed.answer === 'string') {
        return content.replace(blockMatch[0], parsed.answer);
      }
    } catch {}
  }

  // Fallback for streaming (incomplete JSON)
  if (content.match(/"type"\s*:\s*"direct_answer"/)) {
    const answerMatch = content.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (answerMatch) {
      const unescaped = answerMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      // Replace the pending JSON block with the unescaped answer stream
      return content.replace(/```json[\s\S]*$/, unescaped);
    }
  }

  return content;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  const isPlan = message.isPlanningInput;

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : styles.wrapperAi}`}>

      {/* Avatar */}
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAi}`}>
        {isUser ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.912 5.885h6.19l-5.007 3.638 1.912 5.885-5.007-3.638-5.007 3.638 1.912-5.885-5.007-3.638h6.19z" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.role}>{isUser ? 'You' : 'Assistant'}</span>
          <span className={styles.time}>{fmt(message.timestamp)}</span>
        </div>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>

          {/* Think block: collapsed for planning_input, expanded normally */}
          {message.thinkContent && (
            <details className={styles.thinkBox} {...(isPlan ? {} : { open: true })}>
              <summary>Thinking Process</summary>
              <div className={`${styles.text} selectable`}>
                {message.thinkContent}
              </div>
            </details>
          )}

          {/* For planning_input: never show raw JSON, show spinner instead */}
          {isPlan ? (
            <div className={styles.planningRow}>
              <span className={styles.planDot} />
              <span className={styles.planDot} />
              <span className={styles.planDot} />
              <span className={styles.planLabel}>Generating plan…</span>
            </div>
          ) : (
            message.content && (
              isUser ? (
                <p className={`${styles.text} selectable`}>{message.content}</p>
              ) : (
                <div
                  className={`${styles.text} ${styles.markdownContent} selectable`}
                  dangerouslySetInnerHTML={{ __html: mdConverter.makeHtml(getDisplayContent(message.content)) }}
                />
              )
            )
          )}

        </div>
      </div>

    </div>
  );
}
