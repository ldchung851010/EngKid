const SVG_SIZE = 64;

type IconSpec = {
  bg: string;
  fg: string;
  accent: string;
  shape: 'plate' | 'cup' | 'book' | 'ticket' | 'bag' | 'animal' | 'room' | 'badge';
  label: string;
};

const SVG_SPECS: Record<string, IconSpec> = {
  hamburger: { bg: '#ffe8a3', fg: '#8d4b20', accent: '#42a35a', shape: 'plate', label: 'H' },
  pizza: { bg: '#fff0b8', fg: '#e56b2d', accent: '#f7c948', shape: 'plate', label: 'P' },
  salad: { bg: '#e6f8c9', fg: '#45a049', accent: '#ff8f6b', shape: 'plate', label: 'S' },
  pasta: { bg: '#fff3bf', fg: '#d59b24', accent: '#d94f3d', shape: 'plate', label: 'P' },
  water: { bg: '#d7f3ff', fg: '#2f9ed8', accent: '#ffffff', shape: 'cup', label: 'W' },
  juice: { bg: '#ffe2bd', fg: '#ff8a2a', accent: '#ffd166', shape: 'cup', label: 'J' },
  cola: { bg: '#f7d4d4', fg: '#7b2d26', accent: '#ffffff', shape: 'cup', label: 'C' },
  teacher: { bg: '#e8f4ff', fg: '#3677b8', accent: '#ffd166', shape: 'badge', label: 'T' },
  book: { bg: '#e7dcff', fg: '#6f58c9', accent: '#ffffff', shape: 'book', label: 'B' },
  pencil: { bg: '#fff1a8', fg: '#e0a12b', accent: '#f05d5e', shape: 'badge', label: 'P' },
  desk: { bg: '#f0dfc8', fg: '#8c5a32', accent: '#b9793b', shape: 'badge', label: 'D' },
  chair: { bg: '#e7f0ff', fg: '#5577aa', accent: '#8aa8d8', shape: 'badge', label: 'C' },
  classroom: { bg: '#e9f8df', fg: '#4a9c6a', accent: '#ffffff', shape: 'book', label: 'C' },
  room: { bg: '#f5e5d7', fg: '#9a6a42', accent: '#d8a05d', shape: 'room', label: 'R' },
  key: { bg: '#fff2b8', fg: '#c8941a', accent: '#ffffff', shape: 'badge', label: 'K' },
  night: { bg: '#dce7ff', fg: '#3e5489', accent: '#ffd166', shape: 'badge', label: 'N' },
  reservation: { bg: '#efe6ff', fg: '#7754ba', accent: '#ffffff', shape: 'book', label: 'R' },
  passport: { bg: '#d8e8ff', fg: '#325b9a', accent: '#ffd166', shape: 'book', label: 'P' },
  'thank you': { bg: '#ffe2ef', fg: '#c24d83', accent: '#ffffff', shape: 'badge', label: 'T' },
  ticket: { bg: '#fff1c9', fg: '#d68a1c', accent: '#ffffff', shape: 'ticket', label: 'T' },
  'boarding pass': { bg: '#e7fbff', fg: '#2f8db0', accent: '#ffffff', shape: 'ticket', label: 'B' },
  gate: { bg: '#e6ecff', fg: '#4f68b0', accent: '#ffffff', shape: 'ticket', label: 'G' },
  flight: { bg: '#dff6ff', fg: '#2f9eb8', accent: '#ffffff', shape: 'ticket', label: 'F' },
  bag: { bg: '#f1e1d2', fg: '#9b6137', accent: '#ffffff', shape: 'bag', label: 'B' },
  lion: { bg: '#ffe2a8', fg: '#d68a1c', accent: '#8b5a2b', shape: 'animal', label: 'L' },
  monkey: { bg: '#f1ddc4', fg: '#8c5a32', accent: '#ffd0a6', shape: 'animal', label: 'M' },
  elephant: { bg: '#e2e8f0', fg: '#77849b', accent: '#ffffff', shape: 'animal', label: 'E' },
  bird: { bg: '#dff8ff', fg: '#28a0c7', accent: '#ffd166', shape: 'animal', label: 'B' },
  tiger: { bg: '#ffd9a3', fg: '#df7d24', accent: '#27272a', shape: 'animal', label: 'T' },
  big: { bg: '#e4f6d7', fg: '#5b9c45', accent: '#ffffff', shape: 'badge', label: 'B' },
  small: { bg: '#e5f0ff', fg: '#5a78b8', accent: '#ffffff', shape: 'badge', label: 'S' },
  where: { bg: '#f4e5ff', fg: '#9253b8', accent: '#ffffff', shape: 'badge', label: '?' },
  please: { bg: '#ffe6ed', fg: '#c95b7a', accent: '#ffffff', shape: 'badge', label: 'P' },
};

export const VOCAB_SVG_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SVG_SPECS).map(([word, spec]) => [word, createIconSvg(spec)])
);

export function getSvgForWord(word: string): string {
  const normalized = word.trim().toLowerCase();
  return VOCAB_SVG_MAP[normalized] ?? firstLetterSvg(word);
}

function createIconSvg(spec: IconSpec): string {
  const shape = renderShape(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" role="img" aria-label="${escapeXml(spec.label)}"><rect width="64" height="64" rx="16" fill="${spec.bg}"/><circle cx="48" cy="16" r="8" fill="${spec.accent}" opacity="0.82"/>${shape}</svg>`;
}

function renderShape(spec: IconSpec): string {
  switch (spec.shape) {
    case 'plate':
      return `<ellipse cx="32" cy="38" rx="21" ry="12" fill="#fffaf0"/><ellipse cx="32" cy="35" rx="15" ry="8" fill="${spec.fg}"/><circle cx="25" cy="33" r="3" fill="${spec.accent}"/><circle cx="37" cy="37" r="3" fill="${spec.accent}"/>`;
    case 'cup':
      return `<path d="M22 20h22l-3 28H25z" fill="${spec.fg}"/><path d="M25 20h16l-1 8H26z" fill="${spec.accent}" opacity="0.85"/><path d="M43 27h5a5 5 0 0 1 0 10h-6" fill="none" stroke="${spec.fg}" stroke-width="4" stroke-linecap="round"/>`;
    case 'book':
      return `<path d="M18 17h20a8 8 0 0 1 8 8v25H25a7 7 0 0 0-7 7z" fill="${spec.fg}"/><path d="M22 23h18" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/><path d="M22 31h16" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/><path d="M22 39h14" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/>`;
    case 'ticket':
      return `<path d="M16 24a6 6 0 0 0 0 12v4a6 6 0 0 0 6 6h26a6 6 0 0 0 6-6v-4a6 6 0 0 1 0-12v-4a6 6 0 0 0-6-6H22a6 6 0 0 0-6 6z" fill="${spec.fg}"/><path d="M27 21v24" stroke="${spec.accent}" stroke-width="3" stroke-dasharray="3 4"/><path d="M34 27h11M34 35h9" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/>`;
    case 'bag':
      return `<path d="M20 27h28l3 24H17z" fill="${spec.fg}"/><path d="M25 28a7 7 0 0 1 14 0" fill="none" stroke="${spec.fg}" stroke-width="5"/><path d="M25 37h18" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/>`;
    case 'animal':
      return `<circle cx="32" cy="35" r="16" fill="${spec.fg}"/><circle cx="22" cy="24" r="7" fill="${spec.fg}"/><circle cx="42" cy="24" r="7" fill="${spec.fg}"/><circle cx="27" cy="33" r="3" fill="${spec.accent}"/><circle cx="37" cy="33" r="3" fill="${spec.accent}"/><path d="M28 42q4 4 8 0" fill="none" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round"/>`;
    case 'room':
      return `<path d="M20 17h26v35H20z" fill="${spec.fg}"/><path d="M27 24h12v28H27z" fill="${spec.bg}"/><circle cx="36" cy="38" r="2" fill="${spec.accent}"/>`;
    case 'badge':
      return `<circle cx="32" cy="34" r="19" fill="${spec.fg}"/><text x="32" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${spec.accent}">${escapeXml(spec.label)}</text>`;
  }
}

function firstLetterSvg(word: string): string {
  const letter = word.trim().charAt(0).toUpperCase();
  const label = letter || '?';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" role="img" aria-label="${escapeXml(label)}"><rect width="64" height="64" rx="16" fill="#e5e7eb"/><circle cx="32" cy="32" r="21" fill="#94a3b8"/><text x="32" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#ffffff">${escapeXml(label)}</text></svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return char;
    }
  });
}
