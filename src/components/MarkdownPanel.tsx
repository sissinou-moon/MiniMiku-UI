'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './MarkdownPanel.module.css';

// Dynamically import the editor strictly on the client side
const MDEditor = dynamic(() => import('@uiw/react-md-editor').then((mod) => mod.default), { ssr: false });

export interface MarkdownDoc {
  content: string;
  title?: string;
  filePath?: string; // If it's already a saved file
}

interface Props {
  doc: MarkdownDoc;
  onChange: (newContent: string) => void;
  onClose: () => void;
}

export default function MarkdownPanel({ doc, onChange, onClose }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const displayTitle = doc.title || (doc.filePath ? doc.filePath.split('/').pop() : 'Untitled.md');

  const handleDownload = () => {
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = displayTitle!.endsWith('.md') ? displayTitle! : `${displayTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveWorkspace = async () => {
    setIsSaving(true);
    let targetPath = doc.filePath;
    
    // If it doesn't have a file path, we just create one at the root or prompting could be complex
    // User requested: "get the title from 'args' = {.... , 'title': '....', ....}"
    // So the title is passed into doc.title. We can save it as 'title.md' in root workspace.
    if (!targetPath) {
      targetPath = displayTitle!.endsWith('.md') ? displayTitle : `${displayTitle}.md`;
    }

    try {
      const res = await fetch('/api/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          filePath: targetPath,
          content: doc.content,
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed to save: ${data.error}`);
      } else {
        alert(`Saved ${targetPath} successfully!`);
      }
    } catch (err) {
      alert('Error saving to workspace');
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.topBar}>
        <div className={styles.title} title={displayTitle}>
          {displayTitle}
        </div>
        <div className={styles.actions}>
          <button className={styles.iconBtn} onClick={handleDownload} title="Download to PC">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          
          <button className={styles.iconBtn} onClick={handleSaveWorkspace} title="Save to Workspace" disabled={isSaving}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>

          <button className={styles.iconBtn} onClick={onClose} title="Close Panel">
             ✕
          </button>
        </div>
      </div>
      
      <div className={styles.editorContainer} data-color-mode="dark">
        <MDEditor
          value={doc.content}
          onChange={(val) => onChange(val || '')}
          height="100%"
          style={{ height: '100%', borderRadius: 0, border: 'none' }}
          preview="live"
        />
      </div>
    </div>
  );
}
