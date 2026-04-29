'use client';
import { useState } from 'react';
import type { TreeNode, FolderNode, FileNode } from '@/types/electron';
import styles from './FileTree.module.css';

/* ── File icon mapping ─────────────────────────────────────────────────────── */
function getFileIcon(ext: string): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    '.md':   <MdIcon />,
    '.txt':  <TxtIcon />,
    '.js':   <JsIcon />,
    '.jsx':  <JsIcon />,
    '.ts':   <TsIcon />,
    '.tsx':  <TsIcon />,
    '.json': <JsonIcon />,
    '.py':   <PyIcon />,
    '.css':  <CssIcon />,
    '.html': <HtmlIcon />,
    '.png':  <ImgIcon />,
    '.jpg':  <ImgIcon />,
    '.jpeg': <ImgIcon />,
    '.gif':  <ImgIcon />,
    '.webp': <ImgIcon />,
    '.svg':  <ImgIcon />,
    '.pdf':  <PdfIcon />,
  };
  return iconMap[ext] ?? <FileIcon />;
}

/* ── Folder node ───────────────────────────────────────────────────────────── */
interface FolderItemProps {
  node: FolderNode;
  depth: number;
  selectedPath: string;
  onSelectFile?: (path: string, name: string) => void;
  onSelect: (path: string) => void;
  onContextAction?: (e: React.MouseEvent, node: TreeNode) => void;
}

function FolderItem({ node, depth, selectedPath, onSelectFile, onSelect, onContextAction }: FolderItemProps) {
  const [open, setOpen] = useState(depth === 0);

  return (
    <div className={styles.folderWrapper}>
      <button
        className={styles.item}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextAction?.(e, node); }}
        aria-expanded={open}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <ChevronIcon />
        </span>
        <span className={styles.folderIcon}><FolderSvgIcon open={open} /></span>
        <span className={styles.name}>{node.name}</span>
      </button>

      <div className={`${styles.children} ${open ? styles.childrenOpen : ''}`}>
        {open && (
          node.children.length === 0
            ? <p className={styles.empty} style={{ paddingLeft: `${10 + (depth + 1) * 16}px` }}>Empty</p>
            : node.children.map((child) => (
                <FileTree
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onSelect={onSelect}
                  onContextAction={onContextAction}
                />
              ))
        )}
      </div>
    </div>
  );
}

/* ── File node ─────────────────────────────────────────────────────────────── */
interface FileItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string;
  onSelectFile?: (path: string, name: string) => void;
  onSelect: (path: string) => void;
  onContextAction?: (e: React.MouseEvent, node: TreeNode) => void;
}

function FileItem({ node, depth, selectedPath, onSelectFile, onSelect, onContextAction }: FileItemProps) {
  const isSelected = node.path === selectedPath;
  return (
    <button
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      style={{ paddingLeft: `${10 + depth * 16}px` }}
      onClick={() => {
        onSelect(node.path);
        onSelectFile?.(node.path, node.name);
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextAction?.(e, node); }}
      title={node.name}
    >
      <span className={styles.filespacer} />
      <span className={styles.fileIcon}>{getFileIcon(node.ext)}</span>
      <span className={styles.name}>{node.name}</span>
    </button>
  );
}

/* ── Public composite ──────────────────────────────────────────────────────── */
interface Props {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onSelectFile?: (path: string, name: string) => void;
  onSelect: (path: string) => void;
  onContextAction?: (e: React.MouseEvent, node: TreeNode) => void;
}

export default function FileTree({ node, depth, selectedPath, onSelectFile, onSelect, onContextAction }: Props) {
  if (node.type === 'folder') {
    return <FolderItem node={node} depth={depth} selectedPath={selectedPath} onSelectFile={onSelectFile} onSelect={onSelect} onContextAction={onContextAction} />;
  }
  return <FileItem node={node} depth={depth} selectedPath={selectedPath} onSelectFile={onSelectFile} onSelect={onSelect} onContextAction={onContextAction} />;
}

/* ── SVG icon components ───────────────────────────────────────────────────── */
function ChevronIcon() {
  return <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function FolderSvgIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Z" fill="#f5c842" stroke="#e0b030" strokeWidth="0.5"/></svg>
    : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Z" fill="#fad74b" stroke="#e0b030" strokeWidth="0.5"/></svg>;
}
function FileIcon()  { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 1h6l4 4v10H4V1Z" stroke="currentColor" strokeWidth="1.1"/><path d="M10 1v4h4" stroke="currentColor" strokeWidth="1.1"/></svg>; }
function MdIcon()    { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" fill="#e8f4fd" stroke="#5ba8d4" strokeWidth="0.8"/><text x="2" y="12" fontSize="8" fill="#3a86c0" fontWeight="bold">M↓</text></svg>; }
function TxtIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" fill="#f5f5f5" stroke="#aaa" strokeWidth="0.8"/><line x1="4" y1="6" x2="12" y2="6" stroke="#aaa" strokeWidth="1"/><line x1="4" y1="9" x2="10" y2="9" stroke="#aaa" strokeWidth="1"/></svg>; }
function JsIcon()    { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#f7df1e"/><text x="3" y="13" fontSize="8" fill="#333" fontWeight="bold">JS</text></svg>; }
function TsIcon()    { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#3178c6"/><text x="2.5" y="13" fontSize="8" fill="#fff" fontWeight="bold">TS</text></svg>; }
function JsonIcon()  { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#f0f0f0" stroke="#ccc" strokeWidth="0.6"/><text x="2" y="13" fontSize="8" fill="#666" fontWeight="bold">{`{}`}</text></svg>; }
function PyIcon()    { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#306998"/><text x="3" y="13" fontSize="8" fill="#ffd43b" fontWeight="bold">Py</text></svg>; }
function CssIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#264de4"/><text x="2" y="13" fontSize="7" fill="#fff" fontWeight="bold">CSS</text></svg>; }
function HtmlIcon()  { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#e44d26"/><text x="1.5" y="13" fontSize="6.5" fill="#fff" fontWeight="bold">HTML</text></svg>; }
function ImgIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" fill="#e8f5e9" stroke="#66bb6a" strokeWidth="0.8"/><circle cx="5" cy="6" r="1.5" fill="#66bb6a"/><path d="M1 12l4-4 3 3 2-2 4 4" stroke="#66bb6a" strokeWidth="0.9" fill="none"/></svg>; }
function PdfIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="1.5" fill="#fce4e4" stroke="#e53935" strokeWidth="0.8"/><text x="1.5" y="13" fontSize="7" fill="#e53935" fontWeight="bold">PDF</text></svg>; }
