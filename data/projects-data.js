/**
 * Safe source fallback for project content.
 *
 * Supabase is the live source of truth. During `npm run build`, published rows
 * replace this empty array inside `dist/data/projects-data.js`, giving the
 * deployed site a current, synchronous fallback without keeping old demo
 * projects in the repository.
 */
const PROJECTS_DATA = [];
