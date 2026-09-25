/**
 * URL of a file under the `papers/` data directory. Goes through Vite's base path, since
 * the GitHub Pages build is served under /paper-reader/ rather than at the site root.
 */
export function papersUrl(path: string): string {
  return `${import.meta.env.BASE_URL}papers/${path}`;
}
