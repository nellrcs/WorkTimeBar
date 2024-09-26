const { app, BrowserWindow, ipcMain, Notification  } = require('electron');
var http = require('http');
var fs = require('fs');
var Route = require('./src/js/Route.class');

//var Crud = require('./src/js/Crud.class')
//var db = new Crud(__dirname);

const socketIo = require('socket.io');
const path = require('node:path');

let packege = {};
let globalEvent = null;

const debug = process.env.DEBUG || false;;
const PORT = process.env.PORT || 8585;
const env = process.env.NODE_ENV || 'dev';

var setup = {
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false
  }
}

if(!debug){
  setup = { ...setup, ...{
    width:500, 
    height:75,
    minWidth: 360,
    minHeight: 75,
    maxHeight: 75,
    autoHideMenuBar: true,
    titleBarStyle: 'customButtonsOnHover',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    maximizable: false
  }};
}

const log = (str) => {
  if(env === 'dev' && debug){
    console.log(str);
  }
}

async function createCheckWindow () {
  childWindow = new BrowserWindow(setup);
  
  childWindow.loadFile(__dirname + '/index.html')

  childWindow.webContents.on('dom-ready', () => { 
    childWindow.show(); 
  });

  if(env === 'dev' && debug){
    childWindow.webContents.openDevTools();
  }
}  

app.whenReady().then(() => {
    createCheckWindow()
});

if (require('electron-squirrel-startup')) {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

var server = http.createServer(function (req, res) {
  let route = new Route(req.url);
  res.writeHead(200, {'Content-Type': route.contentType});
  res.end(fs.readFileSync(__dirname + route.filename));
});

server.listen(PORT, () => {
  log(`Servidor rodando na porta ${PORT}`);
});

const io = socketIo(server);
var connectCounter = 0;

io.on('connection', (socket) => {
  log('connection');
  connectCounter++; 
  if(connectCounter > 1){
    socket.emit('exit', {});
    process.exit();
  }

  socket.on('disconnect', function() {
    log('disconnect:');
    connectCounter--;
    if(connectCounter <= 0){
      process.exit();
    }
  });

  socket.on('evento', (msg) => {
    log('<-evento:');
    packege = msg;
    if(globalEvent){
      globalEvent.sender.send('instuctions', packege);
    }
  });

  socket.on('stop', (msg) => {
      log('<-stop:');
      globalEvent.sender.send('stop', msg);
  });

  ipcMain.on('status', function(event, arg) {
    log('<-status:');
    log(arg);
    socket.emit('update', arg);
    log('->update:');
    log(arg);
  });

  ipcMain.on('next',function(event,arg){
    log('<-next:');
    log(arg);
    socket.emit('next', arg);
    log('->next:');
    log(arg);
  });

  ipcMain.on('back',function(event,arg){
    log('<-back:');
    log(arg);
    socket.emit('back', arg);
    log('->back:');
    log(arg);
  });

  ipcMain.on('exit',function(event,arg){
    log('<-exit:');
    log(arg);
    socket.emit('exit', arg);
    log('->exit:');
    log(arg);
    process.exit();
  });

  ipcMain.on('finish',function(event,arg){
    log('<-finish:');
    log(arg);
    showNotification(arg);
  })
});

ipcMain.on('online', function(event, arg) {
  log('<-online:');
  log(arg);
  globalEvent = event;
  arg = `Acesse <strong>http://locahost:${PORT}</strong> para selecionar uma nova atividade`;
  event.sender.send('server', arg);
  log('->server:');
  log(arg);
});

function showNotification(arg){
  new Notification({ title: 'Atividade concluída', body: `A atividade ${arg.title} foi concluída` }).show()
}


