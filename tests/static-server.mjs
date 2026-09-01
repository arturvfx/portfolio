import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 4174);
const vercelConfig = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
const globalHeaders = vercelConfig.headers
  ?.find(rule => rule.source === '/(.*)')
  ?.headers || [];
const redirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];

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

function resolveFallbackRoute(pathname) {
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
  const pathname = decodeURIComponent(url.pathname);
  const redirect = redirects.find(rule => rule.source === pathname);
  if (redirect) {
    response.statusCode = redirect.permanent ? 308 : 307;
    response.setHeader('Location', redirect.destination);
    response.setHeader('Cache-Control', 'no-store');
    response.end();
    return;
  }
  const cleanHtmlPath = pathname === '/' ? 'index.html' : `${pathname.replace(/^\/+/, '')}.html`;
  const candidates = [cleanHtmlPath, resolveFallbackRoute(pathname)];
  let absolutePath = null;

  for (const relativePath of candidates) {
    const candidate = safePath(relativePath);
    if (!candidate) continue;
    try {
      await access(candidate);
      const fileStats = await stat(candidate);
      absolutePath = fileStats.isDirectory() ? path.join(candidate, 'index.html') : candidate;
      break;
    } catch (error) {
      // Try the next clean-route or fallback candidate.
    }
  }

  if (!absolutePath) {
    absolutePath = path.join(publicRoot, '404.html');
    response.statusCode = 404;
  }

  response.setHeader('Content-Type', mimeTypes.get(path.extname(absolutePath).toLowerCase()) || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  globalHeaders.forEach(header => response.setHeader(header.key, header.value));
  createReadStream(absolutePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Portfolio test server listening on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
