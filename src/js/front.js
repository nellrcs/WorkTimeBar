var listaDeBarras = [];
var contador = false;
function criarBarra(){
  var objbarra = {
    "titulo":"",
    "min":"0",
    "max":"100",
    "value":"0",
    "playStatus":false}; 
  listaDeBarras.push(objbarra);

  var barView = document.getElementById("barView");
  barView.innerHTML = '';
  
  for (var i = 0; i < listaDeBarras.length; i++) {
    var barra = document.createElement("progress");
    barra.setAttribute('value', listaDeBarras[i].min);
    barra.setAttribute('value', listaDeBarras[i].value);
    barra.setAttribute('max', listaDeBarras[i].max);
    barra.setAttribute('id', i);
    barra.addEventListener("click", (e) => {
      var n = true;
      if(listaDeBarras[e.target.id].playStatus === true){
        n = false;
        stopBarra();
      }
      
      if(n && !contador){
        playBarras();
      }
      listaDeBarras.map(barra=>barra.playStatus=false);
      listaDeBarras[e.target.id].playStatus = n;
    });
    barView.appendChild(barra);
  }
}
function playBarras(){
   contador = setInterval(function() {
      for (var i = 0; i < listaDeBarras.length; i++) {
        if(listaDeBarras[i].playStatus){
          listaDeBarras[i].value = parseInt(listaDeBarras[i].value)+1;
          var barraAtual = document.getElementById(i);
          barraAtual.value = listaDeBarras[i].value;
          if(barraAtual.value >= listaDeBarras[i].max){
            stopBarra();
          }
        }
      }
  }, 1000);
}
function stopBarra(){
  clearInterval(contador);
  contador = false;
}
criarBarra();