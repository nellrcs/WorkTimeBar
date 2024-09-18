var socket = io();
var criarTask = document.getElementById("criarTask");
var barId = document.getElementById("barId");
var descricao = document.getElementById("descricao");
var tasks = document.getElementById("tasks");
var totalBar = document.getElementById("totalBar");
var btLimpar = document.getElementById("btLimpar");
var inputTotal = document.getElementById("inputTotal");
  
var tarefasFeitas = [];
var maxValueVar = 8.0;
var usedValue = 0.0;
  
inputTotal.value = maxValueVar;
  
  criarTask.onclick = () => {
    updataData({
      id:Date.now().toString(16),
      title:descricao.value,
      totalTimeFloat:barId.value,
      totalTimeSeconds:convertSeconds(barId.value),
      totalProgress:0,
      totaltimeStop:0,
      active:false
    });
      
    barId.value = "0";
    descricao.value = "";
    rangeValue.innerText="00:00h = 0"; 
  }
  
  btLimpar.onclick = () => {
    if(confirm("Deseja apagar esta lista?")){
      localStorage.clear();
      tarefasFeitas = [];
      iniciarLista();
      gerarLista();
    }
  }
  
  function updataData(tarefa){
    tarefasFeitas.push(tarefa);
    updataDataAllData();
    setMaxbar(maxValueVar);
  }

  function updataDataAllData(){
    localStorage.setItem("tarefas",JSON.stringify(tarefasFeitas));
  }
  
  function convertSeconds(valor){
    return  parseInt(((valor)*60)*60);
  }

  function gerarLista(){
    var tempoTotal = 0;
    var ul = document.createElement('ul');
    if(localStorage.getItem("tarefas").length > 1){
      tarefasFeitas = JSON.parse(localStorage.getItem("tarefas"));
      for (var i = 0; i < tarefasFeitas.length; i++) {
        
        tempoTotal = (tempoTotal + parseFloat(tarefasFeitas[i].totalTimeFloat));
        var li = document.createElement('li');
        li.innerText = tarefasFeitas[i].title;
        var strong = document.createElement('strong');
        var button = document.createElement('button');
        button.innerText = "x"; 
        button.value = i;
        li.id = i;
        
        console.log(tarefasFeitas[i].active);
        if(tarefasFeitas[i].active){
          li.classList.add("active");
        }
        
        strong.innerHTML = convert(tarefasFeitas[i].totalTimeFloat).tempo;
        button.addEventListener('click',(e)=>{
          removeArray(e.target.value);
        });
        
        li.addEventListener('click',(e) => {
          setItemActive(e.target.id);
          gerarLista();
        });
        
        li.appendChild(strong);
        li.appendChild(barraDinamica(tarefasFeitas[i]));
        li.appendChild(button);
        ul.appendChild(li)
      }
    };
    updateBar(tempoTotal);
    tasks.innerHTML = "";
    tasks.appendChild(ul);
  };
  
  function updateBar(tempoTotal){
    usedValue = tempoTotal;
    
    if(usedValue >= maxValueVar){
      barId.disabled = true;
      criarTask.disabled = true;
    }else{
      barId.max = maxValueVar - usedValue;
      barId.disabled = false;
      criarTask.disabled = false;
    }
    inputTotal.min = usedValue;
    
    var novoVal = parseInt((usedValue * 100) / maxValueVar);
    if(novoVal > 100){
      totalBar.value = 100;
    }else{
      totalBar.value = novoVal;
    }
  };
  function iniciarLista(){
    if(localStorage.getItem("tarefas") === null){
      localStorage.setItem("tarefas",[]);
    }else{
      gerarLista();
    }
  }
  
  function barraDinamica(item){
    
    let tempo = parseInt((item.totalTimeFloat * 100) / maxValueVar);
    let bar = document.createElement('progress');
    let widthBar = (tempo * 160) / 100;
    let locaProgress = (widthBar * (item.totalProgress - item.totaltimeStop)) / item.totalTimeSeconds;
    let locaStopProgress = (widthBar * item.totaltimeStop) / item.totalTimeSeconds;
    
    bar.setAttribute('value',tempo);
    bar.setAttribute('min', '0');
    bar.setAttribute('max', '100');
    bar.setAttribute('style', '--timeStop: '+locaStopProgress+'px;--progress: '+locaProgress+'px');

    return bar;
  }
  
  function convert(valor){
    var hora = "";
    if(valor >= 100 ){
      hora += (`000${Math.floor(valor)}`).slice(-3)  + ":";
    }else{
      hora += (`00${Math.floor(valor)}`).slice(-2)  + ":";
    }
    
    if(valor <= 1){
      hora += (`00${parseInt((parseInt(valor*100)*60) / 100)}`).slice(-2);
    }else{  
      hora += (`00${(Math.ceil(valor*60) %60)}`).slice(-2);
    }
    return  {"tempo": hora + "h = " + valor};
  }
  
  function removeArray(i){
    tarefasFeitas.splice(i, 1);
    localStorage.setItem("tarefas",JSON.stringify(tarefasFeitas));
    setMaxbar(maxValueVar);
  }
  
  function setItemActive(index){
    tarefasFeitas.map(tarefa=>tarefa.active=false);
    tarefasFeitas[index].active = true;
    socket.emit('evento', tarefasFeitas[index]);
    localStorage.setItem("tarefas",JSON.stringify(tarefasFeitas));
    setMaxbar(maxValueVar);
  }
  
  function setMaxbar(value){
    maxValueVar = value;
    barId.max = maxValueVar - usedValue;
    gerarLista();
  }
  
  function setRangeValue(value){
    rangeValue.innerText =  convert(value).tempo;
  }

  socket.on('update', (arg)=>{
    tarefasFeitas.map(tarefa => { 
      if(tarefa.id == arg.id){ 
        tarefa.totalProgress = arg.totalProgress; 
        tarefa.totaltimeStop = arg.totaltimeStop; 
      }});
    updataDataAllData();
    gerarLista();
  });
  
  iniciarLista();