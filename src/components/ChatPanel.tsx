'use client';
import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
} from 'react';
import ChatMessage from './ChatMessage';
import styles from './ChatPanel.module.css';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  thinkContent?: string;
  timestamp: Date;
}

interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  tabTitle: string;
}

export default function ChatPanel({ messages, onSend, tabTitle }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Auto-resize textarea */
  function resizeTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput('');
    onSend(content);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = input.trim().length > 0;

  return (
    <div className={styles.panel}>

      {/* ── Messages area ─────────────────────────────────── */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyLogo}>◆</div>
            <h2 className={styles.emptyTitle}>{tabTitle}</h2>
            <p className={styles.emptyHint}>Start a conversation below</p>
            <div className={styles.suggestionsGrid}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className={styles.suggestion}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ────────────────────────────────────── */}
      <div className={styles.inputArea}>
        <div className={`${styles.inputBox} ${canSend ? styles.inputBoxActive : ''}`}>
          <textarea
            ref={textareaRef}
            id="chat-input"
            className={styles.textarea}
            value={input}
            rows={1}
            placeholder="Ask anything…"
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            aria-label="Chat input"
          />
          <button
            id="send-btn"
            className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <SendIcon />
          </button>
        </div>
        <p className={styles.hint}>Enter to send &nbsp;·&nbsp; Shift+Enter for new line</p>
      </div>

    </div>
  );
}

const SUGGESTIONS = [
  'Summarize my recent notes',
  'Help me brainstorm ideas',
  'Explain a concept clearly',
  'Draft a structured plan',
];

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 14L14 8 2 2v5l9 1-9 1v5Z" fill="currentColor"/>
    </svg>
  );
}
