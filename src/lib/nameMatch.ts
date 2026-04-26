// Name-similarity helper for the Get-QR self-service.
// Goal: be forgiving of order, middle initials, and accents — but reject names
// that don't actually look like the stored one.

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string) =>
  normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2); // drop initials like "n", "m"

/** Returns true iff the input is "close enough" to the stored name. */
export function isCloseName(input: string, stored: string): boolean {
  const a = tokens(input);
  const b = tokens(stored);
  if (!a.length || !b.length) return false;

  const setB = new Set(b);
  let matches = 0;
  for (const t of a) {
    if (setB.has(t)) matches++;
    else {
      // partial: long token contained in any stored token (e.g., misspelled by 1-2 chars)
      if (b.some((bt) => bt.length >= 4 && (bt.startsWith(t.slice(0, 4)) || t.startsWith(bt.slice(0, 4))))) {
        matches += 0.5;
      }
    }
  }

  // Require at least 2 token-matches OR full coverage of the input,
  // AND at least 60% of the longer name's tokens to overlap.
  const coverage = matches / Math.max(a.length, b.length);
  return matches >= 2 && coverage >= 0.5;
}
