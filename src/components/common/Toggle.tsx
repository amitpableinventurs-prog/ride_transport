import clsx from 'clsx'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Accessible name, required when there is no visible <label> around the toggle. */
  label?: string
}

// On/off switch. The knob is laid out with flexbox (not absolute positioning),
// so it always sits inside the track.
export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-orange' : 'bg-navy-200',
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}
