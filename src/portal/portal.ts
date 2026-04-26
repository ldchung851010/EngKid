interface SceneInfo {
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  unlocked: boolean;
  completed: boolean;
  score: number;
}

async function loadPortal(): Promise<void> {
  const loading = document.getElementById('portal-loading')!;
  const grid = document.getElementById('cards-grid')!;
  const scoreCount = document.getElementById('star-count')!;
  const owl = document.getElementById('owl')!;
  const bubble = document.getElementById('owl-bubble')!;

  owl.classList.add('owl-blink');

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

      card.innerHTML = `
        <div class="card-cefr">${scene.cefrLevel}</div>
        ${!scene.unlocked ? '<div class="card-lock">🔒</div>' : ''}
        <div class="card-name">${scene.name}</div>
        <div class="card-desc">${scene.description}</div>
        <div class="card-footer">
          <span class="card-score">⭐ ${scene.score}</span>
          <span class="card-badge">${scene.completed ? '✓ Done!' : scene.unlocked ? '▶ Play' : ''}</span>
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

    // Owl status based on progress
    const completedCount = scenes.filter((s) => s.completed).length;
    if (completedCount === scenes.length && scenes.length > 0) {
      showBubble(bubble, 'Amazing! You completed everything! 🌟');
      owl.className = 'owl-idle owl-blink';
    } else if (completedCount > 0) {
      showBubble(bubble, `You finished ${completedCount} scene(s)! Keep going!`);
    } else {
      showBubble(bubble, 'Pick a scene to start learning!');
    }

    setTimeout(() => bubble.classList.add('hidden'), 5000);
  } catch (err) {
    console.error('Portal load failed:', err);
    loading.innerHTML = '<p>Failed to load scenes. Make sure the server is running.</p>';
  }
}

function showBubble(bubble: HTMLElement, text: string): void {
  bubble.textContent = text;
  bubble.classList.remove('hidden');
}

// Simple tree: stacked blocks, one per 50 points
function updateTree(totalScore: number): void {
  const svg = document.getElementById('tree-svg')!;
  const layers = Math.min(10, Math.floor(totalScore / 50));
  let html = '';
  const colors = ['#a5d6a7', '#66bb6a', '#43a047', '#2e7d32', '#1b5e20',
                  '#ffd54f', '#ffb300', '#ff8f00', '#ff6f00', '#e65100'];

  for (let i = 0; i < 10; i++) {
    const y = 240 - (i + 1) * 22;
    const w = 40 + i * 6;
    const x = 60 - w / 2;
    const visible = i < layers;
    html += `<rect x="${x}" y="${y}" width="${w}" height="20" rx="3"
      fill="${colors[i]}" opacity="${visible ? 1 : 0.15}"
      style="transition: opacity 0.5s ${i * 0.1}s ease-out;"
    />`;
  }

  // Trunk
  html += `<rect x="54" y="242" width="12" height="30" rx="2" fill="#795548" />`;

  // Star on top if full
  if (layers >= 10) {
    const topY = 240 - 10 * 22 - 10;
    html += `<text x="60" y="${topY}" text-anchor="middle" font-size="20">🌟</text>`;
  }

  svg.innerHTML = html;
}

loadPortal();
