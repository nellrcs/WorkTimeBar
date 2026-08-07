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
        store.dayTotalHours = typeof data.dayTotalHours === 'number' ? data.dayTotalHours : 8;

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

let saveStoreTimeout = null;

function saveStore() {
  try {
    const tempPath = STORAGE_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tempPath, STORAGE_PATH);
  } catch (err) {
    log('ERROR', `Erro ao salvar tasks-store.json: ${err.message}`);
  }
}

function debouncedSaveStore() {
  if (saveStoreTimeout) return;
  saveStoreTimeout = setTimeout(() => {
    saveStore();
    saveStoreTimeout = null;
  }, 15000);
}

function saveStoreImmediately() {
  if (saveStoreTimeout) {
    clearTimeout(saveStoreTimeout);
    saveStoreTimeout = null;
  }
  saveStore();
}

function safeSendToOverlay(channel, data) {
  if (childWindow && !childWindow.isDestroyed()) {
    try {
      childWindow.webContents.send(channel, data);
    } catch (err) {
      log('ERROR', `Erro ao enviar dados para canal ${channel}: ${err.message}`);
    }
  }
}

function syncTaskCheckpoints(task, isNowActive, currentProgress) {
  let checkpoints = Array.isArray(task.checkpoints) ? [...task.checkpoints] : [];
  const prog = currentProgress !== undefined ? currentProgress : (task.totalProgress || 0);

  if (isNowActive) {
    let openIdx = checkpoints.findIndex(c => c.endTime === null);
    if (openIdx === -1) {
      checkpoints.push({
        id: Date.now(),
        startTime: new Date().toISOString(),
        endTime: null,
        progressStart: prog,
        progressEnd: prog,
        duration: 0
      });
    } else {
      const cp = { ...checkpoints[openIdx] };
      cp.progressEnd = prog;
      cp.duration = Math.max(0, prog - cp.progressStart);
      checkpoints[openIdx] = cp;
    }
  } else {
    checkpoints = checkpoints.map(c => {
      if (c.endTime === null) {
        return {
          ...c,
          endTime: new Date().toISOString(),
          progressEnd: prog,
          duration: Math.max(0, prog - c.progressStart)
        };
      }
      return c;
    });
  }

  return checkpoints;
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

  store.tasks = store.tasks.map((t, i) => {
    const isNowActive = (i === nextIdx);
    return {
      ...t,
      active: isNowActive,
      checkpoints: syncTaskCheckpoints(t, isNowActive, t.totalProgress)
    };
  });
  saveStoreImmediately();

  const computed = getComputedTasks();
  packege = computed[nextIdx];

  safeSendToOverlay('instructions', packege);
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
    if (!msg || !msg.id) return;

    const exists = store.tasks.some(t => t.id === msg.id);
    if (!exists) {
      store.tasks.push({
        ...msg,
        active: true,
        checkpoints: Array.isArray(msg.checkpoints) ? msg.checkpoints : []
      });
    }

    store.tasks = store.tasks.map(t => {
      const isNowActive = (t.id === msg.id);
      return {
        ...t,
        active: isNowActive,
        checkpoints: syncTaskCheckpoints(t, isNowActive, t.totalProgress)
      };
    });

    const computed = getComputedTasks();
    const activeTaskObj = computed.find(t => t.id === msg.id);
    packege = activeTaskObj ? { ...activeTaskObj, active: true } : { ...msg, active: true };

    saveStoreImmediately();

    safeSendToOverlay('instructions', packege);
    io.emit('sync-store', store);
  });

  socket.on('stop', (msg) => {
    log('SOCKET', 'Comando STOP recebido do painel.');
    store.tasks = store.tasks.map(t => ({
      ...t,
      active: false,
      checkpoints: syncTaskCheckpoints(t, false, t.totalProgress)
    }));
    saveStoreImmediately();
    packege = {};

    safeSendToOverlay('stop', msg);
    io.emit('sync-store', store);
  });

function deleteAndMergeCheckpoint(task, checkpointId) {
  if (!task || !Array.isArray(task.checkpoints)) return task;

  const idx = task.checkpoints.findIndex(c => String(c.id) === String(checkpointId));
  if (idx === -1) return task;

  const targetCp = task.checkpoints[idx];
  // Do not allow deleting active checkpoint (endTime === null)
  if (targetCp.endTime === null) return task;

  let updatedCheckpoints = [...task.checkpoints];

  if (idx + 1 < updatedCheckpoints.length) {
    // Merge into next checkpoint: startTime becomes targetCp.startTime, duration accumulates
    const nextCp = { ...updatedCheckpoints[idx + 1] };
    nextCp.startTime = targetCp.startTime;
    nextCp.progressStart = targetCp.progressStart;
    nextCp.duration = (nextCp.duration || 0) + (targetCp.duration || 0);
    updatedCheckpoints[idx + 1] = nextCp;
  } else if (idx - 1 >= 0) {
    // Fallback: merge into previous checkpoint if deleting last completed one
    const prevCp = { ...updatedCheckpoints[idx - 1] };
    prevCp.endTime = targetCp.endTime;
    prevCp.progressEnd = targetCp.progressEnd;
    prevCp.duration = (prevCp.duration || 0) + (targetCp.duration || 0);
    updatedCheckpoints[idx - 1] = prevCp;
  }

  updatedCheckpoints.splice(idx, 1);

  return {
    ...task,
    checkpoints: updatedCheckpoints
  };
}

  socket.on('delete-checkpoint', ({ taskId, checkpointId }) => {
    log('SOCKET', `Solicitação de exclusão do checkpoint ${checkpointId} da tarefa ${taskId}`);
    store.tasks = store.tasks.map(t => {
      if (t.id === taskId) {
        return deleteAndMergeCheckpoint(t, checkpointId);
      }
      return t;
    });
    saveStoreImmediately();
    io.emit('sync-store', store);
  });

  socket.on('save-store', (newStore) => {
    log('SOCKET', 'Novo store recebido do painel.', newStore);
    if (newStore && typeof newStore === 'object') {
      store.tasks = (newStore.tasks || []).map(t => {
        const existing = store.tasks.find(et => et.id === t.id);
        const incomingCheckpoints = (Array.isArray(t.checkpoints) && t.checkpoints.length > 0)
          ? t.checkpoints
          : (existing && Array.isArray(existing.checkpoints) ? existing.checkpoints : []);

        return {
          ...t,
          checkpoints: syncTaskCheckpoints({ ...t, checkpoints: incomingCheckpoints }, t.active, t.totalProgress)
        };
      });
      store.dayTotalHours = typeof newStore.dayTotalHours === 'number' ? newStore.dayTotalHours : 8;
      saveStoreImmediately();
      io.emit('sync-store', store);
    }
  });

  socket.on('exit', (msg) => {
    log('SOCKET', 'Comando EXIT recebido do painel. Encerrando processos...');
    store.tasks = store.tasks.map(t => ({
      ...t,
      active: false,
      checkpoints: syncTaskCheckpoints(t, false, t.totalProgress)
    }));
    saveStoreImmediately();
    packege = {};
    
    io.emit('exit', msg);
    setTimeout(() => process.exit(0), 500);
  });
});

// IPC Main communication listeners
ipcMain.on('checkpoint', (event, arg) => {
  log('IPC', 'Manual checkpoint solicitado pelo overlay.');
  const activeTask = store.tasks.find(t => t.active);
  if (activeTask) {
    const currentProgress = activeTask.totalProgress || 0;
    let checkpoints = Array.isArray(activeTask.checkpoints) ? [...activeTask.checkpoints] : [];
    
    checkpoints = checkpoints.map(c => {
      if (c.endTime === null) {
        return {
          ...c,
          endTime: new Date().toISOString(),
          progressEnd: currentProgress,
          duration: Math.max(0, currentProgress - c.progressStart)
        };
      }
      return c;
    });

    checkpoints.push({
      id: Date.now(),
      startTime: new Date().toISOString(),
      endTime: null,
      progressStart: currentProgress,
      progressEnd: currentProgress,
      duration: 0
    });

    store.tasks = store.tasks.map(t => {
      if (t.id === activeTask.id) {
        return {
          ...t,
          checkpoints
        };
      }
      return t;
    });

    saveStoreImmediately();
    io.emit('sync-store', store);
  }
});

ipcMain.on('status', (event, arg) => {
  log('IPC', 'Overlay status recebido:', arg);
  let updatedTask = null;
  store.tasks = store.tasks.map(t => {
    if (t.id === arg.id) {
      const updatedCheckpoints = syncTaskCheckpoints(t, arg.active, arg.totalProgress);
      updatedTask = {
        ...t,
        totalProgress: arg.totalProgress,
        totalTimePause: arg.totalTimePause,
        currentTimePause: arg.currentTimePause,
        active: arg.active,
        checkpoints: updatedCheckpoints
      };
      return updatedTask;
    }
    return t;
  });
  debouncedSaveStore();

  io.emit('update', {
    ...arg,
    checkpoints: updatedTask ? updatedTask.checkpoints : []
  });
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
  store.tasks = store.tasks.map(t => ({
    ...t,
    active: false,
    checkpoints: syncTaskCheckpoints(t, false, t.totalProgress)
  }));
  saveStoreImmediately();
  packege = {};
  
  io.emit('exit', arg);
  setTimeout(() => process.exit(0), 500);
});

ipcMain.on('finish', (event, arg) => {
  log('IPC', 'Atividade finalizada. Disparando notificação nativa:', arg.title);
  store.tasks = store.tasks.map(t => {
    if (t.id === arg.id) {
      return {
        ...t,
        totalProgress: arg.totalProgress,
        totalTimePause: arg.totalTimePause,
        active: false,
        checkpoints: syncTaskCheckpoints(t, false, arg.totalProgress)
      };
    }
    return t;
  });
  saveStoreImmediately();

  io.emit('update', { ...arg, active: false });
  showNotification(arg);
});

ipcMain.on('online', (event, arg) => {
  log('IPC', 'Overlay on-line.');
  globalEvent = event;
  const welcomeMsg = `Acesse <strong>http://localhost:${PORT}</strong> para selecionar uma nova atividade`;
  event.sender.send('server', welcomeMsg);

  // Deriving the active task from the store to ensure it's not a stale/deleted task
  const activeTask = store.tasks.find(t => t.active);
  if (activeTask) {
    const computed = getComputedTasks();
    const computedActive = computed.find(t => t.id === activeTask.id);
    if (computedActive) {
      packege = computedActive;
      event.sender.send('instructions', packege);
    }
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


