const { app, BrowserWindow, ipcMain, Notification  } = require('electron');
var http = require('http');
var fs = require('fs');

const socketIo = require('socket.io');
const path = require('node:path');

let packege = {};
let globalEvent = null;

async function createCheckWindow () {
  childWindow = new BrowserWindow({ 
    /*
    width:880, 
    height:95,
    minWidth: 400,
    minHeight: 95,
    maxHeight: 95,
    autoHideMenuBar: true,

    titleBarStyle: 'customButtonsOnHover',
    frame: false,
    transparent: true,
    alwaysOnTop: true,

    fullscreenable: false,
    maximizable: false,
    */
    webPreferences: {
    
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  childWindow.loadFile(__dirname + '/index2.html')

  childWindow.webContents.on('dom-ready', () => { 
    childWindow.show(); 
  }); 

  childWindow.webContents.openDevTools();
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

const PORT = process.env.PORT || 8080;
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

});


ipcMain.on('online', function(event, arg) {
  globalEvent = event;
  event.sender.send('server', `Servidor rodando no endereco http://locahost:${PORT}`);
});



