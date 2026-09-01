import { cn } from './cn'

export function TableWrap({ className, ...props }) {
  return (
    <div
      className={cn('overflow-x-auto rounded-2xl border border-dust-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function Table({ className, ...props }) {
  return (
    <table className={cn('min-w-[640px] w-full border-collapse text-left text-sm', className)} {...props} />
  )
}

export function Th({ className, ...props }) {
  return (
    <th
      className={cn('whitespace-nowrap border-b border-dust-200 px-3 py-3 font-semibold text-stone-700 sm:px-4', className)}
      {...props}
    />
  )
}

export function Td({ className, ...props }) {
  return <td className={cn('border-b border-dust-100 px-3 py-3 text-charcoal sm:px-4', className)} {...props} />
}
