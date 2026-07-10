const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('node:path');
const Route = require('./src/js/Route.class');

// Global state variables
let childWindow = null;
let packege = {};
let globalEvent = null;
let currentSocket = null;

const debug = process.env.DEBUG || false;
const PORT = process.env.PORT || 8585;
const env = process.env.NODE_ENV || 'dev';

// Custom colored console logger inspired by developer experience standards
const log = (module, message, data = '') => {
  if (env === 'dev' || debug) {
    const icons = {
      APP: '🚀 [APP]',
      SERVER: '🌐 [SERVER]',
      SOCKET: '🔌 [SOCKET]',
      IPC: '📥 [IPC]',
      ERROR: '🚨 [ERROR]'
    };
    const prefix = icons[module] || `[${module}]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

// Window setup preferences
const windowSetup = {
  width: 500,
  height: 100,
  minWidth: 360,
  minHeight: 100,
  maxHeight: 100,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  fullscreenable: false,
  maximizable: false,
  resizable: false,
  show: false, // Prevent white flicker on load
  skipTaskbar: true, // Hide from taskbar as it is a utility overlay widget
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
};

async function createCheckWindow() {
  log('APP', 'Inicializando janela de overlay...');
  childWindow = new BrowserWindow(windowSetup);
  
  childWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Ensure window is shown only when content is ready to prevent flickering
  childWindow.once('ready-to-show', () => {
    log('APP', 'Janela pronta para exibição. Exibindo widget...');
    childWindow.show();
    // Keep overlay above full-screen apps (like games/IDE presentation modes)
    childWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  if (env === 'dev' && debug) {
    childWindow.webContents.openDevTools({ mode: 'detach' });
  }

  childWindow.on('closed', () => {
    childWindow = null;
    log('APP', 'Janela fechada.');
  });
}

// App lifecycle
app.whenReady().then(() => {
  createCheckWindow();
});

if (require('electron-squirrel-startup')) {
  log('APP', 'Gerenciando inicialização do Squirrel.');
  app.quit();
}

app.on('window-all-closed', () => {
  log('APP', 'Todas as janelas fechadas. Encerrando app.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// HTTP Server setup
const server = http.createServer(function (req, res) {
  const route = new Route(req.url);
  try {
    const fileData = fs.readFileSync(path.join(__dirname, route.filename));
    res.writeHead(200, { 'Content-Type': route.contentType });
    res.end(fileData);
  } catch (err) {
    log('SERVER', `Erro ao ler arquivo: ${route.filename}. ${err.message}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Storage setup
const STORAGE_PATH = path.join(__dirname, 'tasks-store.json');
let store = {
  tasks: [],
  dayTotalHours: 8
};

function convertFloatToSeconds(time) {
  return Math.floor(time * 3600);
}

function getComputedTasks() {
  const totalPausasHoras = store.tasks.reduce((sum, t) => sum + (t.totalTimePause || 0), 0) / 3600;
  const progressoLivres = store.tasks
    .filter((t) => t.flexible)
    .reduce((sum, t) => sum + (t.totalProgress || 0), 0) / 3600;

  const tempoComprometidoFixas = store.tasks
    .filter((t) => !t.flexible)
    .reduce((sum, t) => {
      const duration = parseFloat(t.totalTimeFloat || 0);
      const progress = (t.totalProgress || 0) / 3600;
      return sum + Math.max(duration, progress);
    }, 0);

  const tempoRestante = Math.max(0, store.dayTotalHours - tempoComprometidoFixas - progressoLivres - totalPausasHoras);

  return store.tasks.map((t) => {
    if (t.flexible) {
      const selfSpentHoursReal = ((t.totalProgress || 0) + (t.totalTimePause || 0)) / 3600;
      const tMaxDuration = tempoRestante + selfSpentHoursReal;
      return {
        ...t,
        totalTimeFloat: tMaxDuration,
        totalTimeSeconds: convertFloatToSeconds(tMaxDuration)
      };
    }
    return t;
  });
}

function loadStore() {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));
      if (data && typeof data === 'object') {
        store.tasks = data.tasks || [];
        store.dayTotalHours = data.dayTotalHours || 8;

        const activeTask = store.tasks.find(t => t.active);
        if (activeTask) {
          const computed = getComputedTasks();
          const computedActive = computed.find(t => t.id === activeTask.id);
          if (computedActive) {
            packege = computedActive;
          }
        }
      }
    }
  } catch (err) {
    log('ERROR', `Erro ao ler tasks-store.json: ${err.message}`);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    log('ERROR', `Erro ao salvar tasks-store.json: ${err.message}`);
  }
}

function handleShiftTask(direction) {
  if (store.tasks.length === 0) return;

  const activeIdx = store.tasks.findIndex(t => t.active);
  let nextIdx = 0;
  if (direction === 'next') {
    nextIdx = activeIdx !== -1 ? (activeIdx + 1) % store.tasks.length : 0;
  } else {
    nextIdx = activeIdx !== -1 ? (activeIdx - 1 + store.tasks.length) % store.tasks.length : store.tasks.length - 1;
  }

  store.tasks = store.tasks.map((t, i) => ({
    ...t,
    active: i === nextIdx
  }));
  saveStore();

  const computed = getComputedTasks();
  packege = computed[nextIdx];

  if (globalEvent) {
    globalEvent.sender.send('instructions', packege);
  }

  io.emit('sync-store', store);
}

loadStore();

server.listen(PORT, () => {
  log('SERVER', `Servidor rodando e ouvindo na porta ${PORT}`);
});

// Socket.IO setup
const io = socketIo(server);

io.on('connection', (socket) => {
  log('SOCKET', 'Nova conexão estabelecida com o painel web.');

  currentSocket = socket;

  // Emit current store state on connection
  socket.emit('sync-store', store);

  socket.on('disconnect', () => {
    log('SOCKET', 'Conexão encerrada com o painel.');
    if (currentSocket === socket) {
      currentSocket = null;
    }
  });

  socket.on('evento', (msg) => {
    log('SOCKET', 'Instruções recebidas do painel. Atualizando overlay.', msg);
    packege = msg;
    store.tasks = store.tasks.map(t => ({
      ...t,
      active: t.id === msg.id
    }));
    saveStore();

    if (globalEvent) {
      globalEvent.sender.send('instructions', packege);
    }
    socket.broadcast.emit('sync-store', store);
  });

  socket.on('stop', (msg) => {
    log('SOCKET', 'Comando STOP recebido do painel.');
    store.tasks = store.tasks.map(t => ({ ...t, active: false }));
    saveStore();

    if (globalEvent) {
      globalEvent.sender.send('stop', msg);
    }
    socket.broadcast.emit('sync-store', store);
  });

  socket.on('save-store', (newStore) => {
    log('SOCKET', 'Novo store recebido do painel.', newStore);
    if (newStore && typeof newStore === 'object') {
      store.tasks = newStore.tasks || [];
      store.dayTotalHours = newStore.dayTotalHours || 8;
      saveStore();
      socket.broadcast.emit('sync-store', store);
    }
  });
});

// IPC Main communication listeners
ipcMain.on('status', (event, arg) => {
  log('IPC', 'Overlay status recebido:', arg);
  store.tasks = store.tasks.map(t => {
    if (t.id === arg.id) {
      return {
        ...t,
        totalProgress: arg.totalProgress,
        totalTimePause: arg.totalTimePause,
        currentTimePause: arg.currentTimePause,
        active: arg.active
      };
    }
    return t;
  });
  saveStore();

  if (currentSocket) {
    currentSocket.emit('update', arg);
  }
});

ipcMain.on('next', (event, arg) => {
  log('IPC', 'Overlay next recebido.');
  handleShiftTask('next');
});

ipcMain.on('back', (event, arg) => {
  log('IPC', 'Overlay back recebido.');
  handleShiftTask('back');
});

ipcMain.on('exit', (event, arg) => {
  log('IPC', 'Overlay exit recebido. Encerrando processos...');
  store.tasks = store.tasks.map(t => ({ ...t, active: false }));
  saveStore();
  
  if (currentSocket) {
    currentSocket.emit('exit', arg);
  }
  process.exit(0);
});

ipcMain.on('finish', (event, arg) => {
  log('IPC', 'Atividade finalizada. Disparando notificação nativa:', arg.title);
  store.tasks = store.tasks.map(t => {
    if (t.id === arg.id) {
      return {
        ...t,
        totalProgress: arg.totalProgress,
        totalTimePause: arg.totalTimePause,
        active: false
      };
    }
    return t;
  });
  saveStore();

  if (currentSocket) {
    currentSocket.emit('update', { ...arg, active: false });
  }
  showNotification(arg);
});

ipcMain.on('online', (event, arg) => {
  log('IPC', 'Overlay on-line.');
  globalEvent = event;
  const welcomeMsg = `Acesse <strong>http://localhost:${PORT}</strong> para selecionar uma nova atividade`;
  event.sender.send('server', welcomeMsg);

  if (packege && Object.keys(packege).length > 0) {
    event.sender.send('instructions', packege);
  }
});

// Notifications helper
function showNotification(arg) {
  new Notification({
    title: 'Atividade concluída',
    body: `A atividade "${arg.title}" foi concluída.`
  }).show();
}

// Global Exception Handler to prevent silent crashes
process.on('uncaughtException', (err) => {
  log('ERROR', `Exceção não capturada: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', `Promessa rejeitada sem tratamento: ${reason}`);
});


