/**
 * Source gallery sections.
 *
 * Gallery Model:
 * - id: string
 * - title: string
 * - description: string
 * - published: boolean
 * - order: number
 *
 * Local admin overrides are merged at runtime. New sections do not need
 * a separate HTML file; gallery.html filters projects by the section id.
 */

const GALLERIES_DATA = [
  { id: 'featured-work', title: 'FEATURED WORK', description: '', published: true, order: 1 },
  { id: 'content-editing', title: 'CONTENT EDITING', description: '', published: true, order: 2 },
  { id: 'digital-alchemy', title: 'DIGITAL ALCHEMY', description: '', published: true, order: 3 }
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
