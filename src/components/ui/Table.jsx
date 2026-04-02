import { cn } from './cn'

export function TableWrap({ className, ...props }) {
  return (
    <div
      className={cn('overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function Table({ className, ...props }) {
  return (
    <table
      className={cn('w-full border-collapse text-left text-sm', className)}
      {...props}
    />
  )
}

export function Th({ className, ...props }) {
  return (
    <th
      className={cn('whitespace-nowrap border-b border-gray-200 px-4 py-3 font-semibold text-gray-700', className)}
      {...props}
    />
  )
}

export function Td({ className, ...props }) {
  return <td className={cn('border-b border-gray-100 px-4 py-3 text-gray-900', className)} {...props} />
}

