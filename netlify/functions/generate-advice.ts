import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

/**
 * Netlify Serverless Function: generate-advice
 *
 * WHY A SERVERLESS FUNCTION?
 * The Anthropic API requires an API key. If we include this key in the
 * frontend code, anyone could extract it from the browser's network tab.
 * By using a serverless function, the API key stays on the server and
 * is never exposed to the client.
 *
 * HOW IT WORKS:
 * 1. Frontend calls /.netlify/functions/generate-advice
 * 2. This function reads ANTHROPIC_API_KEY from environment variables
 * 3. Calls the Anthropic API with the key
 * 4. Returns the response to the frontend
 *
 * ENVIRONMENT VARIABLES:
 * Set ANTHROPIC_API_KEY in Netlify Dashboard → Site Settings → Environment Variables
 */

// ─── Types ───

interface RequestBody {
  plantType: string;
  species: string;
  location: string;
  season: string;
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// ─── Constants ───

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 500;
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `Eres un experto en jardinería. Respondes SOLO con JSON puro (sin markdown, sin \`\`\`, sin texto extra).

Tu respuesta debe ser EXACTAMENTE un objeto JSON con estas 4 claves y ninguna más:

{"advice":"texto en español con consejos de riego en 2-3 líneas","frequency_days":7,"best_time":"mañana","amount":"moderada"}

Reglas para cada campo:
- "advice": string en español, 2-3 líneas con consejos prácticos de riego específicos para la planta y ubicación
- "frequency_days": número entero entre 1 y 30 (cada cuántos días regar)
- "best_time": SOLO uno de estos 3 valores exactos: "mañana", "tarde", "noche"
- "amount": SOLO uno de estos 3 valores exactos: "poca", "moderada", "abundante"

IMPORTANTE: No inventes otros campos. No uses markdown. Solo JSON puro con esas 4 claves.`;

// ─── Helper Functions ───

function createResponse(statusCode: number, body: object): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// ─── Main Handler ───

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return createResponse(405, { error: 'Method not allowed' });
  }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('[generate-advice] ANTHROPIC_API_KEY not configured');
    return createResponse(500, {
      error: 'API key not configured on server',
    });
  }

  // Parse request body
  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON in request body' });
  }

  // Validate required fields
  const { plantType, species, location, season } = body;
  if (!plantType || !species || !location || !season) {
    return createResponse(400, {
      error: 'Missing required fields: plantType, species, location, season',
    });
  }

  // Build the user message
  const userMessage = `Dame consejos de riego para:
- Tipo: ${plantType}
- Especie: ${species}
- Ubicación: ${location}
- Estación actual: ${season}`;

  // Call Anthropic API
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-advice] Anthropic API error:', response.status, errorText);

      if (response.status === 401) {
        return createResponse(500, { error: 'Invalid API key on server' });
      }
      if (response.status === 429) {
        return createResponse(429, { error: 'Rate limit exceeded' });
      }

      return createResponse(response.status, {
        error: `Anthropic API error: ${response.status}`,
      });
    }

    const data: AnthropicResponse = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    if (!rawText) {
      return createResponse(500, { error: 'Empty response from AI' });
    }

    // Parse the JSON response from Claude
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return createResponse(500, { error: 'Invalid JSON from AI' });
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validate and normalize the response
    const advice = typeof parsed.advice === 'string' ? parsed.advice : '';
    const rawFrequency = parsed.frequency_days;
    const frequencyDays =
      typeof rawFrequency === 'number'
        ? Math.min(30, Math.max(1, Math.round(rawFrequency)))
        : 7;

    const validTimes = ['mañana', 'tarde', 'noche'];
    const rawTime = parsed.best_time;
    const bestTime =
      typeof rawTime === 'string' && validTimes.includes(rawTime)
        ? rawTime
        : 'mañana';

    const validAmounts = ['poca', 'moderada', 'abundante'];
    const rawAmount = parsed.amount;
    const amount =
      typeof rawAmount === 'string' && validAmounts.includes(rawAmount)
        ? rawAmount
        : 'moderada';

    return createResponse(200, {
      advice,
      frequency_days: frequencyDays,
      best_time: bestTime,
      amount,
    });
  } catch (error) {
    console.error('[generate-advice] Error:', error);
    return createResponse(500, {
      error: 'Failed to generate advice',
    });
  }
};

export { handler };
