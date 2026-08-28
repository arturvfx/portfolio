/**
 * Source gallery sections.
 *
 * Gallery Model:
 * - id: string
 * - slug: string (editable public URL segment; id remains internal)
 * - previousSlugs: string[]
 * - title: string
 * - browserTitle: string (optional full browser-tab title)
 * - description: string
 * - published: boolean
 * - backgroundEnabled: boolean
 * - backgroundSource: 'default' | 'homepage' | 'custom'
 * - backgroundVideo: string
 * - order: number
 *
 * Local admin overrides are merged at runtime. New sections do not need
 * a separate HTML file; gallery.html filters projects by the section id.
 */

const GALLERIES_DATA = [
  { id: 'featured-work', slug: 'featured-work', previousSlugs: [], title: 'FEATURED WORK', browserTitle: '', description: '', published: true, order: 1, backgroundEnabled: true, backgroundSource: 'default', backgroundVideo: '', translations: { en: {} } },
  { id: 'content-editing', slug: 'content-editing', previousSlugs: [], title: 'CONTENT EDITING', browserTitle: '', description: '', published: true, order: 2, backgroundEnabled: true, backgroundSource: 'default', backgroundVideo: '', translations: { en: {} } },
  { id: 'digital-alchemy', slug: 'digital-alchemy', previousSlugs: [], title: 'DIGITAL ALCHEMY', browserTitle: '', description: '', published: true, order: 3, backgroundEnabled: true, backgroundSource: 'default', backgroundVideo: '', translations: { en: {} } }
];

function galleryToPageConfig(gallery) {
  return {
    ...gallery,
    projectSection: gallery.id,
    activeNav: gallery.id,
    layoutPreset: gallery.layoutPreset || 'editorial',
    containerId: 'project-gallery'
  };
}
