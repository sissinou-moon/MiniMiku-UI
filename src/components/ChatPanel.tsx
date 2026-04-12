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
  isPlanningInput?: boolean;
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* Robust auto-scroll during streaming using MutationObserver */
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    // A flag to check if user is scrolled up (we don't forced-scroll if they are reading past messages)
    let isUserScrolledUp = false;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      // Allow a 50px tolerance
      isUserScrolledUp = scrollTop + clientHeight < scrollHeight - 50;
    };
    scroller.addEventListener('scroll', handleScroll);

    const scrollToBottom = () => {
      if (!isUserScrolledUp) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    };

    const observer = new MutationObserver(scrollToBottom);
    observer.observe(scroller, { childList: true, subtree: true, characterData: true });

    // Initial scroll
    scrollToBottom();

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  /* Auto-resize textarea */
  function resizeTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 250)}px`;
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
      <div className={styles.messages} ref={scrollContainerRef}>
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
        <div className={styles.inputWrapper}>
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
            <div className={styles.inputToolbar}>
              <button 
                className={styles.attachBtn} 
                aria-label="Attach file" 
                title="Attach file"
              >
                <AttachIcon />
              </button>
              
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
          </div>
          <p className={styles.hint}>Enter to send &nbsp;·&nbsp; Shift+Enter for new line</p>
        </div>
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

function AttachIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  );
}
