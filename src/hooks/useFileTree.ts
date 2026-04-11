'use client';
import { useState, useEffect, useCallback } from 'react';
import type { TreeNode } from '@/types/electron';

interface UseFileTreeResult {
  tree: TreeNode[];
  workspacePath: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Mock data for when running in a plain browser (no Electron)
const MOCK_TREE: TreeNode[] = [
  {
    type: 'folder',
    name: 'Notes',
    path: '/Workspace/Notes',
    children: [
      { type: 'file', name: 'welcome.md',  path: '/Workspace/Notes/welcome.md',  ext: '.md' },
      { type: 'file', name: 'ideas.txt',   path: '/Workspace/Notes/ideas.txt',   ext: '.txt' },
    ],
  },
  {
    type: 'folder',
    name: 'Projects',
    path: '/Workspace/Projects',
    children: [
      { type: 'file', name: 'roadmap.md',  path: '/Workspace/Projects/roadmap.md', ext: '.md' },
    ],
  },
  { type: 'file', name: 'README.md', path: '/Workspace/README.md', ext: '.md' },
];

export function useFileTree(): UseFileTreeResult {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [workspacePath, setWorkspacePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.readWorkspace();
        setTree(result.tree);
        setWorkspacePath(result.path);
      } else {
        // Fallback for plain browser dev
        await new Promise((r) => setTimeout(r, 300));
        setTree(MOCK_TREE);
        setWorkspacePath('/Workspace');
      }
    } catch (e) {
      setError((e as Error).message ?? 'Failed to read workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tree, workspacePath, loading, error, refresh };
}
