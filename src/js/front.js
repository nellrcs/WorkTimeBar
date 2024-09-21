import Progress, {convertSecondsToHour, barPercentage} from './Progress.class.js'
const {ipcRenderer} = require('electron');

var control = document.getElementById("control");
//control.style.display = 'none';
//var barView = document.getElementById("barView");
var activityTitle = document.getElementById("activityTitle");
//var body = document.getElementById('main');
var barraAtual = document.getElementById('barraAtual');
var play = document.getElementById('play');
var pause = document.getElementById('pause');
var runTime = document.getElementById('runTime');
var contador = false;
var stopContador = false;
var backupProgress = 0;
var objbarra = null;

play.style.display = "block";
pause.style.display = "none";

ipcRenderer.on('instuctions', (event, arg) => {
  objbarra = new Progress();
  clearInterval(contador);
  clearInterval(stopContador);
  contador = false;
  stopContador = false;

  play.style.display = "block";
  pause.style.display = "none";

  objbarra.id = arg.id;
  objbarra.title = arg.title;
  objbarra.totalTimeSeconds = arg.totalTimeSeconds;
  objbarra.totalTimeFloat = arg.totalTimeFloat;
  objbarra.totalTimePause = arg.totalTimePause;
  objbarra.active = arg.totalTimePause;
  backupProgress = arg.totalProgress;
  criarBarra();
});

ipcRenderer.on('stop', (event, arg) => {
  objbarra = new Progress();
  clearInterval(contador);
  clearInterval(stopContador);
  contador = false;
  stopContador = false;
  defaultContent();
});

control.addEventListener("click", (e) => {
  let n = true;
  if(objbarra.active === true){
    n = false;
    stopBarra();
  } 
  if(n && !contador){
    playBarras();
  }
  objbarra.active = n;
});

function criarBarra(){ 
    //barView.innerHTML = '';
    //control.style.display = 'grid';
    //let barra = document.createElement("progress");
    //barra.setAttribute('value', barPercentage(backupProgress,objbarra.totalTimeSeconds));
    //barra.setAttribute('min', 0);
    //barra.setAttribute('max', 100);
    //barra.setAttribute('id', 'pb');
    //barView.appendChild(barra);

    barraAtual.style.width = barPercentage(backupProgress,objbarra.totalTimeSeconds) + "%";
    activityTitle.innerHTML = objbarra.title;
    //control.setAttribute('style','--value: '+ barPercentage(objbarra.totalTimePause,objbarra.totalTimeSeconds));
    //body.classList.remove("off");
    //body.classList.add("on");
}

function defaultContent(){ 
  //control.style.display = 'none';
  //barView.innerHTML = "...";
  //body.classList.remove("off");
  //body.classList.add("on");
}


function playBarras(){ 


     play.style.display = "none";
     pause.style.display = "block";

     if(objbarra.totalProgress <= 0){
      objbarra.lastTimestempPlay = (Date.now() - (backupProgress * 1000)) + ( 1000 * objbarra.totalTimeSeconds );
     }

     pauseStopCountBarra();
     contador = setInterval(function() {   
        //let barraAtual = document.getElementById('pb');

       if(objbarra.totalProgress >= objbarra.totalTimeSeconds){
         stopBarra();
       }else{
         objbarra.totalProgress = (objbarra.totalTimeSeconds - Math.ceil((objbarra.lastTimestempPlay - Date.now())/1000));
         barraAtual.style.width = barPercentage(objbarra.totalProgress,objbarra.totalTimeSeconds) + "%";
         runTime.textContent = convertSecondsToHour(objbarra.totalProgress - objbarra.totalTimePause);
         ipcRenderer.send('status', objbarra);
       }      
  }, 1000);
}

function stopCountBarra(){
    let totalTimePauseBkup = objbarra.totalTimePause;
    objbarra.lastTimestempPause = Date.now();
     stopContador = setInterval(function() {
       if( (parseInt(objbarra.totalProgress) >= objbarra.totalTimeSeconds )){            
         //body.classList.remove("on");
         //body.classList.add("off");
         pauseStopCountBarra();
       }else{  
        let iTime = parseInt((Date.now() - objbarra.lastTimestempPause) / 1000);
        objbarra.totalProgress = (objbarra.totalTimeSeconds - Math.ceil((objbarra.lastTimestempPlay - Date.now())/1000));
        objbarra.totalTimePause =  totalTimePauseBkup + iTime;
        objbarra.currentTimePause = iTime;
        
        //control.setAttribute('style','--value: '+ barPercentage(objbarra.totalTimePause,objbarra.totalTimeSeconds));
        ipcRenderer.send('status', objbarra);
       }
  }, 1000);
}

function pauseStopCountBarra(){
  clearInterval(stopContador);
}

function stopBarra(){

  play.style.display = "block";
  pause.style.display = "none";
  
  clearInterval(contador);
  contador = false;
  stopCountBarra();
}

ipcRenderer.send('online', '1');

ipcRenderer.on('server', (event, arg) => {
  //barView.innerHTML = arg;
});
