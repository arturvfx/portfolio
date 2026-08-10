import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist');
const publicFiles = [
  '404.html',
  'admin.html',
  'contact.html',
  'gallery.html',
  'index.html',
  'portfolio.js',
  'project-detail.js',
  'project.html',
  'robots.txt',
  'sitemap.xml',
  'script.js',
  'styles.css'
];
const publicDirectories = ['admin', 'assets', 'components', 'config', 'data'];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const file of publicFiles) {
  await cp(path.join(projectRoot, file), path.join(outputRoot, file));
}

for (const directory of publicDirectories) {
  await cp(path.join(projectRoot, directory), path.join(outputRoot, directory), {
    recursive: true,
    filter: source => path.basename(source) !== '.DS_Store'
  });
}

console.log(`Static portfolio built at ${outputRoot}`);
