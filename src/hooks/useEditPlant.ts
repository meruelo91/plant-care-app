import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { compressImage } from '@/utils/imageUtils';
import { identifyPlant, type PlantIdentification } from '@/services/plantIdentification';
import { useToast } from '@/contexts/ToastContext';
import type { Plant } from '@/types';

/**
 * useEditPlant - Custom hook for editing an existing plant.
 *
 * This hook is similar to useAddPlant, but with key differences:
 *   1. Loads existing plant data on mount
 *   2. Pre-fills the form with current values
 *   3. Uses db.plants.update() instead of add()
 *   4. Clears wateringAdvice if type/species changes
 *   5. Preserves id, createdAt, lastWatered, and watering logs
 *
 * EDIT vs CREATE:
 * The main difference is that editing must preserve the plant's
 * identity and history while allowing the user to update the
 * visual and classification information.
 */

// Import PLANT_TYPES from useAddPlant to keep them in sync
export { PLANT_TYPES } from './useAddPlant';

// --- Type definitions ---

interface EditPlantFormState {
  photoURL: string;
  type: string;
  species: string;
  nickname: string;
}

interface EditPlantFormErrors {
  photoURL?: string;
  type?: string;
}

interface TouchedFields {
  photoURL: boolean;
  type: boolean;
}

export interface UseEditPlantResult {
  formState: EditPlantFormState;
  errors: EditPlantFormErrors;
  isSubmitting: boolean;
  isLoadingPlant: boolean;
  plantNotFound: boolean;
  hasChanges: boolean;
  // AI Identification
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

const INITIAL_FORM_STATE: EditPlantFormState = {
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

function validate(formState: EditPlantFormState): EditPlantFormErrors {
  const errors: EditPlantFormErrors = {};

  if (!formState.photoURL) {
    errors.photoURL = 'La foto es obligatoria';
  }

  if (!formState.type) {
    errors.type = 'Selecciona un tipo de planta';
  }

  return errors;
}

function getVisibleErrors(
  errors: EditPlantFormErrors,
  touched: TouchedFields,
): EditPlantFormErrors {
  const visible: EditPlantFormErrors = {};

  if (touched.photoURL && errors.photoURL) {
    visible.photoURL = errors.photoURL;
  }

  if (touched.type && errors.type) {
    visible.type = errors.type;
  }

  return visible;
}

// --- Hook ---

export function useEditPlant(plantId: string | undefined): UseEditPlantResult {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Loading and error states
  const [isLoadingPlant, setIsLoadingPlant] = useState<boolean>(true);
  const [plantNotFound, setPlantNotFound] = useState<boolean>(false);

  // Original plant data (to detect changes and preserve fields)
  const [originalData, setOriginalData] = useState<Plant | null>(null);

  // Form field values
  const [formState, setFormState] = useState<EditPlantFormState>(INITIAL_FORM_STATE);

  // Which fields have been interacted with
  const [touched, setTouched] = useState<TouchedFields>(INITIAL_TOUCHED);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // AI Identification state
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [identificationResult, setIdentificationResult] = useState<PlantIdentification | null>(null);
  const [identificationError, setIdentificationError] = useState<string | null>(null);

  // Calculate errors
  const allErrors = validate(formState);
  const visibleErrors = getVisibleErrors(allErrors, touched);

  // Detect if user has made changes
  const hasChanges = useMemo((): boolean => {
    if (!originalData) return false;
    return (
      formState.photoURL !== originalData.photoURL ||
      formState.type !== originalData.type ||
      formState.species !== originalData.species ||
      formState.nickname !== (originalData.nickname ?? '')
    );
  }, [formState, originalData]);

  // --- Load plant data on mount ---
  useEffect(() => {
    const loadPlant = async (): Promise<void> => {
      if (!plantId) {
        setPlantNotFound(true);
        setIsLoadingPlant(false);
        return;
      }

      try {
        const plant = await db.plants.get(plantId);

        if (!plant) {
          setPlantNotFound(true);
          setIsLoadingPlant(false);
          return;
        }

        // Store original data for comparison
        setOriginalData(plant);

        // Pre-fill form with current values
        setFormState({
          photoURL: plant.photoURL,
          type: plant.type,
          species: plant.species,
          nickname: plant.nickname ?? '',
        });

        setIsLoadingPlant(false);
      } catch (error) {
        console.error('Error loading plant:', error);
        setPlantNotFound(true);
        setIsLoadingPlant(false);
      }
    };

    loadPlant();
  }, [plantId]);

  // --- Handlers ---

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

  const handleIdentifyPlant = useCallback(async (): Promise<void> => {
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

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!plantId || !originalData) return;

    // Mark all fields as touched so all errors become visible
    setTouched({ photoURL: true, type: true });

    // Check for validation errors
    const errors = validate(formState);
    const hasErrors = Object.keys(errors).length > 0;

    if (hasErrors) return;

    setIsSubmitting(true);

    try {
      // Detect if type or species changed (affects watering advice)
      const typeOrSpeciesChanged =
        originalData.type !== formState.type ||
        originalData.species !== formState.species;

      // Build update object with only editable fields
      const updates: Partial<Plant> = {
        photoURL: formState.photoURL,
        type: formState.type,
        species: formState.species,
        nickname: formState.nickname || undefined,
      };

      // Clear watering advice if type/species changed
      // It will be regenerated automatically when viewing the plant
      if (typeOrSpeciesChanged) {
        updates.wateringAdvice = undefined;
      }

      await db.plants.update(plantId, updates);

      // Show success toast
      showToast('✓ Planta actualizada', 'success');

      // Navigate back to plant detail
      navigate(`/plant/${plantId}`);
    } catch (error) {
      console.error('Error updating plant:', error);
      showToast('Error al guardar los cambios', 'error');
      setIsSubmitting(false);
    }
  };

  return {
    formState,
    errors: visibleErrors,
    isSubmitting,
    isLoadingPlant,
    plantNotFound,
    hasChanges,
    // AI Identification
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
