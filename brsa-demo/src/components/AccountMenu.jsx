import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Shield, UserRound } from 'lucide-react'
import { useDemo } from '../demo/store'

export function AccountMenu() {
  const { user, rider, viewingFromAdmin, exitViewAs } = useDemo()
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const navigate = useNavigate()
  const initial = user.name.slice(0, 1)

  useEffect(() => {
    function onDoc(e) {
      if (!wrap.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 py-1 pl-1 pr-2 text-left hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-400 font-display text-sm font-bold text-charcoal">
          {initial}
        </span>
        <span className="hidden sm:block leading-tight">
          <span className="block text-sm font-medium text-white">{user.name}</span>
          <span className="block text-[11px] capitalize tracking-wide text-stone-400">{user.role}</span>
        </span>
        <ChevronDown size={14} className="text-stone-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-md border border-dust-200 bg-white text-charcoal shadow-xl"
        >
          <div className="border-b border-dust-200 px-4 py-3">
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs capitalize text-stone-500">
              {user.role}
              {rider ? ` · ${rider.sa} · ${rider.province}` : ''}
            </p>
          </div>
          <div className="py-1">
            {rider ? (
              <Link
                to={`/riders/${rider.id}`}
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-dust-50"
                onClick={() => setOpen(false)}
              >
                <UserRound size={15} />
                My profile
              </Link>
            ) : null}
            {user.role === 'admin' ? (
              <Link
                to="/admin"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-dust-50"
                onClick={() => setOpen(false)}
              >
                <Shield size={15} />
                Admin
              </Link>
            ) : null}
            {viewingFromAdmin ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-dust-50"
                onClick={() => {
                  setOpen(false)
                  exitViewAs()
                  navigate('/admin')
                }}
              >
                <LogOut size={15} />
                Stop viewing as member
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
