import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist');
const publicOrigin = 'https://arturaraujo.com';
const supabaseUrl = process.env.SUPABASE_URL || 'https://mfxrygjuhhwguitrhnnk.supabase.co';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_7UT6Sm40lMapktUKYcOt-A_7iqcQtkZ';
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

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function plainText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength = 160) {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

function absoluteMediaUrl(value) {
  const source = plainText(value);
  if (!source) return '';
  try {
    return new URL(source, `${publicOrigin}/`).href;
  } catch (error) {
    return '';
  }
}

function upsertMeta(html, attribute, key, content) {
  const escaped = escapeHtmlAttribute(content);
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${key}["'][^>]*>`, 'i');
  const element = `<meta ${attribute}="${key}" content="${escaped}">`;
  return pattern.test(html) ? html.replace(pattern, element) : html.replace('</head>', `  ${element}\n</head>`);
}

function applyMetadata(template, metadata) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttribute(metadata.title)}</title>`);
  html = upsertMeta(html, 'name', 'description', metadata.description);
  html = upsertMeta(html, 'property', 'og:title', metadata.title);
  html = upsertMeta(html, 'property', 'og:description', metadata.description);
  html = upsertMeta(html, 'property', 'og:url', metadata.canonical);
  html = html.replace(
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtmlAttribute(metadata.canonical)}">`
  );
  if (metadata.image) {
    html = upsertMeta(html, 'property', 'og:image', metadata.image);
    html = upsertMeta(html, 'property', 'og:image:alt', metadata.imageAlt || metadata.title);
    html = upsertMeta(html, 'name', 'twitter:image', metadata.image);
    html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  }
  return html;
}

async function fetchPublishedTable(table, select = '*') {
  const query = new URLSearchParams({
    select,
    published: 'eq.true',
    order: 'display_order.asc'
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`${table} returned HTTP ${response.status}`);
  return response.json();
}

async function fetchSiteSettings() {
  const query = new URLSearchParams({ select: 'settings', id: 'eq.global', limit: '1' });
  const response = await fetch(`${supabaseUrl}/rest/v1/portfolio_site_settings?${query}`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) return {};
  const rows = await response.json();
  return rows[0]?.settings || {};
}

function galleryPath(id) {
  const topLevel = new Set(['featured-work', 'content-editing', 'digital-alchemy']);
  return topLevel.has(id) ? `/${encodeURIComponent(id)}` : `/work/${encodeURIComponent(id)}`;
}

async function writeRouteHtml(routePath, html) {
  const relativePath = `${routePath.replace(/^\//, '')}.html`;
  const destination = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
}

function buildSitemap(urls) {
  const uniqueUrls = [...new Set(urls)];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...uniqueUrls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');
}

async function generateSearchEntries() {
  try {
    const [sections, projects, settings, galleryTemplate, projectTemplate] = await Promise.all([
      fetchPublishedTable('portfolio_sections'),
      fetchPublishedTable('portfolio_projects'),
      fetchSiteSettings(),
      readFile(path.join(outputRoot, 'gallery.html'), 'utf8'),
      readFile(path.join(outputRoot, 'project.html'), 'utf8')
    ]);
    const firstCover = absoluteMediaUrl(projects.find(project => project.cover_image)?.cover_image);
    const workDescription = truncate(
      settings.workIntroBody || settings.workIntroTitle ||
      'Seleção de trabalhos de VFX, composição, motion e edição de Artur Araujo.'
    );
    const workHtml = applyMetadata(galleryTemplate, {
      title: 'ARTUR ARAUJO | Trabalhos selecionados',
      description: workDescription,
      canonical: `${publicOrigin}/work`,
      image: firstCover,
      imageAlt: 'Trabalhos selecionados de Artur Araujo'
    });
    await writeRouteHtml('/work', workHtml);

    const urls = [`${publicOrigin}/`, `${publicOrigin}/work`, `${publicOrigin}/contact`];

    for (const section of sections) {
      if (!section.id || !section.title) continue;
      const route = galleryPath(section.id);
      const sectionCover = absoluteMediaUrl(
        projects.find(project => project.section_id === section.id && project.cover_image)?.cover_image
      ) || firstCover;
      const html = applyMetadata(galleryTemplate, {
        title: `ARTUR ARAUJO | ${plainText(section.title)}`,
        description: truncate(section.description || `Projetos selecionados de ${plainText(section.title)} por Artur Araujo.`),
        canonical: `${publicOrigin}${route}`,
        image: sectionCover,
        imageAlt: plainText(section.title)
      });
      await writeRouteHtml(route, html);
      urls.push(`${publicOrigin}${route}`);
    }

    for (const project of projects) {
      if (!project.slug || !project.title) continue;
      const route = `/project/${encodeURIComponent(project.slug)}`;
      const description = truncate(
        project.project_summary || project.contribution ||
        [project.category, project.title].filter(Boolean).join(' — ')
      );
      const html = applyMetadata(projectTemplate, {
        title: `${plainText(project.title)} | ARTUR ARAUJO`,
        description,
        canonical: `${publicOrigin}${route}`,
        image: absoluteMediaUrl(project.cover_image),
        imageAlt: plainText(project.title)
      });
      await writeRouteHtml(route, html);
      urls.push(`${publicOrigin}${route}`);
    }

    await writeFile(path.join(outputRoot, 'sitemap.xml'), buildSitemap(urls));
    console.log(`Generated SEO entries for ${sections.length} sections and ${projects.length} projects.`);
  } catch (error) {
    console.warn(`Could not refresh SEO entries from Supabase; keeping the committed base sitemap. ${error.message}`);
  }
}

await generateSearchEntries();
console.log(`Static portfolio built at ${outputRoot}`);
