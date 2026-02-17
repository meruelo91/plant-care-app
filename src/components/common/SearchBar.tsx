import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchBar.module.css';

/**
 * SearchBar - Input field with search icon and clear button.
 *
 * FEATURES:
 *   - Search icon on the left
 *   - Clear button (X) appears when text is entered
 *   - Focuses input when clicking the search icon
 *   - Calls onChange on every keystroke (debounce handled by hook)
 *
 * PROPS:
 *   - value: current search term
 *   - onChange: callback with new search term
 *   - placeholder: optional placeholder text
 */

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar plantas...',
}: SearchBarProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = (): void => {
    onChange('');
    // Re-focus the input after clearing
    inputRef.current?.focus();
  };

  const handleSearchIconClick = (): void => {
    inputRef.current?.focus();
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.searchIcon}
        onClick={handleSearchIconClick}
        aria-label="Buscar"
      >
        <Search size={20} />
      </button>

      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar plantas"
      />

      {value && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
