import { cn } from './cn'

export function TableWrap({ className, ...props }) {
  return <div className={cn('kk-table-wrap', className)} {...props} />
}

export function Table({ className, ...props }) {
  return <table className={cn('kk-table', className)} {...props} />
}

export function Th({ className, ...props }) {
  return <th className={cn(className)} {...props} />
}

export function Td({ className, ...props }) {
  return <td className={cn(className)} {...props} />
}
