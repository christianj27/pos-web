import React, { useState } from 'react';
import styles from './Input.module.scss';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  currency?: boolean;
}

function formatCurrency(val: string | number | readonly string[] | undefined): string {
  if (val === undefined || val === null || val === '') return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function Input({ label, error, hint, id, className, type, currency, value, onChange, ...props }: InputProps) {
  const [showPwd, setShowPwd] = useState(false);

  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const isPassword = type === 'password';
  const inputType = currency ? 'text' : (isPassword ? (showPwd ? 'text' : 'password') : type);

  function handleCurrencyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (onChange) {
      const fakeEvent = {
        ...e,
        target: { ...e.target, value: raw },
        currentTarget: { ...e.currentTarget, value: raw },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(fakeEvent);
    }
  }

  const inputValue = currency ? formatCurrency(value) : value;
  const inputOnChange = currency ? handleCurrencyChange : onChange;

  return (
    <div className={[styles.wrapper, className ?? ''].join(' ')}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputWrap}>
        <input
          id={inputId}
          type={inputType}
          inputMode={currency ? 'numeric' : undefined}
          className={[styles.input, error ? styles.inputError : ''].join(' ')}
          value={inputValue}
          onChange={inputOnChange}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPwd((p) => !p)}
            tabIndex={-1}
            aria-label={showPwd ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPwd ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
