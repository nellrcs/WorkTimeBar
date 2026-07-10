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

    const projectRoot = path.resolve(__dirname, '..', '..');

    // 1. Try serving from the Vite compiled dist directory
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const distPath = path.resolve(projectRoot, 'dist', relativePath);
    if (distPath.startsWith(path.join(projectRoot, 'dist')) && fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
      this.filename = '/dist/' + relativePath;
      this.setContentTypeFromExtension(pathname);
      return;
    }

    // 2. Fallback to serving directly from the project root (e.g. /src/img/logotipo.png or /src/favicon.ico)
    const projectPath = path.resolve(projectRoot, relativePath);
    if (projectPath.startsWith(projectRoot) && fs.existsSync(projectPath) && fs.statSync(projectPath).isFile()) {
      this.filename = '/' + relativePath;
      this.setContentTypeFromExtension(pathname);
      return;
    }
  }
}
