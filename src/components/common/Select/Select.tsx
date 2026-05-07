import React from 'react';
import styles from './Select.module.scss';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, id, className, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={[styles.wrapper, className ?? ''].join(' ')}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.selectWrap}>
        <select
          id={selectId}
          className={[styles.select, error ? styles.selectError : ''].join(' ')}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
