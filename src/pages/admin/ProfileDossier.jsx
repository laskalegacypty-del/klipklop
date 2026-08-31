import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import {
  ShieldOff, ShieldCheck, Clock, HeartPulse, Trophy, CreditCard, Users, Bell, Flag, ArrowLeft, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent, PageHeader, Skeleton, Badge } from '../../components/ui'
import { isGrantActive, grantStatusLabel } from '../../lib/profileAccess'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SUBSCRIPTION_BADGE = {
  active:  'success',
  none:    'default',
  expired: 'danger',
}

export default function ProfileDossier() {
  const { userId } = useParams()
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [grant, setGrant] = useState(null)
  const [dossier, setDossier] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: latestGrant, error: grantError } = await supabase
        .from('profile_access_grants')
        .select('*')
        .eq('admin_id', adminProfile.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (grantError) throw grantError
      setGrant(latestGrant)

      if (!isGrantActive(latestGrant)) {
        setDossier(null)
        return
      }

      const [profileRes, horsesRes, combosRes, clubHeadLinksRes, clubRiderLinksRes,
        supporterLinksRes, notificationsRes, reportsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('horses').select('id, name, breed, sex, color, photo_url').eq('user_id', userId),
        supabase.from('horse_rider_combos').select('id, horse_id, horse_name, current_level, is_archived').eq('user_id', userId),
        supabase.from('club_member_links').select('id, rider_id, status, created_at').eq('club_head_id', userId),
        supabase.from('club_member_links').select('id, club_head_id, status, created_at').eq('rider_id', userId),
        supabase.from('supporter_rider_links').select('id, supporter_id, status, created_at').eq('rider_id', userId),
        supabase.from('notifications').select('id, type, message, created_at, is_read').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('problem_reports').select('id, category, description, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      ])

      if (profileRes.error) throw profileRes.error

      const comboIds = (combosRes.data || []).map(c => c.id)

      const [pbRes, qualifierResultsRes, eventDayRes] = await Promise.all([
        comboIds.length
          ? supabase.from('personal_bests').select('combo_id, game, best_time, season_year').in('combo_id', comboIds)
          : Promise.resolve({ data: [] }),
        comboIds.length
          ? supabase.from('qualifier_results').select('combo_id, game, time, is_nt, created_at, qualifier_events(date, venue, province, qualifier_number)').in('combo_id', comboIds).order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] }),
        comboIds.length
          ? supabase.from('event_day_results').select('combo_id, game, time, is_nt, level_achieved, saved_at, qualifier_events(date, venue)').in('combo_id', comboIds).order('saved_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] }),
      ])

      setDossier({
        profile: profileRes.data,
        horses: horsesRes.data || [],
        combos: combosRes.data || [],
        personalBests: pbRes.data || [],
        qualifierResults: qualifierResultsRes.data || [],
        eventDayResults: eventDayRes.data || [],
        clubHeadLinks: clubHeadLinksRes.data || [],
        clubRiderLinks: clubRiderLinksRes.data || [],
        supporterLinks: supporterLinksRes.data || [],
        notifications: notificationsRes.data || [],
        reports: reportsRes.data || [],
      })
    } catch (err) {
      console.error(err)
      toast.error('Error loading profile dossier')
    } finally {
      setLoading(false)
    }
  }, [adminProfile?.id, userId])

  useEffect(() => { if (adminProfile?.id) load() }, [adminProfile?.id, load])

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  if (!isGrantActive(grant)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile Dossier" />
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <ShieldOff size={28} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-base font-semibold text-gray-900">
            {grant ? `Access ${grantStatusLabel(grant).toLowerCase()}` : 'No access grant'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            You need an active, accepted access grant from this rider to view their full profile dossier.
          </p>
          <Link to="/admin/profile-access" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:underline">
            <ArrowLeft size={14} /> Back to Profile Access
          </Link>
        </div>
      </div>
    )
  }

  const { profile, horses, combos, personalBests, qualifierResults, eventDayResults,
    clubHeadLinks, clubRiderLinks, supporterLinks, notifications, reports } = dossier

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.rider_name}
        description="Profile dossier — full consolidated view"
        actions={
          <button onClick={() => navigate('/admin/profile-access')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Grant banner */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-200 bg-green-50">
        <ShieldCheck size={20} className="text-green-700 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-sm text-green-800">
          <span className="font-semibold">Active access grant</span> — expires {formatDateTime(grant.expires_at)}.
          The rider can revoke this at any time.
        </div>
        <button
          onClick={() => navigate(`/admin/view-as/${userId}/dashboard`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-semibold transition flex-shrink-0"
        >
          <Eye size={13} /> Enter View As
        </button>
      </div>

      {/* Profile fields */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Personal Details</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-gray-400">Province</dt><dd className="font-medium text-gray-800">{profile.province || '—'}</dd></div>
            <div><dt className="text-gray-400">Age Category</dt><dd className="font-medium text-gray-800">{profile.age_category || '—'}</dd></div>
            <div><dt className="text-gray-400">Role</dt><dd className="font-medium text-gray-800 capitalize">{profile.role}</dd></div>
            <div><dt className="text-gray-400">Status</dt><dd className="font-medium text-gray-800 capitalize">{profile.status}</dd></div>
            <div><dt className="text-gray-400">Scoresheet Name</dt><dd className="font-medium text-gray-800">{profile.scoresheet_name || '—'}</dd></div>
            <div><dt className="text-gray-400">Joined</dt><dd className="font-medium text-gray-800">{formatDate(profile.created_at)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {/* Subscription / payment */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-gray-400" /> Subscription & Payment
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant={SUBSCRIPTION_BADGE[profile.subscription_status] || 'default'} className="capitalize">
              {profile.subscription_status || 'none'}
            </Badge>
            {profile.paygate_exempt && <Badge variant="brand">Free access (paygate exempt)</Badge>}
            {profile.subscription_end_at && (
              <span className="text-gray-500">Renews/ends {formatDate(profile.subscription_end_at)}</span>
            )}
            {profile.paystack_customer_code && (
              <span className="text-gray-400 text-xs">Paystack: {profile.paystack_customer_code}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Horses & combos */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <HeartPulse size={18} className="text-gray-400" /> Horses & Combos
          </h2>
          {horses.length === 0 ? (
            <p className="text-sm text-gray-400">No horses on record.</p>
          ) : (
            <div className="space-y-2">
              {combos.map(combo => {
                const horse = horses.find(h => h.id === combo.horse_id)
                return (
                  <div key={combo.id} className={`flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 ${combo.is_archived ? 'opacity-60' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{combo.horse_name}</p>
                      <p className="text-xs text-gray-400">{[horse?.breed, horse?.color].filter(Boolean).join(' · ') || 'No details'}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                      Level {combo.current_level ?? 0}{combo.is_archived ? ' · Archived' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries & results */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-gray-400" /> Recent Results
          </h2>
          {qualifierResults.length === 0 && eventDayResults.length === 0 && personalBests.length === 0 ? (
            <p className="text-sm text-gray-400">No results on record.</p>
          ) : (
            <div className="space-y-4">
              {personalBests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Personal Bests</p>
                  <div className="flex flex-wrap gap-2">
                    {personalBests.map((pb, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                        {pb.game}: {pb.best_time}s ({pb.season_year})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {qualifierResults.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Qualifier Results</p>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {qualifierResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-700">{r.game}</span>
                        <span className="text-gray-500">{r.qualifier_events?.venue} · {formatDate(r.qualifier_events?.date)}</span>
                        <span className="font-medium text-gray-800">{r.is_nt ? 'NT' : `${r.time}s`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {eventDayResults.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Event Day Results</p>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {eventDayResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-700">{r.game}</span>
                        <span className="text-gray-500">{r.qualifier_events?.venue} · {formatDate(r.qualifier_events?.date)}</span>
                        <span className="font-medium text-gray-800">{r.is_nt ? 'NT' : `${r.time}s`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Club/supporter links & activity */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={18} className="text-gray-400" /> Club / Supporter Activity
          </h2>
          <div className="space-y-3 text-sm">
            {clubHeadLinks.length === 0 && clubRiderLinks.length === 0 && supporterLinks.length === 0 ? (
              <p className="text-gray-400">No club or supporter links.</p>
            ) : (
              <>
                {clubHeadLinks.length > 0 && (
                  <p className="text-gray-600">Manages {clubHeadLinks.filter(l => l.status === 'accepted').length} club rider(s) ({clubHeadLinks.length} total link{clubHeadLinks.length === 1 ? '' : 's'}).</p>
                )}
                {clubRiderLinks.length > 0 && (
                  <p className="text-gray-600">Linked to a club head — status: {clubRiderLinks[0].status}.</p>
                )}
                {supporterLinks.length > 0 && (
                  <p className="text-gray-600">{supporterLinks.filter(l => l.status === 'accepted').length} accepted supporter(s) ({supporterLinks.length} total request{supporterLinks.length === 1 ? '' : 's'}).</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications history */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Bell size={18} className="text-gray-400" /> Recent Notifications
          </h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">No notifications on record.</p>
          ) : (
            <div className="space-y-1.5">
              {notifications.map(n => (
                <div key={n.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className={n.is_read ? 'text-gray-500' : 'text-gray-800 font-medium'}>{n.message}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problem reports */}
      {reports.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Flag size={18} className="text-gray-400" /> Problem Reports Filed
            </h2>
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-gray-800 truncate">{r.description}</p>
                    <p className="text-xs text-gray-400 capitalize">{r.category.replace('_', ' ')} · {formatDate(r.created_at)}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize flex-shrink-0">{r.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
