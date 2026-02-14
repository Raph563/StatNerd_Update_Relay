'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require('electron');
const { createRelayServer, DEFAULT_PORT } = require('./relay-server');

const APP_ID = 'com.statnerd.relay';
const DEFAULT_STATE = {
  port: DEFAULT_PORT,
  repository: 'Raph563/Grocy',
  localRootPath: '',
  language: 'fr',
  launchAtStartup: false,
};

let tray = null;
let win = null;
let relay = null;
let isQuitting = false;
let state = { ...DEFAULT_STATE };

const t = {
  fr: {
    open: 'Ouvrir',
    launchAtStartup: 'Lancer au démarrage',
    language: 'Langue',
    restartRelay: 'Redémarrer le relay',
    restartApp: "Redémarrer l'application",
    quit: 'Quitter',
    relayOn: 'Relay actif',
    relayOff: 'Relay arrêté',
  },
  en: {
    open: 'Open',
    launchAtStartup: 'Launch at startup',
    language: 'Language',
    restartRelay: 'Restart relay',
    restartApp: 'Restart application',
    quit: 'Quit',
    relayOn: 'Relay running',
    relayOff: 'Relay stopped',
  },
};

function tr(key) {
  const lang = state.language === 'en' ? 'en' : 'fr';
  return (t[lang] && t[lang][key]) || (t.fr[key] || key);
}

function stateFilePath() {
  return path.join(app.getPath('userData'), 'relay-settings.json');
}

function normalizeState(input = {}) {
  const next = { ...DEFAULT_STATE, ...(input || {}) };
  next.port = Number(next.port || DEFAULT_PORT);
  if (!Number.isFinite(next.port) || next.port < 1024 || next.port > 65535) next.port = DEFAULT_PORT;
  next.repository = String(next.repository || DEFAULT_STATE.repository).trim() || DEFAULT_STATE.repository;
  next.localRootPath = String(next.localRootPath || '').trim();
  next.language = next.language === 'en' ? 'en' : 'fr';
  next.launchAtStartup = next.launchAtStartup === true;
  return next;
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    state = normalizeState(JSON.parse(raw));
  } catch (_err) {
    state = { ...DEFAULT_STATE };
  }
}

function saveState(patch = {}) {
  state = normalizeState({ ...state, ...(patch || {}) });
  fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
  fs.writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf8');
  applyLaunchAtStartup();
  broadcastState();
  rebuildTrayMenu();
  return state;
}

function applyLaunchAtStartup() {
  app.setLoginItemSettings({
    openAtLogin: state.launchAtStartup === true,
  });
}

function loginOpenAtStartup() {
  try {
    const info = app.getLoginItemSettings();
    return info && info.openAtLogin === true;
  } catch (_err) {
    return state.launchAtStartup === true;
  }
}

function trayIcon() {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAUVBMVEVHcEz///////////////////////////////////////8xMTH////8/Pz5+fnR0dHh4eGtra2Ojo7w8PDm5ubV1dXR0dGioqKUlJSEhIQyMjLQ0NCampqcnJxAQEAFBQXxvU5kAAAAGXRSTlMAAQMEBgcICQoLDA4QERMWFxo0OD9DSEz1sUN5AAAARUlEQVQY02XMRQ7AIAgE0YlN///Ltm0wA7YQ7dM4x8EG8wQnNoMmyM8q1M4nUyqY6d8KfVQ6a6vQtsSx6gK9bR8dlhM5YxJxtM4J6x7xAcnYB3ATGDbvQAAAABJRU5ErkJggg==';
  const image = nativeImage.createFromDataURL(`data:image/png;base64,${pngBase64}`);
  if (process.platform === 'darwin') image.setTemplateImage(false);
  return image;
}

async function restartRelay() {
  if (relay) {
    await relay.stop();
  }
  relay = createRelayServer({ port: state.port });
  await relay.start();
  updateTrayTooltip();
  broadcastState();
}

function relayStatus() {
  return relay ? relay.status() : { host: '127.0.0.1', port: state.port, running: false, listening: false };
}

function updateTrayTooltip() {
  if (!tray) return;
  const s = relayStatus();
  const title = s.listening ? tr('relayOn') : tr('relayOff');
  tray.setToolTip(`StatNerd Relay - ${title} (${s.host}:${s.port})`);
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function broadcastState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('relay:state-changed', {
    ...state,
    launchAtStartup: loginOpenAtStartup(),
    relayListening: relayStatus().listening,
  });
}

function rebuildTrayMenu() {
  if (!tray) return;
  const startupChecked = loginOpenAtStartup();
  const template = [
    { label: tr('open'), click: () => showWindow() },
    { type: 'separator' },
    {
      label: tr('launchAtStartup'),
      type: 'checkbox',
      checked: startupChecked,
      click: (item) => saveState({ launchAtStartup: item.checked === true }),
    },
    {
      label: tr('language'),
      submenu: [
        {
          label: 'Français',
          type: 'radio',
          checked: state.language === 'fr',
          click: () => saveState({ language: 'fr' }),
        },
        {
          label: 'English',
          type: 'radio',
          checked: state.language === 'en',
          click: () => saveState({ language: 'en' }),
        },
      ],
    },
    { type: 'separator' },
    { label: tr('restartRelay'), click: () => restartRelay().catch(() => {}) },
    { label: tr('restartApp'), click: () => app.relaunch() || app.exit(0) },
    { type: 'separator' },
    {
      label: tr('quit'),
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  updateTrayTooltip();
}

function createWindow() {
  win = new BrowserWindow({
    width: 840,
    height: 540,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'installer.html'));
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });
}

function setupIpc() {
  ipcMain.handle('relay:get-state', async () => ({
    ...state,
    launchAtStartup: loginOpenAtStartup(),
    relayListening: relayStatus().listening,
  }));

  ipcMain.handle('relay:save-settings', async (_event, patch) => {
    const next = saveState(patch || {});
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'port')) {
      await restartRelay();
    }
    return {
      ...next,
      launchAtStartup: loginOpenAtStartup(),
      relayListening: relayStatus().listening,
    };
  });

  ipcMain.handle('relay:restart-relay', async () => {
    await restartRelay();
    return true;
  });

  ipcMain.handle('relay:restart-app', async () => {
    app.relaunch();
    app.exit(0);
    return true;
  });
}

async function boot() {
  app.setAppUserModelId(APP_ID);
  loadState();
  applyLaunchAtStartup();
  setupIpc();
  createWindow();
  tray = new Tray(trayIcon());
  tray.on('double-click', () => showWindow());
  tray.on('click', () => showWindow());
  rebuildTrayMenu();
  await restartRelay();
}

app.whenReady().then(() => boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Boot failed:', err);
  app.exit(1);
}));

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

