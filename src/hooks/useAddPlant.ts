import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { compressImage } from '@/utils/imageUtils';
import { generateId } from '@/utils/generateId';
import { identifyPlant, type PlantIdentification } from '@/services/plantIdentification';
import type { Plant } from '@/types';

/**
 * useAddPlant - Custom hook for the "Add Plant" form.
 *
 * SEPARATION OF CONCERNS:
 * This hook handles all the "brain" of the form:
 *   - What values are in each field (state)
 *   - Which fields have errors (validation)
 *   - Processing the photo (compression)
 *   - AI plant identification (NEW!)
 *   - Saving to the database (submission)
 *
 * The page component (AddPlantPage.tsx) only handles the "body":
 *   - What the form looks like (JSX/HTML)
 *   - Where each element is positioned (CSS)
 *
 * This pattern makes the code easier to understand, test, and reuse.
 *
 * FORM VALIDATION PATTERN - "Touched Fields":
 * We don't want to show "This field is required!" the moment the page
 * loads - that would be overwhelming. Instead, we track which fields
 * the user has interacted with ("touched"). Errors only appear for
 * touched fields. When the user clicks "Submit", we mark ALL fields
 * as touched so any remaining errors become visible.
 *
 * AI IDENTIFICATION (NEW):
 * After taking a photo, the user can click "Identificar con IA" to
 * have Claude Vision analyze the image and automatically fill in
 * the type and species fields. The identification includes a
 * confidence level (alta/media/baja) shown as a badge.
 */

// Available plant types for the dropdown (sorted alphabetically, "Otro" at end)
export const PLANT_TYPES: readonly string[] = [
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

// --- Type definitions ---

interface AddPlantFormState {
  photoURL: string;
  type: string;
  species: string;
  nickname: string;
}

interface AddPlantFormErrors {
  photoURL?: string;
  type?: string;
}

interface TouchedFields {
  photoURL: boolean;
  type: boolean;
}

export interface UseAddPlantResult {
  formState: AddPlantFormState;
  errors: AddPlantFormErrors;
  isSubmitting: boolean;
  // AI Identification (NEW)
  isIdentifying: boolean;
  identificationResult: PlantIdentification | null;
  identificationError: string | null;
  handleIdentifyPlant: () => Promise<void>;
  // Form handlers
  handlePhotoChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleTypeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleSpeciesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleNicknameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

// --- Initial values ---

const INITIAL_FORM_STATE: AddPlantFormState = {
  photoURL: '',
  type: '',
  species: '',
  nickname: '',
};

const INITIAL_TOUCHED: TouchedFields = {
  photoURL: false,
  type: false,
};

// --- Validation ---

/**
 * Validate the form and return an object with error messages.
 * An empty object means no errors.
 *
 * We only validate required fields (photoURL and type).
 * Species and nickname are optional so they never have errors.
 */
function validate(formState: AddPlantFormState): AddPlantFormErrors {
  const errors: AddPlantFormErrors = {};

  if (!formState.photoURL) {
    errors.photoURL = 'La foto es obligatoria';
  }

  if (!formState.type) {
    errors.type = 'Selecciona un tipo de planta';
  }

  return errors;
}

/**
 * Filter errors to only show those for fields the user has touched.
 * This prevents showing errors on page load before the user interacts.
 */
function getVisibleErrors(
  errors: AddPlantFormErrors,
  touched: TouchedFields,
): AddPlantFormErrors {
  const visible: AddPlantFormErrors = {};

  if (touched.photoURL && errors.photoURL) {
    visible.photoURL = errors.photoURL;
  }

  if (touched.type && errors.type) {
    visible.type = errors.type;
  }

  return visible;
}

// --- Hook ---

export function useAddPlant(): UseAddPlantResult {
  const navigate = useNavigate();

  // Form field values
  const [formState, setFormState] = useState<AddPlantFormState>(INITIAL_FORM_STATE);

  // Which fields have been interacted with
  const [touched, setTouched] = useState<TouchedFields>(INITIAL_TOUCHED);

  // Prevents double-submission while saving
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ─── AI Identification State (NEW) ───
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [identificationResult, setIdentificationResult] = useState<PlantIdentification | null>(null);
  const [identificationError, setIdentificationError] = useState<string | null>(null);

  // Calculate errors (runs on every render, but it's a cheap operation)
  const allErrors = validate(formState);
  const visibleErrors = getVisibleErrors(allErrors, touched);

  // --- Handlers ---

  /**
   * Process the photo from the file input.
   *
   * event.target.files is a FileList - it can contain multiple files
   * if the input has `multiple` attribute, but ours doesn't, so we
   * always take files[0]. We check if it exists because the user
   * might cancel the camera/file picker without selecting anything.
   */
  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTouched((prev) => ({ ...prev, photoURL: true }));

    // Clear previous identification when photo changes
    setIdentificationResult(null);
    setIdentificationError(null);

    try {
      const base64 = await compressImage(file);
      setFormState((prev) => ({ ...prev, photoURL: base64 }));
    } catch (error) {
      console.error('Error compressing image:', error);
      setFormState((prev) => ({ ...prev, photoURL: '' }));
    }
  };

  /**
   * Identify the plant using Claude Vision API.
   * This auto-fills the type and species fields.
   */
  const handleIdentifyPlant = useCallback(async (): Promise<void> => {
    // Guard: need a photo and not already identifying
    if (!formState.photoURL || isIdentifying) return;

    setIsIdentifying(true);
    setIdentificationError(null);

    try {
      const result = await identifyPlant(formState.photoURL);
      setIdentificationResult(result);

      // Auto-fill the form fields
      setFormState((prev) => ({
        ...prev,
        type: result.type,
        species: result.species,
      }));

      // Mark type as touched since it's been filled
      setTouched((prev) => ({ ...prev, type: true }));
    } catch (error) {
      console.error('Error identifying plant:', error);
      setIdentificationError(
        error instanceof Error
          ? error.message
          : 'No pudimos identificar la planta. Introdúcela manualmente',
      );
    } finally {
      setIsIdentifying(false);
    }
  }, [formState.photoURL, isIdentifying]);

  const handleTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    setTouched((prev) => ({ ...prev, type: true }));
    setFormState((prev) => ({ ...prev, type: event.target.value }));
  };

  const handleSpeciesChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setFormState((prev) => ({ ...prev, species: event.target.value }));
  };

  const handleNicknameChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setFormState((prev) => ({ ...prev, nickname: event.target.value }));
  };

  /**
   * Handle form submission.
   *
   * event.preventDefault() is CRUCIAL here. Without it, the browser
   * would do its default behavior for form submission: send an HTTP
   * request and reload the page. In a Single Page App (SPA), we
   * never want that - we handle everything in JavaScript.
   */
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    // Mark all fields as touched so all errors become visible
    setTouched({ photoURL: true, type: true });

    // Check for validation errors
    const errors = validate(formState);
    const hasErrors = Object.keys(errors).length > 0;

    if (hasErrors) return;

    setIsSubmitting(true);

    try {
      // Build the plant object following the Plant interface
      const plant: Plant = {
        id: generateId(),
        photoURL: formState.photoURL,
        type: formState.type,
        species: formState.species,
        // Convert empty string to undefined (matches the optional field)
        nickname: formState.nickname || undefined,
        createdAt: new Date(),
        lastWatered: null,
      };

      await db.plants.add(plant);

      // Navigate to home. The plant list will auto-update because
      // usePlants() uses useLiveQuery, which detects IndexedDB changes.
      navigate('/');
    } catch (error) {
      console.error('Error saving plant:', error);
      setIsSubmitting(false);
    }
  };

  return {
    formState,
    errors: visibleErrors,
    isSubmitting,
    // AI Identification (NEW)
    isIdentifying,
    identificationResult,
    identificationError,
    handleIdentifyPlant,
    // Form handlers
    handlePhotoChange,
    handleTypeChange,
    handleSpeciesChange,
    handleNicknameChange,
    handleSubmit,
  };
}
