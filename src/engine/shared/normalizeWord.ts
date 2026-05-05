/** Canonical word normalizer: trim, lowercase, collapse internal whitespace */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}
