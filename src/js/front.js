import Progress, {convertSecondsToHour, barPercentage} from './Progress.class.js'
const {ipcRenderer} = require('electron');

var control = document.getElementById("control");
var serverMsg = document.getElementById("serverMsg");
var activityTitle = document.getElementById("activityTitle");
var barraAtual = document.getElementById('barraAtual');
var play = document.getElementById('play');
var pause = document.getElementById('pause');
var finish = document.getElementById('finish');
var lock = document.getElementById('lock');
var runTime = document.getElementById('runTime');
var countTime = document.getElementById('countTime');
var waitingTime = document.getElementById('waitingTime');
var timeStopCount = document.getElementById('timeStopCount');
var exitApp = document.getElementById('exitApp');
var btNext = document.getElementById('btNext');
var btBack = document.getElementById('btBack');
var contador = false;
var stopContador = false;
var backupProgress = 0;
var objbarra = null;

play.classList.remove('hidden');
timeStopCount.classList.add('hidden');

exitApp.onclick = () => {
  ipcRenderer.send('exit', {});
}

btNext.onclick = () => {
  ipcRenderer.send('next', {});
}

btBack.onclick = () => {
  ipcRenderer.send('back', {});
}

ipcRenderer.on('instuctions', (event, arg) => {
  
  objbarra = new Progress();
  endCountBar();
  viewStatus(true);
  objbarra.id = arg.id;
  objbarra.title = arg.title;
  objbarra.totalTimeSeconds = arg.totalTimeSeconds;
  objbarra.totalTimeFloat = arg.totalTimeFloat;
  objbarra.totalTimePause = arg.totalTimePause;
  objbarra.active = arg.totalTimePause;
  backupProgress = arg.totalProgress;


  createBar();

});

ipcRenderer.on('stop', (event, arg) => {
  objbarra = new Progress();
  window.localStorage.clear();
  endCountBar();
  viewStatus(false);
});

control.addEventListener("click", (e) => {
  let n = true;
  if(objbarra.active === true){
    n = false;
    pauseBar();
  } 
  if(n && !contador){
    playBarras();
  }
  objbarra.active = n;
});

function viewStatus(status = false){
  if(status){
    document.getElementById('on').classList.remove('hidden');
    document.getElementById('off').classList.add('hidden');
    return;
  }
  document.getElementById('off').classList.remove('hidden');
  document.getElementById('on').classList.add('hidden');
}

function createBar(){ 
    barraAtual.classList.remove('animate-pulse');
    countTime.classList.remove('hidden');
    play.classList.remove('hidden');
    pause.classList.add('hidden');
    lock.classList.add('hidden');
    finish.classList.add('hidden');

    timeStopCount.classList.add("hidden");
    control.disabled = false;
    runTime.textContent = convertSecondsToHour(backupProgress);
    barraAtual.style.width = barPercentage(backupProgress,objbarra.totalTimeSeconds) + "%";
    activityTitle.innerHTML = objbarra.title;

    if((parseInt(backupProgress) >= objbarra.totalTimeSeconds )){
      terminate();
    }
}


function playBarras(){
    
    play.classList.add("hidden");
    pause.classList.remove("hidden");
    lock.classList.add("hidden");
    finish.classList.add('hidden');
    
    timeStopCount.classList.add("hidden");
    if(objbarra.totalProgress <= 0){
    objbarra.lastTimestempPlay = (Date.now() - (backupProgress * 1000)) + ( 1000 * objbarra.totalTimeSeconds );
    }
    endCountBar();
    contador = setInterval(function() {   
      if(objbarra.totalProgress >= objbarra.totalTimeSeconds){
        pauseBar();
        control.disabled = true;
      }else{
        objbarra.totalProgress = (objbarra.totalTimeSeconds - Math.ceil((objbarra.lastTimestempPlay - Date.now())/1000));
        barraAtual.style.width = barPercentage(objbarra.totalProgress,objbarra.totalTimeSeconds) + "%";
        runTime.textContent = convertSecondsToHour(objbarra.totalProgress);
        ipcRenderer.send('status', objbarra);
      }      
  }, 1000);
}

function stopCountBarra(){
    let totalTimePauseBkup = objbarra.totalTimePause;
    objbarra.lastTimestempPause = Date.now();
    timeStopCount.classList.remove("hidden");
    waitingTime.textContent = "00:00:00";

     stopContador = setInterval(function() {
       if( (parseInt(objbarra.totalProgress) >= objbarra.totalTimeSeconds )){
          terminate();
          endCountBar();
          ipcRenderer.send('finish', objbarra); 
       }else{  
        
        let iTime = parseInt((Date.now() - objbarra.lastTimestempPause) / 1000);
        objbarra.totalProgress = (objbarra.totalTimeSeconds - Math.ceil((objbarra.lastTimestempPlay - Date.now())/1000));
        objbarra.totalTimePause =  totalTimePauseBkup + iTime;
        objbarra.currentTimePause = iTime; 
        waitingTime.textContent = " - "+ convertSecondsToHour(objbarra.currentTimePause);
        ipcRenderer.send('status', objbarra);
       }
  }, 1000);
}

function endCountBar(){

  clearInterval(contador);
  clearInterval(stopContador);
  contador = false;
  stopContador = false;
}

function pauseBar(){
  play.classList.remove('hidden');
  pause.classList.add('hidden');
  timeStopCount.classList.add("hidden");

  endCountBar();
  stopCountBarra();
}

function terminate(){
  barraAtual.classList.add('animate-pulse');
  countTime.classList.add('hidden'); 
  finish.classList.remove('hidden'); 
  lock.classList.remove('hidden');
  play.classList.add('hidden');   
  pause.classList.add('hidden'); 
  timeStopCount.classList.add("hidden"); 
}

ipcRenderer.send('online', '1');

ipcRenderer.on('server', (event, arg) => {
  serverMsg.innerHTML = arg;
});
