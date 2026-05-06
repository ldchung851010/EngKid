const SVG_SIZE = 64;

type IconKind =
  | 'airplane'
  | 'apple'
  | 'bag'
  | 'ball'
  | 'beach'
  | 'bed'
  | 'bench'
  | 'bird'
  | 'boarding-pass'
  | 'book'
  | 'bread'
  | 'broom'
  | 'burger'
  | 'chair'
  | 'chicken'
  | 'classroom'
  | 'cola'
  | 'cow'
  | 'desk'
  | 'doctor'
  | 'door'
  | 'egg'
  | 'elephant'
  | 'farm'
  | 'flower'
  | 'gate'
  | 'headache'
  | 'heart'
  | 'hotel-key'
  | 'house'
  | 'juice'
  | 'kite'
  | 'kitchen'
  | 'lamp'
  | 'lion'
  | 'medicine'
  | 'milk'
  | 'money'
  | 'monkey'
  | 'moon'
  | 'nurse'
  | 'park'
  | 'passport'
  | 'pasta'
  | 'pencil'
  | 'pizza'
  | 'please'
  | 'price-tag'
  | 'reservation'
  | 'rest'
  | 'run'
  | 'salad'
  | 'sand'
  | 'sea'
  | 'sheep'
  | 'shell'
  | 'shop'
  | 'small-big'
  | 'sofa'
  | 'stomachache'
  | 'sun'
  | 'swim'
  | 'teacher'
  | 'thank-you'
  | 'ticket'
  | 'tiger'
  | 'toy'
  | 'tractor'
  | 'tree'
  | 'water'
  | 'where';

type IconSpec = {
  bg: string;
  kind: IconKind;
};

const SVG_SPECS: Record<string, IconSpec> = {
  apple: { bg: '#ffe4e6', kind: 'apple' },
  bag: { bg: '#f1e1d2', kind: 'bag' },
  ball: { bg: '#e0f2fe', kind: 'ball' },
  beach: { bg: '#ffedd5', kind: 'beach' },
  bed: { bg: '#e0e7ff', kind: 'bed' },
  bench: { bg: '#f5e6d3', kind: 'bench' },
  big: { bg: '#dcfce7', kind: 'small-big' },
  bird: { bg: '#dff8ff', kind: 'bird' },
  book: { bg: '#e7dcff', kind: 'book' },
  'boarding pass': { bg: '#e7fbff', kind: 'boarding-pass' },
  bread: { bg: '#fef3c7', kind: 'bread' },
  chair: { bg: '#dbeafe', kind: 'chair' },
  chicken: { bg: '#fff7ed', kind: 'chicken' },
  classroom: { bg: '#dcfce7', kind: 'classroom' },
  clean: { bg: '#e0f2fe', kind: 'broom' },
  cola: { bg: '#fee2e2', kind: 'cola' },
  cow: { bg: '#f8fafc', kind: 'cow' },
  desk: { bg: '#f5e6d3', kind: 'desk' },
  doctor: { bg: '#dbeafe', kind: 'doctor' },
  egg: { bg: '#fff7ed', kind: 'egg' },
  elephant: { bg: '#e2e8f0', kind: 'elephant' },
  farm: { bg: '#dcfce7', kind: 'farm' },
  flight: { bg: '#dff6ff', kind: 'airplane' },
  flower: { bg: '#ffe4e6', kind: 'flower' },
  gate: { bg: '#e6ecff', kind: 'gate' },
  headache: { bg: '#fef3c7', kind: 'headache' },
  hamburger: { bg: '#ffe8a3', kind: 'burger' },
  hat: { bg: '#fef3c7', kind: 'beach' },
  help: { bg: '#ffe4e6', kind: 'heart' },
  home: { bg: '#fef3c7', kind: 'house' },
  juice: { bg: '#ffedd5', kind: 'juice' },
  key: { bg: '#fef3c7', kind: 'hotel-key' },
  kite: { bg: '#fce7f3', kind: 'kite' },
  kitchen: { bg: '#e0f2fe', kind: 'kitchen' },
  lamp: { bg: '#fef9c3', kind: 'lamp' },
  lion: { bg: '#ffedd5', kind: 'lion' },
  medicine: { bg: '#fee2e2', kind: 'medicine' },
  milk: { bg: '#e0f2fe', kind: 'milk' },
  money: { bg: '#dcfce7', kind: 'money' },
  monkey: { bg: '#f1ddc4', kind: 'monkey' },
  night: { bg: '#dce7ff', kind: 'moon' },
  nurse: { bg: '#fce7f3', kind: 'nurse' },
  park: { bg: '#dcfce7', kind: 'park' },
  pasta: { bg: '#fff3bf', kind: 'pasta' },
  passport: { bg: '#d8e8ff', kind: 'passport' },
  pencil: { bg: '#fff1a8', kind: 'pencil' },
  pizza: { bg: '#fff0b8', kind: 'pizza' },
  play: { bg: '#fef3c7', kind: 'ball' },
  please: { bg: '#ffe6ed', kind: 'please' },
  price: { bg: '#fef3c7', kind: 'price-tag' },
  reservation: { bg: '#efe6ff', kind: 'reservation' },
  rest: { bg: '#e0e7ff', kind: 'rest' },
  room: { bg: '#f5e5d7', kind: 'door' },
  run: { bg: '#dcfce7', kind: 'run' },
  salad: { bg: '#e6f8c9', kind: 'salad' },
  sand: { bg: '#fef3c7', kind: 'sand' },
  sea: { bg: '#cffafe', kind: 'sea' },
  sheep: { bg: '#f8fafc', kind: 'sheep' },
  shell: { bg: '#ffe4e6', kind: 'shell' },
  shop: { bg: '#fee2e2', kind: 'shop' },
  small: { bg: '#dbeafe', kind: 'small-big' },
  sofa: { bg: '#ede9fe', kind: 'sofa' },
  stomachache: { bg: '#ffedd5', kind: 'stomachache' },
  sun: { bg: '#fef3c7', kind: 'sun' },
  swim: { bg: '#cffafe', kind: 'swim' },
  table: { bg: '#f5e6d3', kind: 'desk' },
  teacher: { bg: '#e8f4ff', kind: 'teacher' },
  'thank you': { bg: '#ffe2ef', kind: 'thank-you' },
  ticket: { bg: '#fff1c9', kind: 'ticket' },
  tiger: { bg: '#ffd9a3', kind: 'tiger' },
  toy: { bg: '#f3e8ff', kind: 'toy' },
  tractor: { bg: '#dcfce7', kind: 'tractor' },
  tree: { bg: '#dcfce7', kind: 'tree' },
  water: { bg: '#d7f3ff', kind: 'water' },
  where: { bg: '#f4e5ff', kind: 'where' },
};

export const VOCAB_SVG_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SVG_SPECS).map(([word, spec]) => [word, createIconSvg(word, spec)])
);

export function getSvgForWord(word: string): string {
  const normalized = word.trim().toLowerCase();
  return VOCAB_SVG_MAP[normalized] ?? firstLetterSvg(word);
}

function createIconSvg(word: string, spec: IconSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" role="img" aria-label="${escapeXml(word)}"><rect width="64" height="64" rx="16" fill="${spec.bg}"/>${renderShape(spec.kind)}</svg>`;
}

function renderShape(kind: IconKind): string {
  switch (kind) {
    case 'airplane':
      return `<path d="M12 35l39-17 3 5-17 13 1 14-5 2-6-11-11 5-4-4 10-8-8-8 4-4 14 7z" fill="#38bdf8"/><path d="M35 35l12-9" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/>`;
    case 'apple':
      return `<path d="M35 19c2-5 6-7 11-7-1 6-5 9-10 9z" fill="#22c55e"/><path d="M32 23c8-6 20 0 18 13-2 12-9 17-16 12-7 5-16 0-18-12-2-13 10-19 16-13z" fill="#ef4444"/><path d="M32 21v-7" stroke="#7c2d12" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="33" r="3" fill="#fecaca" opacity="0.75"/>`;
    case 'bag':
      return `<path d="M18 27h28l4 25H14z" fill="#a16207"/><path d="M25 27a7 7 0 0 1 14 0" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M23 37h18" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/>`;
    case 'ball':
      return `<circle cx="32" cy="34" r="19" fill="#f97316"/><path d="M18 29c8 5 19 6 30 2M28 16c-2 9-1 22 5 37M42 20c-9 6-15 16-18 28" fill="none" stroke="#fff7ed" stroke-width="4" stroke-linecap="round"/>`;
    case 'beach':
      return `<path d="M13 45c10-8 26-8 38 0v8H13z" fill="#fbbf24"/><path d="M31 16c-10 1-17 8-19 18 7-4 12-4 18 1 4-7 8-9 17-7-3-8-8-12-16-12z" fill="#fb7185"/><path d="M31 16l-5 35" stroke="#92400e" stroke-width="4" stroke-linecap="round"/><path d="M31 16c-1 8-1 13-1 19" stroke="#fff7ed" stroke-width="3"/>`;
    case 'bed':
      return `<path d="M16 25h30a8 8 0 0 1 8 8v17H16z" fill="#60a5fa"/><path d="M16 19h9a7 7 0 0 1 7 7v4H16z" fill="#f8fafc"/><path d="M16 48v5M54 48v5" stroke="#1e3a8a" stroke-width="4" stroke-linecap="round"/>`;
    case 'bench':
      return `<path d="M16 26h34M14 36h38" stroke="#a16207" stroke-width="7" stroke-linecap="round"/><path d="M21 36v14M45 36v14" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`;
    case 'bird':
      return `<path d="M17 38c6-18 25-21 33-4-9 11-24 13-33 4z" fill="#38bdf8"/><circle cx="38" cy="30" r="9" fill="#0ea5e9"/><path d="M46 31l9 4-9 4z" fill="#f59e0b"/><circle cx="40" cy="28" r="2" fill="#0f172a"/><path d="M21 39c6 0 12-4 17-11" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round"/>`;
    case 'boarding-pass':
    case 'ticket':
      return `<path d="M12 25a6 6 0 0 0 0 12v4a6 6 0 0 0 6 6h30a6 6 0 0 0 6-6v-4a6 6 0 0 1 0-12v-4a6 6 0 0 0-6-6H18a6 6 0 0 0-6 6z" fill="#f59e0b"/><path d="M27 21v24" stroke="#fff7ed" stroke-width="3" stroke-dasharray="3 4"/><path d="M34 27h10M34 35h8" stroke="#fff7ed" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="33" r="3" fill="#fff7ed"/>`;
    case 'book':
    case 'classroom':
    case 'passport':
    case 'reservation':
      return `<path d="M17 16h21a8 8 0 0 1 8 8v27H24a7 7 0 0 0-7 7z" fill="${kind === 'passport' ? '#1d4ed8' : kind === 'reservation' ? '#7c3aed' : '#2563eb'}"/><path d="M23 24h16M23 32h14M23 40h12" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/><path d="M44 22v29" stroke="#bfdbfe" stroke-width="3" opacity="0.7"/>`;
    case 'bread':
      return `<path d="M18 29c0-11 8-18 15-12 8-7 17 1 17 12v20H18z" fill="#d97706"/><path d="M24 30h20v16H24z" fill="#fbbf24"/><circle cx="30" cy="37" r="2" fill="#92400e"/><circle cx="39" cy="34" r="2" fill="#92400e"/>`;
    case 'broom':
      return `<path d="M41 13L22 47" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M17 44h18l4 11H13z" fill="#f59e0b"/><path d="M17 48h18" stroke="#78350f" stroke-width="3"/><path d="M21 44l-2 11M28 44l2 11" stroke="#fde68a" stroke-width="2"/>`;
    case 'burger':
      return `<path d="M17 31c1-10 29-10 30 0z" fill="#f59e0b"/><path d="M16 36h32v6H16z" fill="#7c2d12"/><path d="M15 42c8 5 24 5 34 0v6H15z" fill="#d97706"/><path d="M17 35c7 5 12-4 19 0s9-2 13 0" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="26" r="2" fill="#fff7ed"/><circle cx="37" cy="25" r="2" fill="#fff7ed"/>`;
    case 'chair':
      return `<path d="M22 17h23v25H22z" fill="#60a5fa"/><path d="M18 37h31v10H18z" fill="#2563eb"/><path d="M22 47v8M45 47v8" stroke="#1d4ed8" stroke-width="5" stroke-linecap="round"/>`;
    case 'chicken':
      return `<circle cx="31" cy="35" r="16" fill="#f8fafc"/><circle cx="38" cy="26" r="9" fill="#ffffff"/><path d="M45 27l8 4-8 4z" fill="#f59e0b"/><path d="M32 17c1-6 5-6 7 0 3-5 7-3 5 3" fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/><circle cx="39" cy="25" r="2" fill="#111827"/><path d="M26 48v5M36 48v5" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>`;
    case 'cola':
    case 'juice':
    case 'water':
      return `<path d="M21 18h23l-3 33H24z" fill="${kind === 'water' ? '#38bdf8' : kind === 'juice' ? '#fb923c' : '#7f1d1d'}"/><path d="M24 18h17l-1 9H25z" fill="#ffffff" opacity="0.85"/><path d="M43 27h5a5 5 0 0 1 0 10h-6" fill="none" stroke="${kind === 'cola' ? '#7f1d1d' : '#0284c7'}" stroke-width="4" stroke-linecap="round"/><path d="M36 10l7 8" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>`;
    case 'cow':
      return `<path d="M18 22c6-9 22-9 28 0v17c0 10-28 10-28 0z" fill="#ffffff"/><path d="M17 27l-7-8M47 27l7-8" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M23 22c2-6 8-6 10 0-4 3-7 4-10 0zM39 23c-3-6 4-8 8-4-1 5-4 7-8 4z" fill="#111827"/><ellipse cx="32" cy="41" rx="10" ry="7" fill="#fecdd3"/><circle cx="28" cy="39" r="2" fill="#7f1d1d"/><circle cx="36" cy="39" r="2" fill="#7f1d1d"/><circle cx="26" cy="31" r="2" fill="#111827"/><circle cx="38" cy="31" r="2" fill="#111827"/>`;
    case 'desk':
      return `<path d="M15 25h36v10H15z" fill="#a16207"/><path d="M20 35v16M46 35v16" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M22 17h21v8H22z" fill="#f59e0b"/>`;
    case 'doctor':
    case 'nurse':
      return `<circle cx="32" cy="22" r="10" fill="#ffd7a8"/><path d="M19 53c1-14 25-14 27 0z" fill="${kind === 'doctor' ? '#e0f2fe' : '#fce7f3'}"/><path d="M21 16h22v8H21z" fill="#ffffff"/><path d="M32 14v12M26 20h12" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="22" r="2" fill="#111827"/><circle cx="36" cy="22" r="2" fill="#111827"/><path d="M26 39h12" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`;
    case 'door':
      return `<path d="M21 13h25v43H21z" fill="#92400e"/><path d="M27 19h13v37H27z" fill="#b45309"/><circle cx="37" cy="37" r="2.5" fill="#facc15"/>`;
    case 'egg':
      return `<path d="M32 12c11 0 17 17 17 27 0 11-7 17-17 17s-17-6-17-17c0-10 6-27 17-27z" fill="#ffffff"/><path d="M22 42c7 5 14 5 22 0" stroke="#fde68a" stroke-width="5" stroke-linecap="round"/>`;
    case 'elephant':
      return `<circle cx="29" cy="34" r="16" fill="#94a3b8"/><circle cx="18" cy="32" r="10" fill="#cbd5e1"/><circle cx="42" cy="32" r="10" fill="#cbd5e1"/><path d="M31 40c0 10 10 10 10 1" fill="none" stroke="#64748b" stroke-width="6" stroke-linecap="round"/><circle cx="25" cy="30" r="2" fill="#111827"/><circle cx="35" cy="30" r="2" fill="#111827"/>`;
    case 'farm':
      return `<path d="M14 31l18-16 18 16v22H14z" fill="#ef4444"/><path d="M24 38h16v15H24z" fill="#7f1d1d"/><path d="M32 15v38M14 31h36M21 25h22" stroke="#ffffff" stroke-width="3"/><path d="M10 53h44" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/>`;
    case 'flower':
      return `<path d="M32 36v17" stroke="#16a34a" stroke-width="4" stroke-linecap="round"/><path d="M32 45c-8-1-10-7-10-7 8-1 10 7 10 7z" fill="#22c55e"/><circle cx="32" cy="28" r="6" fill="#facc15"/><circle cx="32" cy="18" r="7" fill="#fb7185"/><circle cx="42" cy="28" r="7" fill="#fb7185"/><circle cx="32" cy="38" r="7" fill="#fb7185"/><circle cx="22" cy="28" r="7" fill="#fb7185"/>`;
    case 'gate':
      return `<path d="M15 24h34v18H15z" fill="#2563eb"/><path d="M21 42v12M43 42v12" stroke="#64748b" stroke-width="5" stroke-linecap="round"/><path d="M23 33h18" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><path d="M49 30l7 3-7 3z" fill="#ffffff"/>`;
    case 'headache':
      return `<circle cx="32" cy="34" r="16" fill="#ffd7a8"/><path d="M26 15l7 8-5 1 7 9" fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 37h16" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="31" r="2" fill="#111827"/><circle cx="37" cy="31" r="2" fill="#111827"/>`;
    case 'heart':
    case 'please':
    case 'thank-you':
      return `<path d="M32 51S14 40 14 27c0-11 13-14 18-5 5-9 18-6 18 5 0 13-18 24-18 24z" fill="#fb7185"/><path d="M24 34h16" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><path d="M32 26v16" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="${kind === 'thank-you' ? '1' : '0'}"/>`;
    case 'hotel-key':
      return `<circle cx="23" cy="35" r="10" fill="none" stroke="#f59e0b" stroke-width="6"/><path d="M32 35h21" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/><path d="M46 35v8M52 35v6" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>`;
    case 'house':
      return `<path d="M12 31l20-17 20 17" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 30h28v23H18z" fill="#fbbf24"/><path d="M28 39h9v14h-9z" fill="#92400e"/><path d="M39 35h5v6h-5z" fill="#bfdbfe"/>`;
    case 'kite':
      return `<path d="M32 10l16 18-16 18-16-18z" fill="#38bdf8"/><path d="M32 10v36M16 28h32" stroke="#ffffff" stroke-width="3"/><path d="M32 46c4 6 2 10 8 10" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>`;
    case 'kitchen':
      return `<path d="M16 18h32v34H16z" fill="#60a5fa"/><path d="M20 22h10v10H20zM34 22h10v10H34z" fill="#eff6ff"/><path d="M20 39h24" stroke="#1d4ed8" stroke-width="4"/><circle cx="26" cy="45" r="2" fill="#1d4ed8"/><circle cx="38" cy="45" r="2" fill="#1d4ed8"/>`;
    case 'lamp':
      return `<path d="M24 16h16l6 18H18z" fill="#facc15"/><path d="M32 34v15M24 51h16" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M22 34h20" stroke="#fde68a" stroke-width="3"/>`;
    case 'lion':
      return `<circle cx="32" cy="34" r="20" fill="#d97706"/><circle cx="32" cy="35" r="13" fill="#fbbf24"/><circle cx="27" cy="32" r="2" fill="#111827"/><circle cx="37" cy="32" r="2" fill="#111827"/><path d="M28 42q4 4 8 0" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>`;
    case 'medicine':
      return `<rect x="17" y="28" width="31" height="18" rx="9" fill="#ef4444" transform="rotate(-35 32 37)"/><path d="M32 23l11 15" stroke="#ffffff" stroke-width="4"/><path d="M20 45h24v10H20z" fill="#60a5fa"/><path d="M32 43v12M26 49h12" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`;
    case 'milk':
      return `<path d="M21 20l5-8h14l5 8v34H21z" fill="#f8fafc"/><path d="M21 27h24v18H21z" fill="#60a5fa"/><path d="M26 14h14M27 34h12" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round"/>`;
    case 'money':
      return `<path d="M14 24h38v25H14z" fill="#22c55e"/><circle cx="33" cy="36" r="8" fill="#bbf7d0"/><path d="M19 29c4 0 5-1 5-5M45 44c0-4 1-5 5-5" fill="none" stroke="#15803d" stroke-width="3"/><path d="M33 31v10" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>`;
    case 'monkey':
      return `<circle cx="32" cy="34" r="15" fill="#8b5a2b"/><circle cx="18" cy="34" r="8" fill="#a16207"/><circle cx="46" cy="34" r="8" fill="#a16207"/><ellipse cx="32" cy="39" rx="10" ry="8" fill="#fed7aa"/><circle cx="27" cy="31" r="2" fill="#111827"/><circle cx="37" cy="31" r="2" fill="#111827"/><path d="M28 42q4 3 8 0" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>`;
    case 'moon':
      return `<path d="M41 12c-12 4-18 18-12 29 4 8 12 11 20 9-5 5-13 7-21 3-12-6-16-20-10-31 5-10 14-13 23-10z" fill="#fef3c7"/><circle cx="47" cy="22" r="3" fill="#facc15"/><circle cx="52" cy="34" r="2" fill="#facc15"/>`;
    case 'park':
    case 'tree':
      return `<path d="M32 34v18" stroke="#92400e" stroke-width="7" stroke-linecap="round"/><circle cx="25" cy="28" r="11" fill="#22c55e"/><circle cx="39" cy="28" r="12" fill="#16a34a"/><circle cx="32" cy="18" r="11" fill="#4ade80"/><path d="M13 53h38" stroke="#84cc16" stroke-width="5" stroke-linecap="round"/>`;
    case 'pasta':
      return `<ellipse cx="32" cy="42" rx="21" ry="8" fill="#fff7ed"/><path d="M20 35c7-8 17 8 24 0M20 41c7-8 17 8 24 0M20 29c7-8 17 8 24 0" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round"/><circle cx="39" cy="34" r="5" fill="#ef4444"/>`;
    case 'pencil':
      return `<path d="M16 43l27-27 8 8-27 27-10 2z" fill="#facc15"/><path d="M43 16l5-5 8 8-5 5z" fill="#fca5a5"/><path d="M14 53l4-10 6 6z" fill="#92400e"/><path d="M40 19l8 8" stroke="#92400e" stroke-width="3"/>`;
    case 'pizza':
      return `<path d="M18 15l32 9-23 29z" fill="#f59e0b"/><path d="M22 20l22 6-16 20z" fill="#facc15"/><circle cx="30" cy="29" r="4" fill="#ef4444"/><circle cx="35" cy="39" r="4" fill="#ef4444"/><path d="M18 15c7 3 21 7 32 9" stroke="#92400e" stroke-width="5" stroke-linecap="round"/>`;
    case 'price-tag':
      return `<path d="M17 17h23l10 10-24 24-17-17z" fill="#f59e0b"/><circle cx="34" cy="24" r="3" fill="#fff7ed"/><path d="M23 37h17M31 29v18" stroke="#fff7ed" stroke-width="4" stroke-linecap="round"/>`;
    case 'rest':
      return `<path d="M16 36c0-8 8-12 18-9l12 4c6 2 7 7 3 12H16z" fill="#93c5fd"/><path d="M18 35h15v9H18z" fill="#eff6ff"/><path d="M18 45h33" stroke="#1e3a8a" stroke-width="5" stroke-linecap="round"/>`;
    case 'run':
      return `<circle cx="36" cy="16" r="6" fill="#ffd7a8"/><path d="M32 24l-8 12 12 4 8-9" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 40l-9 11M37 40l11 8M27 30l-11-3" stroke="#1d4ed8" stroke-width="5" stroke-linecap="round"/>`;
    case 'salad':
      return `<ellipse cx="32" cy="42" rx="20" ry="9" fill="#f8fafc"/><path d="M18 35c7-10 14-2 14-2s8-9 15 3c-6 9-22 11-29-1z" fill="#22c55e"/><circle cx="25" cy="35" r="4" fill="#fb7185"/><circle cx="40" cy="34" r="4" fill="#f97316"/>`;
    case 'sand':
      return `<path d="M12 46c8-9 31-11 41 0v8H12z" fill="#fbbf24"/><path d="M26 30h18l-3 18H29z" fill="#f97316"/><path d="M23 27h24" stroke="#f97316" stroke-width="4" stroke-linecap="round"/><circle cx="19" cy="47" r="2" fill="#d97706"/><circle cx="49" cy="47" r="2" fill="#d97706"/>`;
    case 'sea':
      return `<path d="M10 37c6-8 12-8 18 0s12 8 18 0 8-8 12-3v17H10z" fill="#38bdf8"/><path d="M11 28c6-7 12-7 18 0s12 7 18 0" fill="none" stroke="#0ea5e9" stroke-width="5" stroke-linecap="round"/><path d="M16 44c8 3 22 3 34 0" stroke="#cffafe" stroke-width="3" stroke-linecap="round"/>`;
    case 'sheep':
      return `<circle cx="24" cy="35" r="10" fill="#ffffff"/><circle cx="33" cy="31" r="11" fill="#ffffff"/><circle cx="42" cy="36" r="10" fill="#ffffff"/><circle cx="42" cy="31" r="8" fill="#334155"/><circle cx="39" cy="30" r="1.5" fill="#ffffff"/><circle cx="45" cy="30" r="1.5" fill="#ffffff"/><path d="M24 44v7M40 44v7" stroke="#334155" stroke-width="4" stroke-linecap="round"/>`;
    case 'shell':
      return `<path d="M16 45c1-18 12-29 16-29s15 11 16 29z" fill="#fb7185"/><path d="M16 45h32M32 17v28M23 25l9 20M41 25l-9 20" stroke="#fff7ed" stroke-width="3" stroke-linecap="round"/>`;
    case 'shop':
      return `<path d="M15 25h34v27H15z" fill="#fbbf24"/><path d="M12 18h40l-4 12H16z" fill="#ef4444"/><path d="M21 36h8v16h-8zM35 35h9v8h-9z" fill="#bfdbfe"/><path d="M12 30h40" stroke="#ffffff" stroke-width="3"/>`;
    case 'small-big':
      return `<circle cx="23" cy="39" r="9" fill="#60a5fa"/><circle cx="41" cy="31" r="16" fill="#22c55e"/><path d="M17 51h34" stroke="#14532d" stroke-width="4" stroke-linecap="round" opacity="0.35"/>`;
    case 'sofa':
      return `<path d="M18 31h28a8 8 0 0 1 8 8v10H10V39a8 8 0 0 1 8-8z" fill="#8b5cf6"/><path d="M17 25h30v15H17z" fill="#a78bfa"/><path d="M13 49v5M51 49v5" stroke="#5b21b6" stroke-width="4" stroke-linecap="round"/>`;
    case 'stomachache':
      return `<circle cx="32" cy="21" r="8" fill="#ffd7a8"/><path d="M20 55c2-18 22-18 24 0z" fill="#60a5fa"/><path d="M27 39c4-7 12-5 12 2 0 8-12 8-12 1z" fill="#fb923c"/><path d="M24 35c-5 3-5 8-1 11M41 35c5 3 5 8 1 11" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>`;
    case 'sun':
      return `<circle cx="32" cy="32" r="13" fill="#facc15"/><path d="M32 9v8M32 47v8M9 32h8M47 32h8M16 16l6 6M42 42l6 6M48 16l-6 6M22 42l-6 6" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>`;
    case 'swim':
      return `<path d="M10 45c6-6 12-6 18 0s12 6 18 0 8-5 10-2" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="24" r="6" fill="#ffd7a8"/><path d="M30 29l16 8M33 30l-10 9" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/><path d="M12 52c6-4 12-4 18 0s12 4 18 0" fill="none" stroke="#0ea5e9" stroke-width="4" stroke-linecap="round"/>`;
    case 'teacher':
      return `<circle cx="32" cy="21" r="9" fill="#ffd7a8"/><path d="M20 53c1-16 23-16 25 0z" fill="#22c55e"/><path d="M18 18h28" stroke="#5d4037" stroke-width="5" stroke-linecap="round"/><path d="M45 29h8v20h-8z" fill="#2563eb"/><path d="M47 35h4" stroke="#ffffff" stroke-width="2"/>`;
    case 'tiger':
      return `<circle cx="32" cy="34" r="18" fill="#f97316"/><path d="M20 22l-6-7M44 22l6-7" stroke="#111827" stroke-width="4" stroke-linecap="round"/><path d="M23 27l-8-3M41 27l8-3M24 38l-8 4M40 38l8 4" stroke="#111827" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="32" r="2" fill="#111827"/><circle cx="37" cy="32" r="2" fill="#111827"/><path d="M28 43q4 4 8 0" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>`;
    case 'toy':
      return `<rect x="18" y="22" width="28" height="28" rx="5" fill="#a855f7"/><path d="M26 22c-6-10 15-10 6 0M38 22c9-10 12 10 0 0M18 34h28M32 22v28" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/>`;
    case 'tractor':
      return `<path d="M18 31h20l5 10h8v8H16z" fill="#facc15"/><path d="M22 21h13v10H22z" fill="#22c55e"/><circle cx="23" cy="49" r="8" fill="#111827"/><circle cx="47" cy="49" r="6" fill="#111827"/><circle cx="23" cy="49" r="3" fill="#94a3b8"/><circle cx="47" cy="49" r="2" fill="#94a3b8"/><path d="M43 26h7" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>`;
    case 'where':
      return `<path d="M32 55s16-17 16-30a16 16 0 0 0-32 0c0 13 16 30 16 30z" fill="#a855f7"/><circle cx="32" cy="25" r="8" fill="#ffffff"/><path d="M30 25c0-5 8-5 8 0 0 4-5 4-5 8" fill="none" stroke="#7e22ce" stroke-width="3" stroke-linecap="round"/><circle cx="33" cy="39" r="2" fill="#7e22ce"/>`;
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
