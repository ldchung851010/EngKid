interface SceneInfo {
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  unlocked: boolean;
  completed: boolean;
  score: number;
}

const sceneEmoji: Record<string, string> = {
  restaurant: '🍽️',
  school: '🏫',
  park: '🌳',
  hospital: '🏥',
  shop: '🛒',
  airport: '✈️',
  zoo: '🦁',
  home: '🏠',
  beach: '🏖️',
  farm: '🚜',
};

function getSceneEmoji(scene: SceneInfo): string {
  return sceneEmoji[scene.id] || '🎯';
}

interface QuoteItem {
  id: number;
  text: string;
  audioFile: string;
}

let quoteList: QuoteItem[] = [];
let currentAudio: HTMLAudioElement | null = null;
let defaultBubbleText = '';
let bubbleHideTimer: ReturnType<typeof setTimeout> | null = null;

async function loadQuotes(): Promise<void> {
  try {
    const res = await fetch('/api/quotes');
    if (res.ok) {
      const manifest = await res.json() as { quotes: QuoteItem[] };
      quoteList = manifest.quotes;
      console.log(`[quotes] loaded ${quoteList.length} quotes`);
    }
  } catch (err) {
    console.warn('[quotes] failed to load:', err);
  }
}

function playRandomQuote(kittenEl: HTMLElement, bubble: HTMLElement): void {
  if (quoteList.length === 0) return;

  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (bubbleHideTimer) {
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = null;
  }

  const quote = quoteList[Math.floor(Math.random() * quoteList.length)];
  const audio = new Audio(`/api/quotes/${quote.id}/audio`);
  currentAudio = audio;

  // Show quote text in bubble
  showBubble(bubble, quote.text);

  // Visual feedback: speaking state
  kittenEl.classList.remove('kitten-idle');
  kittenEl.classList.add('kitten-speaking');

  audio.addEventListener('ended', () => {
    kittenEl.classList.remove('kitten-speaking');
    kittenEl.classList.add('kitten-idle');
    currentAudio = null;
    // Restore default bubble text, then auto-hide after delay
    if (defaultBubbleText) {
      showBubble(bubble, defaultBubbleText);
      bubbleHideTimer = setTimeout(() => bubble.classList.add('hidden'), 5000);
    }
  });

  audio.addEventListener('error', () => {
    kittenEl.classList.remove('kitten-speaking');
    kittenEl.classList.add('kitten-idle');
    currentAudio = null;
    if (defaultBubbleText) {
      showBubble(bubble, defaultBubbleText);
      bubbleHideTimer = setTimeout(() => bubble.classList.add('hidden'), 5000);
    }
  });

  audio.play().catch((err) => {
    console.warn('[quotes] audio play failed:', err);
    kittenEl.classList.remove('kitten-speaking');
    kittenEl.classList.add('kitten-idle');
    if (defaultBubbleText) {
      showBubble(bubble, defaultBubbleText);
      bubbleHideTimer = setTimeout(() => bubble.classList.add('hidden'), 5000);
    }
  });
}

async function loadPortal(): Promise<void> {
  const loading = document.getElementById('portal-loading')!;
  const grid = document.getElementById('cards-grid')!;
  const scoreCount = document.getElementById('star-count')!;
  const kitten = document.getElementById('kitten')!;
  const bubble = document.getElementById('kitten-bubble')!;

  kitten.classList.add('kitten-idle');

  // Click kitten to play a random quote
  kitten.addEventListener('click', () => {
    playRandomQuote(kitten, bubble);
  });

  // Pre-load quotes in background
  loadQuotes();

  try {
    const [scenesRes, progressRes] = await Promise.all([
      fetch('/api/scenes'),
      fetch('/api/progress'),
    ]);

    if (!scenesRes.ok || !progressRes.ok) throw new Error('API error');

    const { scenes } = await scenesRes.json() as { scenes: SceneInfo[] };
    const { totalScore } = await progressRes.json() as { totalScore: number };

    scoreCount.textContent = String(totalScore);
    updateTree(totalScore);
    loading.classList.add('hidden');

    // Render cards
    grid.innerHTML = '';
    for (const scene of scenes) {
      const card = document.createElement('div');
      card.className = `card${!scene.unlocked ? ' locked' : ''}${scene.completed ? ' completed' : ''}`;

      const emoji = getSceneEmoji(scene);
      const playBtn = scene.completed
        ? '<span class="card-badge-done">✓ Done!</span>'
        : scene.unlocked
          ? '<span class="card-play-btn">▶ Play</span>'
          : '';

      card.innerHTML = `
        <div class="card-header">${emoji}</div>
        <div class="card-body">
          <div class="card-cefr">${scene.cefrLevel}</div>
          ${!scene.unlocked ? '<div class="card-lock">🔒</div>' : ''}
          <div class="card-name">${scene.name}</div>
          <div class="card-desc">${scene.description}</div>
          <div class="card-footer">
            <span class="card-score">${scene.score}</span>
            ${playBtn}
          </div>
        </div>
      `;

      if (scene.unlocked) {
        card.addEventListener('click', () => {
          card.classList.add('entering');
          setTimeout(() => { location.href = `/play.html?scene=${scene.id}`; }, 350);
        });
      }

      grid.appendChild(card);
    }

    // Kitten status based on progress
    const completedCount = scenes.filter((s) => s.completed).length;
    if (completedCount === scenes.length && scenes.length > 0) {
      defaultBubbleText = 'Amazing! You completed everything! 🌟';
    } else if (completedCount > 0) {
      defaultBubbleText = `You finished ${completedCount} scene(s)! Keep going! 🐱`;
    } else {
      defaultBubbleText = 'Pick a scene to start learning! 📚';
    }
    showBubble(bubble, defaultBubbleText);

    bubbleHideTimer = setTimeout(() => bubble.classList.add('hidden'), 6000);
  } catch (err) {
    console.error('Portal load failed:', err);
    loading.innerHTML = '<p>Failed to load scenes. Make sure the server is running.</p>';
  }
}

function showBubble(bubble: HTMLElement, text: string): void {
  bubble.textContent = text;
  bubble.classList.remove('hidden');
}

// Cartoon tree: organic rounded crown with fruits
function updateTree(totalScore: number): void {
  const svg = document.getElementById('tree-svg')!;
  const layers = Math.min(10, Math.floor(totalScore / 50));

  const crownColors = [
    '#a8e6a3', '#8cd982', '#6bcb77', '#50c878',
    '#3cb371', '#2e8b57', '#228b22', '#1e7e1e',
    '#ffd93d', '#ff6b6b',
  ];

  let html = '';

  // Background hill
  html += `<ellipse cx="70" cy="265" rx="55" ry="12" fill="#90c695" opacity="0.4"/>`;

  // Trunk
  html += `<rect x="60" y="220" width="20" height="45" rx="4" fill="#8B6914"/>`;
  html += `<rect x="62" y="225" width="16" height="35" rx="2" fill="#A67C00" opacity="0.5"/>`;

  // Crown circles — stacked organic blobs
  const blobs = [
    { cx: 70, cy: 205, r: 22 },
    { cx: 52, cy: 195, r: 18 },
    { cx: 88, cy: 195, r: 18 },
    { cx: 42, cy: 180, r: 16 },
    { cx: 70, cy: 175, r: 20 },
    { cx: 98, cy: 180, r: 16 },
    { cx: 55, cy: 160, r: 15 },
    { cx: 85, cy: 160, r: 15 },
    { cx: 70, cy: 148, r: 14 },
    { cx: 70, cy: 135, r: 12 },
  ];

  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const visible = i < layers;
    html += `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}"
      fill="${crownColors[i]}"
      opacity="${visible ? 0.95 : 0.12}"
      style="transition: opacity 0.5s ${i * 0.08}s ease-out;"
    />`;
  }

  // Fruits on grown parts
  const fruits = [
    { cx: 50, cy: 192 },
    { cx: 90, cy: 192 },
    { cx: 40, cy: 178 },
    { cx: 70, cy: 172 },
    { cx: 100, cy: 178 },
    { cx: 55, cy: 157 },
    { cx: 85, cy: 157 },
    { cx: 70, cy: 145 },
    { cx: 62, cy: 132 },
    { cx: 78, cy: 132 },
  ];

  for (let i = 0; i < fruits.length; i++) {
    const f = fruits[i];
    const visible = i < Math.max(0, layers - 2);
    html += `<circle cx="${f.cx}" cy="${f.cy}" r="4"
      fill="#ff6b6b"
      opacity="${visible ? 0.9 : 0}"
      style="transition: opacity 0.5s ${0.3 + i * 0.08}s ease-out;"
    />`;
  }

  // Star on top if full
  if (layers >= 10) {
    html += `<text x="70" y="118" text-anchor="middle" font-size="22">🌟</text>`;
  }

  svg.innerHTML = html;
}

loadPortal();
