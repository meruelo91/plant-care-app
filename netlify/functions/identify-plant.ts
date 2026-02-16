import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

/**
 * Netlify Serverless Function: Identify Plant with Claude Vision
 *
 * This function receives a plant image and uses Claude's vision capabilities
 * to identify the plant type and species.
 *
 * WHY SERVERLESS?
 * - The Anthropic API key stays on the server (never exposed to browser)
 * - Vision API calls can be large (base64 images), but serverless handles it
 * - CORS is handled here, not in the browser
 *
 * VISION API:
 * Claude can analyze images when you include them in the messages array
 * with type: "image" and the base64 data. The model "sees" the image
 * and responds based on its content.
 */

// ─── Constants ───

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 200;
const ANTHROPIC_VERSION = '2023-06-01';

// Valid plant types (must match frontend PLANT_TYPES - sorted alphabetically, "Otro" at end)
const VALID_PLANT_TYPES = [
  'Arbol frutal',
  'Arbusto',
  'Cactus',
  'Carnivora',
  'Helecho',
  'Herbacea perenne',
  'Hierba aromatica',
  'Hortaliza',
  'Orquidea',
  'Palmera',
  'Planta de flor',
  'Planta de interior',
  'Suculenta',
  'Trepadora',
  'Otro',
] as const;

// Mapeo inteligente para variaciones comunes de la IA
const TYPE_MAPPINGS: Record<string, string> = {
  // Variaciones de herbácea
  'planta herbacea': 'Herbacea perenne',
  'herbacea': 'Herbacea perenne',
  'perenne': 'Herbacea perenne',
  // Variaciones de planta de interior
  'planta de casa': 'Planta de interior',
  'planta interior': 'Planta de interior',
  'monstera': 'Planta de interior',
  'pothos': 'Planta de interior',
  'ficus': 'Planta de interior',
  'filodendro': 'Planta de interior',
  // Variaciones de orquídea
  'orquídea': 'Orquidea',
  'orchid': 'Orquidea',
  // Variaciones de carnívora
  'carnívora': 'Carnivora',
  'planta carnivora': 'Carnivora',
  'venus': 'Carnivora',
  // Variaciones de árbol
  'arbol': 'Arbol frutal',
  'árbol frutal': 'Arbol frutal',
  // Variaciones comunes
  'suculentas': 'Suculenta',
  'cactáceas': 'Cactus',
  'cacto': 'Cactus',
};

const VALID_CONFIDENCE = ['alta', 'media', 'baja'] as const;

// ─── Types ───

interface IdentifyRequest {
  imageBase64: string; // Base64 data WITHOUT the "data:image/..." prefix
  mediaType: string;   // "image/jpeg", "image/png", "image/webp"
}

interface IdentifyResponse {
  type: string;
  species: string;
  confidence: 'alta' | 'media' | 'baja';
  error?: string;
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// ─── Prompt ───

const IDENTIFICATION_PROMPT = `Analiza esta imagen e identifica la planta.

Debes elegir el TIPO de la siguiente lista (elige el que mejor se ajuste):
- Arbol frutal (limonero, naranjo, manzano)
- Arbusto (lavanda, rosal silvestre)
- Cactus (cualquier cactácea)
- Carnivora (venus atrapamoscas, drosera)
- Helecho (cualquier helecho)
- Herbacea perenne (plantas herbáceas de varios años)
- Hierba aromatica (albahaca, romero, menta, tomillo)
- Hortaliza (tomates, lechugas, pimientos)
- Orquidea (cualquier orquídea)
- Palmera (cualquier palmera)
- Planta de flor (rosas, geranios, petunias, flores ornamentales)
- Planta de interior (monstera, pothos, ficus, filodendro, plantas de casa)
- Suculenta (echeveria, aloe, sedum, crassula)
- Trepadora (hiedra, enredaderas)
- Otro (si ninguno aplica)

Responde ÚNICAMENTE en formato JSON sin markdown ni texto adicional:
{
  "type": "[EXACTAMENTE uno de los tipos de arriba]",
  "species": "nombre científico o común (ej: Monstera deliciosa, Aloe vera)",
  "confidence": "alta | media | baja"
}

IMPORTANTE:
- El campo 'type' DEBE ser EXACTAMENTE uno de la lista, sin variaciones
- Si la imagen NO es de una planta: type="Otro", species="No identificada", confidence="baja"
- confidence="alta" si estás muy seguro
- confidence="media" si tienes dudas razonables
- confidence="baja" si la imagen es borrosa o poco clara`;

// ─── Response Helpers ───

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function errorResponse(statusCode: number, message: string): HandlerResponse {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

function successResponse(data: IdentifyResponse): HandlerResponse {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

// ─── Validation ───

function validatePlantType(type: unknown): string {
  if (typeof type !== 'string') return 'Otro';
  const normalized = type.trim();

  // Check if it's already a valid type
  if (VALID_PLANT_TYPES.includes(normalized as typeof VALID_PLANT_TYPES[number])) {
    return normalized;
  }

  // Try mapping common variations
  const lowerType = normalized.toLowerCase();
  if (TYPE_MAPPINGS[lowerType]) {
    console.log(`[identify-plant] Mapped "${normalized}" to "${TYPE_MAPPINGS[lowerType]}"`);
    return TYPE_MAPPINGS[lowerType];
  }

  // Check if any mapping key is contained in the type
  for (const [key, value] of Object.entries(TYPE_MAPPINGS)) {
    if (lowerType.includes(key)) {
      console.log(`[identify-plant] Partial match: "${normalized}" mapped to "${value}"`);
      return value;
    }
  }

  console.log(`[identify-plant] Unknown type "${normalized}", defaulting to "Otro"`);
  return 'Otro';
}

function validateConfidence(confidence: unknown): 'alta' | 'media' | 'baja' {
  if (typeof confidence !== 'string') return 'media';
  const normalized = confidence.toLowerCase().trim() as 'alta' | 'media' | 'baja';
  if (VALID_CONFIDENCE.includes(normalized)) {
    return normalized;
  }
  return 'media';
}

function parseIdentificationResponse(rawText: string): IdentifyResponse {
  let parsed: Record<string, unknown>;

  try {
    // Try parsing raw text as JSON
    parsed = JSON.parse(rawText);
  } catch {
    // If that fails, try extracting JSON from markdown code blocks
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        type: 'Otro',
        species: 'No identificada',
        confidence: 'baja',
      };
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return {
        type: 'Otro',
        species: 'No identificada',
        confidence: 'baja',
      };
    }
  }

  return {
    type: validatePlantType(parsed.type),
    species: typeof parsed.species === 'string' ? parsed.species : 'No identificada',
    confidence: validateConfidence(parsed.confidence),
  };
}

// ─── Handler ───

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[identify-plant] ANTHROPIC_API_KEY not configured');
    return errorResponse(500, 'Servicio no configurado');
  }

  // Parse request body
  let requestBody: IdentifyRequest;
  try {
    requestBody = JSON.parse(event.body ?? '{}');
  } catch {
    return errorResponse(400, 'JSON inválido');
  }

  // Validate required fields
  const { imageBase64, mediaType } = requestBody;
  if (!imageBase64 || !mediaType) {
    return errorResponse(400, 'Faltan campos: imageBase64, mediaType');
  }

  // Validate media type
  const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validMediaTypes.includes(mediaType)) {
    return errorResponse(400, `Tipo de imagen no soportado: ${mediaType}`);
  }

  // ─── Call Claude Vision API ───
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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: IDENTIFICATION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[identify-plant] Anthropic API error:', response.status, errorText);

      if (response.status === 401) {
        return errorResponse(500, 'Error de autenticación con la IA');
      }
      if (response.status === 429) {
        return errorResponse(429, 'Demasiadas peticiones. Intenta en unos segundos');
      }
      return errorResponse(500, 'Error al comunicarse con la IA');
    }

    // Parse response
    const data: AnthropicResponse = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    if (!rawText) {
      console.error('[identify-plant] Empty response from Claude');
      return errorResponse(500, 'La IA no devolvió una respuesta');
    }

    // Parse and validate the identification
    const identification = parseIdentificationResponse(rawText);
    return successResponse(identification);
  } catch (error) {
    console.error('[identify-plant] Unexpected error:', error);
    return errorResponse(500, 'Error inesperado al identificar la planta');
  }
};

export { handler };
