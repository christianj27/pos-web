import styles from './Badge.module.scss';

type BadgeVariant =
  | 'active' | 'inactive'
  | 'owner' | 'kurir' | 'kasir'
  | 'simple' | 'refillable'
  | 'air' | 'gas'
  | 'warehouse' | 'vehicle'
  | 'delivery' | 'counter'
  | 'pending' | 'completed' | 'cancelled'
  | 'filled' | 'empty'
  | 'movement'
  | 'confidential'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant]].join(' ')}>
      {children}
    </span>
  );
}
