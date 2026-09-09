/**
 * Best-effort extraction of taxon names from an uploaded alignment, used to
 * populate the outgroup dropdown. FASTA is first-class; PHYLIP is supported
 * on a best-effort basis (relaxed/interleaved PHYLIP headers vary too much to
 * parse reliably, so a failure here just means an empty outgroup dropdown,
 * never a submission error).
 */
export function parseTaxaNames(content: string): string[] {
  const trimmed = content.trimStart();
  if (trimmed.startsWith(">")) {
    return parseFastaTaxa(trimmed);
  }
  return parsePhylipTaxa(trimmed);
}

function parseFastaTaxa(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith(">")) continue;
    const header = line.slice(1).trim();
    const firstToken = header.split(/\s/)[0];
    if (firstToken) names.push(firstToken);
  }
  return dedupe(names);
}

function parsePhylipTaxa(content: string): string[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].trim().split(/\s+/);
  const numTaxa = Number(header[0]);
  if (!Number.isFinite(numTaxa) || numTaxa <= 0) return [];

  const names: string[] = [];
  for (let i = 1; i <= numTaxa && i < lines.length; i++) {
    const firstToken = lines[i].trim().split(/\s+/)[0];
    if (firstToken) names.push(firstToken);
  }
  return dedupe(names);
}

function dedupe(names: string[]): string[] {
  return Array.from(new Set(names));
}
