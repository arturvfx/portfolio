import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 4174);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webm', 'video/webm'],
  ['.xml', 'application/xml; charset=utf-8']
]);

function resolveRoute(pathname) {
  if (pathname === '/') return 'index.html';
  if (pathname === '/contact') return 'contact.html';
  if (pathname === '/admin') return 'admin.html';
  if (pathname === '/work') return 'gallery.html';
  if (['/featured-work', '/content-editing', '/digital-alchemy'].includes(pathname)) return 'gallery.html';
  if (/^\/work\/[^/]+$/.test(pathname)) return 'gallery.html';
  if (/^\/project\/[^/]+$/.test(pathname)) return 'project.html';
  return pathname.replace(/^\/+/, '');
}

function safePath(relativePath) {
  const absolutePath = path.resolve(publicRoot, relativePath);
  return absolutePath === publicRoot || absolutePath.startsWith(`${publicRoot}${path.sep}`)
    ? absolutePath
    : null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  const relativePath = resolveRoute(decodeURIComponent(url.pathname));
  let absolutePath = safePath(relativePath);

  try {
    if (!absolutePath) throw new Error('Unsafe path');
    await access(absolutePath);
    const fileStats = await stat(absolutePath);
    if (fileStats.isDirectory()) absolutePath = path.join(absolutePath, 'index.html');
  } catch (error) {
    absolutePath = path.join(publicRoot, '404.html');
    response.statusCode = 404;
  }

  response.setHeader('Content-Type', mimeTypes.get(path.extname(absolutePath).toLowerCase()) || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(absolutePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Portfolio test server listening on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
