import React from 'react';
import styles from './Button.module.scss';
import { Spinner } from '../Spinner/Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        className ?? '',
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" color="inherit" />}
      <span className={loading ? styles.loadingText : ''}>{children}</span>
    </button>
  );
}
