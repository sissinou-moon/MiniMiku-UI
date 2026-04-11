'use client';
import styles from './ChatMessage.module.css';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  thinkContent?: string;
  timestamp: Date;
}

interface Props { message: Message; }

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
  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : styles.wrapperAi}`}>

      {/* Avatar */}
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAi}`}>
        {isUser ? 'U' : '◆'}
      </div>

      {/* Content */}
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.role}>{isUser ? 'You' : 'Assistant'}</span>
          <span className={styles.time}>{fmt(message.timestamp)}</span>
        </div>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>
          {message.thinkContent && (
            <details className={styles.thinkBox} open>
              <summary>Thinking Process</summary>
              <div className={`${styles.text} selectable`}>
                {message.thinkContent}
              </div>
            </details>
          )}
          {message.content && (
            <p className={`${styles.text} selectable`}>{getDisplayContent(message.content)}</p>
          )}
        </div>
      </div>

    </div>
  );
}
