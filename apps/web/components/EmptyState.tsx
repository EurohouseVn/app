import Link from 'next/link';

type EmptyStateProps = { title: string; message: string; action?: { label: string; href: string }; className?: string };

export function EmptyState({ title, message, action, className }: EmptyStateProps) {
  return (
    <div className={['empty-state', className].filter(Boolean).join(' ')} role="status">
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <Link className="empty-state-action" href={action.href}>{action.label}</Link> : null}
    </div>
  );
}
