import type { WateringAdvice } from '@/types';
import { getCurrentSeason } from '@/utils/seasons';

/**
 * Claude API service for generating AI watering advice.
 *
 * HOW THIS WORKS:
 * 1. We build a prompt with the plant info + user location + season
 * 2. We send it to Claude via Anthropic's Messages API
 * 3. Claude responds with a JSON object containing advice
 * 4. We parse and validate the response
 *
 * PRODUCTION vs DEVELOPMENT:
 * - In PRODUCTION: We call /.netlify/functions/generate-advice
 *   The serverless function has the API key stored securely on the server.
 *   The API key is NEVER exposed to the browser.
 *
 * - In DEVELOPMENT: We call /api/anthropic/... through Vite's proxy
 *   The key is in .env.local (not committed to git).
 *
 * WHY SERVERLESS FUNCTION?
 * The browser can't safely store API keys — anyone could extract them
 * from the network tab. By using a serverless function, the key stays
 * on the server and is never sent to the client.
 *
 * ANTHROPIC MESSAGES API:
 * - Endpoint: /v1/messages
 * - Method: POST
 * - Required headers: x-api-key, anthropic-version, content-type
 * - Body: model name, max_tokens, system prompt, messages array
 * - Response: { content: [{ type: "text", text: "..." }] }
 */

// ─── Types ───

/** Parameters needed to generate watering advice */
export interface AdviceParams {
  plantType: string;       // e.g., "Suculenta"
  species: string;         // e.g., "Echeveria elegans"
  country: string;         // e.g., "España"
  city?: string;           // e.g., "Valencia" (optional)
}

/** Shape of the Anthropic Messages API response (used in development) */
interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/** Shape of the serverless function response (used in production) */
interface ServerlessFunctionResponse {
  advice: string;
  frequency_days: number;
  best_time: string;
  amount: string;
  error?: string;
}

// ─── Constants ───

/**
 * Detect if we're running in production mode.
 * Vite sets import.meta.env.PROD to true when running `npm run build`.
 */
const IS_PRODUCTION: boolean = import.meta.env.PROD;

/** API URLs for different environments */
const PRODUCTION_API_URL = '/.netlify/functions/generate-advice';
const DEVELOPMENT_API_URL = '/api/anthropic/v1/messages';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 500;
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * System prompt that tells Claude HOW to respond.
 *
 * PROMPT ENGINEERING TIPS:
 * - Be specific about the output format (JSON only, no markdown)
 * - Define the exact structure you expect
 * - Give constraints (frequency_days between 1-30)
 * - Set the role ("experto en jardinería")
 *
 * NOTE: In production, this prompt is duplicated in the serverless function.
 * Keep them in sync!
 */
const SYSTEM_PROMPT = `Eres un experto en jardinería. Respondes SOLO con JSON puro (sin markdown, sin \`\`\`, sin texto extra).

Tu respuesta debe ser EXACTAMENTE un objeto JSON con estas 4 claves y ninguna más:

{"advice":"texto en español con consejos de riego en 2-3 líneas","frequency_days":7,"best_time":"mañana","amount":"moderada"}

Reglas para cada campo:
- "advice": string en español, 2-3 líneas con consejos prácticos de riego específicos para la planta y ubicación
- "frequency_days": número entero entre 1 y 30 (cada cuántos días regar)
- "best_time": SOLO uno de estos 3 valores exactos: "mañana", "tarde", "noche"
- "amount": SOLO uno de estos 3 valores exactos: "poca", "moderada", "abundante"

IMPORTANTE: No inventes otros campos. No uses markdown. Solo JSON puro con esas 4 claves.`;

// ─── Main Function ───

/**
 * Generate personalized watering advice using Claude AI.
 *
 * @param params - Plant type, species, country, and optional city
 * @returns Parsed and validated watering advice
 * @throws Error with a user-friendly Spanish message
 */
export async function generateWateringAdvice(
  params: AdviceParams,
): Promise<WateringAdvice> {
  // Route to the appropriate implementation based on environment
  if (IS_PRODUCTION) {
    return generateAdviceProduction(params);
  }
  return generateAdviceDevelopment(params);
}

// ─── Production Implementation ───

/**
 * Production: Call the Netlify serverless function.
 *
 * The serverless function has the API key stored securely on the server.
 * We just send the plant parameters and receive the parsed advice back.
 */
async function generateAdviceProduction(
  params: AdviceParams,
): Promise<WateringAdvice> {
  // Determine the current season based on user's country
  const season: string = getCurrentSeason(params.country);

  // Build the location string for the prompt
  const location: string = params.city
    ? `${params.city}, ${params.country}`
    : params.country;

  // Call the serverless function
  const response = await fetch(PRODUCTION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plantType: params.plantType,
      species: params.species,
      location,
      season,
    }),
  });

  // ─── Error Handling ───

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Demasiadas peticiones. Espera un momento e intenta de nuevo');
    }
    if (response.status === 500) {
      // Try to get error message from response
      try {
        const errorData = await response.json() as { error?: string };
        if (errorData.error) {
          throw new Error(errorData.error);
        }
      } catch {
        // Ignore JSON parse errors, fall through to generic error
      }
      throw new Error('El servicio de IA no está disponible. Intenta más tarde');
    }
    throw new Error(`Error del servidor (${response.status}). Intenta más tarde`);
  }

  // ─── Parse Response ───

  const data: ServerlessFunctionResponse = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  // The serverless function already returns parsed data, just validate and convert
  const validTimes = ['mañana', 'tarde', 'noche'] as const;
  const validAmounts = ['poca', 'moderada', 'abundante'] as const;

  const bestTime: WateringAdvice['bestTime'] =
    validTimes.includes(data.best_time as WateringAdvice['bestTime'])
      ? (data.best_time as WateringAdvice['bestTime'])
      : 'mañana';

  const amount: WateringAdvice['amount'] =
    validAmounts.includes(data.amount as WateringAdvice['amount'])
      ? (data.amount as WateringAdvice['amount'])
      : 'moderada';

  return {
    advice: data.advice || '',
    frequencyDays: data.frequency_days || 7,
    bestTime,
    amount,
  };
}

// ─── Development Implementation ───

/**
 * Development: Call the Anthropic API directly through Vite's proxy.
 *
 * This uses the API key from .env.local (not committed to git).
 * The Vite proxy rewrites /api/anthropic/* to https://api.anthropic.com/*
 */
async function generateAdviceDevelopment(
  params: AdviceParams,
): Promise<WateringAdvice> {
  // Get the API key from environment variables
  const apiKey: string = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';

  if (!apiKey || apiKey === 'sk-ant-tu-key-aqui') {
    throw new Error(
      'API key no configurada. Añade tu key de Anthropic en el archivo .env.local',
    );
  }

  // Determine the current season based on user's country
  const season: string = getCurrentSeason(params.country);

  // Build the location string for the prompt
  const locationText: string = params.city
    ? `${params.city}, ${params.country}`
    : params.country;

  // Build the user message with all context
  const userMessage = `Dame consejos de riego para:
- Tipo: ${params.plantType}
- Especie: ${params.species}
- Ubicación: ${locationText}
- Estación actual: ${season}`;

  // ─── API Call ───

  /**
   * fetch() sends an HTTP request. Here we're calling the Anthropic
   * Messages API through our Vite proxy.
   *
   * The request body follows Anthropic's API format:
   * - model: which Claude model to use
   * - max_tokens: maximum length of the response
   * - system: instructions for how Claude should behave
   * - messages: the conversation (just one user message here)
   */
  const response = await fetch(DEVELOPMENT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  // ─── Error Handling ───

  if (!response.ok) {
    // Different HTTP status codes mean different problems
    if (response.status === 401) {
      throw new Error('API key inválida. Verifica tu key en .env.local');
    }
    if (response.status === 429) {
      throw new Error('Demasiadas peticiones. Espera un momento e intenta de nuevo');
    }
    if (response.status === 500 || response.status === 503) {
      throw new Error('El servicio de IA no está disponible. Intenta más tarde');
    }
    throw new Error(`Error del servidor (${response.status}). Intenta más tarde`);
  }

  // ─── Parse Response ───

  const data: AnthropicResponse = await response.json();

  /**
   * Anthropic's response structure:
   * { content: [{ type: "text", text: "the actual response text" }] }
   *
   * We asked Claude to respond with pure JSON, so content[0].text
   * should be a valid JSON string that we can parse.
   */
  const rawText: string = data.content?.[0]?.text ?? '';

  if (!rawText) {
    throw new Error('La IA no devolvió una respuesta. Intenta de nuevo');
  }

  return parseAdviceResponse(rawText);
}

// ─── Response Parsing ───

/**
 * Parse and validate the raw text from Claude into a WateringAdvice object.
 *
 * WHY SEPARATE FUNCTION?
 * Claude's response might not be perfect JSON (it could include markdown
 * code fences or extra text). This function handles edge cases:
 *   1. Try parsing the raw text directly
 *   2. If that fails, try extracting JSON from markdown code blocks
 *   3. Validate all fields have the expected types
 *
 * DEFENSIVE PROGRAMMING:
 * Even though we asked Claude for specific JSON, AI models can
 * sometimes deviate. We validate every field to prevent crashes.
 */
function parseAdviceResponse(rawText: string): WateringAdvice {
  let parsed: Record<string, unknown>;

  try {
    // First try: parse the raw text directly as JSON
    parsed = JSON.parse(rawText);
  } catch {
    // Second try: maybe Claude wrapped it in markdown code fences
    // like ```json ... ``` — extract the JSON from inside
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('La respuesta de la IA no tiene el formato esperado');
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('No se pudo interpretar la respuesta de la IA');
    }
  }

  // ─── Validation ───

  // Validate advice text
  const advice = typeof parsed.advice === 'string' ? parsed.advice : '';
  if (!advice) {
    throw new Error('La IA no proporcionó consejos de texto');
  }

  // Validate frequency_days (note: API uses snake_case, our interface uses camelCase)
  const rawFrequency = parsed.frequency_days;
  const frequencyDays =
    typeof rawFrequency === 'number'
      ? Math.min(30, Math.max(1, Math.round(rawFrequency)))
      : 7; // Default to weekly if invalid

  // Validate best_time
  const validTimes = ['mañana', 'tarde', 'noche'] as const;
  const rawTime = parsed.best_time;
  const bestTime: WateringAdvice['bestTime'] =
    typeof rawTime === 'string' && validTimes.includes(rawTime as WateringAdvice['bestTime'])
      ? (rawTime as WateringAdvice['bestTime'])
      : 'mañana'; // Default to morning

  // Validate amount
  const validAmounts = ['poca', 'moderada', 'abundante'] as const;
  const rawAmount = parsed.amount;
  const amount: WateringAdvice['amount'] =
    typeof rawAmount === 'string' && validAmounts.includes(rawAmount as WateringAdvice['amount'])
      ? (rawAmount as WateringAdvice['amount'])
      : 'moderada'; // Default to moderate

  return {
    advice,
    frequencyDays,
    bestTime,
    amount,
  };
}

// ─── Fallback Advice ───

/**
 * Hardcoded watering advice as fallback when the API is unavailable.
 *
 * WHY FALLBACKS?
 * The user might not have internet, or their API key might be invalid,
 * or the Anthropic API might be down. Instead of showing an error and
 * leaving the user with nothing, we provide sensible default advice
 * based on the plant type.
 *
 * These values are based on general gardening knowledge and are
 * intentionally conservative (better to underwater than overwater).
 *
 * @param plantType - The plant category (e.g., "Suculenta", "Cactus")
 * @returns Generic watering advice for that plant type
 */
export function getFallbackAdvice(plantType: string): WateringAdvice {
  const fallbacks: Record<string, WateringAdvice> = {
    Suculenta: {
      advice:
        'Las suculentas almacenan agua en sus hojas. Riega solo cuando el sustrato esté completamente seco. Evita mojar las hojas directamente.',
      frequencyDays: 7,
      bestTime: 'mañana',
      amount: 'poca',
    },
    Cactus: {
      advice:
        'Los cactus necesitan muy poca agua. Deja secar el sustrato por completo entre riegos. En invierno reduce la frecuencia a la mitad.',
      frequencyDays: 10,
      bestTime: 'mañana',
      amount: 'poca',
    },
    Hortaliza: {
      advice:
        'Las hortalizas necesitan riego frecuente y constante. Mantén el sustrato húmedo pero no encharcado. Riega en la base, no sobre las hojas.',
      frequencyDays: 2,
      bestTime: 'mañana',
      amount: 'abundante',
    },
    'Hierba aromatica': {
      advice:
        'Las hierbas aromáticas prefieren suelo ligeramente húmedo. No las encharques. Riega cuando la capa superior del sustrato esté seca.',
      frequencyDays: 3,
      bestTime: 'mañana',
      amount: 'moderada',
    },
    'Arbol frutal': {
      advice:
        'Los árboles frutales necesitan riego profundo y espaciado. Riega abundantemente y deja que el suelo se seque parcialmente entre riegos.',
      frequencyDays: 5,
      bestTime: 'mañana',
      amount: 'abundante',
    },
    'Planta de flor': {
      advice:
        'Las plantas con flor necesitan riego regular para mantener la floración. Mantén el sustrato húmedo sin encharcar. Riega en la base.',
      frequencyDays: 3,
      bestTime: 'mañana',
      amount: 'moderada',
    },
    Helecho: {
      advice:
        'Los helechos necesitan humedad constante. Mantén el sustrato siempre ligeramente húmedo y pulveriza las hojas regularmente.',
      frequencyDays: 3,
      bestTime: 'tarde',
      amount: 'moderada',
    },
    Trepadora: {
      advice:
        'Las trepadoras suelen necesitar riego regular. Riega cuando la capa superior del sustrato esté seca. Aumenta en épocas de crecimiento.',
      frequencyDays: 3,
      bestTime: 'mañana',
      amount: 'moderada',
    },
    Arbusto: {
      advice:
        'Los arbustos establecidos son resistentes. Riega profundamente pero con menor frecuencia. Deja secar parcialmente entre riegos.',
      frequencyDays: 4,
      bestTime: 'mañana',
      amount: 'moderada',
    },
  };

  // Return specific fallback or a generic default
  return (
    fallbacks[plantType] ?? {
      advice:
        'Riega cuando la capa superior del sustrato esté seca al tacto. Evita el encharcamiento y asegúrate de que la maceta tenga buen drenaje.',
      frequencyDays: 3,
      bestTime: 'mañana' as const,
      amount: 'moderada' as const,
    }
  );
}
