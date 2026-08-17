import { getSvgForWord } from '../engine/collectibles/vocab-svg-map.js';
import { learningDataStore, normalizeLearningWord, type CollectibleData } from '../engine/runtime/LearningDataStore.js';
import { applyLocalProgress, type PortalScene, type SceneInfo } from './portal-progress.js';

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
  hotel: '🏨',
};

function getSceneEmoji(scene: SceneInfo): string {
  return sceneEmoji[scene.id] || '🎯';
}

interface QuoteItem {
  id: number;
  text: string;
  audioFile: string;
}

interface ExampleItem {
  sentence: string;
  explanation: string;
}

interface OnboardingStep {
  icon: string;
  title: string;
  subtitle: string;
  body: string;
}

const ONBOARDING_TUTORIAL_SEEN_KEY = 'onboardingTutorialSeen';
const onboardingSteps: OnboardingStep[] = [
  {
    icon: '🌈',
    title: 'Welcome!',
    subtitle: 'Welcome to the English Adventure World',
    body: 'Explore different 3D scenes and practice speaking English while you play.',
  },
  {
    icon: '🗺️',
    title: 'Pick a scene',
    subtitle: 'Choose a scene',
    body: 'Tap any unlocked scene card to start learning. Each scene has a different real-life theme and English missions.',
  },
  {
    icon: '⭐',
    title: 'Earn stars',
    subtitle: 'Earn stars',
    body: 'Talk with NPCs, say the right sentences, and complete missions to earn star points.',
  },
  {
    icon: '📖',
    title: 'Collect words',
    subtitle: 'Collect words',
    body: 'When you find vocabulary objects, they are added to your word collection. Your progress and data stay in this browser.',
  },
];

let quoteList: QuoteItem[] = [];
let currentAudio: HTMLAudioElement | null = null;
let defaultBubbleText = '';
let bubbleHideTimer: ReturnType<typeof setTimeout> | null = null;
const exampleCache = new Map<string, ExampleItem>();

async function loadQuotes(): Promise<void> {
  try {
    const res = await fetch('/quotes/manifest.json');
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
  const audio = new Audio(`/quotes/${quote.audioFile}`);
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
    const scenesRes = await fetch('/api/scenes');
    if (!scenesRes.ok) throw new Error('API error');

    const { scenes } = await scenesRes.json() as { scenes: SceneInfo[] };
    const portalScenes = applyLocalProgress(scenes, learningDataStore);
    const totalScore = learningDataStore.getTotalScore();
    const collectibles = learningDataStore.getCollectibles();

    scoreCount.textContent = String(totalScore);
    updateTree(totalScore);
    renderCompendiumButton(portalScenes, collectibles);
    renderGuideButton();
    renderSettingsButton();
    loading.classList.add('hidden');

    // Render cards
    grid.innerHTML = '';
    for (const scene of portalScenes) {
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
    const completedCount = portalScenes.filter((s) => s.completed).length;
    if (completedCount === portalScenes.length && portalScenes.length > 0) {
      defaultBubbleText = 'Amazing! You completed everything! 🌟';
    } else if (completedCount > 0) {
      defaultBubbleText = `You finished ${completedCount} scene(s)! Keep going! 🐱`;
    } else {
      defaultBubbleText = 'Pick a scene to start learning! 📚';
    }
    showBubble(bubble, defaultBubbleText);

    bubbleHideTimer = setTimeout(() => bubble.classList.add('hidden'), 6000);
    if (learningDataStore.getPreference<boolean>(ONBOARDING_TUTORIAL_SEEN_KEY) !== true) {
      window.setTimeout(openOnboardingTutorial, 500);
    }
  } catch (err) {
    console.error('Portal load failed:', err);
    loading.innerHTML = '<p>Failed to load scenes. Make sure the server is running.</p>';
  }
}

function renderCompendiumButton(scenes: PortalScene[], collectibles: CollectibleData[]): void {
  const scoreDisplay = document.getElementById('score-display')!;
  document.getElementById('compendium-btn')?.remove();

  const button = document.createElement('button');
  button.id = 'compendium-btn';
  button.type = 'button';
  button.innerHTML = `
    <span class="compendium-book-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M4 5.5C4 4.7 4.7 4 5.5 4H10c1 0 1.8.3 2.4.9.6-.6 1.4-.9 2.4-.9h3.7c.8 0 1.5.7 1.5 1.5v12.8c0 .5-.4.9-.9.9h-4.7c-.7 0-1.3.2-1.8.7l-.2.2-.2-.2c-.5-.5-1.1-.7-1.8-.7H4.9c-.5 0-.9-.4-.9-.9V5.5Z" fill="currentColor"/>
        <path d="M12.4 5v13.5M6.5 7.5H10M6.5 10.2H10M15 7.5h2.5M15 10.2h2.5" fill="none" stroke="#fff8d6" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </span>
    <span class="compendium-icon">Book</span>
    <span id="compendium-count">${collectibles.length}</span>
  `;
  scoreDisplay.appendChild(button);
  button.addEventListener('click', () => openCompendium(scenes, collectibles));
}

function renderGuideButton(): void {
  const scoreDisplay = document.getElementById('score-display')!;
  document.getElementById('onboarding-guide-btn')?.remove();

  const button = document.createElement('button');
  button.id = 'onboarding-guide-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open guide');
  button.title = 'Guide';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M9.8 9.3a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.3 2-2.3 3.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 17h.01" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;
  button.addEventListener('click', openOnboardingTutorial);
  scoreDisplay.appendChild(button);
}

function renderSettingsButton(): void {
  const scoreDisplay = document.getElementById('score-display')!;
  document.getElementById('learning-data-btn')?.remove();

  const button = document.createElement('button');
  button.id = 'learning-data-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Learning data settings');
  button.title = 'Learning data';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
  button.addEventListener('click', openLearningDataSettings);
  scoreDisplay.appendChild(button);
}

function openCompendium(scenes: PortalScene[], collectibles: CollectibleData[]): void {
  const overlay = getCompendiumOverlay();
  const body = overlay.querySelector<HTMLDivElement>('.compendium-body')!;
  const collectedSet = new Set(collectibles.map((item) => `${item.sceneId}:${normalizeLearningWord(item.word)}`));

  body.innerHTML = '';
  if (collectibles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'compendium-empty';
    empty.textContent = 'No words collected yet. Explore a scene to find some.';
    body.appendChild(empty);
  }

  for (const scene of scenes) {
    const words = scene.targetVocabulary ?? [];
    const collectedCount = words.filter((word) => collectedSet.has(`${scene.id}:${normalizeLearningWord(word)}`)).length;
    const section = document.createElement('section');
    section.className = 'compendium-scene';
    section.innerHTML = `
      <div class="compendium-scene-header">
        <span class="compendium-scene-icon">${getSceneEmoji(scene)}</span>
        <span class="compendium-scene-name">${scene.name}</span>
        <span class="compendium-scene-progress">${collectedCount}/${words.length}</span>
      </div>
      <div class="compendium-grid"></div>
    `;

    const grid = section.querySelector<HTMLDivElement>('.compendium-grid')!;
    for (const word of words) {
      const collected = collectedSet.has(`${scene.id}:${normalizeLearningWord(word)}`);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `compendium-item${collected ? ' collected' : ' missing'}`;
      card.disabled = !collected;
      card.innerHTML = `
        <span class="compendium-svg">${getSvgForWord(word)}</span>
        <span class="compendium-word">${collected ? word : '???'}</span>
      `;
      if (collected) {
        card.addEventListener('click', (event) => {
          event.stopPropagation();
          void handleCompendiumWordClick(card, word, scene.cefrLevel);
        });
      }
      grid.appendChild(card);
    }

    body.appendChild(section);
  }

  overlay.classList.remove('hidden');
  overlay.querySelector<HTMLButtonElement>('.compendium-close')!.focus();
}

function openLearningDataSettings(): void {
  const overlay = getLearningDataOverlay();
  overlay.classList.remove('hidden');
  overlay.querySelector<HTMLButtonElement>('.learning-data-close')!.focus();
}

function getLearningDataOverlay(): HTMLDivElement {
  const existing = document.getElementById('learning-data-overlay') as HTMLDivElement | null;
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.id = 'learning-data-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div class="learning-data-panel" role="dialog" aria-modal="true" aria-label="Learning data settings">
      <div class="learning-data-header">
        <h2>Learning Data</h2>
        <button type="button" class="learning-data-close" aria-label="Close">x</button>
      </div>
      <div class="learning-data-body">
        <p class="learning-data-note">Progress is saved in this browser.</p>
        <div class="learning-data-actions">
          <button type="button" id="learning-data-export">Export</button>
          <button type="button" id="learning-data-import">Import</button>
          <button type="button" id="learning-data-reset">Reset</button>
        </div>
        <input id="learning-data-file" type="file" accept="application/json,.json" hidden />
        <p id="learning-data-status" role="status"></p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeLearningDataSettings();
  });
  overlay.querySelector<HTMLButtonElement>('.learning-data-close')!.addEventListener('click', closeLearningDataSettings);
  overlay.querySelector<HTMLButtonElement>('#learning-data-export')!.addEventListener('click', exportLearningData);
  overlay.querySelector<HTMLButtonElement>('#learning-data-import')!.addEventListener('click', () => {
    overlay.querySelector<HTMLInputElement>('#learning-data-file')!.click();
  });
  overlay.querySelector<HTMLButtonElement>('#learning-data-reset')!.addEventListener('click', resetLearningData);
  overlay.querySelector<HTMLInputElement>('#learning-data-file')!.addEventListener('change', importLearningData);
  document.addEventListener('keydown', (event) => {
    if (overlay.classList.contains('hidden')) return;
    if (event.code === 'Escape') closeLearningDataSettings();
  });

  return overlay;
}

function closeLearningDataSettings(): void {
  document.getElementById('learning-data-overlay')?.classList.add('hidden');
}

function exportLearningData(): void {
  const blob = new Blob([learningDataStore.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hi-kid-fun-learning-data-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setLearningDataStatus('Exported.');
}

async function importLearningData(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const result = learningDataStore.importData(await file.text());
  if (!result.ok) {
    setLearningDataStatus('Import failed. Please choose a valid data file.');
    return;
  }
  location.reload();
}

function resetLearningData(): void {
  if (!window.confirm('Reset learning data in this browser?')) return;
  const result = learningDataStore.reset();
  if (!result.ok) {
    setLearningDataStatus('Reset failed. Browser storage is unavailable.');
    return;
  }
  location.reload();
}

function setLearningDataStatus(message: string): void {
  const status = document.getElementById('learning-data-status');
  if (status) status.textContent = message;
}

function openOnboardingTutorial(): void {
  const overlay = getOnboardingOverlay();
  overlay.dataset.step = '0';
  renderOnboardingStep(overlay);
  overlay.classList.remove('hidden');
  overlay.querySelector<HTMLButtonElement>('.onboarding-close')?.focus();
}

function getOnboardingOverlay(): HTMLDivElement {
  const existing = document.getElementById('onboarding-overlay') as HTMLDivElement | null;
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'hidden';
  overlay.dataset.step = '0';
  overlay.innerHTML = `
    <div class="onboarding-panel" role="dialog" aria-modal="true" aria-label="New player guide">
      <div class="onboarding-content"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOnboardingTutorial();
  });
  document.addEventListener('keydown', (event) => {
    if (overlay.classList.contains('hidden')) return;
    if (event.code === 'Escape') closeOnboardingTutorial();
    if (event.code === 'Tab') trapOverlayFocus(event, overlay);
  });

  return overlay;
}

function renderOnboardingStep(overlay: HTMLDivElement): void {
  const stepIndex = getOnboardingStepIndex(overlay);
  const step = onboardingSteps[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === onboardingSteps.length - 1;
  const content = overlay.querySelector<HTMLDivElement>('.onboarding-content')!;

  content.innerHTML = `
    <div class="onboarding-header">
      <span class="onboarding-kicker">New Player Guide</span>
      <button type="button" class="onboarding-close" aria-label="Close">x</button>
    </div>
    <div class="onboarding-illustration" aria-hidden="true">
      <span class="onboarding-icon">${step.icon}</span>
      <span class="onboarding-sparkle onboarding-sparkle-1">✨</span>
      <span class="onboarding-sparkle onboarding-sparkle-2">⭐</span>
    </div>
    <div class="onboarding-copy">
      <h2>${step.title}</h2>
      <p class="onboarding-subtitle">${step.subtitle}</p>
      <p class="onboarding-body">${step.body}</p>
    </div>
    <div class="onboarding-dots" aria-label="Tutorial progress">
      ${onboardingSteps.map((_, index) => `
        <button type="button" class="onboarding-dot${index === stepIndex ? ' active' : ''}" aria-label="Go to step ${index + 1}" data-step="${index}"></button>
      `).join('')}
    </div>
    <div class="onboarding-actions">
      <button type="button" class="onboarding-skip">Skip</button>
      <div class="onboarding-nav">
        <button type="button" class="onboarding-back" ${isFirst ? 'disabled' : ''}>Back</button>
        <button type="button" class="onboarding-next">${isLast ? 'Start' : 'Next'}</button>
      </div>
    </div>
  `;

  content.querySelector<HTMLButtonElement>('.onboarding-close')!.addEventListener('click', closeOnboardingTutorial);
  content.querySelector<HTMLButtonElement>('.onboarding-skip')!.addEventListener('click', closeOnboardingTutorial);
  content.querySelector<HTMLButtonElement>('.onboarding-back')!.addEventListener('click', () => {
    setOnboardingStep(overlay, stepIndex - 1);
  });
  content.querySelector<HTMLButtonElement>('.onboarding-next')!.addEventListener('click', () => {
    if (isLast) {
      closeOnboardingTutorial();
      return;
    }
    setOnboardingStep(overlay, stepIndex + 1);
  });
  content.querySelectorAll<HTMLButtonElement>('.onboarding-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      setOnboardingStep(overlay, Number(dot.dataset.step ?? 0));
    });
  });
}

function setOnboardingStep(overlay: HTMLDivElement, stepIndex: number): void {
  overlay.dataset.step = String(Math.max(0, Math.min(stepIndex, onboardingSteps.length - 1)));
  renderOnboardingStep(overlay);
  overlay.querySelector<HTMLButtonElement>('.onboarding-next')?.focus();
}

function getOnboardingStepIndex(overlay: HTMLDivElement): number {
  const step = Number(overlay.dataset.step ?? 0);
  return Number.isInteger(step) ? Math.max(0, Math.min(step, onboardingSteps.length - 1)) : 0;
}

function closeOnboardingTutorial(): void {
  document.getElementById('onboarding-overlay')?.classList.add('hidden');
  const result = learningDataStore.setPreference(ONBOARDING_TUTORIAL_SEEN_KEY, true);
  if (!result.ok) {
    console.warn('Failed to save onboarding preference');
  }
}

function getCompendiumOverlay(): HTMLDivElement {
  const existing = document.getElementById('compendium-overlay') as HTMLDivElement | null;
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.id = 'compendium-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div class="compendium-panel" role="dialog" aria-modal="true" aria-label="Word collection">
      <div class="compendium-header">
        <h2>Word Collection</h2>
        <button type="button" class="compendium-close" aria-label="Close">x</button>
      </div>
      <div class="compendium-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCompendium();
  });
  overlay.querySelector<HTMLButtonElement>('.compendium-close')!.addEventListener('click', closeCompendium);
  document.addEventListener('keydown', (event) => {
    if (overlay.classList.contains('hidden')) return;
    if (event.code === 'Escape') closeCompendium();
    if (event.code === 'Tab') trapCompendiumFocus(event, overlay);
  });

  return overlay;
}

function closeCompendium(): void {
  document.getElementById('compendium-overlay')?.classList.add('hidden');
}

function trapOverlayFocus(event: KeyboardEvent, overlay: HTMLElement): void {
  const focusable = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
  if (focusable.length === 0) return;

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trapCompendiumFocus(event: KeyboardEvent, overlay: HTMLElement): void {
  const focusable = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
  if (focusable.length === 0) return;

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function handleCompendiumWordClick(card: HTMLElement, word: string, cefrLevel: string): Promise<void> {
  hideExampleBubbles();
  try {
    await speakPortalText(word, 0.75);
  } catch (error) {
    console.warn('[compendium] word speech failed', error);
  }

  const bubble = document.createElement('div');
  bubble.className = 'compendium-example';
  bubble.textContent = 'Loading example...';
  document.body.appendChild(bubble);
  const positionBubble = () => positionCompendiumExample(card, bubble);
  positionBubble();

  try {
    const example = await getExample(word, cefrLevel);
    bubble.innerHTML = `<strong>${example.sentence}</strong><span>${example.explanation}</span>`;
    positionBubble();
    try {
      await speakPortalText(example.sentence, 0.85);
    } catch (error) {
      console.warn('[compendium] example speech failed', error);
    }
  } catch (error) {
    console.warn('[compendium] example failed', error);
    bubble.textContent = 'Example is unavailable right now.';
    positionBubble();
  }

  const body = document.querySelector<HTMLDivElement>('.compendium-body');
  body?.addEventListener('scroll', positionBubble, { passive: true });
  window.addEventListener('resize', positionBubble);
  setTimeout(() => {
    body?.removeEventListener('scroll', positionBubble);
    window.removeEventListener('resize', positionBubble);
    bubble.remove();
  }, 8000);
}

function hideExampleBubbles(): void {
  document.querySelectorAll('.compendium-example').forEach((node) => node.remove());
}

function positionCompendiumExample(anchor: HTMLElement, bubble: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  const gap = 10;
  const margin = 12;
  const spaceAbove = anchorRect.top - margin;
  const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
  const placeBelow = spaceAbove < bubbleRect.height + gap && spaceBelow > spaceAbove;

  const rawLeft = anchorRect.left + anchorRect.width / 2 - bubbleRect.width / 2;
  const left = Math.max(margin, Math.min(rawLeft, window.innerWidth - bubbleRect.width - margin));
  const top = placeBelow
    ? Math.min(anchorRect.bottom + gap, window.innerHeight - bubbleRect.height - margin)
    : Math.max(margin, anchorRect.top - bubbleRect.height - gap);

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.classList.toggle('below', placeBelow);
  bubble.classList.toggle('above', !placeBelow);
  bubble.style.setProperty('--example-arrow-left', `${anchorRect.left + anchorRect.width / 2 - left}px`);
}

async function getExample(word: string, cefrLevel: string): Promise<ExampleItem> {
  const key = word.toLowerCase();
  const cached = exampleCache.get(key);
  if (cached) return cached;

  const response = await fetch('/api/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, cefrLevel }),
  });
  if (!response.ok) throw new Error(`Example failed: ${response.status}`);

  const example = await response.json() as ExampleItem;
  exampleCache.set(key, example);
  return example;
}

async function speakPortalText(text: string, speed: number): Promise<void> {
  currentAudio?.pause();
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, voice: 'Kiki', speed }),
  });
  if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
  audio.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
  await audio.play();
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
