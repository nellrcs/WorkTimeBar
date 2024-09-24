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

async function createCheckWindow () {
  childWindow = new BrowserWindow({
    
    width:450, 
    height:104,
    minWidth: 450,
    minHeight: 104,
    maxHeight: 104,
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
  //{ parent: mainWindow, modal: true, show: false,  frame: false ,  width:450,  height:300}
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
  else{
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(fs.readFileSync('config.html'));
  }
});


server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

const io = socketIo(server);

io.on('connection', (socket) => {

  console.log('Um usuario se conectou');

  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
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
  
});


ipcMain.on('online', function(event, arg) {
  globalEvent = event;
  event.sender.send('server', `Acesse <a class="text-blue-500" href="#">http://locahost:${PORT}</a> para criar uma nova atividade`);
});



