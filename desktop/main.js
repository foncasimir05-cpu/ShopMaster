const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = process.env.NODE_ENV === 'development';
const WEB_BUILD = path.join(__dirname, 'web-build', 'index.html');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'ShopMaster',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV) {
    // Connect to Expo web dev server for hot reload during development
    win.loadURL('http://localhost:8081');
    win.webContents.openDevTools();
  } else {
    if (!fs.existsSync(WEB_BUILD)) {
      // Show a helpful message if the web build is missing
      win.loadURL(`data:text/html,<body style="font-family:sans-serif;padding:40px;background:#f3f4f6">
        <h2>Build required</h2>
        <p>Run <code>npm run build:web</code> inside the <code>desktop/</code> folder first.</p>
      </body>`);
    } else {
      win.loadFile(WEB_BUILD);
    }
  }

  buildMenu(win);
}

function buildMenu(win) {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.reload() },
        { type: 'separator' },
        { label: 'Quit ShopMaster', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(DEV ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'ShopMaster Support',
          click: () => shell.openExternal('https://github.com/foncasimir05-cpu/ShopMaster'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
