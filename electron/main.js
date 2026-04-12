const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow = null;

// ─── Workspace path ─────────────────────────────────────────────────────────
function getWorkspacePath() {
  return isDev
    ? path.join(process.cwd(), 'Workspace')
    : path.join(path.dirname(app.getPath('exe')), 'Workspace');
}

// ─── Recursive directory reader ──────────────────────────────────────────────
function readDirRecursive(dirPath, depth = 0) {
  if (depth > 8) return [];
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    return items
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          return {
            type: 'folder',
            name: item.name,
            path: fullPath,
            children: readDirRecursive(fullPath, depth + 1),
          };
        }
        return {
          type: 'file',
          name: item.name,
          path: fullPath,
          ext: path.extname(item.name).toLowerCase(),
        };
      });
  } catch {
    return [];
  }
}

// ─── IPC Handlers (registered once) ─────────────────────────────────────────
ipcMain.on('window:minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});

ipcMain.on('window:close', () => {
  BrowserWindow.getFocusedWindow()?.close();
});

ipcMain.handle('fs:readWorkspace', () => {
  const workspacePath = getWorkspacePath();
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }
  return {
    path: workspacePath,
    tree: readDirRecursive(workspacePath),
  };
});

ipcMain.handle('fs:readFile', (_event, filePath) => {
  try {
    const workspacePath = getWorkspacePath();
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(workspacePath)) return null;
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
});

// ─── Window creation ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 500,
    frame: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
    show: false,
  });

  // ✅ ADD IT HERE
  mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
