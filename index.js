const { app, BrowserWindow, ipcMain, Notification  } = require('electron');
var http = require('http');
var fs = require('fs');

const socketIo = require('socket.io');

const path = require('node:path');

async function createCheckWindow () {
  childWindow = new BrowserWindow({ 
    width:800, 
    height:86,
    minWidth: 200,
    minHeight: 86,
    maxHeight: 86,
    autoHideMenuBar: true,

    titleBarStyle: 'customButtonsOnHover',
    frame: false,
    transparent: true,
    alwaysOnTop: true,

    fullscreenable: false,
    maximizable: false,
   /*  resizable: false , */
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

ipcMain.on('debug', function(event, arg) {
  console.log(arg); 
  event.returnValue = 'pong';
});

var config = fs.readFileSync('config.html');

var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(config);
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
    console.log(msg)
    //io.emit('chat message', msg);
  });
});

