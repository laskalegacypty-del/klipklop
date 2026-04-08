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
  X,
  Camera,
  KeyRound,
  ChevronRight,
  UserCheck,
  UserX,
  Users,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, Card, CardContent, PageHeader, PasswordInput } from '../../components/ui'
import { APP_NAME } from '../../constants/branding'
import {
  clearDeferredPwaInstallPrompt,
  getDeferredPwaInstallPrompt,
  isPwaStandaloneDisplay,
  PWA_APP_INSTALLED_EVENT,
  PWA_INSTALL_PROMPT_EVENT
} from '../../lib/pwaInstall'

const EMPTY_COMBO = {
  horse_id: '',
  horse_name: '',
  current_level: 0,
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
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: ''
  })
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Linked supporters (for rider profiles)
  const [linkedSupporters, setLinkedSupporters] = useState([])
  const [loadingSupporters, setLoadingSupporters] = useState(false)

  // Linked riders (for supporter profiles)
  const [linkedRiders, setLinkedRiders] = useState([])
  const [loadingRiders, setLoadingRiders] = useState(false)

  // Linked club members (for club_head profiles)
  const [clubMembers, setClubMembers] = useState([])
  const [loadingClubMembers, setLoadingClubMembers] = useState(false)

  // club_member: the club_head they are linked to
  const [myClubHead, setMyClubHead] = useState(null)
  const [loadingMyClub, setLoadingMyClub] = useState(false)

  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(() => getDeferredPwaInstallPrompt())
  const [pwaInstalledView, setPwaInstalledView] = useState(() => isPwaStandaloneDisplay())

  // Profile form
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
        // regular 'user' rider (may or may not be linked to a club/family)
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
        ? 'On iPhone or iPad: tap Share, then “Add to Home Screen”.'
        : `In Chrome: use the install icon in the address bar if you see it, or the menu (⋮) → “Save and share” → “Install ${APP_NAME}…”.`,
      { duration: 8000 }
    )
  }

  async function fetchData() {
    try {
      const [combosRes, horsesRes] = await Promise.all([
        supabase
          .from('horse_rider_combos')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('horses')
          .select('id, name, photo_url, breed, color')
          .eq('user_id', profile.id)
          .order('name', { ascending: true })
      ])

      if (combosRes.error) throw combosRes.error
      if (horsesRes.error) throw horsesRes.error

      setCombos(combosRes.data || [])
      setHorses(horsesRes.data || [])
    } catch (error) {
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
      if (!links || links.length === 0) {
        setLinkedSupporters([])
        return
      }

      // Fetch supporter profiles
      const supporterIds = links.map(l => l.supporter_id)
      const { data: supporterProfiles } = await supabase
        .from('profiles')
        .select('id, rider_name, profile_photo_url')
        .in('id', supporterIds)

      const profileMap = {}
      supporterProfiles?.forEach(p => { profileMap[p.id] = p })

      setLinkedSupporters(links.map(link => ({
        ...link,
        supporter: profileMap[link.supporter_id] || null
      })))
    } catch (error) {
      toast.error('Error loading supporters')
    } finally {
      setLoadingSupporters(false)
    }
  }

  async function handleSupporterResponse(linkId, supporterId, action) {
    try {
      const newStatus = action === 'accept' ? 'accepted' : 'rejected'
      const { error } = await supabase
        .from('supporter_rider_links')
        .update({ status: newStatus })
        .eq('id', linkId)

      if (error) throw error

      // Notify the supporter
      const notifType = action === 'accept' ? 'supporter_request_accepted' : 'supporter_request_rejected'
      const notifMsg = action === 'accept'
        ? `${profile.rider_name} accepted your request to follow them.`
        : `${profile.rider_name} declined your supporter request.`

      await supabase.from('notifications').insert({
        user_id: supporterId,
        type: notifType,
        message: notifMsg,
        link: '/my-riders'
      })

      toast.success(action === 'accept' ? 'Supporter accepted' : 'Request declined')
      fetchLinkedSupporters()
    } catch (error) {
      toast.error('Error updating request')
    }
  }

  async function handleRemoveSupporter(linkId) {
    try {
      const { error } = await supabase
        .from('supporter_rider_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Supporter removed')
      fetchLinkedSupporters()
    } catch (error) {
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
        .from('profiles')
        .select('id, rider_name, province, profile_photo_url')
        .in('id', riderIds)

      const profileMap = {}
      riderProfiles?.forEach(p => { profileMap[p.id] = p })

      setLinkedRiders(links.map(link => ({
        ...link,
        rider: profileMap[link.rider_id] || null
      })))
    } catch (error) {
      toast.error('Error loading linked riders')
    } finally {
      setLoadingRiders(false)
    }
  }

  async function handleRemoveRider(linkId) {
    try {
      const { error } = await supabase
        .from('supporter_rider_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Rider removed')
      setLinkedRiders(prev => prev.filter(l => l.id !== linkId))
    } catch (error) {
      toast.error('Error removing rider')
    }
  }

  // ─── Club Head: fetch linked club members ────────────────────────────
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
        .from('profiles')
        .select('id, rider_name, province, age_category, profile_photo_url')
        .in('id', riderIds)

      const profileMap = {}
      riderProfiles?.forEach(p => { profileMap[p.id] = p })

      setClubMembers(links.map(link => ({
        ...link,
        rider: profileMap[link.rider_id] || null
      })))
    } catch (error) {
      toast.error('Error loading club members')
    } finally {
      setLoadingClubMembers(false)
    }
  }

  async function handleRemoveClubMember(linkId) {
    try {
      const { error } = await supabase
        .from('club_member_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Rider removed from club')
      setClubMembers(prev => prev.filter(l => l.id !== linkId))
    } catch (error) {
      toast.error('Error removing club member')
    }
  }

  // ─── Club Member: fetch the club_head they are linked to (any status) ──
  async function fetchMyClubHead() {
    setLoadingMyClub(true)
    try {
      // Fetch all links (pending + accepted) so member can accept/reject
      const { data: links, error } = await supabase
        .from('club_member_links')
        .select('id, club_head_id, status, created_at')
        .eq('rider_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!links || links.length === 0) { setMyClubHead(null); return }

      // Pending must win: a rider can have an accepted link to one head and a new pending request from another.
      const link =
        links.find(l => l.status === 'pending') ||
        links.find(l => l.status === 'accepted') ||
        null
      if (!link) { setMyClubHead(null); return }

      const { data: headProfile } = await supabase
        .from('profiles')
        .select('id, rider_name, province, profile_photo_url')
        .eq('id', link.club_head_id)
        .maybeSingle()

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
      const { error } = await supabase
        .from('club_member_links')
        .update({ status: newStatus })
        .eq('id', linkId)

      if (error) throw error

      // Notify the club head
      const notifType = action === 'accept' ? 'club_link_accepted' : 'club_link_rejected'
      const notifMsg = action === 'accept'
        ? `${profile.rider_name} accepted your request to join the club/family.`
        : `${profile.rider_name} declined your club/family request.`

      await supabase.from('notifications').insert({
        user_id: clubHeadId,
        type: notifType,
        message: notifMsg,
        link: '/my-club-riders'
      })

      toast.success(action === 'accept' ? 'You joined the club!' : 'Request declined')
      fetchMyClubHead()
    } catch (error) {
      toast.error('Error responding to club request')
    }
  }

  // Find the linked horse record for a combo (by horse_id, then fall back to name)
  function getLinkedHorse(combo) {
    if (combo.horse_id) return horses.find(h => h.id === combo.horse_id) || null
    return horses.find(h => h.name.toLowerCase() === combo.horse_name?.toLowerCase()) || null
  }

  async function handleSaveProfile() {
    if (!profileForm.rider_name || !profileForm.province) {
      toast.error('Please fill in all required fields')
      return
    }
    const needsAgeCategory = !isSupporter && !isClubHead
    if (needsAgeCategory && !profileForm.age_category) {
      toast.error('Please select your age category')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          rider_name: profileForm.rider_name,
          province: profileForm.province,
          age_category: profileForm.age_category,
          scoresheet_name: profileForm.scoresheet_name || null
        })
        .eq('id', profile.id)

      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch (error) {
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
      const { publicUrl } = await uploadImageToBucket({
        bucket: 'avatars',
        path: filePath,
        file,
      })

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Photo updated successfully')
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
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new_password
      })

      if (error) throw error
      toast.success('Password updated successfully')
      setShowPasswordModal(false)
      setPasswordForm({ new_password: '', confirm_password: '' })
    } catch (error) {
      toast.error('Error updating password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Signed out successfully')
  }

  function openAddCombo() {
    setEditingCombo(null)
    setComboForm(EMPTY_COMBO)
    setShowComboModal(true)
  }

  function openEditCombo(combo) {
    setEditingCombo(combo)
    setComboForm({
      horse_id: combo.horse_id || '',
      horse_name: combo.horse_name,
      current_level: combo.current_level ?? 0,
    })
    setShowComboModal(true)
  }

  function handleHorseSelect(horseId) {
    const horse = horses.find(h => h.id === horseId)
    setComboForm(f => ({
      ...f,
      horse_id: horseId,
      horse_name: horse?.name || ''
    }))
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

      const payload = {
        horse_name: comboForm.horse_name,
        horse_id: comboForm.horse_id || null,
        current_level: currentLevel,
      }

      if (editingCombo) {
        const { error } = await supabase
          .from('horse_rider_combos')
          .update(payload)
          .eq('id', editingCombo.id)

        if (error) throw error
        toast.success('Combo updated')
      } else {
        const { error } = await supabase
          .from('horse_rider_combos')
          .insert({
            user_id: profile.id,
            ...payload,
            is_pinned: combos.filter(c => !c.is_archived).length === 0,
            is_archived: false
          })

        if (error) throw error
        toast.success('Horse/rider combo added')
      }

      setShowComboModal(false)
      fetchData()
    } catch (error) {
      toast.error('Error saving combo')
    } finally {
      setSavingCombo(false)
    }
  }

  async function handlePinCombo(comboId) {
    try {
      await supabase
        .from('horse_rider_combos')
        .update({ is_pinned: false })
        .eq('user_id', profile.id)

      await supabase
        .from('horse_rider_combos')
        .update({ is_pinned: true })
        .eq('id', comboId)

      toast.success('Pinned to dashboard')
      fetchData()
    } catch (error) {
      toast.error('Error pinning combo')
    }
  }

  async function handleArchiveCombo(comboId, currentArchived) {
    try {
      const { error } = await supabase
        .from('horse_rider_combos')
        .update({ is_archived: !currentArchived })
        .eq('id', comboId)

      if (error) throw error
      toast.success(currentArchived ? 'Combo restored' : 'Combo archived')
      fetchData()
    } catch (error) {
      toast.error('Error archiving combo')
    }
  }

  async function handleDeleteCombo(comboId) {
    try {
      const { error } = await supabase
        .from('horse_rider_combos')
        .delete()
        .eq('id', comboId)

      if (error) throw error
      toast.success('Combo deleted permanently')
      setShowDeleteConfirm(null)
      fetchData()
    } catch (error) {
      toast.error('Error deleting combo')
    }
  }

  const activeCombos = combos.filter(c => !c.is_archived)
  const archivedCombos = combos.filter(c => c.is_archived)

  // Horses not yet linked to any active combo
  const linkedHorseIds = new Set(activeCombos.map(c => c.horse_id).filter(Boolean))
  const unlinkedHorses = horses.filter(h => !linkedHorseIds.has(h.id))

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <PageHeader
        title="Profile"
        description={
          isSupporter ? 'Manage your account' :
          isClubHead ? 'Manage your account and club riders' :
          'Manage your account and horse/rider combos'
        }
      />

      {/* Profile photo + status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center overflow-hidden">
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt="Profile"
                  className="w-20 h-20 object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-green-800">
                  {profile?.rider_name?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-green-800 text-white rounded-full p-1.5 cursor-pointer hover:bg-green-900 transition">
              <Camera size={12} />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">{profile?.rider_name}</h2>
            <p className="text-gray-500 text-sm">
              {profile?.province}{(!isSupporter && !isClubHead) && profile?.age_category ? ` · ${profile.age_category}` : ''}
            </p>
            <Badge className="mt-2 capitalize" variant={profile?.status === 'approved' ? 'success' : 'warning'}>
              {profile?.status}
            </Badge>
          </div>
          {uploadingPhoto && (
            <p className="text-sm text-gray-400 ml-auto">Uploading...</p>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Install as app (PWA) */}
      {!pwaInstalledView && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Download size={20} className="text-gray-400" aria-hidden />
              Install {APP_NAME}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Add {APP_NAME} to your phone’s home screen or your computer desktop for quick access, like a normal app.
            </p>
            <Button type="button" onClick={handleInstallPwa} className="w-full sm:w-auto">
              <Download size={18} aria-hidden />
              {pwaInstallPrompt ? 'Install app' : 'How to install'}
            </Button>
            {!pwaInstallPrompt && (
              <div className="mt-4 text-sm text-gray-600 space-y-2 border-t border-gray-100 pt-4">
                <p className="font-medium text-gray-700">Chrome (desktop)</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Check the right side of the address bar for an install icon — click it and confirm.
                  </li>
                  <li>
                    Or open the menu (⋮) → <span className="font-medium">Save and share</span> →{' '}
                    <span className="font-medium">Install {APP_NAME}…</span> (wording may vary slightly by version).
                  </li>
                </ul>
                <p className="font-medium text-gray-700 pt-2">iPhone / iPad</p>
                <p>
                  Tap <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personal details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User size={20} className="text-gray-400" />
          Personal Details
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {(isSupporter || isClubHead) ? 'Full Name' : 'Full Name (Rider Name)'}
            </label>
            <input
              type="text"
              value={profileForm.rider_name}
              onChange={e => setProfileForm({ ...profileForm, rider_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Province — all roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Province
            </label>
            <select
              value={profileForm.province}
              onChange={e => setProfileForm({ ...profileForm, province: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Select province</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Age Category + Scoresheet — riders and club_member only */}
          {!isSupporter && !isClubHead && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age Category
                </label>
                <select
                  value={profileForm.age_category}
                  onChange={e => setProfileForm({ ...profileForm, age_category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  {AGE_CATEGORIES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scoresheet Name
                  <span className="text-gray-400 font-normal ml-1">
                    (name as it appears on SAWMGA scoresheets)
                  </span>
                </label>
                <input
                  type="text"
                  value={profileForm.scoresheet_name}
                  onChange={e => setProfileForm({ ...profileForm, scoresheet_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="e.g. exactly as shown on your results PDF"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              <KeyRound size={16} />
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Account actions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Account</h2>
          <p className="text-sm text-gray-500 mb-4">Sign out of your account on this device.</p>
          <Button
            type="button"
            variant="danger"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Horse/rider combos — regular riders and club_member (hidden for supporter and club_head) */}
      {!isSupporter && !isClubHead && <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Horse/Rider Combos
          </h2>
          <div className="flex items-center gap-2">
            <Link
              to="/horses"
              className="text-sm text-gray-500 hover:text-green-700 transition"
            >
              Manage horses →
            </Link>
            <button
              onClick={openAddCombo}
              className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              <Plus size={16} />
              Add Combo
            </button>
          </div>
        </div>

        {/* Hint if there are unlinked horses */}
        {!loadingCombos && unlinkedHorses.length > 0 && activeCombos.length > 0 && (
          <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {unlinkedHorses.length} of your horse{unlinkedHorses.length > 1 ? 's' : ''} ({unlinkedHorses.map(h => h.name).join(', ')}) {unlinkedHorses.length > 1 ? 'are' : 'is'} not linked to a combo yet.
          </div>
        )}

        {loadingCombos ? (
          <div className="text-center py-4 text-gray-400">Loading...</div>
        ) : horses.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-sm">No horses added yet.</p>
            <Link
              to="/horses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline mt-2"
            >
              Go to Horses page to add your horses
              <ChevronRight size={14} />
            </Link>
          </div>
        ) : activeCombos.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p>No combos yet.</p>
            <p className="text-sm mt-1">Click "Add Combo" to link a horse to your rider profile.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCombos.map(combo => {
              const horse = getLinkedHorse(combo)
              return (
                <div
                  key={combo.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    combo.is_pinned
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Horse photo / avatar */}
                    <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border ${
                      combo.is_pinned ? 'border-green-300' : 'border-gray-200'
                    }`}>
                      {horse?.photo_url ? (
                        <img
                          src={horse.photo_url}
                          alt={horse.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${
                          combo.is_pinned ? 'bg-green-600' : 'bg-gray-300'
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {combo.horse_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate">{combo.horse_name}</p>
                        {horse && (
                          <Link
                            to={`/horses/${horse.id}`}
                            className="text-xs text-green-600 hover:underline flex-shrink-0"
                            title="View horse profile"
                          >
                            View profile
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{profile?.rider_name}</p>
                      {horse?.breed || horse?.color ? (
                        <p className="text-xs text-gray-400">
                          {[horse.breed, horse.color].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          combo.current_level === 4 ? 'bg-red-100 text-red-700' :
                          combo.current_level === 3 ? 'bg-orange-100 text-orange-700' :
                          combo.current_level === 2 ? 'bg-green-100 text-green-700' :
                          combo.current_level === 1 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          Level {combo.current_level ?? 0}
                        </span>
                        {combo.is_pinned && (
                          <span className="text-xs text-green-600 font-medium">★ Pinned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!combo.is_pinned && (
                      <button
                        onClick={() => handlePinCombo(combo.id)}
                        className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition"
                        title="Pin to dashboard"
                      >
                        <Star size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditCombo(combo)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleArchiveCombo(combo.id, false)}
                      className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                      title="Archive"
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(combo.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete permanently"
                    >
                      <Trash2 size={16} />
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
            <h3 className="text-sm font-medium text-gray-500 mb-3">Archived Combos</h3>
            <div className="space-y-2">
              {archivedCombos.map(combo => {
                const horse = getLinkedHorse(combo)
                return (
                  <div
                    key={combo.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        {horse?.photo_url ? (
                          <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {combo.horse_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">{combo.horse_name}</p>
                        <p className="text-xs text-gray-400">Archived</p>
                      </div>
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
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>}

      {/* Linked Supporters — regular riders and club_member */}
      {!isSupporter && !isClubHead && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            Linked Supporters
          </h2>

          {loadingSupporters ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
          ) : linkedSupporters.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No supporters linked yet.</p>
              <p className="text-xs text-gray-300 mt-1">Supporters who request to follow you will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedSupporters.map(link => (
                <div
                  key={link.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    link.status === 'accepted'
                      ? 'border-green-200 bg-green-50'
                      : link.status === 'pending'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                      {link.supporter?.profile_photo_url ? (
                        <img
                          src={link.supporter.profile_photo_url}
                          alt={link.supporter.rider_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-green-700">
                          {link.supporter?.rider_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{link.supporter?.rider_name || 'Unknown'}</p>
                      <p className="text-xs capitalize text-gray-400">
                        {link.status === 'accepted' ? '✓ Supporter' : link.status === 'pending' ? '⏳ Pending your response' : '✗ Declined'}
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
                          <UserCheck size={13} />
                          Accept
                        </button>
                        <button
                          onClick={() => handleSupporterResponse(link.id, link.supporter_id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        >
                          <UserX size={13} />
                          Decline
                        </button>
                      </>
                    )}
                    {link.status === 'accepted' && (
                      <button
                        onClick={() => handleRemoveSupporter(link.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
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
        </div>
      )}

      {/* My Club Riders — club_head only */}
      {isClubHead && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-gray-400" />
              My Club Riders
            </h2>
            <Link
              to="/my-club-riders"
              className="text-sm font-medium text-green-700 hover:underline flex items-center gap-1"
            >
              Manage riders →
            </Link>
          </div>

          {loadingClubMembers ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
          ) : clubMembers.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No riders added yet.</p>
              <Link
                to="/my-club-riders"
                className="inline-block mt-2 text-sm font-semibold text-green-700 hover:underline"
              >
                Go to My Riders to add a rider →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {clubMembers.filter(l => l.status === 'accepted').map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-green-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                      {link.rider?.profile_photo_url ? (
                        <img src={link.rider.profile_photo_url} alt={link.rider.rider_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-green-700">{link.rider?.rider_name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{link.rider?.age_category || link.rider?.province || ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveClubMember(link.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Remove from club"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {clubMembers.filter(l => l.status === 'pending').map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-yellow-200 bg-yellow-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-200 bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-yellow-700">{link.rider?.rider_name?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                      <p className="text-xs text-yellow-600">⏳ Awaiting rider's acceptance</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveClubMember(link.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Withdraw request"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Club — any rider linked to a club/family head */}
      {!isSupporter && !isClubHead && (
        <div id="my-club-family" className="bg-white rounded-xl border border-gray-200 p-6 scroll-mt-24">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            My Club / Family
          </h2>
          {loadingMyClub ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
          ) : !myClubHead ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">You are not linked to a club or family yet.</p>
              <p className="text-xs text-gray-300 mt-1">Your club head will send you a request to link you to the club.</p>
            </div>
          ) : myClubHead.status === 'pending' ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-200 bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  {myClubHead.head?.profile_photo_url ? (
                    <img src={myClubHead.head.profile_photo_url} alt={myClubHead.head.rider_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-yellow-700">{myClubHead.head?.rider_name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
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
              <div className="w-10 h-10 rounded-full overflow-hidden border border-green-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                {myClubHead.head?.profile_photo_url ? (
                  <img src={myClubHead.head.profile_photo_url} alt={myClubHead.head.rider_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-green-700">{myClubHead.head?.rider_name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{myClubHead.head?.rider_name || 'Unknown'}</p>
                <p className="text-xs text-green-600">✓ Club / Family Head</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* My Riders — supporters only */}
      {isSupporter && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-gray-400" />
              My Riders
            </h2>
            <Link
              to="/my-riders"
              className="text-sm font-medium text-green-700 hover:underline flex items-center gap-1"
            >
              Manage riders →
            </Link>
          </div>

          {loadingRiders ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
          ) : linkedRiders.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No linked riders yet.</p>
              <Link
                to="/my-riders"
                className="inline-block mt-2 text-sm font-semibold text-green-700 hover:underline"
              >
                Go to My Riders to send a request →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedRiders.map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-green-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                      {link.rider?.profile_photo_url ? (
                        <img
                          src={link.rider.profile_photo_url}
                          alt={link.rider.rider_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-green-700">
                          {link.rider?.rider_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{link.rider?.province || ''}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveRider(link.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Remove rider"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Combo Modal */}
      {showComboModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {editingCombo ? 'Edit Combo' : 'Add Horse/Rider Combo'}
              </h3>
              <button onClick={() => setShowComboModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">

              {/* Horse selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horse
                </label>
                {horses.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    No horses found.{' '}
                    <Link to="/horses" className="font-semibold underline" onClick={() => setShowComboModal(false)}>
                      Add a horse first →
                    </Link>
                  </div>
                ) : (
                  <>
                    <select
                      value={comboForm.horse_id}
                      onChange={e => handleHorseSelect(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                    >
                      <option value="">— Select a horse —</option>
                      {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>

                    {/* Preview selected horse */}
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
                            <p className="text-xs text-gray-400">
                              {[h.breed, h.color].filter(Boolean).join(' · ') || 'No details'}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Level
                </label>
                <select
                  value={comboForm.current_level}
                  onChange={e => setComboForm({ ...comboForm, current_level: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                >
                  {[0, 1, 2, 3, 4].map(l => (
                    <option key={l} value={l}>Level {l}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Used as the default "level entered" in Qualifier Tracker (for overcount).
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowComboModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCombo}
                disabled={savingCombo || (!comboForm.horse_id && !comboForm.horse_name)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {savingCombo ? 'Saving...' : editingCombo ? 'Update' : 'Add Combo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <PasswordInput
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <PasswordInput
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePassword}
                disabled={savingPassword}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {savingPassword ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Combo?</h3>
            <p className="text-gray-500 text-sm mb-2">
              This will permanently delete the combo and all associated times and personal bests.
            </p>
            <p className="text-red-500 text-sm font-medium mb-6">
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCombo(showDeleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
