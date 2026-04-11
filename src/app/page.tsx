'use client';
import { useState, useCallback, useRef } from 'react';
import TabBar from '@/components/TabBar';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import type { Message } from '@/components/ChatPanel';
import styles from './page.module.css';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Tab {
  id: string;
  title: string;
}

interface TabData {
  tab: Tab;
  messages: Message[];
}

/* ── Tab factory ───────────────────────────────────────────────────────────── */
function makeTab(n: number): TabData {
  return {
    tab: { id: `tab-${n}`, title: `Chat ${n}` },
    messages: [],
  };
}


/* ── Root page ─────────────────────────────────────────────────────────────── */
export default function Home() {
  const counter = useRef(1);
  const [tabsData, setTabsData]       = useState<TabData[]>(() => [makeTab(1)]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const tabs = tabsData.map((td) => td.tab);
  const active = tabsData.find((td) => td.tab.id === activeTabId);

  /* ── Tab actions ─────────────────────────────────── */
  const handleAddTab = useCallback(() => {
    counter.current += 1;
    const td = makeTab(counter.current);
    setTabsData((prev) => [...prev, td]);
    setActiveTabId(td.tab.id);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    setTabsData((prev) => {
      const next = prev.filter((td) => td.tab.id !== id);
      if (next.length === 0) {
        counter.current += 1;
        const td = makeTab(counter.current);
        setActiveTabId(td.tab.id);
        return [td];
      }
      if (id === activeTabId) {
        setActiveTabId(next[next.length - 1].tab.id);
      }
      return next;
    });
  }, [activeTabId]);

  /* ── Chat messages ───────────────────────────────── */
  const handleSend = useCallback((content: string) => {
    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setTabsData((prev) =>
      prev.map((td) =>
        td.tab.id !== activeTabId
          ? td
          : { ...td, messages: [...td.messages, userMsg] }
      )
    );

    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'ai',
      content: '', // Will populate continuously
      thinkContent: '', // Will populate continuously
      timestamp: new Date(),
    };

    setTabsData((prev) =>
      prev.map((td) =>
        td.tab.id !== activeTabId
          ? td
          : { ...td, messages: [...td.messages, aiMsg] }
      )
    );

    const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000/llm/text';

    const fetchStream = async () => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST', // using POST to send the prompt depending on backend implementation
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: content }) 
        });
        
        if (!response.body) return;
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          let newContent = '';
          let newThink = '';

          for (const part of parts) {
            if (!part.trim()) continue;
            const lines = part.split('\n');
            let event = '';
            let dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                event = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                dataLines.push(line.substring(6));
              } else if (line.startsWith('data:')) {
                dataLines.push(line.substring(5));
              }
            }

            const data = dataLines.join('\n');

            if (event === 'think') {
               newThink += data;
            } else if (event === 'content') {
               newContent += data;
            } else if (event === 'done') {
               // stream complete
            } else if (!event && dataLines.length > 0) {
               // some SSE servers omit 'event' for default messages
               newContent += data;
            }
          }

          if (newContent || newThink) {
            setTabsData((prev) =>
              prev.map((td) => {
                if (td.tab.id !== activeTabId) return td;
                const msgIdx = td.messages.findIndex(m => m.id === aiMsgId);
                if (msgIdx === -1) return td;
                
                const msgs = [...td.messages];
                const m = msgs[msgIdx];
                msgs[msgIdx] = {
                  ...m,
                  content: m.content + newContent,
                  thinkContent: (m.thinkContent || '') + newThink
                };
                return { ...td, messages: msgs };
              })
            );
          }
        }
      } catch (err) {
        console.error("Stream error: ", err);
      }
    };
    
    fetchStream();
  }, [activeTabId]);

  return (
    <div className={styles.app}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleCloseTab}
        onTabAdd={handleAddTab}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />
      <div className={styles.body}>
        <Sidebar open={sidebarOpen} />
        <main className={styles.main}>
          {active && (
            <ChatPanel
              key={active.tab.id}
              messages={active.messages}
              onSend={handleSend}
              tabTitle={active.tab.title}
            />
          )}
        </main>
      </div>
    </div>
  );
}
