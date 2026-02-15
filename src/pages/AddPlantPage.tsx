import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Leaf, Loader, AlertCircle } from 'lucide-react';
import { useAddPlant, PLANT_TYPES } from '@/hooks/useAddPlant';
import styles from './AddPlantPage.module.css';

/**
 * AddPlantPage - Form to create a new plant.
 *
 * This component is "presentational": it only renders UI.
 * All the logic (state, validation, submission) lives in useAddPlant().
 *
 * HIDDEN FILE INPUT PATTERN:
 * The native <input type="file"> looks ugly and can't be styled.
 * So we:
 *   1. Hide it with CSS (opacity: 0, position: absolute)
 *   2. Create a pretty visual area (the dashed placeholder)
 *   3. When the user clicks the visual area, we programmatically
 *      trigger the hidden input with fileInputRef.current.click()
 *
 * useRef:
 * React's useRef() creates a "reference" to a DOM element.
 * It's like document.getElementById() but the React way.
 * The ref persists across re-renders and doesn't cause re-renders
 * when changed (unlike useState).
 *
 * accept="image/*":
 * Without the `capture` attribute, mobile Safari shows a menu with
 * options: "Hacer foto", "Fototeca", etc. This is better UX than
 * forcing the camera directly, because users may want to pick an
 * existing photo from their gallery.
 */

const AddPlantPage: React.FC = () => {
  const navigate = useNavigate();

  // Ref to the hidden file input so we can trigger it programmatically
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All form logic comes from the custom hook
  const {
    formState,
    errors,
    isSubmitting,
    handlePhotoChange,
    handleTypeChange,
    handleSpeciesChange,
    handleNicknameChange,
    handleSubmit,
  } = useAddPlant();

  // Open the file picker / camera when the photo area is clicked
  const triggerFileInput = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.page}>
      {/* Header with back button */}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/')}
          aria-label="Volver al jardin"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className={styles.title}>Agregar Planta</h1>
      </header>

      {/* The form element wraps all fields. onSubmit fires when the
          user clicks the submit button or presses Enter. */}
      <form className={styles.form} onSubmit={handleSubmit}>

        {/* --- PHOTO SECTION --- */}
        <div className={styles.photoSection}>
          {/* Hidden file input - triggered by clicking the visual area */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handlePhotoChange}
            aria-label="Tomar foto de la planta"
          />

          {formState.photoURL ? (
            // Photo taken: show preview
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
            // No photo yet: show placeholder
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
              <Leaf size={20} />
              Guardar planta
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AddPlantPage;
