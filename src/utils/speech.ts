import type { Language } from './i18n';

let sharedAudioCtx: AudioContext | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;
let activeAbortController: AbortController | null = null;

const MAX_CLIENT_CACHE = 40;
const clientAudioCache = new Map<string, { audioBase64: string; mimeType: string }>();
let clientTtsCooldownUntil = 0;

function sanitizeSpeechError(raw: string | undefined, language: Language): string {
  const fallback =
    language === 'am'
      ? 'የAI ድምጽ አገልግሎት የቀን ኮታ ተጠናቋል። ማሳወቂያዎች በደወል ይቀጥላሉ።'
      : 'Voice synthesis quota reached. Alert chimes remain active.';
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.includes('RESOURCE_EXHAUSTED') || trimmed.includes('429')) {
    return fallback;
  }
  return trimmed.slice(0, 220);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playAlertChime(tone: 'info' | 'success' | 'warning' = 'info'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs =
    tone === 'warning'
      ? [660, 520]
      : tone === 'success'
        ? [523.25, 659.25, 783.99]
        : [587.33, 783.99];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.09);

    gain.gain.setValueAtTime(0.001, now + idx * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.07, now + idx * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.09);
    osc.stop(now + idx * 0.09 + 0.24);
  });
}

/**
 * Crisp mobile SMS-style incoming text ping (zero speech/TTS API calls).
 */
export function playMobileSmsChime(tone: 'info' | 'success' | 'warning' = 'info'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes =
    tone === 'warning'
      ? [880, 698.46, 880]
      : tone === 'success'
        ? [1046.5, 1318.51]
        : [987.77, 1318.51];

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.11;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  });
}

export function triggerMobileHaptic(tone: 'info' | 'success' | 'warning' = 'info'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(tone === 'warning' ? [120, 60, 120] : [70, 40, 70]);
  } catch {
    // Ignore unsupported vibration calls
  }
}

export function sendOsTextNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (window.Notification.permission === 'granted') {
      new window.Notification(title, { body, tag: 'kal-tekno-sms' });
    }
  } catch {
    // Ignore iframe Notification restrictions
  }
}

export function stopVoiceAlert(): void {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.src = '';
    } catch {
      // Ignore cleanup errors
    }
    currentAudioElement = null;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore Web Speech cancellation errors
    }
  }
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
  return URL.createObjectURL(blob);
}

async function playBase64Clip(audioBase64: string, mimeType: string): Promise<void> {
  const url = base64ToBlobUrl(audioBase64, mimeType);
  currentBlobUrl = url;
  const audio = new Audio(url);
  audio.volume = 0.96;
  currentAudioElement = audio;

  const cleanup = () => {
    if (currentBlobUrl === url) {
      URL.revokeObjectURL(url);
      currentBlobUrl = null;
    }
    if (currentAudioElement === audio) {
      currentAudioElement = null;
    }
  };

  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  await audio.play();
}

function speakWithNativeDeviceVoiceOnly(message: string, language: Language): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    const voices = window.speechSynthesis.getVoices();
    if (language === 'am') {
      // Only speak Amharic via browser if a genuine Amharic voice exists; NEVER fall back to English for Ge'ez text
      const amVoice = voices.find((v) => v.lang.toLowerCase().startsWith('am'));
      if (!amVoice) {
        return false;
      }
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.voice = amVoice;
      utterance.lang = amVoice.lang;
      utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
      return true;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    if (enVoice) utterance.voice = enVoice;
    utterance.lang = 'en-US';
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export async function speakVoiceAlert(
  message: string,
  language: Language,
  tone: 'info' | 'success' | 'warning' = 'info',
  onSpeechError?: (errorMessage: string, code?: string) => void
): Promise<void> {
  if (typeof window === 'undefined') return;

  stopVoiceAlert();
  playAlertChime(tone);

  const trimmed = message.trim();
  if (!trimmed) return;

  const cacheKey = `${language}:${trimmed}`;
  const cached = clientAudioCache.get(cacheKey);
  if (cached) {
    try {
      await playBase64Clip(cached.audioBase64, cached.mimeType);
      return;
    } catch {
      // Proceed to re-fetch if cached playback fails
    }
  }

  if (Date.now() < clientTtsCooldownUntil) {
    speakWithNativeDeviceVoiceOnly(trimmed, language);
    return;
  }

  const controller = new AbortController();
  activeAbortController = controller;

  try {
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, language }),
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    const payload = (await res.json()) as {
      audioBase64?: string;
      mimeType?: string;
      error?: string;
      amError?: string;
      code?: string;
    };

    if (!res.ok || !payload.audioBase64) {
      if (res.status === 429 || payload.code === 'QUOTA_EXHAUSTED') {
        clientTtsCooldownUntil = Date.now() + 2 * 60 * 1000;
      }
      const spokeLocally = speakWithNativeDeviceVoiceOnly(trimmed, language);
      if (!spokeLocally && onSpeechError) {
        const localizedMsg =
          language === 'am'
            ? payload.amError || sanitizeSpeechError(payload.error, 'am')
            : sanitizeSpeechError(payload.error, 'en');
        onSpeechError(localizedMsg, payload.code);
      }
      return;
    }

    if (clientAudioCache.size >= MAX_CLIENT_CACHE) {
      const oldest = clientAudioCache.keys().next().value;
      if (oldest) clientAudioCache.delete(oldest);
    }
    clientAudioCache.set(cacheKey, {
      audioBase64: payload.audioBase64,
      mimeType: payload.mimeType || 'audio/wav',
    });

    if (!controller.signal.aborted) {
      await playBase64Clip(payload.audioBase64, payload.mimeType || 'audio/wav');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    const spokeLocally = speakWithNativeDeviceVoiceOnly(trimmed, language);
    if (!spokeLocally && onSpeechError) {
      const msg = err instanceof Error ? err.message : undefined;
      onSpeechError(sanitizeSpeechError(msg, language));
    }
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
  }
}
