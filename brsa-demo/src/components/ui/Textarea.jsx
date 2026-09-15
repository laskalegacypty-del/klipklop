import { forwardRef, useLayoutEffect, useRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea(
  { className, rows = 8, autoSize = false, value, onChange, ...props },
  ref,
) {
  const inner = useRef(null)

  function assign(node) {
    inner.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  useLayoutEffect(() => {
    if (!autoSize || !inner.current) return
    const el = inner.current
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`
  }, [autoSize, value])

  return (
    <textarea
      ref={assign}
      rows={rows}
      value={value}
      onChange={onChange}
      className={cn(
        'w-full rounded-md border border-dust-200 bg-white px-3 py-3 text-sm leading-relaxed text-charcoal shadow-sm placeholder:text-stone-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        autoSize ? 'min-h-56 resize-none overflow-hidden' : 'min-h-56 resize-y',
        className,
      )}
      {...props}
    />
  )
})
