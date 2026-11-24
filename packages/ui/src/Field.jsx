import { cn } from './cn'

export function Field({ label, hint, htmlFor, className, children }) {
  return (
    <label className={cn('kk-field', className)} htmlFor={htmlFor}>
      {label ? <span className="kk-label">{label}</span> : null}
      {children}
      {hint ? <span className="kk-hint">{hint}</span> : null}
    </label>
  )
}
