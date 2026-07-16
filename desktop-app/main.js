const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: "IPA Compilor",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0e' // Dark background
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

let currentProcess = null;

ipcMain.on('start-build', (event, options) => {
  if (currentProcess) {
    event.reply('build-log', 'A build is already in progress.\n');
    return;
  }

  // Construct arguments
  const args = [];
  
  // Try to use dist if available, else tsx
  const distPath = path.join(__dirname, '..', 'cli', 'dist', 'index.js');
  const srcPath = path.join(__dirname, '..', 'cli', 'src', 'index.ts');
  
  let command = 'node';
  if (fs.existsSync(distPath)) {
    args.push(distPath);
  } else {
    command = 'npx';
    // Use npx tsx in windows: npx.cmd
    if (process.platform === 'win32') command = 'npx.cmd';
    args.push('tsx', srcPath);
  }

  args.push('build');
  if (options.projectPath) {
    args.push(options.projectPath);
  }
  
  if (options.cloud) args.push('--cloud');
  if (options.simulator) args.push('--emulator');
  if (options.target) {
    args.push('-t', options.target);
  }
  
  // We can add FORCE_COLOR to get colored output and parse it or just show raw
  const env = { ...process.env, FORCE_COLOR: '1' };

  event.reply('build-log', `> ${command} ${args.join(' ')}\n\n`);

  currentProcess = spawn(command, args, { env, cwd: path.join(__dirname, '..') });

  currentProcess.stdout.on('data', (data) => {
    event.reply('build-log', data.toString());
  });

  currentProcess.stderr.on('data', (data) => {
    event.reply('build-log', data.toString());
  });

  currentProcess.on('close', (code) => {
    event.reply('build-log', `\nProcess exited with code ${code}\n`);
    event.reply('build-finished', code === 0);
    currentProcess = null;
  });
  
  currentProcess.on('error', (err) => {
    event.reply('build-log', `\nError spawning process: ${err.message}\n`);
    event.reply('build-finished', false);
    currentProcess = null;
  });
});

ipcMain.on('cancel-build', (event) => {
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
    event.reply('build-log', '\n[System] Build cancelled by user.\n');
    currentProcess = null;
  }
});
