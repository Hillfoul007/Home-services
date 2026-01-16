/**
 * Sound Notification Service
 * Manages audio notifications for system alerts and new orders
 */

export interface SoundNotificationSettings {
  enabled: boolean;
  volume: number; // 0-100
  soundType: 'beep' | 'bell' | 'chime';
}

const DEFAULT_SETTINGS: SoundNotificationSettings = {
  enabled: true,
  volume: 70,
  soundType: 'beep'
};

const STORAGE_KEY = 'soundNotificationSettings';

export class SoundNotificationService {
  private static instance: SoundNotificationService;
  private settings: SoundNotificationSettings;
  private audioContext: AudioContext | null = null;

  public static getInstance(): SoundNotificationService {
    if (!SoundNotificationService.instance) {
      SoundNotificationService.instance = new SoundNotificationService();
    }
    return SoundNotificationService.instance;
  }

  constructor() {
    this.settings = this.loadSettings();
    this.initAudioContext();
  }

  private loadSettings(): SoundNotificationSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save sound notification settings:', error);
    }
  }

  private initAudioContext(): void {
    if (typeof window !== 'undefined' && !this.audioContext) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
        }
      } catch (error) {
        console.warn('AudioContext not available:', error);
      }
    }
  }

  /**
   * Play a beep sound
   */
  async playBeep(frequency: number = 800, duration: number = 200): Promise<void> {
    if (!this.settings.enabled || !this.audioContext) {
      return;
    }

    try {
      const context = this.audioContext;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      const volume = this.settings.volume / 100;
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

      oscillator.start(now);
      oscillator.stop(now + duration / 1000);
    } catch (error) {
      console.warn('Failed to play beep:', error);
    }
  }

  /**
   * Play notification sound based on selected type
   */
  async playNotification(): Promise<void> {
    if (!this.settings.enabled) {
      return;
    }

    switch (this.settings.soundType) {
      case 'beep':
        await this.playBeep(800, 200);
        break;
      case 'bell':
        await this.playBell();
        break;
      case 'chime':
        await this.playChime();
        break;
    }
  }

  /**
   * Play bell sound
   */
  private async playBell(): Promise<void> {
    if (!this.audioContext) return;

    try {
      const context = this.audioContext;
      const now = context.currentTime;
      const duration = 0.3;

      // Create a bell-like sound with multiple frequencies
      const frequencies = [800, 1200, 1600];
      for (const freq of frequencies) {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const volume = this.settings.volume / 100 / frequencies.length;
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
      }
    } catch (error) {
      console.warn('Failed to play bell:', error);
    }
  }

  /**
   * Play chime sound
   */
  private async playChime(): Promise<void> {
    if (!this.audioContext) return;

    try {
      const context = this.audioContext;
      const now = context.currentTime;
      const duration = 0.2;

      // Play ascending chime tones
      const frequencies = [1047, 1319, 1568]; // C, E, G notes
      for (let i = 0; i < frequencies.length; i++) {
        const startTime = now + (i * 0.1);
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.frequency.value = frequencies[i];
        oscillator.type = 'sine';

        const volume = this.settings.volume / 100;
        gainNode.gain.setValueAtTime(volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      }
    } catch (error) {
      console.warn('Failed to play chime:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): SoundNotificationSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<SoundNotificationSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();
  }

  /**
   * Toggle sound notifications
   */
  toggleEnabled(enabled: boolean): void {
    this.updateSettings({ enabled });
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.updateSettings({ volume: clampedVolume });
  }

  /**
   * Set sound type
   */
  setSoundType(soundType: 'beep' | 'bell' | 'chime'): void {
    this.updateSettings({ soundType });
  }

  /**
   * Resume audio context if needed
   */
  resumeAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.warn('Failed to resume audio context:', err);
      });
    }
  }
}

export const soundNotificationService = SoundNotificationService.getInstance();
