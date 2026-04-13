'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import Showdown from 'showdown';
import TurndownService from 'turndown';
import styles from './MarkdownPanel.module.css';

export interface MarkdownDoc {
  content: string;
  title?: string;
  filePath?: string;
}

interface Props {
  doc: MarkdownDoc;
  onChange: (newContent: string) => void;
  onClose: () => void;
  onSave?: () => void;
}

// ── Converters (singleton) ─────────────────────────────────
const mdToHtml = new Showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  ghCodeBlocks: true,
  simplifiedAutoLink: true,
  openLinksInNewWindow: true,
  emoji: true,
});

const htmlToMd = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Add table support to turndown
htmlToMd.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement: (content) => content.trim(),
});

htmlToMd.addRule('tableRow', {
  filter: 'tr',
  replacement: (content, node) => {
    const cells = Array.from(node.children).map(td =>
      td.textContent?.trim() || ''
    );
    return `| ${cells.join(' | ')} |\n`;
  },
});

htmlToMd.addRule('table', {
  filter: 'table',
  replacement: (content, node) => {
    const rows = Array.from(node.querySelectorAll('tr')).map(tr => {
      const cells = Array.from(tr.children).map(td =>
        td.textContent?.trim() || ''
      );
      return `| ${cells.join(' | ')} |`;
    });

    if (rows.length === 0) return '';

    const header = rows[0];
    const colCount = header.split('|').length - 2;

    const separator =
      '| ' + Array(colCount).fill('---').join(' | ') + ' |';

    return '\n\n' + [header, separator, ...rows.slice(1)].join('\n') + '\n\n';
  },
});
htmlToMd.addRule('taskListItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.parentElement?.getAttribute('data-type') === 'taskList';
  },
  replacement: (content, node) => {
    const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
    const checked = checkbox ? (checkbox as HTMLInputElement).checked : false;
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

export default function MarkdownPanel({ doc, onChange, onClose, onSave }: Props) {
  const lastExternalContent = useRef(doc.content);
  const isInternalUpdate = useRef(false);

  // CTRL+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  function fixMarkdown(md: string) {
    return md
      .replace(/\\n/g, '\n') // fix escaped newlines
      .replace(/\|\s*\|/g, '|\n|') // split merged rows
      .replace(/\|\|/g, '|'); // remove duplicates
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: { class: 'code-block' },
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: 'Start writing, or paste your content here…',
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: mdToHtml.makeHtml(fixMarkdown(doc.content || '')),
    editorProps: {
      attributes: {
        class: 'tiptap',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true;
      const html = ed.getHTML();
      const md = htmlToMd.turndown(html);
      onChange(md);
      lastExternalContent.current = md;
    },
  });

  // When doc.content changes externally (e.g. streaming), update editor
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (doc.content !== lastExternalContent.current) {
      lastExternalContent.current = doc.content;
      const html = mdToHtml.makeHtml(doc.content || '');
      editor.commands.setContent(html, false);
    }
  }, [doc.content, editor]);

  return (
    <div className={styles.panel}>
      <div className={styles.editorContainer}>
        <div className={styles.editor}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
