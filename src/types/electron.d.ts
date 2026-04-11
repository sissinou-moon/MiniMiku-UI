// TypeScript declarations for the Electron context bridge API

export interface FileNode {
  type: 'file';
  name: string;
  path: string;
  ext: string;
}

export interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

export interface WorkspaceData {
  path: string;
  tree: TreeNode[];
}

export interface ElectronAPI {
  // Window controls
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  // File system
  readWorkspace: () => Promise<WorkspaceData>;
  readFile: (filePath: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
