import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon ? (
        <div className={styles.icon}>{icon}</div>
      ) : (
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
      )}
      <p className={styles.message}>{message}</p>
    </div>
  );
}
