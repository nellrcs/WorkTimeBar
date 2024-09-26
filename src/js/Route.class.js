
module.exports = class Route {
    constructor(url) {
      this.contentType = '';
      this.filename = ''; 
      this.urlList = [
         {file:'/src/js/backoff.js',type:'application/javascript; charset=utf-8'},
         {file:'/src/js/Progress.class.js',type:'application/javascript; charset=utf-8'},
         {file:'/src/js/views.js',type:'application/javascript; charset=utf-8'},
         {file:'/src/style/backoff.css',type:'text/css; charset=utf-8'},
         {file:'/src/favicon.ico',type:'image/x-icon'},
         {file:'/src/img/logotipo.png',type:'mage/png'},
         {file:'/src/painel.html',type:'text/html; charset=utf-8'}
      ];
      this.setRoute(url);
    }

    setRoute(url){
      this.urlList.map(item => { 
         if(item.file === url){ 
            this.contentType = item.type;
            this.filename = item.file; 
         }
      });
      if(this.filename == ''){
         this.contentType = 'text/html; charset=utf-8';
         this.filename = '/src/painel.html'; 
      }
   }   
}
