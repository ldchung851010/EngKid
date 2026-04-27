import { getSvgForWord } from './vocab-svg-map.js';

interface CollectOverlayCallbacks {
  onReplay: () => Promise<void>;
  onPronunciationStart: () => Promise<boolean>;
  onPronunciationStop: () => Promise<{ matched: boolean; transcript: string | null }>;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export class CollectOverlay {
  private root: HTMLDivElement;
  private card: HTMLDivElement;
  private confirmButton: HTMLButtonElement;
  private speakButton: HTMLButtonElement;
  private instructionEl: HTMLDivElement;
  private transcriptEl: HTMLDivElement;
  private errorEl: HTMLDivElement;
  private timeoutId: number | null = null;
  private callbacks: CollectOverlayCallbacks | null = null;
  private isRecording = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'collect-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="collect-card" role="dialog" aria-modal="true" aria-label="Collect word">
        <button class="collect-close" type="button" aria-label="Close">x</button>
        <div class="collect-svg"></div>
        <div class="collect-word"></div>
        <button class="collect-replay" type="button">Listen again</button>
        <div class="collect-instruction">Listen, then say the word.</div>
        <button class="collect-speak" type="button">Hold to say it</button>
        <div class="collect-transcript" aria-live="polite"></div>
        <button class="collect-confirm" type="button" hidden>Got it!</button>
        <div class="collect-error" aria-live="polite"></div>
      </div>
    `;
    this.installStyles();
    document.body.appendChild(this.root);

    this.card = this.root.querySelector('.collect-card')!;
    this.confirmButton = this.root.querySelector('.collect-confirm')!;
    this.speakButton = this.root.querySelector('.collect-speak')!;
    this.instructionEl = this.root.querySelector('.collect-instruction')!;
    this.transcriptEl = this.root.querySelector('.collect-transcript')!;
    this.errorEl = this.root.querySelector('.collect-error')!;

    this.root.querySelector<HTMLButtonElement>('.collect-close')!.addEventListener('click', () => this.close());
    this.root.querySelector<HTMLButtonElement>('.collect-replay')!.addEventListener('click', () => {
      void this.callbacks?.onReplay().catch((error) => this.showError(String(error)));
    });
    this.speakButton.addEventListener('pointerdown', () => {
      void this.startPronunciation();
    });
    this.speakButton.addEventListener('pointerup', () => {
      void this.stopPronunciation();
    });
    this.speakButton.addEventListener('pointerleave', () => {
      void this.stopPronunciation();
    });
    this.confirmButton.addEventListener('click', () => {
      this.confirmButton.disabled = true;
      void this.callbacks?.onConfirm()
        .catch(() => {
          this.confirmButton.disabled = false;
          this.showError('Save failed. Please try again.');
        });
    });
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (!this.root.hidden && event.code === 'Escape') this.close();
    });
  }

  show(word: string, callbacks: CollectOverlayCallbacks): void {
    this.callbacks = callbacks;
    this.errorEl.textContent = '';
    this.instructionEl.textContent = 'Listen, then say the word.';
    this.transcriptEl.textContent = '';
    this.speakButton.hidden = false;
    this.speakButton.disabled = true;
    this.speakButton.textContent = 'Listen first';
    this.isRecording = false;
    this.confirmButton.hidden = true;
    this.confirmButton.disabled = false;
    this.root.querySelector<HTMLDivElement>('.collect-svg')!.innerHTML = getSvgForWord(word);
    this.root.querySelector<HTMLDivElement>('.collect-word')!.textContent = word;
    this.root.hidden = false;
    this.card.classList.remove('collected');
    window.clearTimeout(this.timeoutId ?? undefined);
    this.timeoutId = window.setTimeout(() => this.close(), 60_000);
  }

  revealConfirm(): void {
    this.speakButton.disabled = false;
    this.speakButton.textContent = 'Hold to say it';
    this.instructionEl.textContent = 'Now say the word clearly.';
  }

  markCollected(): void {
    this.card.classList.add('collected');
  }

  hide(): void {
    window.clearTimeout(this.timeoutId ?? undefined);
    this.timeoutId = null;
    this.root.hidden = true;
    this.callbacks = null;
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }

  private close(): void {
    const onClose = this.callbacks?.onClose;
    this.hide();
    onClose?.();
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
  }

  private async startPronunciation(): Promise<void> {
    if (this.isRecording || !this.callbacks || this.speakButton.disabled) return;
    this.errorEl.textContent = '';
    this.transcriptEl.textContent = '';
    this.speakButton.textContent = 'Listening...';

    try {
      const started = await this.callbacks.onPronunciationStart();
      if (!started) {
        this.speakButton.textContent = 'Hold to say it';
        this.showError('Microphone is busy. Try again.');
        return;
      }
      this.isRecording = true;
      this.speakButton.classList.add('recording');
      this.instructionEl.textContent = 'Release when you finish.';
    } catch {
      this.speakButton.textContent = 'Hold to say it';
      this.showError('Microphone is not available.');
    }
  }

  private async stopPronunciation(): Promise<void> {
    if (!this.isRecording || !this.callbacks) return;
    this.isRecording = false;
    this.speakButton.classList.remove('recording');
    this.speakButton.disabled = true;
    this.speakButton.textContent = 'Checking...';

    try {
      const result = await this.callbacks.onPronunciationStop();
      const transcript = result.transcript?.trim() ?? '';
      this.transcriptEl.textContent = transcript ? `Heard: "${transcript}"` : '';
      if (result.matched) {
        this.instructionEl.textContent = 'Nice reading!';
        this.speakButton.hidden = true;
        this.confirmButton.hidden = false;
      } else {
        this.instructionEl.textContent = 'Try saying the word again.';
        this.showError(transcript ? 'That did not match the word.' : 'I did not catch that.');
        this.speakButton.disabled = false;
        this.speakButton.textContent = 'Hold to try again';
      }
    } catch {
      this.showError('Could not check your voice. Try again.');
      this.speakButton.disabled = false;
      this.speakButton.textContent = 'Hold to try again';
    }
  }

  private installStyles(): void {
    if (document.getElementById('collect-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'collect-overlay-styles';
    style.textContent = `
      #collect-overlay {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: grid;
        place-items: center;
        background: rgba(15, 23, 42, 0.58);
        backdrop-filter: blur(8px);
      }
      #collect-overlay[hidden] { display: none; }
      .collect-card {
        width: min(380px, calc(100vw - 32px));
        min-height: 340px;
        display: grid;
        justify-items: center;
        gap: 16px;
        padding: 28px 24px 24px;
        border-radius: 20px;
        background: #fffaf0;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35);
        position: relative;
        animation: collect-pop 220ms ease-out;
      }
      .collect-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #fee2e2;
        color: #7f1d1d;
        font-weight: 800;
        cursor: pointer;
      }
      .collect-svg svg {
        width: min(38vh, 150px);
        height: min(38vh, 150px);
        filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.22));
      }
      .collect-word {
        font-size: 28px;
        font-weight: 800;
        color: #1f2937;
      }
      .collect-replay,
      .collect-speak,
      .collect-confirm {
        border: 0;
        min-width: 148px;
        padding: 12px 18px;
        border-radius: 999px;
        font-weight: 800;
        cursor: pointer;
        color: #111827;
      }
      .collect-replay { background: #dbeafe; }
      .collect-speak { background: #fde68a; }
      .collect-speak.recording {
        background: #fecaca;
        color: #7f1d1d;
        transform: scale(1.04);
      }
      .collect-speak:disabled { opacity: 0.65; cursor: wait; }
      .collect-confirm { background: #bbf7d0; }
      .collect-confirm:disabled { opacity: 0.65; cursor: wait; }
      .collect-instruction {
        color: #374151;
        font-size: 15px;
        font-weight: 800;
      }
      .collect-transcript {
        min-height: 20px;
        color: #2563eb;
        font-size: 14px;
        font-weight: 800;
      }
      .collect-error {
        min-height: 20px;
        color: #b91c1c;
        font-size: 14px;
        font-weight: 700;
      }
      .collect-card.collected { animation: collect-done 420ms ease-in-out; }
      @keyframes collect-pop {
        from { opacity: 0; transform: translateY(12px) scale(0.94); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes collect-done {
        0% { transform: scale(1); }
        45% { transform: scale(1.08) rotate(1deg); }
        100% { transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .collect-card,
        .collect-card.collected { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }
}
