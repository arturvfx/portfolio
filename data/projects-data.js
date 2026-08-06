/**
 * Centralized Projects Data Store
 * Contains project content definitions only.
 *
 * Project Data Model:
 * - id: string
 * - slug: string
 * - title: string
 * - client: string
 * - category: string
 * - year: string
 * - services: string[] (optional areas of work)
 * - projectSummary: string (optional project context)
 * - contribution: string (optional description of work performed)
 * - director: string (optional credit)
 * - productionCompany: string (optional credit)
 * - watchNowEnabled: boolean (optional external availability link)
 * - watchNowUrl: string (optional external streaming/player URL)
 * - coverImage: string (optional when previewVideo exists)
 * - previewVideo: string (optional)
 * - youtubeUrl: string (optional full video for the project page)
 * - projectStills: { url: string, size: '16-9' | '9-16' | '4-3' }[] (max 3)
 * - section: string ('featured-work' | 'content-editing' | 'digital-alchemy')
 * - size: string ('16-9' | '9-16' | '4-3' | 'featured')
 * - published: boolean
 * - order: number
 */

const PROJECTS_DATA = [
  // --- Featured Work Section ---
  {
    id: 'monsters-of-god',
    slug: 'monsters-of-god',
    title: 'MONSTERS OF GOD',
    client: 'A24',
    category: 'VFX & COMPOSITING',
    year: '2026',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '16-9',
    published: true,
    order: 2
  },
  {
    id: 'crystal-lake',
    slug: 'crystal-lake',
    title: 'CRYSTAL LAKE',
    client: 'Peacock',
    category: '3D SIMULATION',
    year: '2026',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '16-9',
    published: true,
    order: 1
  },
  {
    id: 'overcompensating',
    slug: 'overcompensating',
    title: 'OVERCOMPENSATING: S2',
    client: 'Prime Video',
    category: 'DIRECTION & EDITORIAL',
    year: '2025',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '4-3',
    published: true,
    order: 3
  },
  {
    id: 'neon-gateway',
    slug: 'neon-gateway',
    title: 'NEON GATEWAY',
    client: 'Digital Alchemy',
    category: 'LIGHTING & ENVIRONMENT',
    year: '2025',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '16-9',
    published: true,
    order: 4
  },
  {
    id: 'chrono-dust',
    slug: 'chrono-dust',
    title: 'CHRONO DUST',
    client: 'VFX Studio',
    category: 'PARTICLE SIMULATION',
    year: '2024',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '4-3',
    published: true,
    order: 5
  },
  {
    id: 'aetheria',
    slug: 'aetheria',
    title: 'AETHERIA CINEMA',
    client: 'A24',
    category: 'MATTE PAINTING',
    year: '2024',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'featured-work',
    size: '9-16',
    published: true,
    order: 6
  },

  // --- Content Editing Section ---
  {
    id: 'urban-rhythm',
    slug: 'urban-rhythm',
    title: 'URBAN RHYTHM',
    client: 'Commercial Cut',
    category: 'COMMERCIAL CUT',
    year: '2026',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '16-9',
    published: true,
    order: 1
  },
  {
    id: 'echoes-in-the-dark',
    slug: 'echoes-in-the-dark',
    title: 'ECHOES IN THE DARK',
    client: 'Music Video',
    category: 'MUSIC VIDEO / EDITORIAL',
    year: '2025',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '9-16',
    published: true,
    order: 2
  },
  {
    id: 'cinematic-showreel',
    slug: 'cinematic-showreel',
    title: 'CINEMATIC SHOWREEL',
    client: 'Editorial Reel',
    category: 'EDITORIAL REEL',
    year: '2026',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '4-3',
    published: true,
    order: 3
  },
  {
    id: 'nocturne-cut',
    slug: 'nocturne-cut',
    title: 'NOCTURNE MEMORY',
    client: 'Fashion Film',
    category: 'FASHION FILM',
    year: '2025',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '9-16',
    published: true,
    order: 4
  },
  {
    id: 'beat-refraction',
    slug: 'beat-refraction',
    title: 'BEAT REFRACTION',
    client: 'Music Video',
    category: 'RHYTHMIC SEQUENCE',
    year: '2024',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '16-9',
    published: true,
    order: 5
  },
  {
    id: 'frames-of-thought',
    slug: 'frames-of-thought',
    title: 'FRAMES OF THOUGHT',
    client: 'Documentary',
    category: 'DOCUMENTARY CUT',
    year: '2024',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'content-editing',
    size: '4-3',
    published: true,
    order: 6
  },

  // --- Digital Alchemy Section ---
  {
    id: 'quantum-fluids',
    slug: 'quantum-fluids',
    title: 'QUANTUM FLUIDS',
    client: 'Procedural Lab',
    category: 'PROCEDURAL SIMULATION',
    year: '2026',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '4-3',
    published: true,
    order: 1
  },
  {
    id: 'analog-memory-shader',
    slug: 'analog-memory-shader',
    title: 'ANALOG MEMORY SHADER',
    client: 'Shader Art',
    category: 'SHADER ART & LIGHTING',
    year: '2025',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '9-16',
    published: true,
    order: 2
  },
  {
    id: 'kinetic-geometry',
    slug: 'kinetic-geometry',
    title: 'KINETIC GEOMETRY',
    client: 'Experimental R&D',
    category: 'EXPERIMENTAL R&D',
    year: '2024',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '16-9',
    published: true,
    order: 3
  },
  {
    id: 'neural-dreams',
    slug: 'neural-dreams',
    title: 'NEURAL DREAMS',
    client: 'Generative CGI',
    category: 'GENERATIVE CGI',
    year: '2025',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '16-9',
    published: true,
    order: 4
  },
  {
    id: 'void-simulation',
    slug: 'void-simulation',
    title: 'VOID SIMULATION',
    client: 'Computational Shader',
    category: 'COMPUTATIONAL SHADER',
    year: '2024',
    previewVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '4-3',
    published: true,
    order: 5
  },
  {
    id: 'optical-echo',
    slug: 'optical-echo',
    title: 'OPTICAL ECHO',
    client: 'Refraction R&D',
    category: 'LIGHT REFRACTION R&D',
    year: '2024',
    previewVideo: 'assets/videos/bg-cinema.mp4',
    coverImage: '',
    section: 'digital-alchemy',
    size: '9-16',
    published: true,
    order: 6
  }
];
