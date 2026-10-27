/** "[your notice period]" style gaps a draft leaves for you to fill in before sending. */
export function unfilledPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{2,80}\]/g) ?? [])];
}
