/*const { app, BrowserWindow, ipcMain } = require('electron');
const { desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadFile('public/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.on('get-stream', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sources[0].id } },
  });
  const videoTrack = stream.getVideoTracks()[0];
  event.reply('stream-ready', videoTrack);
});*/