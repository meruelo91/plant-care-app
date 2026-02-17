import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Camera,
  Save,
  Loader,
  AlertCircle,
  Sparkles,
  SearchX,
} from 'lucide-react';
import { useEditPlant, PLANT_TYPES } from '@/hooks/useEditPlant';
import styles from './AddPlantPage.module.css';

/**
 * EditPlantPage - Form to edit an existing plant.
 *
 * This component reuses the same structure and styles as AddPlantPage,
 * but with key differences:
 *   - Loads existing plant data
 *   - Pre-fills form fields
 *   - Updates instead of creates
 *   - Shows "Guardar cambios" instead of "Guardar planta"
 *   - Navigates back to plant detail on save
 *
 * STYLE REUSE:
 * We import AddPlantPage.module.css directly to avoid duplicating styles.
 * Both forms have identical visual appearance - only the behavior differs.
 */

const EditPlantPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Ref to the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All form logic comes from the custom hook
  const {
    formState,
    errors,
    isSubmitting,
    isLoadingPlant,
    plantNotFound,
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
  } = useEditPlant(id);

  // Open the file picker / camera
  const triggerFileInput = (): void => {
    fileInputRef.current?.click();
  };

  // Navigate back to plant detail
  const handleBack = (): void => {
    navigate(`/plant/${id}`);
  };

  // ─── Loading state ───
  if (isLoadingPlant) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <Loader size={32} className={styles.spinner} />
          <p>Cargando planta...</p>
        </div>
      </div>
    );
  }

  // ─── Not found state ───
  if (plantNotFound) {
    return (
      <div className={styles.page}>
        <div className={styles.notFoundContainer}>
          <SearchX size={64} className={styles.notFoundIcon} />
          <h2 className={styles.notFoundTitle}>Planta no encontrada</h2>
          <p className={styles.notFoundMessage}>
            Esta planta ya no existe o el enlace es incorrecto.
          </p>
          <button
            type="button"
            className={styles.backButtonLarge}
            onClick={() => navigate('/')}
          >
            <ChevronLeft size={18} />
            Volver al jardín
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header with back button */}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Volver al detalle"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className={styles.title}>Editar Planta</h1>
      </header>

      {/* Form */}
      <form className={styles.form} onSubmit={handleSubmit}>

        {/* --- PHOTO SECTION --- */}
        <div className={styles.photoSection}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handlePhotoChange}
            aria-label="Cambiar foto de la planta"
          />

          {formState.photoURL ? (
            <div className={styles.photoPreview}>
              <img
                src={formState.photoURL}
                alt="Preview de la planta"
                className={styles.previewImage}
              />
              <button
                type="button"
                className={styles.changePhotoButton}
                onClick={triggerFileInput}
              >
                Cambiar foto
              </button>
            </div>
          ) : (
            <div
              className={styles.photoPlaceholder}
              onClick={triggerFileInput}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') triggerFileInput();
              }}
            >
              <Camera size={40} />
              <span className={styles.photoPlaceholderText}>
                Toca para añadir una foto
              </span>
            </div>
          )}

          {/* Photo error */}
          {errors.photoURL && (
            <p className={styles.error} role="alert">
              <AlertCircle size={14} />
              {errors.photoURL}
            </p>
          )}

          {/* AI Identification Button - shows when photo changed */}
          {formState.photoURL && !isIdentifying && !identificationResult && (
            <button
              type="button"
              className={styles.identifyButton}
              onClick={handleIdentifyPlant}
            >
              <Sparkles size={18} />
              Re-identificar con IA
            </button>
          )}

          {/* Loading state while identifying */}
          {isIdentifying && (
            <div className={styles.identifyingState}>
              <Loader size={18} className={styles.spinner} />
              Analizando imagen...
            </div>
          )}

          {/* Identification error */}
          {identificationError && (
            <p className={styles.identifyError}>
              <AlertCircle size={14} />
              {identificationError}
            </p>
          )}

          {/* Confidence badge */}
          {identificationResult && (
            <div
              className={styles.confidenceBadge}
              data-confidence={identificationResult.confidence}
            >
              {identificationResult.confidence === 'alta' && '✓ Identificada con alta confianza'}
              {identificationResult.confidence === 'media' && '⚠️ Verificar identificación'}
              {identificationResult.confidence === 'baja' && '❓ Identificación incierta, revisa'}
            </div>
          )}
        </div>

        {/* --- PLANT TYPE DROPDOWN --- */}
        <div className={styles.fieldGroup}>
          <label htmlFor="plant-type" className={styles.label}>
            Tipo de planta
            <span className={styles.required}>*</span>
          </label>
          <select
            id="plant-type"
            className={`${styles.select} ${errors.type ? styles.inputError : ''}`}
            value={formState.type}
            onChange={handleTypeChange}
          >
            <option value="" disabled>
              Selecciona un tipo...
            </option>
            {PLANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className={styles.error} role="alert">
              <AlertCircle size={14} />
              {errors.type}
            </p>
          )}
        </div>

        {/* --- SPECIES INPUT --- */}
        <div className={styles.fieldGroup}>
          <label htmlFor="plant-species" className={styles.label}>
            Especie
            <span className={styles.hint}>Recomendado</span>
          </label>
          <input
            id="plant-species"
            type="text"
            className={styles.input}
            placeholder="Ej: Echeveria elegans"
            value={formState.species}
            onChange={handleSpeciesChange}
          />
        </div>

        {/* --- NICKNAME INPUT --- */}
        <div className={styles.fieldGroup}>
          <label htmlFor="plant-nickname" className={styles.label}>
            Apodo
            <span className={styles.hint}>Opcional</span>
          </label>
          <input
            id="plant-nickname"
            type="text"
            className={styles.input}
            placeholder="Ej: Susy"
            value={formState.nickname}
            onChange={handleNicknameChange}
          />
        </div>

        {/* --- SUBMIT BUTTON --- */}
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader size={20} className={styles.spinner} />
              Guardando...
            </>
          ) : (
            <>
              <Save size={20} />
              Guardar cambios
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default EditPlantPage;
