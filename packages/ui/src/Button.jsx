import { forwardRef } from 'react'
import { cn } from './cn'

const variants = {
  primary: 'kk-btn--primary',
  secondary: 'kk-btn--secondary',
  ghost: 'kk-btn--ghost',
  danger: 'kk-btn--danger',
  inverse: 'kk-btn--inverse',
}

const sizes = {
  sm: 'kk-btn--sm',
  md: '',
  lg: 'kk-btn--lg',
}

export const Button = forwardRef(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('kk-btn', variants[variant], sizes[size], className)}
      {...props}
    />
  )
})
