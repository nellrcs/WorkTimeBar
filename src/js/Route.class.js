const path = require('node:path');
const fs = require('node:fs');

module.exports = class Route {
  constructor(url) {
    this.contentType = 'text/html; charset=utf-8';
    this.filename = '/dist/painel.html';
    this.setRoute(url);
  }

  setContentTypeFromExtension(pathname) {
    const ext = path.extname(pathname).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.json': 'application/json'
    };
    this.contentType = mimeTypes[ext] || 'application/octet-stream';
  }

  setRoute(url) {
    let pathname = decodeURIComponent(url.split('?')[0]);
    
    if (pathname === '/' || pathname === '/index.html' || pathname === '/painel.html') {
      this.filename = '/dist/painel.html';
      this.contentType = 'text/html; charset=utf-8';
      return;
    }

    if (pathname === '/floating') {
      this.filename = '/dist/index.html';
      this.contentType = 'text/html; charset=utf-8';
      return;
    }

    // 1. Try serving from the Vite compiled dist directory
    const distPath = path.join(__dirname, '..', '..', 'dist', pathname);
    if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
      this.filename = '/dist' + pathname;
      this.setContentTypeFromExtension(pathname);
      return;
    }

    // 2. Fallback to serving directly from the project root (e.g. /src/img/logotipo.png or /src/favicon.ico)
    const projectPath = path.join(__dirname, '..', '..', pathname);
    if (fs.existsSync(projectPath) && fs.statSync(projectPath).isFile()) {
      this.filename = pathname;
      this.setContentTypeFromExtension(pathname);
      return;
    }
  }
}
