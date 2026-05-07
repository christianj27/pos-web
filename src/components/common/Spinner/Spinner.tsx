import styles from './Spinner.module.scss';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'violet' | 'white' | 'inherit';
}

export function Spinner({ size = 'md', color = 'violet' }: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, styles[size], styles[color]].join(' ')}
      role="status"
      aria-label="Memuat..."
    />
  );
}
