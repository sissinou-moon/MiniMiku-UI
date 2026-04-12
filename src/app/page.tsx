'use client';
import { useState, useCallback, useRef } from 'react';
import TabBar from '@/components/TabBar';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import AgentPanel, { type PlanStep } from '@/components/AgentPanel';
import MarkdownPanel, { type MarkdownDoc } from '@/components/MarkdownPanel';
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

  // Agent / Planning panel state
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentLoading, setAgentLoading]     = useState(false);
  const [agentThinking, setAgentThinking]   = useState('');
  const [agentSteps, setAgentSteps]         = useState<PlanStep[]>([]);

  // Markdown Panel state
  const [activeMarkdownDoc, setActiveMarkdownDoc] = useState<MarkdownDoc | null>(null);

  const handleSetActiveMarkdownDoc: React.Dispatch<React.SetStateAction<MarkdownDoc | null>> = useCallback((val) => {
    setActiveMarkdownDoc((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (next) {
        // Defer setting activeTabId to 'doc' so state updates sequentially
        setTimeout(() => setActiveTabId('doc'), 0);
      }
      return next;
    });
  }, []);

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

  /* ── API Endpoints & Tools ───────────────────────── */
  const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000/llm/text';

  const fetchPlanStream = useCallback(async (promptPayload: string) => {
    setAgentLoading(true);
    setAgentThinking('');
    setAgentSteps([]);
    
    try {
      const res = await fetch('http://localhost:8000/llm/json/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptPayload, model: 'gemma4:e4b' })
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullPlanStr = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        let addedThink = '';
        let addedContent = '';

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
          if (event === 'think') addedThink += data;
          else if (event === 'content' || (!event && dataLines.length > 0)) addedContent += data;
        }

        if (addedThink) setAgentThinking(prev => prev + addedThink);
        if (addedContent) fullPlanStr += addedContent;
      }

      setAgentLoading(false);
      try {
        const m = fullPlanStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (m) {
          const parsed = JSON.parse(m[1]);
          if (parsed.type === 'plan' && Array.isArray(parsed.steps)) {
            setAgentSteps(parsed.steps);
          }
        }
      } catch (e) {
        console.error('Failed to parse plan steps', e);
      }
    } catch (err) {
      console.error('Plan stream error:', err);
      setAgentLoading(false);
    }
  }, []);

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

    const fetchStream = async () => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: content }) 
        });
        
        if (!response.body) return;
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        let fullMsgContent = '';
        let isPlanningTriggered = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (isPlanningTriggered) {
                let promptPayload = content;
                try {
                  const m = fullMsgContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                  if (m) {
                    const parsed = JSON.parse(m[1]);
                    if (parsed.prompt) promptPayload = parsed.prompt;
                  } else {
                     const pMatch = fullMsgContent.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)/);
                     if (pMatch) promptPayload = pMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                  }
                } catch {}
                fetchPlanStream(promptPayload);
            }
            break;
          }
          
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
            } else if (event === 'content' || (!event && dataLines.length > 0)) {
               newContent += data;
            }
          }

          if (newContent) fullMsgContent += newContent;

          if (!isPlanningTriggered && fullMsgContent.includes('"planning_input"')) {
            isPlanningTriggered = true;
            setAgentPanelOpen(true);
            setAgentLoading(true);
            setAgentThinking('');
            setAgentSteps([]);

            setTabsData((prev) =>
              prev.map((td) => {
                if (td.tab.id !== activeTabId) return td;
                const msgIdx = td.messages.findIndex(m => m.id === aiMsgId);
                if (msgIdx === -1) return td;
                const msgs = [...td.messages];
                msgs[msgIdx] = { ...msgs[msgIdx], isPlanningInput: true };
                return { ...td, messages: msgs };
              })
            );
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

  /* ── Markdown Actions ────────────────────────────── */
  const handleDownloadMarkdown = useCallback(() => {
    if (!activeMarkdownDoc) return;
    const { content, title, filePath } = activeMarkdownDoc;
    const displayTitle = title || (filePath ? filePath.split('/').pop() : 'Untitled.md');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = displayTitle!.endsWith('.md') ? displayTitle! : `${displayTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeMarkdownDoc]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!activeMarkdownDoc) return;
    const { content, title, filePath } = activeMarkdownDoc;
    let targetPath = filePath;
    if (!targetPath) {
      const displayTitle = title || 'Untitled.md';
      targetPath = displayTitle.endsWith('.md') ? displayTitle : `${displayTitle}.md`;
    }

    try {
      const res = await fetch('/api/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          filePath: targetPath,
          content,
        })
      });
      const data = await res.json();
      if (!data.success) alert(`Failed to save: ${data.error}`);
      else alert(`Saved ${targetPath} successfully!`);
    } catch (err) {
      alert('Error saving to workspace');
    }
  }, [activeMarkdownDoc]);

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
        activeDoc={activeMarkdownDoc ? {
          title: activeMarkdownDoc.title || activeMarkdownDoc.filePath?.split('/').pop() || 'Untitled.md',
          onDownload: handleDownloadMarkdown,
          onSave: handleSaveMarkdown
        } : null}
      />
      <div className={styles.body}>
        <Sidebar open={sidebarOpen} />
        <main className={styles.main}>
          {activeTabId !== 'doc' && active && (
            <ChatPanel
              key={active.tab.id}
              messages={active.messages}
              onSend={handleSend}
              tabTitle={active.tab.title}
            />
          )}
          {activeTabId === 'doc' && activeMarkdownDoc && (
            <MarkdownPanel
              doc={activeMarkdownDoc}
              onChange={(content) => setActiveMarkdownDoc(prev => prev ? { ...prev, content } : null)}
              onClose={() => {
                setActiveMarkdownDoc(null);
                setActiveTabId(tabsData[0].tab.id);
              }}
            />
          )}
        </main>
        <AgentPanel
          isOpen={agentPanelOpen}
          isLoading={agentLoading}
          thinking={agentThinking}
          steps={agentSteps}
          onClose={() => setAgentPanelOpen(false)}
          setActiveMarkdownDoc={handleSetActiveMarkdownDoc}
          onPlanAdjustment={(oldPlan, errorMsg, userMsg) => {
            const prompt = `CAN YOU ADJUST THE OLD PLAN WITH THE ERROR AND USER MESSAGE:\nError: ${errorMsg}\nMessage: ${userMsg}\nOld Plan: ${JSON.stringify(oldPlan)}`;
            fetchPlanStream(prompt);
          }}
        />
      </div>
    </div>
  );
}
