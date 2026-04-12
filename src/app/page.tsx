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
interface TabData {
  id: string;
  title: string;
  type: 'chat' | 'file';
  messages: Message[];
  doc?: MarkdownDoc;
}

/* ── Tab factory ───────────────────────────────────────────────────────────── */
function makeTab(n: number): TabData {
  return {
    id: `tab-${n}`,
    title: `Chat ${n}`,
    type: 'chat',
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

  const active = tabsData.find((td) => td.id === activeTabId);

  // Helper to update active markdown doc
  const handleSetActiveMarkdownDoc = useCallback((val: any) => {
    setTabsData(prev => prev.map(td => {
      if (td.id !== activeTabId || td.type !== 'file' || !td.doc) return td;
      const nextDoc = typeof val === 'function' ? val(td.doc) : val;
      return { ...td, doc: nextDoc, title: nextDoc.title || nextDoc.filePath?.split('/').pop() || td.title };
    }));
  }, [activeTabId]);

  /* ── Tab actions ─────────────────────────────────── */
  const handleAddTab = useCallback(() => {
    counter.current += 1;
    const td = makeTab(counter.current);
    setTabsData((prev) => [...prev, td]);
    setActiveTabId(td.id);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    setTabsData((prev) => {
      const next = prev.filter((td) => td.id !== id);
      if (next.length === 0) {
        counter.current += 1;
        const td = makeTab(counter.current);
        setActiveTabId(td.id);
        return [td];
      }
      if (id === activeTabId) {
        setActiveTabId(next[next.length - 1].id);
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
        td.id !== activeTabId
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
        td.id !== activeTabId
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
                if (td.id !== activeTabId) return td;
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
                if (td.id !== activeTabId) return td;
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
    if (!active || active.type !== 'file' || !active.doc) return;
    const { content, title, filePath } = active.doc;
    const displayTitle = title || (filePath ? filePath.split('/').pop() : 'Untitled.md');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = displayTitle!.endsWith('.md') ? displayTitle! : `${displayTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!active || active.type !== 'file' || !active.doc) return;
    const { content, title, filePath } = active.doc;
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
  }, [active]);

  const handleFileSelect = useCallback(async (path: string) => {
    if (path.endsWith('.md')) {
      // Check if file is already open
      const existing = tabsData.find(td => td.type === 'file' && td.doc?.filePath === path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      try {
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', filePath: path })
        });
        const data = await res.json();
        if (data.success) {
          const newId = `file-${Date.now()}`;
          const title = path.split('/').pop() || path;
          setTabsData(prev => [...prev, {
             id: newId,
             title,
             type: 'file',
             messages: [],
             doc: {
                content: data.content,
                filePath: path,
                title
             }
          }]);
          setActiveTabId(newId);
        }
      } catch (e) {
        console.error('Failed to open md file', e);
      }
    }
  }, [tabsData]);

  // Special case for LLM execution adding a doc tab
  const addDocTabFromLLM = useCallback((doc: MarkdownDoc) => {
    const title = doc.title || 'LLM Output.md';
    
    setTabsData(prev => {
      const existingIdx = prev.findIndex(td => td.type === 'file' && td.title === title && !td.doc?.filePath);
      
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], doc: { ...next[existingIdx].doc, ...doc } };
        // Defer activation to ensure state settles
        setTimeout(() => setActiveTabId(next[existingIdx].id), 0);
        return next;
      }

      const newId = `file-${Date.now()}`;
      setTimeout(() => setActiveTabId(newId), 0);
      return [...prev, {
         id: newId,
         title,
         type: 'file',
         messages: [],
         doc: { ...doc, title }
      }];
    });
  }, []);

  return (
    <div className={styles.app}>
      <TabBar
        tabs={tabsData.map(td => ({ id: td.id, title: td.title, type: td.type }))}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleCloseTab}
        onTabAdd={handleAddTab}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        activeDoc={active?.type === 'file' && active.doc ? {
          title: active.doc.title || active.doc.filePath?.split('/').pop() || 'Untitled.md',
          onDownload: handleDownloadMarkdown,
          onSave: handleSaveMarkdown
        } : null}
      />
      <div className={styles.body}>
        <Sidebar open={sidebarOpen} onSelectFile={handleFileSelect} />
        <main className={styles.main}>
          {active?.type === 'chat' && (
            <ChatPanel
              key={active.id}
              messages={active.messages}
              onSend={handleSend}
              tabTitle={active.title}
            />
          )}
          {active?.type === 'file' && active.doc && (
            <MarkdownPanel
              doc={active.doc}
              onChange={handleSetActiveMarkdownDoc}
              onClose={() => handleCloseTab(active.id)}
            />
          )}
        </main>
        <AgentPanel
          isOpen={agentPanelOpen}
          isLoading={agentLoading}
          thinking={agentThinking}
          steps={agentSteps}
          onClose={() => setAgentPanelOpen(false)}
          setActiveMarkdownDoc={addDocTabFromLLM}
          onSelectFile={handleFileSelect}
          onPlanAdjustment={(oldPlan, errorMsg, userMsg) => {
            const prompt = `CAN YOU ADJUST THE OLD PLAN WITH THE ERROR AND USER MESSAGE:\nError: ${errorMsg}\nMessage: ${userMsg}\nOld Plan: ${JSON.stringify(oldPlan)}`;
            fetchPlanStream(prompt);
          }}
        />
      </div>
    </div>
  );
}
