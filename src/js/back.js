document.addEventListener('DOMContentLoaded', () => {

    var socket = io();
    
    socket.on('chat message', function(msg) {
      console.log(msg);
    });
  
  });
  
  var criarTask = document.getElementById("criarTask");
  var barId = document.getElementById("barId");
  var descricao = document.getElementById("descricao");
  var tasks = document.getElementById("tasks");
  var totalBar = document.getElementById("totalBar");
  var btLimpar = document.getElementById("btLimpar");

  var tarefasFeitas = [];

  function convert(valor){
  var hora = (`00${Math.floor(valor)}`).slice(-2)  + ":" +  (`00${((valor*60) %60)}`).slice(-2) + "h";
  return  {"tempo": hora + " = " + valor};
  }

  criarTask.onclick = event => {
  updataData({"nome":descricao.value,"tempo":barId.value});
  barId.value = "0";
  descricao.value = "";
  rangeValue.innerText="00:00h = 0";
  socket.emit('evento', 'task criada');
  }

  function updataData(tarefa){
  tarefasFeitas.push(tarefa);
  localStorage.setItem("tarefas",JSON.stringify(tarefasFeitas));
  gerarLista();
  }

  function gerarLista(){
  var tempoTotal = 0;
  var ul = "<ul>";
  if(localStorage.getItem("tarefas").length > 1){
      tarefasFeitas = JSON.parse(localStorage.getItem("tarefas"));
      for (var i = 0; i < tarefasFeitas.length; i++) {
      tempoTotal = (tempoTotal + parseFloat(tarefasFeitas[i].tempo));
      ul += "<li>" +  tarefasFeitas[i].nome + "  <strong>[" + convert(tarefasFeitas[i].tempo).tempo;
      ul += ']</strong> <button onclick="removeArray('+i+')">x</button><br>' + barraDinamica(parseFloat(tarefasFeitas[i].tempo)) ;
      ul +="</li>";    
      }
  }
  ul += "</ul>";
  updateBar(tempoTotal);
  tasks.innerHTML = ul;
  }

  function updateBar(tempoTotal){
  var novoVal = parseInt((tempoTotal * 100) / barId.max);
  if(novoVal > 100){
      totalBar.value = 100;
  }else{
      totalBar.value = novoVal;
  }
  }


  function iniciarLista(){
  if(localStorage.getItem("tarefas") === null){
      localStorage.setItem("tarefas",[]);
  }else{
      gerarLista();
  }
  }

  function barraDinamica(tempo){
  return '<progress value="'+ parseInt((tempo * 100) / barId.max)+'" max="100" id=""> </progress>';
  }

  btLimpar.onclick = event => {
      if(confirm("Deseja apagar esta lista?")){
          localStorage.clear();
          tarefasFeitas = [];
          iniciarLista();
          gerarLista();
      }
  }

  function removeArray(i){
      tarefasFeitas.splice(i, 1);
      localStorage.setItem("tarefas",JSON.stringify(tarefasFeitas));
      gerarLista();
  }

  iniciarLista();