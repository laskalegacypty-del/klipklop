import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { PROVINCES, AGE_CATEGORIES } from '../../lib/constants'
import { uploadImageToBucket } from '../../lib/storageUploads'
import {
  User,
  Plus,
  Pencil,
  Trash2,
  Star,
  Archive,
  Save,
  Camera,
  KeyRound,
  ChevronRight,
  UserCheck,
  UserX,
  Users,
  Download,
  LogOut,
  PlayCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Badge,
  Button,
  Card,
  CardContent,
  PageHeader,
  PasswordInput,
  Input,
  Select,
  Modal,
  ConfirmDialog,
  Skeleton,
  EmptyState
} from '../../components/ui'
import { APP_NAME } from '../../constants/branding'
import {
  clearDeferredPwaInstallPrompt,
  getDeferredPwaInstallPrompt,
  isPwaStandaloneDisplay,
  PWA_APP_INSTALLED_EVENT,
  PWA_INSTALL_PROMPT_EVENT
} from '../../lib/pwaInstall'
import { START_TUTORIAL_EVENT } from '../../components/onboarding/OnboardingTour'

const EMPTY_COMBO = { horse_id: '', horse_name: '', current_level: 0 }

const LEVEL_STYLES = {
  4: 'bg-red-100 text-red-700',
  3: 'bg-orange-100 text-orange-700',
  2: 'bg-green-100 text-green-700',
  1: 'bg-blue-100 text-blue-700',
  0: 'bg-gray-100 text-gray-500',
}

function AvatarCircle({ src, name, size = 'md', className = '' }) {
  const sizes = { sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-20 h-20 text-2xl' }
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-green-700">{name?.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}

export default function Profile() {
  const { profile, refreshProfile, signOut, isSupporter, isClubHead, isClubMember } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [horses, setHorses] = useState([])
  const [combos, setCombos] = useState([])
  const [loadingCombos, setLoadingCombos] = useState(true)
  const [showComboModal, setShowComboModal] = useState(false)
  const [editingCombo, setEditingCombo] = useState(null)
  const [comboForm, setComboForm] = useState(EMPTY_COMBO)
  const [savingCombo, setSavingCombo] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ new_password: '', confirm_password: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [linkedSupporters, setLinkedSupporters] = useState([])
  const [loadingSupporters, setLoadingSupporters] = useState(false)
  const [linkedRiders, setLinkedRiders] = useState([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [clubMembers, setClubMembers] = useState([])
  const [loadingClubMembers, setLoadingClubMembers] = useState(false)
  const [myClubHead, setMyClubHead] = useState(null)
  const [loadingMyClub, setLoadingMyClub] = useState(false)

  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(() => getDeferredPwaInstallPrompt())
  const [pwaInstalledView, setPwaInstalledView] = useState(() => isPwaStandaloneDisplay())

  const [profileForm, setProfileForm] = useState({
    rider_name: '',
    province: '',
    age_category: '',
    scoresheet_name: ''
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        rider_name: profile.rider_name || '',
        province: profile.province || '',
        age_category: profile.age_category || '',
        scoresheet_name: profile.scoresheet_name || ''
      })
      if (isSupporter) {
        setLoadingCombos(false)
        fetchLinkedRiders()
      } else if (isClubHead) {
        setLoadingCombos(false)
        fetchClubMembers()
      } else {
        fetchData()
        fetchLinkedSupporters()
        fetchMyClubHead()
      }
    }
  }, [profile, isSupporter, isClubHead])

  useEffect(() => {
    const syncStandalone = () => setPwaInstalledView(isPwaStandaloneDisplay())
    syncStandalone()
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener?.('change', syncStandalone)
    return () => mq.removeEventListener?.('change', syncStandalone)
  }, [])

  useEffect(() => {
    const onPromptReady = () => setPwaInstallPrompt(getDeferredPwaInstallPrompt())
    const onAppInstalled = () => {
      setPwaInstallPrompt(null)
      setPwaInstalledView(true)
      toast.success('App installed — open it from your home screen or desktop.')
    }
    window.addEventListener(PWA_INSTALL_PROMPT_EVENT, onPromptReady)
    window.addEventListener(PWA_APP_INSTALLED_EVENT, onAppInstalled)
    return () => {
      window.removeEventListener(PWA_INSTALL_PROMPT_EVENT, onPromptReady)
      window.removeEventListener(PWA_APP_INSTALLED_EVENT, onAppInstalled)
    }
  }, [])

  async function handleInstallPwa() {
    const ev = pwaInstallPrompt || getDeferredPwaInstallPrompt()
    if (ev) {
      try {
        await ev.prompt()
        await ev.userChoice
      } finally {
        clearDeferredPwaInstallPrompt()
        setPwaInstallPrompt(null)
      }
      return
    }
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    toast(
      isIOS
        ? 'On iPhone or iPad: tap Share, then "Add to Home Screen".'
        : `In Chrome: use the install icon in the address bar if you see it, or the menu (⋮) → "Save and share" → "Install ${APP_NAME}…".`,
      { duration: 8000 }
    )
  }

  async function fetchData() {
    try {
      const [combosRes, horsesRes] = await Promise.all([
        supabase.from('horse_rider_combos').select('*').eq('user_id', profile.id).order('created_at', { ascending: true }),
        supabase.from('horses').select('id, name, photo_url, breed, color').eq('user_id', profile.id).order('name', { ascending: true })
      ])
      if (combosRes.error) throw combosRes.error
      if (horsesRes.error) throw horsesRes.error
      setCombos(combosRes.data || [])
      setHorses(horsesRes.data || [])
    } catch {
      toast.error('Error loading data')
    } finally {
      setLoadingCombos(false)
    }
  }

  async function fetchLinkedSupporters() {
    setLoadingSupporters(true)
    try {
      const { data: links, error } = await supabase
        .from('supporter_rider_links')
        .select('id, supporter_id, status, created_at')
        .eq('rider_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!links || links.length === 0) { setLinkedSupporters([]); return }
      const supporterIds = links.map(l => l.supporter_id)
      const { data: supporterProfiles } = await supabase
        .from('profiles').select('id, rider_name, profile_photo_url').in('id', supporterIds)
      const profileMap = {}
      supporterProfiles?.forEach(p => { profileMap[p.id] = p })
      setLinkedSupporters(links.map(link => ({ ...link, supporter: profileMap[link.supporter_id] || null })))
    } catch {
      toast.error('Error loading supporters')
    } finally {
      setLoadingSupporters(false)
    }
  }

  async function handleSupporterResponse(linkId, supporterId, action) {
    try {
      const newStatus = action === 'accept' ? 'accepted' : 'rejected'
      const { error } = await supabase.from('supporter_rider_links').update({ status: newStatus }).eq('id', linkId)
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: supporterId,
        type: action === 'accept' ? 'supporter_request_accepted' : 'supporter_request_rejected',
        message: action === 'accept'
          ? `${profile.rider_name} accepted your request to follow them.`
          : `${profile.rider_name} declined your supporter request.`,
        link: '/my-riders'
      })
      toast.success(action === 'accept' ? 'Supporter accepted' : 'Request declined')
      fetchLinkedSupporters()
    } catch {
      toast.error('Error updating request')
    }
  }

  async function handleRemoveSupporter(linkId) {
    try {
      const { error } = await supabase.from('supporter_rider_links').delete().eq('id', linkId)
      if (error) throw error
      toast.success('Supporter removed')
      fetchLinkedSupporters()
    } catch {
      toast.error('Error removing supporter')
    }
  }

  async function fetchLinkedRiders() {
    setLoadingRiders(true)
    try {
      const { data: links, error } = await supabase
        .from('supporter_rider_links')
        .select('id, rider_id, status, created_at')
        .eq('supporter_id', profile.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!links || links.length === 0) { setLinkedRiders([]); return }
      const riderIds = links.map(l => l.rider_id)
      const { data: riderProfiles } = await supabase
        .from('profiles').select('id, rider_name, province, profile_photo_url').in('id', riderIds)
      const profileMap = {}
      riderProfiles?.forEach(p => { profileMap[p.id] = p })
      setLinkedRiders(links.map(link => ({ ...link, rider: profileMap[link.rider_id] || null })))
    } catch {
      toast.error('Error loading linked riders')
    } finally {
      setLoadingRiders(false)
    }
  }

  async function handleRemoveRider(linkId) {
    try {
      const { error } = await supabase.from('supporter_rider_links').delete().eq('id', linkId)
      if (error) throw error
      toast.success('Rider removed')
      setLinkedRiders(prev => prev.filter(l => l.id !== linkId))
    } catch {
      toast.error('Error removing rider')
    }
  }

  async function fetchClubMembers() {
    setLoadingClubMembers(true)
    try {
      const { data: links, error } = await supabase
        .from('club_member_links')
        .select('id, rider_id, status, created_at')
        .eq('club_head_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!links || links.length === 0) { setClubMembers([]); return }
      const riderIds = links.map(l => l.rider_id)
      const { data: riderProfiles } = await supabase
        .from('profiles').select('id, rider_name, province, age_category, profile_photo_url').in('id', riderIds)
      const profileMap = {}
      riderProfiles?.forEach(p => { profileMap[p.id] = p })
      setClubMembers(links.map(link => ({ ...link, rider: profileMap[link.rider_id] || null })))
    } catch {
      toast.error('Error loading club members')
    } finally {
      setLoadingClubMembers(false)
    }
  }

  async function handleRemoveClubMember(linkId) {
    try {
      const { error } = await supabase.from('club_member_links').delete().eq('id', linkId)
      if (error) throw error
      toast.success('Rider removed from club')
      setClubMembers(prev => prev.filter(l => l.id !== linkId))
    } catch {
      toast.error('Error removing club member')
    }
  }

  async function fetchMyClubHead() {
    setLoadingMyClub(true)
    try {
      const { data: links, error } = await supabase
        .from('club_member_links')
        .select('id, club_head_id, status, created_at')
        .eq('rider_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!links || links.length === 0) { setMyClubHead(null); return }
      const link =
        links.find(l => l.status === 'pending') ||
        links.find(l => l.status === 'accepted') ||
        null
      if (!link) { setMyClubHead(null); return }
      const { data: headProfile } = await supabase
        .from('profiles').select('id, rider_name, province, profile_photo_url').eq('id', link.club_head_id).maybeSingle()
      setMyClubHead(headProfile ? { ...link, head: headProfile } : null)
    } catch (error) {
      console.error('Error loading club head', error)
    } finally {
      setLoadingMyClub(false)
    }
  }

  async function handleClubLinkResponse(linkId, clubHeadId, action) {
    try {
      const newStatus = action === 'accept' ? 'accepted' : 'rejected'
      const { error } = await supabase.from('club_member_links').update({ status: newStatus }).eq('id', linkId)
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: clubHeadId,
        type: action === 'accept' ? 'club_link_accepted' : 'club_link_rejected',
        message: action === 'accept'
          ? `${profile.rider_name} accepted your request to join the club/family.`
          : `${profile.rider_name} declined your club/family request.`,
        link: '/my-club-riders'
      })
      toast.success(action === 'accept' ? 'You joined the club!' : 'Request declined')
      fetchMyClubHead()
    } catch {
      toast.error('Error responding to club request')
    }
  }

  function getLinkedHorse(combo) {
    if (combo.horse_id) return horses.find(h => h.id === combo.horse_id) || null
    return horses.find(h => h.name.toLowerCase() === combo.horse_name?.toLowerCase()) || null
  }

  async function handleSaveProfile() {
    if (!profileForm.rider_name || !profileForm.province) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!isSupporter && !isClubHead && !profileForm.age_category) {
      toast.error('Please select your age category')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('profiles').update({
        rider_name: profileForm.rider_name,
        province: profileForm.province,
        age_category: profileForm.age_category,
        scoresheet_name: profileForm.scoresheet_name || null
      }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated')
    } catch {
      toast.error('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      if (!profile?.id) throw new Error('Not signed in')
      const filePath = `${profile.id}/avatar.jpg`
      const { publicUrl } = await uploadImageToBucket({ bucket: 'avatars', path: filePath, file })
      const { error: updateError } = await supabase.from('profiles').update({ profile_photo_url: publicUrl }).eq('id', profile.id)
      if (updateError) throw updateError
      await refreshProfile()
      toast.success('Photo updated')
    } catch (error) {
      console.error(error)
      toast.error(error?.message || 'Error uploading photo')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  async function handleSavePassword() {
    if (!passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error('Please fill in all fields')
      return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password })
      if (error) throw error
      toast.success('Password updated')
      setShowPasswordModal(false)
      setPasswordForm({ new_password: '', confirm_password: '' })
    } catch {
      toast.error('Error updating password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  function openAddCombo() {
    setEditingCombo(null)
    setComboForm(EMPTY_COMBO)
    setShowComboModal(true)
  }

  function openEditCombo(combo) {
    setEditingCombo(combo)
    setComboForm({ horse_id: combo.horse_id || '', horse_name: combo.horse_name, current_level: combo.current_level ?? 0 })
    setShowComboModal(true)
  }

  function handleHorseSelect(horseId) {
    const horse = horses.find(h => h.id === horseId)
    setComboForm(f => ({ ...f, horse_id: horseId, horse_name: horse?.name || '' }))
  }

  async function handleSaveCombo() {
    if (!comboForm.horse_id && !comboForm.horse_name.trim()) {
      toast.error('Please select a horse')
      return
    }
    setSavingCombo(true)
    try {
      const currentLevel = parseInt(comboForm.current_level, 10)
      if (Number.isNaN(currentLevel) || currentLevel < 0 || currentLevel > 4) {
        toast.error('Current level must be between 0 and 4')
        return
      }
      const payload = { horse_name: comboForm.horse_name, horse_id: comboForm.horse_id || null, current_level: currentLevel }
      if (editingCombo) {
        const { error } = await supabase.from('horse_rider_combos').update(payload).eq('id', editingCombo.id)
        if (error) throw error
        toast.success('Combo updated')
      } else {
        const { error } = await supabase.from('horse_rider_combos').insert({
          user_id: profile.id, ...payload,
          is_pinned: combos.filter(c => !c.is_archived).length === 0,
          is_archived: false
        })
        if (error) throw error
        toast.success('Combo added')
      }
      setShowComboModal(false)
      fetchData()
    } catch {
      toast.error('Error saving combo')
    } finally {
      setSavingCombo(false)
    }
  }

  async function handlePinCombo(comboId) {
    try {
      await supabase.from('horse_rider_combos').update({ is_pinned: false }).eq('user_id', profile.id)
      await supabase.from('horse_rider_combos').update({ is_pinned: true }).eq('id', comboId)
      toast.success('Pinned to dashboard')
      fetchData()
    } catch {
      toast.error('Error pinning combo')
    }
  }

  async function handleArchiveCombo(comboId, currentArchived) {
    try {
      const { error } = await supabase.from('horse_rider_combos').update({ is_archived: !currentArchived }).eq('id', comboId)
      if (error) throw error
      toast.success(currentArchived ? 'Combo restored' : 'Combo archived')
      fetchData()
    } catch {
      toast.error('Error archiving combo')
    }
  }

  async function handleDeleteCombo(comboId) {
    try {
      const { error } = await supabase.from('horse_rider_combos').delete().eq('id', comboId)
      if (error) throw error
      toast.success('Combo deleted')
      setShowDeleteConfirm(null)
      fetchData()
    } catch {
      toast.error('Error deleting combo')
    }
  }

  const activeCombos = combos.filter(c => !c.is_archived)
  const archivedCombos = combos.filter(c => c.is_archived)
  const linkedHorseIds = new Set(activeCombos.map(c => c.horse_id).filter(Boolean))
  const unlinkedHorses = horses.filter(h => !linkedHorseIds.has(h.id))

  const roleLabel = isSupporter ? 'Supporter' : isClubHead ? 'Club Head' : isClubMember ? 'Club Member' : 'Rider'

  return (
    <div className="space-y-6">

      {/* ── Modals ─────────────────────────────────── */}

      {/* Combo modal */}
      <Modal
        open={showComboModal}
        onClose={() => setShowComboModal(false)}
        title={editingCombo ? 'Edit Combo' : 'Add Horse/Rider Combo'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horse</label>
            {horses.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                No horses found.{' '}
                <Link to="/horses" className="font-semibold underline" onClick={() => setShowComboModal(false)}>
                  Add a horse first →
                </Link>
              </div>
            ) : (
              <>
                <Select value={comboForm.horse_id} onChange={e => handleHorseSelect(e.target.value)}>
                  <option value="">— Select a horse —</option>
                  {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </Select>
                {comboForm.horse_id && (() => {
                  const h = horses.find(x => x.id === comboForm.horse_id)
                  if (!h) return null
                  return (
                    <div className="mt-2 flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        {h.photo_url ? (
                          <img src={h.photo_url} alt={h.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-green-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{h.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{h.name}</p>
                        <p className="text-xs text-gray-400">{[h.breed, h.color].filter(Boolean).join(' · ') || 'No details'}</p>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Level</label>
            <Select value={comboForm.current_level} onChange={e => setComboForm({ ...comboForm, current_level: e.target.value })}>
              {[0, 1, 2, 3, 4].map(l => <option key={l} value={l}>Level {l}</option>)}
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              Used as the default "level entered" in Qualifier Tracker for overcount calculation.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setShowComboModal(false)}>Cancel</Button>
          <Button
            onClick={handleSaveCombo}
            disabled={savingCombo || (!comboForm.horse_id && !comboForm.horse_name)}
          >
            <Save size={16} />
            {savingCombo ? 'Saving…' : editingCombo ? 'Update' : 'Add Combo'}
          </Button>
        </div>
      </Modal>

      {/* Password modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <PasswordInput
              value={passwordForm.new_password}
              onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <PasswordInput
              value={passwordForm.confirm_password}
              onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
          <Button onClick={handleSavePassword} disabled={savingPassword}>
            <Save size={16} />
            {savingPassword ? 'Saving…' : 'Update Password'}
          </Button>
        </div>
      </Modal>

      {/* Delete combo confirm */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => handleDeleteCombo(showDeleteConfirm)}
        title="Delete combo?"
        description="This permanently deletes the combo and all associated times and personal bests. This cannot be undone."
        confirmLabel="Delete permanently"
        variant="danger"
      />

      {/* ── Page header ────────────────────────────── */}
      <PageHeader
        title="Profile"
        description={
          isSupporter ? 'Manage your account' :
          isClubHead ? 'Manage your account and club riders' :
          'Manage your account and horse/rider combos'
        }
      />

      {/* ── Hero card ──────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-green-900 via-green-700 to-green-500" />
        <CardContent className="px-6 pb-6 pt-0 -mt-12">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Avatar with camera button */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-green-100 flex items-center justify-center">
                {profile?.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-green-700">
                    {profile?.rider_name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-green-700 text-white rounded-full p-1.5 cursor-pointer hover:bg-green-800 transition border-2 border-white shadow">
                <Camera size={11} />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="flex-1 min-w-0 pt-10 sm:pt-14">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900 truncate">{profile?.rider_name}</h2>
                <span className="text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {[profile?.province, (!isSupporter && !isClubHead) ? profile?.age_category : null].filter(Boolean).join(' · ')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={profile?.status === 'approved' ? 'success' : 'warning'} className="capitalize">
                  {profile?.status}
                </Badge>
                {uploadingPhoto && <span className="text-xs text-gray-400 animate-pulse">Uploading photo…</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Install as app (PWA) ───────────────────── */}
      {!pwaInstalledView && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Download size={18} className="text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-800 mb-0.5">Install {APP_NAME}</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Add to your home screen or desktop for quick access, like a native app.
                </p>
                <Button type="button" variant="secondary" onClick={handleInstallPwa} className="w-full sm:w-auto">
                  <Download size={15} />
                  {pwaInstallPrompt ? 'Install app' : 'How to install'}
                </Button>
                {!pwaInstallPrompt && (
                  <div className="mt-3 text-xs text-gray-500 space-y-1.5 border-t border-gray-100 pt-3">
                    <p><span className="font-medium text-gray-700">Chrome desktop:</span> install icon in address bar, or menu (⋮) → Save and share → Install {APP_NAME}…</p>
                    <p><span className="font-medium text-gray-700">iPhone / iPad:</span> tap Share, then Add to Home Screen.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Personal details ───────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User size={18} className="text-gray-400" />
            Personal Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {(isSupporter || isClubHead) ? 'Full Name' : 'Full Name (Rider Name)'}
              </label>
              <Input
                type="text"
                value={profileForm.rider_name}
                onChange={e => setProfileForm({ ...profileForm, rider_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <Select
                value={profileForm.province}
                onChange={e => setProfileForm({ ...profileForm, province: e.target.value })}
              >
                <option value="">Select province</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>

            {!isSupporter && !isClubHead && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age Category</label>
                  <Select
                    value={profileForm.age_category}
                    onChange={e => setProfileForm({ ...profileForm, age_category: e.target.value })}
                  >
                    {AGE_CATEGORIES.map(a => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scoresheet Name
                    <span className="text-gray-400 font-normal ml-1">(as shown on SAWMGA scoresheets)</span>
                  </label>
                  <Input
                    type="text"
                    value={profileForm.scoresheet_name}
                    onChange={e => setProfileForm({ ...profileForm, scoresheet_name: e.target.value })}
                    placeholder="e.g. exactly as it appears on your results PDF"
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <Button onClick={handleSaveProfile} disabled={loading}>
                <Save size={16} />
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="secondary" onClick={() => setShowPasswordModal(true)}>
                <KeyRound size={16} />
                Change Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Horse/Rider Combos ─────────────────────── */}
      {!isSupporter && !isClubHead && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Horse/Rider Combos</h2>
              <div className="flex items-center gap-2">
                <Link to="/horses" className="text-sm text-gray-500 hover:text-green-700 transition">
                  Manage horses →
                </Link>
                <Button onClick={openAddCombo}>
                  <Plus size={16} />
                  Add Combo
                </Button>
              </div>
            </div>

            {!loadingCombos && unlinkedHorses.length > 0 && activeCombos.length > 0 && (
              <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {unlinkedHorses.length} horse{unlinkedHorses.length > 1 ? 's' : ''} not linked to a combo: {unlinkedHorses.map(h => h.name).join(', ')}
              </div>
            )}

            {loadingCombos ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : horses.length === 0 ? (
              <EmptyState
                title="No horses yet"
                description="Add your horses first, then link them to a rider combo."
                action={
                  <Link to="/horses" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline">
                    Go to Horses <ChevronRight size={14} />
                  </Link>
                }
              />
            ) : activeCombos.length === 0 ? (
              <EmptyState
                title="No combos yet"
                description="Link a horse to your rider profile to start tracking times."
              />
            ) : (
              <div className="space-y-3">
                {activeCombos.map(combo => {
                  const horse = getLinkedHorse(combo)
                  return (
                    <div
                      key={combo.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border ${
                        combo.is_pinned ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {/* Horse avatar */}
                      <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border ${combo.is_pinned ? 'border-green-300' : 'border-gray-200'}`}>
                        {horse?.photo_url ? (
                          <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${combo.is_pinned ? 'bg-green-600' : 'bg-gray-300'}`}>
                            <span className="text-white font-bold text-sm">{combo.horse_name?.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-800 truncate">{combo.horse_name}</p>
                          {horse && (
                            <Link to={`/horses/${horse.id}`} className="text-xs text-green-600 hover:underline flex-shrink-0">
                              View profile
                            </Link>
                          )}
                        </div>
                        {horse?.breed || horse?.color ? (
                          <p className="text-xs text-gray-400">{[horse.breed, horse.color].filter(Boolean).join(' · ')}</p>
                        ) : null}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEVEL_STYLES[combo.current_level ?? 0] ?? LEVEL_STYLES[0]}`}>
                            Level {combo.current_level ?? 0}
                          </span>
                          {combo.is_pinned && <span className="text-xs text-green-600 font-medium">★ Pinned</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!combo.is_pinned && (
                          <button
                            onClick={() => handlePinCombo(combo.id)}
                            className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition"
                            title="Pin to dashboard"
                          >
                            <Star size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditCombo(combo)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleArchiveCombo(combo.id, false)}
                          className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                          title="Archive"
                        >
                          <Archive size={15} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(combo.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete permanently"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Archived combos */}
            {archivedCombos.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Archived</p>
                <div className="space-y-2">
                  {archivedCombos.map(combo => {
                    const horse = getLinkedHorse(combo)
                    return (
                      <div key={combo.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-60">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                            {horse?.photo_url ? (
                              <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">{combo.horse_name?.charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-600">{combo.horse_name}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleArchiveCombo(combo.id, true)}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(combo.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Linked Supporters (rider) ──────────────── */}
      {!isSupporter && !isClubHead && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              Linked Supporters
            </h2>

            {loadingSupporters ? (
              <div className="space-y-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : linkedSupporters.length === 0 ? (
              <EmptyState
                title="No supporters linked"
                description="Supporters who request to follow you will appear here."
              />
            ) : (
              <div className="space-y-3">
                {linkedSupporters.map(link => (
                  <div
                    key={link.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      link.status === 'accepted' ? 'border-green-200 bg-green-50' :
                      link.status === 'pending' ? 'border-yellow-200 bg-yellow-50' :
                      'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarCircle src={link.supporter?.profile_photo_url} name={link.supporter?.rider_name} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.supporter?.rider_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">
                          {link.status === 'accepted' ? '✓ Supporter' : link.status === 'pending' ? '⏳ Awaiting your response' : '✗ Declined'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {link.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleSupporterResponse(link.id, link.supporter_id, 'accept')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            <UserCheck size={13} /> Accept
                          </button>
                          <button
                            onClick={() => handleSupporterResponse(link.id, link.supporter_id, 'reject')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                          >
                            <UserX size={13} /> Decline
                          </button>
                        </>
                      )}
                      {link.status === 'accepted' && (
                        <button
                          onClick={() => handleRemoveSupporter(link.id)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Remove supporter"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── My Club Riders (club head) ─────────────── */}
      {isClubHead && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Users size={18} className="text-gray-400" />
                My Club Riders
              </h2>
              <Link to="/my-club-riders" className="text-sm font-medium text-green-700 hover:underline flex items-center gap-1">
                Manage riders →
              </Link>
            </div>

            {loadingClubMembers ? (
              <div className="space-y-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : clubMembers.length === 0 ? (
              <EmptyState
                title="No riders added yet"
                action={
                  <Link to="/my-club-riders" className="text-sm font-semibold text-green-700 hover:underline">
                    Go to My Riders to add a rider →
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {clubMembers.filter(l => l.status === 'accepted').map(link => (
                  <div key={link.id} className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3">
                      <AvatarCircle src={link.rider?.profile_photo_url} name={link.rider?.rider_name} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{link.rider?.age_category || link.rider?.province || ''}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveClubMember(link.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove from club">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {clubMembers.filter(l => l.status === 'pending').map(link => (
                  <div key={link.id} className="flex items-center justify-between p-4 rounded-xl border border-yellow-200 bg-yellow-50">
                    <div className="flex items-center gap-3">
                      <AvatarCircle src={null} name={link.rider?.rider_name} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                        <p className="text-xs text-yellow-600">⏳ Awaiting rider's acceptance</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveClubMember(link.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Withdraw request">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── My Club / Family (rider linked to club head) ── */}
      {!isSupporter && !isClubHead && (
        <Card id="my-club-family" className="scroll-mt-24">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              My Club / Family
            </h2>

            {loadingMyClub ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : !myClubHead ? (
              <EmptyState
                title="Not linked to a club yet"
                description="Your club head will send you a request to link you to the club."
              />
            ) : myClubHead.status === 'pending' ? (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
                <div className="flex items-center gap-3">
                  <AvatarCircle src={myClubHead.head?.profile_photo_url} name={myClubHead.head?.rider_name} />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{myClubHead.head?.rider_name || 'Unknown'}</p>
                    <p className="text-xs text-yellow-600">⏳ Wants to add you to their club/family</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleClubLinkResponse(myClubHead.id, myClubHead.club_head_id, 'accept')}
                    className="flex-1 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => handleClubLinkResponse(myClubHead.id, myClubHead.club_head_id, 'reject')}
                    className="flex-1 py-2 text-sm font-semibold border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
                <AvatarCircle src={myClubHead.head?.profile_photo_url} name={myClubHead.head?.rider_name} />
                <div>
                  <p className="font-medium text-gray-800 text-sm">{myClubHead.head?.rider_name || 'Unknown'}</p>
                  <p className="text-xs text-green-600">✓ Club / Family Head</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── My Riders (supporter) ─────────────────── */}
      {isSupporter && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Users size={18} className="text-gray-400" />
                My Riders
              </h2>
              <Link to="/my-riders" className="text-sm font-medium text-green-700 hover:underline flex items-center gap-1">
                Manage riders →
              </Link>
            </div>

            {loadingRiders ? (
              <div className="space-y-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : linkedRiders.length === 0 ? (
              <EmptyState
                title="No linked riders yet"
                action={
                  <Link to="/my-riders" className="text-sm font-semibold text-green-700 hover:underline">
                    Go to My Riders to send a request →
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {linkedRiders.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3">
                      <AvatarCircle src={link.rider?.profile_photo_url} name={link.rider?.rider_name} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{link.rider?.province || ''}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveRider(link.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove rider">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Account / Sign Out (danger zone) ─────────── */}
      <Card className="border-red-100">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Account</h2>
          <p className="text-sm text-gray-500 mb-4">Sign out, or replay the getting-started walkthrough.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={() => window.dispatchEvent(new CustomEvent(START_TUTORIAL_EVENT))}>
              <PlayCircle size={16} />
              Replay tutorial
            </Button>
            <Button variant="danger" type="button" onClick={handleSignOut}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
