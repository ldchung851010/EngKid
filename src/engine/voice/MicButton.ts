/**
 * Mic Button — Push-to-Talk UI component.
 * Renders a floating mic button with hint bubbles (R19).
 */

import { SpeechPipeline } from './SpeechPipeline.js';

export class MicButton {
  private button: HTMLElement;
  private label: HTMLElement;
  private hintsContainer: HTMLElement;
  private container: HTMLElement;

  private pipeline: SpeechPipeline;
  private onTranscript: (text: string) => void;
  private isRecording = false;

  constructor(
    container: HTMLElement,
    pipeline: SpeechPipeline,
    onTranscript: (text: string) => void
  ) {
    this.container = container;
    this.pipeline = pipeline;
    this.onTranscript = onTranscript;

    // Get existing DOM elements from index.html
    this.button = container.querySelector('#mic-button')!;
    this.label = container.querySelector('#mic-label')!;
    this.hintsContainer = container.querySelector('#hint-bubbles')!;

    this.button.addEventListener('pointerdown', () => this.onPress());
    this.button.addEventListener('pointerup', () => this.onRelease());
    this.button.addEventListener('pointerleave', () => this.onRelease());

    // Keyboard: hold Q = push-to-talk
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' && !e.repeat) this.onPress();
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'KeyQ') this.onRelease();
    });
  }

  /** Show the mic button */
  show(): void {
    this.container.style.display = 'flex';
  }

  /** Hide the mic button */
  hide(): void {
    this.container.style.display = 'none';
  }

  /** Update hint bubbles from scene config */
  setHints(hints: string[]): void {
    this.hintsContainer.innerHTML = '';
    for (const hint of hints.slice(0, 4)) {
      const bubble = document.createElement('div');
      bubble.className = 'hint-bubble';
      bubble.textContent = hint;
      // Click a bubble to populate the prompt for reading
      bubble.addEventListener('click', () => {
        // Visual feedback only — child reads the example
        bubble.style.background = '#c8e6c9';
        setTimeout(() => { bubble.style.background = ''; }, 600);
      });
      this.hintsContainer.appendChild(bubble);
    }
  }

  private async onPress(): Promise<void> {
    if (this.isRecording) return;
    this.isRecording = true;

    this.button.classList.add('recording');
    this.label.textContent = 'Release to send';

    try {
      await this.pipeline.startRecording();
    } catch {
      this.isRecording = false;
      this.button.classList.remove('recording');
      this.label.textContent = 'Mic not allowed';
      setTimeout(() => {
        this.label.textContent = 'Hold to speak';
      }, 2000);
    }
  }

  private async onRelease(): Promise<void> {
    if (!this.isRecording) return;
    this.isRecording = false;

    this.button.classList.remove('recording');
    this.button.classList.add('processing');
    this.label.textContent = 'Listening...';

    try {
      const transcript = await this.pipeline.stopRecording();

      if (transcript === null) {
        // Too short — prompt to hold longer
        this.label.textContent = 'Hold a bit longer!';
        setTimeout(() => {
          this.label.textContent = 'Hold to speak';
        }, 1500);
      } else if (transcript) {
        this.label.textContent = `You said: "${transcript}"`;
        this.onTranscript(transcript);
        setTimeout(() => {
          this.label.textContent = 'Hold to speak';
        }, 2000);
      } else {
        this.label.textContent = 'Try again';
        setTimeout(() => {
          this.label.textContent = 'Hold to speak';
        }, 1500);
      }
    } catch {
      this.label.textContent = 'Error — try again';
      setTimeout(() => {
        this.label.textContent = 'Hold to speak';
      }, 2000);
    } finally {
      this.button.classList.remove('processing');
    }
  }
}
