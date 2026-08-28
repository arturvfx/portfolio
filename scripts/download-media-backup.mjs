import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : '';
const requestedOutput = process.argv[3] ? path.resolve(process.argv[3]) : '';

if (!backupPath) {
  console.error('Usage: npm run backup:media -- /path/to/artur-portfolio-backup.json [output-folder]');
  process.exit(1);
}

const backup = JSON.parse(await readFile(backupPath, 'utf8'));
if (backup.backupType !== 'artur-portfolio-full' || !Array.isArray(backup.media)) {
  throw new Error('The selected JSON is not a full portfolio backup with a media inventory.');
}

const date = new Date().toISOString().slice(0, 10);
const outputRoot = requestedOutput || path.join(path.dirname(backupPath), `artur-portfolio-media-${date}`);
const mediaRoot = path.join(outputRoot, 'media');
await mkdir(mediaRoot, { recursive: true });

function safeFileName(url, index) {
  let baseName = '';
  try {
    baseName = decodeURIComponent(new URL(url, 'https://arturaraujo.com/').pathname.split('/').pop() || 'media');
  } catch (_error) {
    baseName = path.basename(String(url || 'media'));
  }
  const clean = baseName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
  return `${String(index + 1).padStart(3, '0')}-${clean}`;
}

async function saveMedia(entry, index) {
  const fileName = safeFileName(entry.url, index);
  const destination = path.join(mediaRoot, fileName);
  const source = String(entry.url || '').trim();
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  } else {
    const localSource = path.resolve(projectRoot, source.replace(/^\/+/, ''));
    if (!localSource.startsWith(`${projectRoot}${path.sep}`)) throw new Error('Unsafe local media path');
    await copyFile(localSource, destination);
  }
  return { ...entry, file: `media/${fileName}`, status: 'downloaded' };
}

const results = [];
for (let index = 0; index < backup.media.length; index += 1) {
  const entry = backup.media[index];
  try {
    results.push(await saveMedia(entry, index));
    console.log(`[${index + 1}/${backup.media.length}] Saved ${entry.url}`);
  } catch (error) {
    results.push({ ...entry, file: '', status: 'failed', error: error.message || String(error) });
    console.warn(`[${index + 1}/${backup.media.length}] Failed ${entry.url}: ${error.message || error}`);
  }
}

const offlineBackup = {
  ...backup,
  offlineMediaExportedAt: new Date().toISOString(),
  media: results
};
await writeFile(path.join(outputRoot, 'portfolio-backup.json'), JSON.stringify(offlineBackup, null, 2));

const downloaded = results.filter(item => item.status === 'downloaded').length;
const failed = results.length - downloaded;
console.log(`Media backup complete: ${downloaded} downloaded, ${failed} failed. Output: ${outputRoot}`);
if (failed) process.exitCode = 1;
