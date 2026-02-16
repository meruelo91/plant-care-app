/**
 * Plant Identification Service
 *
 * Uses Claude Vision API to identify plants from photos.
 * The image is sent to the AI which returns the plant type and species.
 *
 * PRODUCTION vs DEVELOPMENT:
 * - Production: Calls /.netlify/functions/identify-plant
 * - Development: Calls Anthropic API directly through Vite proxy
 *
 * The serverless function keeps the API key secure on the server.
 */

// ─── Types ───

export interface PlantIdentification {
  type: string;
  species: string;
  confidence: 'alta' | 'media' | 'baja';
}

interface ServerlessResponse {
  type?: string;
  species?: string;
  confidence?: string;
  error?: string;
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// ─── Constants ───

const IS_PRODUCTION: boolean = import.meta.env.PROD;
const PRODUCTION_API_URL = '/.netlify/functions/identify-plant';
const DEVELOPMENT_API_URL = '/api/anthropic/v1/messages';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 200;
const ANTHROPIC_VERSION = '2023-06-01';

// Valid plant types (must match serverless function - sorted alphabetically, "Otro" at end)
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

// ─── Helpers ───

/**
 * Extract base64 data and media type from a data URL.
 *
 * @param dataUrl - Full data URL like "data:image/jpeg;base64,/9j/4AAQ..."
 * @returns Object with mediaType and raw base64 data
 */
function extractBase64(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Formato de imagen inválido');
  }
  return {
    mediaType: match[1],
    data: match[2],
  };
}

/**
 * Validate that plant type is in the allowed list.
 * Uses intelligent mapping for common variations.
 */
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
    console.log(`[plantIdentification] Mapped "${normalized}" to "${TYPE_MAPPINGS[lowerType]}"`);
    return TYPE_MAPPINGS[lowerType];
  }

  // Check if any mapping key is contained in the type
  for (const [key, value] of Object.entries(TYPE_MAPPINGS)) {
    if (lowerType.includes(key)) {
      console.log(`[plantIdentification] Partial match: "${normalized}" mapped to "${value}"`);
      return value;
    }
  }

  console.log(`[plantIdentification] Unknown type "${normalized}", defaulting to "Otro"`);
  return 'Otro';
}

/**
 * Validate confidence level.
 */
function validateConfidence(confidence: unknown): 'alta' | 'media' | 'baja' {
  if (typeof confidence !== 'string') return 'media';
  const normalized = confidence.toLowerCase().trim() as 'alta' | 'media' | 'baja';
  if (VALID_CONFIDENCE.includes(normalized)) {
    return normalized;
  }
  return 'media';
}

/**
 * Parse raw text response into PlantIdentification.
 */
function parseIdentificationResponse(rawText: string): PlantIdentification {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Try extracting JSON from markdown code blocks
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

  return {
    type: validatePlantType(parsed.type),
    species: typeof parsed.species === 'string' ? parsed.species : 'No identificada',
    confidence: validateConfidence(parsed.confidence),
  };
}

// ─── API Functions ───

/**
 * Production: Call the Netlify serverless function.
 */
async function identifyPlantProduction(
  mediaType: string,
  imageBase64: string,
): Promise<PlantIdentification> {
  const response = await fetch(PRODUCTION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      mediaType,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Demasiadas peticiones. Espera un momento e intenta de nuevo');
    }
    // Try to get error message from response
    try {
      const errorData = await response.json() as { error?: string };
      if (errorData.error) {
        throw new Error(errorData.error);
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error('No pudimos identificar la planta. Introdúcela manualmente');
  }

  const data: ServerlessResponse = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    type: validatePlantType(data.type),
    species: typeof data.species === 'string' ? data.species : 'No identificada',
    confidence: validateConfidence(data.confidence),
  };
}

/**
 * Development: Call Anthropic API directly through Vite proxy.
 */
async function identifyPlantDevelopment(
  mediaType: string,
  imageBase64: string,
): Promise<PlantIdentification> {
  const apiKey: string = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';

  if (!apiKey || apiKey === 'sk-ant-tu-key-aqui') {
    throw new Error(
      'API key no configurada. Añade tu key de Anthropic en el archivo .env.local',
    );
  }

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

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API key inválida. Verifica tu key en .env.local');
    }
    if (response.status === 429) {
      throw new Error('Demasiadas peticiones. Espera un momento e intenta de nuevo');
    }
    throw new Error('No pudimos identificar la planta. Introdúcela manualmente');
  }

  const data: AnthropicResponse = await response.json();
  const rawText: string = data.content?.[0]?.text ?? '';

  if (!rawText) {
    throw new Error('La IA no devolvió una respuesta');
  }

  return parseIdentificationResponse(rawText);
}

// ─── Main Export ───

/**
 * Identify a plant from its photo using Claude Vision.
 *
 * @param photoURL - Base64 data URL of the plant image
 * @returns Plant identification with type, species, and confidence
 * @throws Error with user-friendly message on failure
 *
 * @example
 * const result = await identifyPlant(photoDataUrl);
 * // { type: "Suculenta", species: "Aloe vera", confidence: "alta" }
 */
export async function identifyPlant(photoURL: string): Promise<PlantIdentification> {
  // Extract base64 data from data URL
  const { mediaType, data: imageBase64 } = extractBase64(photoURL);

  // Route to appropriate implementation based on environment
  if (IS_PRODUCTION) {
    return identifyPlantProduction(mediaType, imageBase64);
  }
  return identifyPlantDevelopment(mediaType, imageBase64);
}
