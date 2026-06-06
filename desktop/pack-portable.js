/**
 * Portable build script — bypasses electron-builder's winCodeSign dependency.
 *
 * Uses the Electron binary cached by npm/electron and injects the app files
 * into the resources/app folder, then zips the result.
 *
 * Run: node pack-portable.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST, 'ShopMaster-win32-x64');
const APP_DIR = path.join(OUT_DIR, 'resources', 'app');

// Locate electron binary zip from npm cache
function findElectronZip() {
  const electronPkg = require('./node_modules/electron/package.json');
  const ver = electronPkg.version;
  const cache = path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache');
  const zipName = `electron-v${ver}-win32-x64.zip`;
  const zipPath = path.join(cache, zipName);
  if (fs.existsSync(zipPath)) return zipPath;
  throw new Error(`Electron binary not found at ${zipPath}. Run 'npm install' first.`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('Building ShopMaster portable app...\n');

// 1. Clean output
console.log('[1/5] Cleaning output directory...');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 2. Extract electron runtime from cache
console.log('[2/5] Extracting Electron runtime...');
const zipPath = findElectronZip();
console.log(`      Using: ${zipPath}`);
fs.mkdirSync(OUT_DIR, { recursive: true });
const result = spawnSync('powershell', [
  '-command',
  `Expand-Archive -Path '${zipPath}' -DestinationPath '${OUT_DIR}' -Force`,
], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Failed to extract Electron zip');

// 3. Rename electron.exe → ShopMaster.exe
console.log('[3/5] Renaming executable...');
const electronExe = path.join(OUT_DIR, 'electron.exe');
const appExe = path.join(OUT_DIR, 'ShopMaster.exe');
if (fs.existsSync(electronExe)) fs.renameSync(electronExe, appExe);
else if (!fs.existsSync(appExe)) throw new Error('electron.exe not found after extraction');

// 4. Inject app files
console.log('[4/5] Injecting app files...');
fs.mkdirSync(APP_DIR, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'main.js'), path.join(APP_DIR, 'main.js'));
fs.copyFileSync(path.join(ROOT, 'preload.js'), path.join(APP_DIR, 'preload.js'));
fs.writeFileSync(path.join(APP_DIR, 'package.json'), JSON.stringify({
  name: 'shopmaster-desktop', version: '1.0.0', main: 'main.js',
}, null, 2));
if (!fs.existsSync(path.join(ROOT, 'web-build'))) {
  throw new Error('web-build/ not found. Run "npm run build:web" first.');
}
console.log('      Copying web build...');
copyDir(path.join(ROOT, 'web-build'), path.join(APP_DIR, 'web-build'));

// 5. Create zip
console.log('[5/5] Creating zip...');
const zipOut = path.join(DIST, 'ShopMaster-Windows-x64.zip');
fs.rmSync(zipOut, { force: true });
const zipResult = spawnSync('powershell', [
  '-command',
  `Compress-Archive -Path '${OUT_DIR}' -DestinationPath '${zipOut}' -Force`,
], { stdio: 'inherit' });
if (zipResult.status !== 0) throw new Error('Failed to create zip');

const sizeMB = (fs.statSync(zipOut).size / 1024 / 1024).toFixed(1);
console.log(`\nDone!`);
console.log(`  Folder: dist/ShopMaster-win32-x64/ShopMaster.exe  (run directly)`);
console.log(`  Zip:    dist/ShopMaster-Windows-x64.zip  (${sizeMB} MB — distribute this)`);
console.log(`\nTo install on another PC: extract the zip and run ShopMaster.exe`);
