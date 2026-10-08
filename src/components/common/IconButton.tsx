import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

const TONES = {
  neutral: 'text-navy-500 hover:bg-navy-50 hover:text-navy-800',
  success: 'text-brand-green-dark hover:bg-green-50',
  danger: 'text-brand-red hover:bg-red-50',
} as const

/** Compact square icon button for table rows; the label shows as a tooltip and is read by screen readers. */
export function IconButton({
  icon: Icon,
  label,
  tone = 'neutral',
  onClick,
  disabled,
}: {
  icon: LucideIcon
  label: string
  tone?: keyof typeof TONES
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx('flex h-8 w-8 items-center justify-center rounded-lg border border-navy-100 transition-colors disabled:opacity-40', TONES[tone])}
    >
      <Icon size={15} />
    </button>
  )
}
