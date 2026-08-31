import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { ViewAsProvider, useViewAs } from '../../context/ViewAsContext'
import { isGrantActive } from '../../lib/profileAccess'
import { ArrowLeft, ShieldOff, Send, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton } from '../../components/ui'

import Dashboard from '../user/Dashboard'
import Profile from '../user/Profile'
import Horses from '../user/Horses'
import HorseDetails from '../user/HorseDetails'
import MyTimes from '../user/MyTimes'
import QualifierTracker from '../user/QualifierTracker'
import EventDay from '../user/EventDay'
import SeasonOverview from '../user/SeasonOverview'
import Matrix from '../user/Matrix'
import Qualifiers from '../user/Qualifiers'

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Home' },
  { path: 'profile',   label: 'Profile' },
  { path: 'horses',    label: 'Horses' },
  { path: 'my-times',  label: 'My Times' },
  { path: 'tracker',   label: 'Qualifier Tracker' },
  { path: 'event-day', label: 'Event Day' },
  { path: 'season',    label: 'Season' },
  { path: 'matrix',    label: 'Matrix' },
  { path: 'qualifiers', label: 'Qualifiers' },
]

function ViewAsTopBar({ basePath, targetProfile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const viewAs = useViewAs()
  const [submitting, setSubmitting] = useState(false)

  const submitted = viewAs.session?.status === 'submitted'

  async function handleSubmit() {
    if (viewAs.itemCount === 0) {
      toast.error('No changes staged yet')
      return
    }
    setSubmitting(true)
    try {
      await viewAs.submit()
      toast.success('Submitted for review — the rider will be notified')
    } catch {
      toast.error('Could not submit changes')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 mb-4 bg-amber-50 border-b border-amber-200">
      <div className="px-3 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <Eye size={18} className="text-amber-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Viewing as {targetProfile.rider_name}
            {submitted && <span className="ml-2 text-xs font-normal text-amber-700">· submitted, awaiting rider review</span>}
          </p>
          <p className="text-xs text-amber-700">
            {viewAs.itemCount} change{viewAs.itemCount === 1 ? '' : 's'} staged — nothing is real until the rider approves.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting || submitted || viewAs.itemCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition disabled:opacity-50"
          >
            <Send size={13} /> {submitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <button
            onClick={() => navigate('/admin/profile-access')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition"
          >
            <ArrowLeft size={13} /> Exit
          </button>
        </div>
      </div>
      <div className="px-3 sm:px-6 pb-2 flex flex-wrap gap-1 overflow-x-auto">
        {NAV_ITEMS.map(item => {
          const to = `${basePath}/${item.path}`
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`)
          return (
            <Link
              key={item.path}
              to={to}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                active ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function ViewAsRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="profile" element={<Profile />} />
      <Route path="horses" element={<Horses />} />
      <Route path="horses/:horseId" element={<HorseDetails />} />
      <Route path="my-times" element={<MyTimes />} />
      <Route path="tracker" element={<QualifierTracker />} />
      <Route path="event-day" element={<EventDay />} />
      <Route path="season" element={<SeasonOverview />} />
      <Route path="matrix" element={<Matrix />} />
      <Route path="qualifiers" element={<Qualifiers />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}

export default function ViewAsShell() {
  const { userId } = useParams()
  const { profile: adminProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [grant, setGrant] = useState(null)
  const [targetProfile, setTargetProfile] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: latestGrant }, { data: target }] = await Promise.all([
        supabase
          .from('profile_access_grants')
          .select('*')
          .eq('admin_id', adminProfile.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
      ])
      if (cancelled) return
      setGrant(latestGrant)
      setTargetProfile(target || null)
      setLoading(false)
    }
    if (adminProfile?.id) load()
    return () => { cancelled = true }
  }, [adminProfile?.id, userId])

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  if (!isGrantActive(grant) || !targetProfile) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
        <ShieldOff size={28} className="mx-auto mb-3 text-gray-300" />
        <h3 className="text-base font-semibold text-gray-900">No active access grant</h3>
        <p className="mt-1 text-sm text-gray-600">
          You need an active, accepted access grant from this rider to browse as them.
        </p>
        <Link to="/admin/profile-access" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:underline">
          <ArrowLeft size={14} /> Back to Profile Access
        </Link>
      </div>
    )
  }

  const basePath = `/admin/view-as/${userId}`

  return (
    <ViewAsProvider grant={grant} targetProfile={targetProfile}>
      <ViewAsTopBar basePath={basePath} targetProfile={targetProfile} />
      <ViewAsRoutes />
    </ViewAsProvider>
  )
}
