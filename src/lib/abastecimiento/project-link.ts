/** Appends the project scope to a link, when there is one. Pure (no Next imports) so it
 * can be unit tested and used from server-safe modules. */
export function withProject(href: string, projectId: string): string {
  return projectId ? `${href}?projectId=${projectId}` : href;
}
