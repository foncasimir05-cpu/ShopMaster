const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DEV = process.env.NODE_ENV === 'development';
const WEB_BUILD = path.join(__dirname, 'web-build');

// MIME types for static file serving
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.ttf':  'font/truetype',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.pak':  'application/octet-stream',
};

// Spin up a local HTTP server on a random port to serve the web build.
// Avoids all file:// protocol restrictions (fetch, fonts, CSP, history).
function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';

      const filePath = path.join(WEB_BUILD, urlPath);
      const ext = path.extname(filePath).toLowerCase();

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(filePath));
      } else {
        // SPA fallback — all unknown routes serve index.html
        const index = path.join(WEB_BUILD, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(index));
      }
    });

    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

let mainWindow = null;

async function createWindow() {
  let appUrl;

  if (DEV) {
    appUrl = 'http://localhost:8081'; // Expo web dev server
  } else if (!fs.existsSync(path.join(WEB_BUILD, 'index.html'))) {
    appUrl = null;
  } else {
    const port = await startStaticServer();
    appUrl = `http://127.0.0.1:${port}`;
  }

  mainWindow = new BrowserWindow({
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

  if (!appUrl) {
    mainWindow.loadURL(`data:text/html,<body style="font-family:sans-serif;padding:40px;background:#f3f4f6">
      <h2>Build required</h2>
      <p>Run <code>npm run build:web</code> inside the <code>desktop/</code> folder first, then repackage.</p>
    </body>`);
  } else {
    mainWindow.loadURL(appUrl);
  }

  if (DEV) mainWindow.webContents.openDevTools();

  buildMenu(mainWindow);
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
          label: 'Check for Updates',
          click: () => checkForUpdatesManually(),
        },
        { type: 'separator' },
        {
          label: 'ShopMaster Support',
          click: () => shell.openExternal('https://github.com/foncasimir05-cpu/ShopMaster'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Auto-updater ────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  // Only run in packaged app (not in dev mode)
  if (DEV || !app.isPackaged) return;

  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `ShopMaster ${info.version} is available. Downloading in the background…`,
        buttons: ['OK'],
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('Already on latest version.');
    });

    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `ShopMaster ${info.version} has been downloaded. It will be installed when you quit the app.`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message);
    });

    // Check 5 seconds after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

  } catch (err) {
    console.warn('Auto-updater not available:', err.message);
  }
}

function checkForUpdatesManually() {
  if (DEV || !app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Dev Mode',
      message: 'Auto-update is only active in the packaged/installed version of ShopMaster.',
      buttons: ['OK'],
    });
    return;
  }
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdates().then(result => {
      if (!result || !result.updateInfo) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Up to Date',
          message: 'You are running the latest version of ShopMaster.',
          buttons: ['OK'],
        });
      }
    }).catch(err => {
      dialog.showErrorBox('Update Check Failed', err.message);
    });
  } catch (err) {
    dialog.showErrorBox('Update Check Failed', err.message);
  }
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
