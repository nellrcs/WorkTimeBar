import Progress, {convertSecondsToHour, convertFloatToHous, convertFloatToSeconds} from './Progress.class.js';

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
    localStorage.clear();
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
    console.log(maxValueVar);
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

    function removeArray(i){
      taskList.splice(i, 1);
      localStorage.setItem("tarefas",JSON.stringify(taskList));
      setMaxbar();
      socket.emit('stop', {});
    }
 
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
      MAXHOUR.innerText = parseInt(BARID.max) + "h"; 
    }
    
    function setRangeValue(value){
      rangeValue.innerText =  convertFloatToHous(value).tempo;
    }

    function setCheckActive(i){
      setItemActive(i);
      listCreate();
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

    var tr = document.createElement('tr');
    if(item.active){
      tr.classList.add('animate-pulse');
    }

    tr.classList.add('border-b','bg-white','hover:bg-gray-50','dark:border-gray-700','dark:hover:bg-gray-600','dark:bg-gray-800');

    tr.innerHTML = ( `
        
                  <td class="w-4 p-4">
                    <div class="flex items-center">
                      <input type="checkbox" data-check='${i}' class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600 dark:focus:ring-offset-gray-800 " ${item.active ? ' checked' : '' }/>
                    </div>
                  </td>
                  <th scope="row" class="whitespace-nowrap px-6 py-4 font-medium text-gray-900 dark:text-white">${item.title}</th>
            <td class="px-6 py-4">
                   <div class="mx-0 h-5 w-full rounded bg-gray-200 dark:bg-gray-700">
                      <div class="h-5 rounded bg-green-500" style="width: ${tempo}%"></div>
                    </div>
                  </td>
                  <td class="px-6 py-4"> <span class="text-blue-500"> ${sPlay}</span>/  <span class="text-orange-500">${sPause}</span> </td>
                  <td class="px-6 py-4">
                  </button>
                  
                    <button type="button" data-remove='${i}' class="clickRemove text-red-500 hover:text-white focus:outline-none font-medium  text-sm p-2.5 text-center inline-flex items-center dark:hover:text-white">

                    <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
                    </svg>                    
                              
                    <span class="sr-only">Excluir</span>
                  </button>
                  </td>

`).trim();

tr.querySelector("[data-remove='"+i+"']").addEventListener('click',function () {
  removeArray(i)
});

tr.querySelector("[data-check='"+i+"']").addEventListener('click',function () {
  setCheckActive(i)
});

return tr
}

function nextItemList(){

  let active = 0;
  let totalIntens =  taskList.length;
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
}

function backItemList(){

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
}


socket.on('update', (arg)=>{
  taskList.map(tarefa => { 
    if(tarefa.id === arg.id){ 
      tarefa.totalProgress = arg.totalProgress; 
      tarefa.totalTimePause = arg.totalTimePause;
      console.log("UPDATE:");
      console.log(tarefa);
    }});
  updataDataAllData();
  listCreate();
});

socket.on('exit', (arg)=>{
  STATUSOFFLINE.style.display = "block";
});


socket.on('next', (arg)=>{
  nextItemList();
});
socket.on('back', (arg)=>{
  backItemList();
});