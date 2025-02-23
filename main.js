// BEGIN Main.js
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('Main process starting...');

let mainWindow;
let overlayWindow;
let overlayPosition;
let isGlobalHotkeyEnabled = false;

function createMainWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path resolved:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  console.log('Loading index:', indexPath);
  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('Failed to load index.html:', err);
    mainWindow.loadURL('data:text/html,<h1>Error: Could not load app</h1><p>' + err.message + '</p>');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window loaded—checking electronAPI...');
    mainWindow.webContents.executeJavaScript('console.log("electronAPI exists:", !!window.electronAPI)');
  });
}

function createOverlayWindow() {
  const displays = screen.getAllDisplays();
  const minX = Math.min(...displays.map(d => d.bounds.x));
  const minY = Math.min(...displays.map(d => d.bounds.y));
  const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  overlayWindow = new BrowserWindow({
    x: minX,
    y: minY,
    width: totalWidth,
    height: totalHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayPosition = { x: minX, y: minY };

  const bounds = overlayWindow.getBounds();
  console.log('Overlay window created with bounds:', bounds);
  if (bounds.width !== totalWidth || bounds.height !== totalHeight) {
    console.warn('Overlay bounds mismatch, resetting...');
    overlayWindow.setBounds({ x: minX, y: minY, width: totalWidth, height: totalHeight });
    console.log('Overlay bounds reset to:', overlayWindow.getBounds());
  }

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html')).catch((err) => {
    console.error('Failed to load overlay.html:', err);
    overlayWindow.loadURL('data:text/html,<h1>Error loading overlay</h1><p>' + err.message + '</p>');
  });

  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setFocusable(false);

  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('Overlay window loaded');
  });
}

ipcMain.handle('fs-read', (event, path, encoding) => fs.readFileSync(path, encoding));
ipcMain.handle('fs-write', (event, path, data) => fs.writeFileSync(path, data));
ipcMain.handle('fs-exists', (event, path) => fs.existsSync(path));

ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log('Desktop sources fetched:', sources);
    return sources.map(source => ({ id: source.id, name: source.name, display_id: source.display_id }));
  } catch (err) {
    console.error('Error fetching desktop sources:', err);
    throw err;
  }
});

ipcMain.handle('get-screen-size', async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  console.log('Screen size:', { width, height });
  return { width, height };
});

app.whenReady().then(() => {
  console.log('App ready');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.on('get-sources', async (event) => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    console.log('Sources fetched:', sources);
    event.reply('source-list', sources.map((source) => ({
      id: source.id,
      name: source.name,
    })));
  } catch (err) {
    console.error('Error fetching sources:', err);
    event.reply('source-list', []);
  }
});

ipcMain.on('toggle-overlay', (event, enable) => {
  if (enable && !overlayWindow) {
    createOverlayWindow();
  } else if (!enable && overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

ipcMain.on('start-bounding-box', (event, mode) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(false);
    console.log('Overlay mouse events enabled');
    overlayWindow.webContents.send('start-drawing', mode);
  }
});

ipcMain.on('capture-area', async (event, { x, y, width, height, mode }) => {
  const screenX = overlayPosition.x + x;
  const screenY = overlayPosition.y + y;
  const centerX = screenX + width / 2;
  const centerY = screenY + height / 2;

  const displays = screen.getAllDisplays();
  console.log('Capture attempt:', { screenX, screenY, centerX, centerY, width, height });
  console.log('All displays:', displays.map(d => ({ id: d.id, bounds: d.bounds })));

  const targetDisplay = displays.find(d => {
    const { x, y, width, height } = d.bounds;
    return centerX >= x && centerX < x + width && centerY >= y && centerY < y + height;
  });

  if (!targetDisplay) {
    console.error('No display found for coordinates:', { centerX, centerY });
    return;
  }

  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log('Available sources:', sources.map(s => ({ id: s.id, name: s.name, display_id: s.display_id })));

    const source = sources.find(s => s.display_id === String(targetDisplay.id)) || 
                  sources[displays.indexOf(targetDisplay)] || 
                  sources[0];
    if (!source) {
      console.error('No matching source found for display:', targetDisplay);
      return;
    }

    const relativeX = Math.max(0, Math.min(screenX - targetDisplay.bounds.x, targetDisplay.bounds.width - width));
    const relativeY = Math.max(0, Math.min(screenY - targetDisplay.bounds.y, targetDisplay.bounds.height - height));

    console.log('Sending capture:', { 
      sourceId: source.id, 
      x: relativeX, 
      y: relativeY, 
      width, 
      height, 
      mode, 
      displayWidth: targetDisplay.bounds.width, 
      displayHeight: targetDisplay.bounds.height 
    });

    mainWindow.webContents.send('perform-capture', { 
      sourceId: source.id, 
      x: relativeX, 
      y: relativeY, 
      width, 
      height, 
      mode,
      displayWidth: targetDisplay.bounds.width,
      displayHeight: targetDisplay.bounds.height
    });
  } catch (err) {
    console.error('Capture error:', err);
  }
});

ipcMain.on('enable-interaction', (event, { x, y, width, height }) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    console.log('Overlay mouse events disabled, forwarding enabled');
  }
});

ipcMain.on('disable-bounding-box', (event) => {
  if (mainWindow) {
    mainWindow.webContents.send('disable-bounding-box');
  }
});

ipcMain.on('toggle-global-hotkey', (event, enable) => {
  if (enable && !isGlobalHotkeyEnabled) {
    globalShortcut.register('`', () => {
      console.log('Global hotkey ` pressed');
      if (mainWindow) {
        mainWindow.webContents.send('toggle-bounding-box');
      }
    });
    isGlobalHotkeyEnabled = true;
    console.log('Global hotkey ` registered');
  } else if (!enable && isGlobalHotkeyEnabled) {
    globalShortcut.unregister('`');
    isGlobalHotkeyEnabled = false;
    console.log('Global hotkey ` unregistered');
  }
});
// END Main.js