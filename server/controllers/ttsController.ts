import { GoogleGenAI } from '@google/genai';
import type { Request, Response } from 'express';

const MAX_CACHE_ENTRIES = 100;
const audioCache = new Map<string, { audioBase64: string; mimeType: string }>();
let quotaCooldownUntil = 0;

let sharedAi: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!sharedAi) {
    sharedAi = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedAi;
}

function formatTtsError(err: unknown): {
  statusCode: number;
  code: string;
  error: string;
  amError: string;
} {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.toLowerCase().includes('quota')) {
    return {
      statusCode: 429,
      code: 'QUOTA_EXHAUSTED',
      error:
        'Voice synthesis daily quota limit reached. Alert chimes remain active; upgrade your API key in Settings > Secrets for higher TTS quota.',
      amError:
        'የAI ድምጽ አገልግሎት የቀን ኮታ ተጠናቋል። ማሳወቂያዎች በደወል (Chime) ይቀጥላሉ፤ ላልተገደበ ድምጽ Settings > Secrets ውስጥ የክፍያ ቁልፍ ይምረጡ።',
    };
  }

  if (
    raw.includes('400') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('403') ||
    raw.includes('PERMISSION_DENIED')
  ) {
    return {
      statusCode: raw.includes('403') || raw.includes('PERMISSION_DENIED') ? 403 : 400,
      code: 'API_KEY_ERROR',
      error: 'Voice API key is invalid or unauthorized. Please check Settings > Secrets.',
      amError: 'የድምጽ API ቁልፍ ልክ አይደለም። እባክዎ Settings > Secrets ውስጥ ያረጋግጡ።',
    };
  }

  // Extract nested JSON error.message if present, never dump raw JSON to UI
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return {
        statusCode: 502,
        code: 'TTS_UNAVAILABLE',
        error: parsed.error.message.slice(0, 180),
        amError: 'የድምጽ አገልግሎት ለጊዜው አልተገኘም፤ የማሳወቂያ ደወል እየሰራ ነው።',
      };
    }
  } catch {
    // Non-JSON error message
  }

  return {
    statusCode: 502,
    code: 'TTS_UNAVAILABLE',
    error: 'Voice synthesis is temporarily unavailable. Alert chimes remain active.',
    amError: 'የድምጽ አገልግሎት ለጊዜው አልተገኘም፤ የማሳወቂያ ደወል እየሰራ ነው።',
  };
}

function normalizeTextForSpeech(rawText: string, language: 'am' | 'en'): string {
  let cleaned = rawText
    .replace(/[·|•]/g, '፣ ')
    .replace(/\s+/g, ' ')
    .trim();

  if (language === 'am') {
    cleaned = cleaned
      .replace(/\bETB\b/gi, 'ብር')
      .replace(/%/g, ' በመቶ')
      .replace(/\bF&B\b/gi, 'ምግብ እና መጠጥ')
      .replace(/\bPending\b/gi, 'በመጠባበቅ ላይ')
      .replace(/\bPreparing\b/gi, 'በዝግጅት ላይ')
      .replace(/\bServed\b/gi, 'ቀርቧል')
      .replace(/\bClean\b/gi, 'ንጹህ')
      .replace(/\bDirty\b/gi, 'ቆሻሻ')
      .replace(/\bInspecting\b/gi, 'በምርመራ ላይ')
      .replace(/\bResolved\b/gi, 'ተጠናቋል')
      .replace(/\bIn Progress\b/gi, 'በመሰራት ላይ')
      .replace(/\bAvailable\b/gi, 'ዝግጁ')
      .replace(/\bOut of Order\b/gi, 'ከአገልግሎት ውጭ')
      .replace(/\bStandard\b/gi, 'ስታንዳርድ')
      .replace(/\bDeluxe\b/gi, 'ዴላክስ')
      .replace(/\bExecutive Suite\b/gi, 'ኤግዚኩቲቭ ስዊት')
      .replace(/\bDine-In\b/gi, 'በሆቴል መመገቢያ')
      .replace(/\bBar Counter\b/gi, 'ባር')
      .replace(/\bRoom Service\b/gi, 'የክፍል አገልግሎት')
      .replace(/\bCash\b/gi, 'ካሽ')
      .replace(/\bTelebirr\b/gi, 'ቴሌብር')
      .replace(/\bBank Transfer\b/gi, 'የባንክ ዝውውር')
      .replace(/\bPOS Card\b/gi, 'POS ካርድ')
      .replace(/\bmanager\b/gi, 'ማናጀር')
      .replace(/\bhousekeeping\b/gi, 'ሃውስ ኪፒንግ')
      .replace(/\bmaintenance\b/gi, 'ሚንተናስ')
      .replace(/\breception\b/gi, 'ሪሴፕሽን')
      .replace(/\bstaff\b/gi, 'ሰራተኞች')
      .replace(/\bCheck-In\b/gi, 'እንግዳ መግቢያ')
      .replace(/\bCheck-Out\b/gi, 'እንግዳ መውጫ')
      .replace(/\bRoom\b/gi, 'ክፍል');
  } else {
    cleaned = cleaned.replace(/\bETB\b/gi, 'Birr');
  }

  return cleaned.slice(0, 500);
}

function setCachedAudio(key: string, value: { audioBase64: string; mimeType: string }): void {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) audioCache.delete(oldestKey);
  }
  audioCache.set(key, value);
}

async function generateWithRetry(
  ai: GoogleGenAI,
  text: string,
  language: 'am' | 'en'
): Promise<{ audioBase64: string; mimeType: string }> {
  const stylePrompt =
    language === 'am'
      ? 'Native Ethiopian Amharic (am-ET) female hospitality voice announcer. Pronounce every Amharic Ge-ez word naturally, clearly, and fluently in authentic Ethiopian Amharic at a calm pace.'
      : 'Clear, warm English hospitality operations announcer at a calm, steady pace.';

  const voiceName = language === 'am' ? 'Kore' : 'Kore';

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (!audioBase64) {
        throw new Error('Gemini TTS did not return audio data.');
      }

      return { audioBase64, mimeType };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Do not retry daily quota exhaustion (429 RESOURCE_EXHAUSTED); only retry transient 500/503
      const retryable = msg.includes('503') || msg.includes('500');
      if (!retryable || attempt === 1) {
        break;
      }
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Failed to synthesize speech.');
}

export async function generateSpeechAudio(req: Request, res: Response): Promise<void> {
  const { text, language } = req.body as {
    text?: string;
    language?: 'am' | 'en';
  };

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Text to speak is required.' });
    return;
  }

  const targetLang: 'am' | 'en' = language === 'am' ? 'am' : 'en';
  const normalized = normalizeTextForSpeech(text, targetLang);
  if (!normalized) {
    res.status(400).json({ error: 'Text to speak cannot be empty.' });
    return;
  }

  const cacheKey = `${targetLang}:${normalized}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  if (Date.now() < quotaCooldownUntil) {
    const formatted = formatTtsError('429 RESOURCE_EXHAUSTED');
    res.status(429).json({
      code: formatted.code,
      error: formatted.error,
      amError: formatted.amError,
    });
    return;
  }

  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      code: 'API_KEY_MISSING',
      error: 'GEMINI_API_KEY is not configured in Settings > Secrets for server-side voice synthesis.',
      amError: 'የGemini ድምጽ ቁልፍ በSettings > Secrets ውስጥ አልተዋቀረም፤ የማሳወቂያ ደወል እየሰራ ነው።',
    });
    return;
  }

  try {
    const result = await generateWithRetry(ai, normalized, targetLang);
    setCachedAudio(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (err) {
    const formatted = formatTtsError(err);
    if (formatted.statusCode === 429) {
      quotaCooldownUntil = Date.now() + 60 * 1000;
    }
    res.status(formatted.statusCode).json({
      code: formatted.code,
      error: formatted.error,
      amError: formatted.amError,
    });
  }
}
