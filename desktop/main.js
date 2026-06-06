const { app, BrowserWindow, Menu, shell } = require('electron');
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
// This avoids all file:// protocol restrictions (fetch, fonts, CSP, history).
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

    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

async function createWindow() {
  let appUrl;

  if (DEV) {
    appUrl = 'http://localhost:8081'; // Expo web dev server
  } else if (!fs.existsSync(path.join(WEB_BUILD, 'index.html'))) {
    appUrl = null; // handled below
  } else {
    const port = await startStaticServer();
    appUrl = `http://127.0.0.1:${port}`;
  }

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

  if (!appUrl) {
    win.loadURL(`data:text/html,<body style="font-family:sans-serif;padding:40px;background:#f3f4f6">
      <h2>Build required</h2>
      <p>Run <code>npm run build:web</code> inside the <code>desktop/</code> folder first, then repackage.</p>
    </body>`);
  } else {
    win.loadURL(appUrl);
  }

  if (DEV) win.webContents.openDevTools();

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
