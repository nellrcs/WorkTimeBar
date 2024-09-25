const { app, BrowserWindow, ipcMain, Notification  } = require('electron');
var http = require('http');
var fs = require('fs');

//var Crud = require('./src/js/Crud')
//var db = new Crud(__dirname);

const socketIo = require('socket.io');
const path = require('node:path');

let packege = {};
let globalEvent = null;

const PORT = process.env.PORT || 8080;
const env = process.env.NODE_ENV || 'development';

async function createCheckWindow () {
  childWindow = new BrowserWindow({
    
    width:500, 
    height:75,
    minWidth: 330,
    minHeight: 75,
    maxHeight: 75,
    autoHideMenuBar: true,

    titleBarStyle: 'customButtonsOnHover',
    frame: false,
    transparent: true,
    alwaysOnTop: true,

    fullscreenable: false,
    maximizable: false,
    
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  childWindow.loadFile(__dirname + '/index.html')

  childWindow.webContents.on('dom-ready', () => { 
    childWindow.show(); 
  }); 

  //childWindow.webContents.openDevTools();
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

  if(req.url === '/src/js/back.js'){
    res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8'});
    res.end(fs.readFileSync(__dirname + req.url));
  }
  else if(req.url === '/src/js/Progress.class.js'){
    res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8'});
    res.end(fs.readFileSync(__dirname + req.url));
  }
  else if(req.url === '/src/style/back.css'){
    res.writeHead(200, {'Content-Type': 'text/css; charset=utf-8'});
    res.end(fs.readFileSync(__dirname + req.url));
  }
  else if(req.url === '/src/favicon.ico'){
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    res.end(fs.readFileSync(__dirname + req.url));
  }
  else if(req.url === '/src/img/logotipo.png'){
    res.writeHead(200, {'Content-Type': 'image/png'});
    res.end(fs.readFileSync(__dirname + req.url));
  }
  else{
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(fs.readFileSync('config.html'));
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

const io = socketIo(server);
var connectCounter = 0;
io.on('connection', (socket) => {

  connectCounter++; 
  if(connectCounter > 1){
    socket.emit('exit', {});
    process.exit();
  }

  socket.on('disconnect', function() { 
    connectCounter--; 
  });

  socket.on('evento', (msg) => {
    packege = msg;
    if(globalEvent){
      globalEvent.sender.send('instuctions', packege);
    }
  });

  socket.on('stop', (msg) => {
      globalEvent.sender.send('stop', msg);
  });

  ipcMain.on('status', function(event, arg) {
    console.log(arg);
    socket.emit('update', arg);
  });

  ipcMain.on('next',function(event,arg){
    socket.emit('next', arg);
  });

  ipcMain.on('back',function(event,arg){
    socket.emit('back', arg);
  });

  ipcMain.on('exit',function(event,arg){
    socket.emit('exit', arg);
    process.exit();
  });

  ipcMain.on('finish',function(event,arg){
    showNotification(arg);
  })
  
});

ipcMain.on('online', function(event, arg) {
  globalEvent = event;
  event.sender.send('server', `Acesse <strong>http://locahost:${PORT}</strong> para selecionar uma nova atividade`);
});


function showNotification(arg){
  new Notification({ title: 'Atividade concluída', body: `A atividade ${arg.title} foi concluída` }).show()
}


