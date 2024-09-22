import Progress, {convertSecondsToHour, convertFloatToHous, convertSeconds} from './Progress.class.js';

var socket = io();
const CRIARTASK = document.getElementById("criarTask");
const BARID = document.getElementById("barId");
const DESCRIPTION = document.getElementById("description");
const TASKS = document.getElementById("tasks");
const TOTALBAR = document.getElementById("totalBar");
const BTCLEAR = document.getElementById("btCleaar");
const INPUTTOTAL = document.getElementById("inputTotal");
const MAXHOUR = document.getElementById("maxHour"); 
const PAUSEALL = document.getElementById("btPauseAll");
const STATUSOFFLINE = document.getElementById("statusOffLine");

var taskList = [];
var maxValueVar = 8.0;
var usedValue = 0.0;
  
INPUTTOTAL.value = maxValueVar;

INPUTTOTAL.oninput = (e) => {
  setMaxbar(e.target.value);
}

BARID.oninput = (e) => {
  setRangeValue(e.target.value)
}

CRIARTASK.onclick = () => {
  if(parseFloat(BARID.value) > 0){
    let progress = new Progress();
    progress.id=Date.now().toString(16),
    progress.title=DESCRIPTION.value,
    progress.totalTimeFloat=BARID.value,
    progress.totalTimeSeconds=convertSeconds(BARID.value),
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
    let tempoTotal = 0;
    TASKS.innerHTML = "";
    if(localStorage.getItem("tarefas").length > 1){
      taskList = JSON.parse(localStorage.getItem("tarefas"));
      for (var i = 0; i < taskList.length; i++) {
        tempoTotal = tempoTotal + parseFloat(taskList[i].totalTimeFloat);
        TASKS.appendChild(itemTr(i));
      }
    };
    updateBar(tempoTotal);
  };
  
  function updateBar(tempoTotal){
    usedValue = tempoTotal;
    
    if(usedValue >= maxValueVar){
      BARID.disabled = true;
      CRIARTASK.disabled = true;
    }else{
      BARID.max = maxValueVar - usedValue;
      BARID.disabled = false;
      CRIARTASK.disabled = false;
    }
    INPUTTOTAL.min = usedValue;
    
    var newValue = parseInt((usedValue * 100) / maxValueVar);
    if(newValue > 100){
      TOTALBAR.value = 100;
      TOTALBAR.innerText = "100%";
      TOTALBAR.style.width =  "100%";
    }else{
      TOTALBAR.value = newValue;
      TOTALBAR.innerText = newValue + "%";
      TOTALBAR.style.width = newValue + "%";
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
      listCreate();
      maxValueVar = INPUTTOTAL.value;
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
    tr.classList.add('border-b','bg-white','hover:bg-gray-50','dark:border-gray-700','dark:hover:bg-gray-600','dark:bg-gray-800');
    tr.innerHTML = ( `
        
                  <td class="w-4 p-4">
                    <div class="flex items-center">
                      <input type="checkbox" data-check='${i}' class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600 dark:focus:ring-offset-gray-800" ${item.active ? ' checked' : '' }/>
                    </div>
                  </td>
                  <th scope="row" class="whitespace-nowrap px-6 py-4 font-medium text-gray-900 dark:text-white">${item.title}</th>
            <td class="px-6 py-4">
                   <div class="mx-0 h-5 w-full rounded bg-gray-200 dark:bg-gray-700">
                      <div class="h-5 rounded bg-blue-500" style="width: ${tempo}%"></div>
                    </div>
                  </td>
                  <td class="px-6 py-4"> <span class="text-blue-500"> ${sPlay}</span>/  <span class="text-white-500">${sPause}</span> </td>
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
