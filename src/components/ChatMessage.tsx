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
            <details className={styles.thinkBox}>
              <summary>Thinking Process</summary>
              <div className={`${styles.text} selectable`}>
                {message.thinkContent}
              </div>
            </details>
          )}
          {message.content && (
            <p className={`${styles.text} selectable`}>{message.content}</p>
          )}
        </div>
      </div>

    </div>
  );
}
