import Progress, {convertSecondsToHour, convertFloatToHous, convertFloatToSeconds} from './Progress.class.js';
import {itemTable} from './views.js';

var socket = io();
const NEWTASK = document.getElementById("newTask");
const BARID = document.getElementById("barId");
const DESCRIPTION = document.getElementById("description");
const TASKS = document.getElementById("tasks");
const TOTALBAR = document.getElementById("totalBar");
const TOTALPAUSE = document.getElementById("totalPause");
const TOTALUSED = document.getElementById("totalUsed");
const BTCLEAR = document.getElementById("btCleaar");
const INPUTTOTAL = document.getElementById("inputTotal");
const MAXHOUR = document.getElementById("maxHour"); 
const PAUSEALL = document.getElementById("btPauseAll");
const STATUSOFFLINE = document.getElementById("statusOffLine");

var taskList = [];
var maxValueVar = 8.0;
var usedValue = 0.0;
  
const setCheckActive = function(i){
  setItemActive(i);
  listCreate();
}

const removeArray = function(i){
  taskList.splice(i, 1);
  localStorage.setItem("tarefas",JSON.stringify(taskList));
  setMaxbar();
  socket.emit('stop', {});
}

INPUTTOTAL.value = maxValueVar;

INPUTTOTAL.oninput = () => {
  setMaxbar();
}

BARID.oninput = (e) => {
  setRangeValue(e.target.value)
}

NEWTASK.onclick = () => {
  if(parseFloat(BARID.value) > 0){
    let progress = new Progress();
    progress.id=Date.now().toString(16),
    progress.title=DESCRIPTION.value,
    progress.totalTimeFloat=BARID.value,
    progress.totalTimeSeconds=convertFloatToSeconds(BARID.value),
    progress.totalProgress=0,
    progress.totalTimePause=0,
    progress.active=false
    updataData(progress);
    BARID.value = "0";
    DESCRIPTION.value = "";
    rangeValue.innerText="00:00h = 0";
  }   
}
  
BTCLEAR.onclick = () => {
  if(confirm("Deseja remover todos os itens da lista?")){
    stopAll();
    window.localStorage.clear();
    taskList = [];
    listCreate();
  }
}

PAUSEALL.onclick = () => {
  stopAll();
}
  
(function(){
  if(localStorage.getItem("tarefas") === null){
    localStorage.setItem("tarefas",[]);
  }else{
    listCreate();
  }
})();

function updataData(tarefa){
  taskList.push(tarefa);
  updataDataAllData();
  setMaxbar();
}

function updataDataAllData(){
  localStorage.setItem("tarefas",JSON.stringify(taskList));
}
  
function listCreate(){
    let totalTime = 0;
    let totalPauseTime = 0;
    let totalUsed = 0;
    TASKS.innerHTML = "";
    if(localStorage.getItem("tarefas").length > 1){
      taskList = JSON.parse(localStorage.getItem("tarefas"));
      for (var i = 0; i < taskList.length; i++) {
        totalTime = totalTime + parseFloat(taskList[i].totalTimeFloat);
        totalPauseTime = totalPauseTime + taskList[i].totalTimePause;
        totalUsed = totalUsed + taskList[i].totalProgress;
        TASKS.appendChild(itemTr(i));
      }
    };
    updateBar(totalTime,totalPauseTime,totalUsed);
};

  function updateBar(totalTime,totalPauseTime,totalUsed){

    if(totalTime >= maxValueVar){
      BARID.disabled = true;
      NEWTASK.disabled = true;
    }else{
      BARID.max = maxValueVar - totalTime;
      BARID.disabled = false;
      NEWTASK.disabled = false;
    }
    INPUTTOTAL.min = totalTime;
    
    var newValue = parseInt((totalTime * 100) / maxValueVar);
    if(isNaN(newValue)){
      newValue = 0;
    }
    
    if(newValue > 100){
      TOTALBAR.value = 100;
      TOTALBAR.innerText = "100%";
      TOTALBAR.style.width =  "100%";
    }else{
      TOTALBAR.value = newValue;
      TOTALBAR.innerText = newValue + "%";
      TOTALBAR.style.width = newValue + "%";
    }

    let pausa = parseInt((100 *  totalPauseTime) / convertFloatToSeconds(totalTime));

    if(isNaN(pausa)){
      pausa = 0;
    }

    if(pausa > 100){
      TOTALPAUSE.value = 100;
      TOTALPAUSE.innerText = "100%";
      TOTALPAUSE.style.width =  "100%";
    }else{
      TOTALPAUSE.value = pausa;
      TOTALPAUSE.innerText = pausa + "%";
      TOTALPAUSE.style.width = pausa + "%";
    }

    let used = parseInt((100 * totalUsed )/ convertFloatToSeconds(totalTime));
    if(isNaN(used)){
      used = 0;
    }
    if(used > 100){
      TOTALUSED.value = 100;
      TOTALUSED.innerText = "100%";
      TOTALUSED.style.width =  "100%";
    }else{
      TOTALUSED.value = used;
      TOTALUSED.innerText = used + "%";
      TOTALUSED.style.width = used + "%";
    }
  };

    function setItemActive(index){
      taskList.map(tarefa=>tarefa.active=false);
      if(typeof taskList[index] !== "undefined"){
        taskList[index].active = true;
      }
      socket.emit('evento', taskList[index]);
      localStorage.setItem("tarefas",JSON.stringify(taskList));
      setMaxbar();
    }

    function setMaxbar(){
      maxValueVar = INPUTTOTAL.value;
      listCreate();
      BARID.max = maxValueVar - usedValue;
      console.log("MAXBAR"+maxValueVar);
      console.log("USEDVAUE"+usedValue);
      MAXHOUR.innerText = parseInt(BARID.max) + "h"; 
    }
    
    function setRangeValue(value){
      rangeValue.innerText =  convertFloatToHous(value).tempo;
    }


  function stopAll(){
    taskList.map(tarefa=>tarefa.active=false);
    localStorage.setItem("tarefas",JSON.stringify(taskList));
    setMaxbar();
    listCreate();
    socket.emit('stop', {});
  }

  function itemTr(i){

    let item = taskList[i];
    let tempo = parseInt((item.totalTimeFloat * 100) / maxValueVar);
    let sPlay = convertSecondsToHour(item.totalProgress);
    let sPause = convertSecondsToHour(item.totalTimeSeconds - item.totalTimePause);
    let data = {'item':item,'tempo':tempo,'sPlay':sPlay,'sPause':sPause,'title':item.title,'index':i,'active':item.active};

    return itemTable(data,setCheckActive,removeArray);
}

function nextItemList(){

  try {
    let active = 0;
    let totalIntens =  taskList.length;
    console.log(totalIntens);
    for(var i = 0; i < totalIntens;i++)
    {
      if(taskList[i].active === true){
        active = i + 1;
        if(active > (totalIntens - 1) ){
          active = 0;
        }
        
      }
    } 
    setCheckActive(active);
  } catch (error) {
    console.log(error)
  }

}

function backItemList(){

  try {
    let totalIntens =  taskList.length;
    let active = 0;
    for(var i = 0; i < totalIntens;i++)
    {
      if(taskList[i].active === true){
        active = i - 1;
        if(active < 0){
          active = totalIntens - 1;
        } 
      }
    } 
    setCheckActive(active);
  } catch (error) {
    console.log(error)
  }

}

socket.on('update', (arg)=>{
  taskList.map(tarefa => { 
    if(tarefa.id === arg.id){ 
      tarefa.totalProgress = arg.totalProgress; 
      tarefa.totalTimePause = arg.totalTimePause;
    }});
  updataDataAllData();
  listCreate();
});

socket.on('exit', (arg)=>{
  STATUSOFFLINE.style.display = "flex";
  window.location.reload();
});


socket.on('next', (arg)=>{
  nextItemList();
});
socket.on('back', (arg)=>{
  backItemList();
});