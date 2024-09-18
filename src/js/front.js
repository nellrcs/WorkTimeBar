
const {ipcRenderer} = require('electron');


ipcRenderer.on('instuctions', (event, arg) => {

  clearInterval(contador);
  clearInterval(stopContador);
  contador = false;
  stopContador = false;

  control.classList.remove("pause");
  control.classList.add("play");

  objbarra.id = arg.id;
  objbarra.title = arg.title;
  objbarra.totalTimeSeconds = arg.totalTimeSeconds;
  objbarra.totalTimeFloat = arg.totalTimeFloat;
  objbarra.totalProgress = arg.totalProgress; 
  objbarra.totaltimeStop = arg.totaltimeStop;
  objbarra.active = arg.totaltimeStop;

  criarBarra();
});

var control = document.getElementById("control");
control.style.display = 'none';
var barView = document.getElementById("barView");
var activityTitle = document.getElementById("activityTitle");
var  body = document.getElementById('main');
var contador = false;
var stopContador = false;

var objbarra = {
  id:'',
  title:'',
  totalTimeSeconds:0,
  totalTimeFloat:0,
  totalProgress:0, 
  totaltimeStop:0,
  lastTimestempPlay:0,
  active:false
}; 


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


function barPercentage(value,max){
  return parseInt( (100 * value) / max);
}

function criarBarra(){ 
    barView.innerHTML = '';
    control.style.display = 'grid';
    let barra = document.createElement("progress");
    barra.setAttribute('value', barPercentage(objbarra.totalProgress,objbarra.totalTimeSeconds));
    barra.setAttribute('min', 0);
    barra.setAttribute('max', 100);
    barra.setAttribute('id', 'pb');
    barView.appendChild(barra);
    activityTitle.innerHTML = objbarra.title;
    control.setAttribute('style','--value: '+ barPercentage(objbarra.totaltimeStop,objbarra.totalTimeSeconds));
    body.classList.remove("off");
    body.classList.add("on");
}

function playBarras(){
     control.classList.remove("play");
     control.classList.add("pause");

     if(objbarra.lastTimestempPlay == 0){
      objbarra.lastTimestempPlay = Date.now() + ( 1000 * objbarra.totalTimeSeconds );
     }

     pauseStopCountBarra();
     contador = setInterval(function() {   
        let barraAtual = document.getElementById('pb');

       if(objbarra.totalProgress >= objbarra.totalTimeSeconds){
         stopBarra();
       }else{
         objbarra.totalProgress = parseInt(objbarra.totalProgress) + 1;
         barraAtual.value = barPercentage(objbarra.totalProgress,objbarra.totalTimeSeconds);
         ipcRenderer.send('status', objbarra);
       }
       
  }, 1000);
}

function stopCountBarra(){
     stopContador = setInterval(function() {
       if( (parseInt(objbarra.totalProgress) >= objbarra.totalTimeSeconds )){            
         body.classList.remove("on");
         body.classList.add("off");
         pauseStopCountBarra();
       }else{  
         objbarra.totalProgress = parseInt(objbarra.totalProgress) + 1;
         objbarra.totaltimeStop = parseInt(objbarra.totaltimeStop) + 1;
         control.setAttribute('style','--value: '+ barPercentage(objbarra.totaltimeStop,objbarra.totalTimeSeconds));
         ipcRenderer.send('status', objbarra);
       }
  }, 1000);
}

function pauseStopCountBarra(){
  clearInterval(stopContador);
}

function stopBarra(){
  control.classList.remove("pause");
  control.classList.add("play");
  
  clearInterval(contador);
  contador = false;
  stopCountBarra();
}

ipcRenderer.send('online', '1');

ipcRenderer.on('server', (event, arg) => {
  barView.innerHTML = arg;
});