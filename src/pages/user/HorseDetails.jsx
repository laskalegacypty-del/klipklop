import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import Cropper from 'react-easy-crop'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { createCroppedImageFile } from '../../lib/imageCrop'
import { uploadImageToBucket, uploadVideoToBucket, UploadValidationError } from '../../lib/storageUploads'
import { useTabQueryParam } from '../../lib/useTabQueryParam'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bug,
  Calendar,
  CheckCircle2,
  Heart,
  Info,
  Pencil,
  Plus,
  Save,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Syringe,
  Trash2,
  Video,
  Wrench,
  X
} from 'lucide-react'
import { Button, Card, CardContent, ConfirmDialog, EmptyState, Input, PageHeader, Skeleton, Textarea } from '../../components/ui'
import VitalsTrendCard from '../../components/horses/VitalsTrendCard'

const SEX_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'gelding', label: 'Gelding' },
  { value: 'mare', label: 'Mare' },
  { value: 'stallion', label: 'Stallion' },
]

const MEDICAL_TYPES = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'farrier', label: 'Farrier' },
  { value: 'vet_visit', label: 'Vet visit' },
  { value: 'injury', label: 'Injury' },
  { value: 'other', label: 'Other' },
]

const VITAL_TYPES = [
  { value: 'temperature', label: 'Temperature', unit: '°C' },
  { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
  { value: 'respiration_rate', label: 'Respiration Rate', unit: 'breaths/min' },
  { value: 'gut_sounds', label: 'Gut Sounds', unit: '' },
]

const GUT_SOUND_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'absent', label: 'Absent' },
  { value: 'hyperactive', label: 'Hyperactive' },
]

const VITAL_THRESHOLDS = {
  temperature: { min: 37.2, max: 38.6, unit: '°C' },
  heart_rate: { min: 28, max: 44, unit: 'bpm' },
  respiration_rate: { min: 8, max: 16, unit: 'breaths/min' },
}

const REMINDER_TYPES = [
  { value: 'flu_vaccination', label: 'Flu Vaccination (Equine Influenza)', group: 'Vaccinations', icon: Syringe },
  { value: 'ahs_vaccination', label: 'AHS Vaccination (African Horse Sickness)', group: 'Vaccinations', icon: ShieldAlert },
  { value: 'farrier', label: 'Farrier (Trimming / Shoeing)', group: 'Routine Care', icon: Scissors },
  { value: 'deworming', label: 'Deworming', group: 'Routine Care', icon: Bug },
  { value: 'dental', label: 'Dental (Teeth floating)', group: 'Routine Care', icon: Wrench },
  { value: 'coggins_test', label: 'Coggins Test (EIA)', group: 'Routine Care', icon: Calendar },
  { value: 'passport_renewal', label: 'Passport Renewal', group: 'Administrative', icon: Calendar },
  { value: 'custom', label: 'Custom', group: 'Other', icon: Calendar },
]

const REMINDER_GROUP_ORDER = ['Vaccinations', 'Routine Care', 'Administrative', 'Other']
const HORSE_DETAILS_TABS = ['details', 'medical', 'vitals', 'reminders', 'vaccinations']

function parseISODate(value) {
  if (!value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function toISODate(date) {
  if (!date || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(value, days) {
  const base = parseISODate(value)
  if (!base) return ''
  base.setDate(base.getDate() + days)
  return toISODate(base)
}

function addMonths(value, months) {
  const base = parseISODate(value)
  if (!base) return ''
  base.setMonth(base.getMonth() + months)
  return toISODate(base)
}

function dayDiff(fromISO, toISO) {
  const from = parseISODate(fromISO)
  const to = parseISODate(toISO)
  if (!from || !to) return null
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / 86400000)
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function annualDueDate(lastDateISO) {
  const base = parseISODate(lastDateISO)
  if (!base) return ''
  const nextYear = base.getFullYear() + 1
  const days = isLeapYear(nextYear) ? 366 : 365
  base.setDate(base.getDate() + days)
  return toISODate(base)
}

function reminderTypeConfig(type) {
  return REMINDER_TYPES.find(t => t.value === type) || REMINDER_TYPES[REMINDER_TYPES.length - 1]
}

function normalizeReminderText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function resolvedReminderType(reminder) {
  const currentType = reminder?.reminder_type
  if (currentType && currentType !== 'custom') return currentType

  const normalizedLabel = normalizeReminderText(reminder?.label || reminder?.custom_label)
  if (!normalizedLabel) return currentType || 'custom'

  const inferred = REMINDER_TYPES.find(type => normalizeReminderText(type.label) === normalizedLabel)
  return inferred?.value || currentType || 'custom'
}

function reminderDisplayLabel(reminder) {
  return reminderTypeConfig(resolvedReminderType(reminder)).label
}

function reminderUrgency(nextDueDate) {
  const days = dayDiff(todayISO(), nextDueDate)
  if (days === null) return { tone: 'green', text: 'No due date' }
  if (days <= 7) return { tone: 'red', text: `${days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}` }
  if (days <= 14) return { tone: 'amber', text: `${days} days left` }
  if (days <= 30) return { tone: 'yellow', text: `${days} days left` }
  return { tone: 'green', text: `${days} days left` }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function nowISO() {
  return new Date().toISOString()
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function evaluateVital(vitalType, value) {
  if (vitalType === 'gut_sounds') {
    return { numericValue: null, isAbnormal: false, abnormalReason: null }
  }

  const numericValue = Number.parseFloat(value)
  if (Number.isNaN(numericValue)) {
    return { numericValue: null, isAbnormal: false, abnormalReason: null }
  }

  const threshold = VITAL_THRESHOLDS[vitalType]
  if (!threshold) {
    return { numericValue, isAbnormal: false, abnormalReason: null }
  }

  if (numericValue < threshold.min || numericValue > threshold.max) {
    return {
      numericValue,
      isAbnormal: true,
      abnormalReason: `Outside normal range (${threshold.min}-${threshold.max} ${threshold.unit})`,
    }
  }

  return { numericValue, isAbnormal: false, abnormalReason: null }
}

/** PostgREST / Supabase when DB is missing new vitals columns */
function isMissingVitalsColumnsError(error) {
  const msg = String(error?.message || error?.details || '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('schema cache') ||
    lower.includes('does not exist') ||
    (lower.includes('column') && (lower.includes('not found') || lower.includes('unknown'))) ||
    lower.includes('vital_type') ||
    lower.includes('recorded_at') ||
    lower.includes('is_abnormal') ||
    lower.includes('abnormal_reason') ||
    lower.includes('vital_value') ||
    lower.includes('vital_text_value')
  )
}

function isMissingColumnOrTableError(error, token) {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  const key = String(token || '').toLowerCase()
  return (
    msg.includes(key) ||
    msg.includes('schema cache') ||
    (msg.includes('column') && (msg.includes('not found') || msg.includes('does not exist'))) ||
    (msg.includes('relation') && msg.includes('does not exist'))
  )
}

function isReminderInsertCompatibilityError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  return (
    msg.includes('schema cache') ||
    (msg.includes('column') && (msg.includes('not found') || msg.includes('does not exist'))) ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('horse_reminder_type') ||
    msg.includes('reminder_type') ||
    msg.includes('custom_label') ||
    msg.includes('last_done_date') ||
    msg.includes('next_due_date') ||
    msg.includes('vet_name') ||
    msg.includes('notification_days_before') ||
    msg.includes('interval_value') ||
    msg.includes('interval_unit') ||
    msg.includes('metadata') ||
    msg.includes('updated_at')
  )
}

function buildLegacyVitalNotes(userNotes, vitalCheck) {
  const trimmed = userNotes.trim()
  if (vitalCheck.isAbnormal && vitalCheck.abnormalReason) {
    return trimmed ? `${trimmed}\n\n${vitalCheck.abnormalReason}` : vitalCheck.abnormalReason
  }
  return trimmed || null
}

function vitalsEntryShowsFlagged(entry) {
  if (entry.type !== 'vitals') return false
  if (entry.is_abnormal) return true
  if (entry.title?.startsWith?.('Flagged —')) return true
  if (entry.notes?.includes?.('Outside normal range')) return true
  return false
}

function vitalsAbnormalReasonForDisplay(entry) {
  if (entry.abnormal_reason) return entry.abnormal_reason
  if (entry.notes?.includes?.('Outside normal range')) {
    const part = entry.notes.split('\n\n').find(p => p.includes('Outside normal range'))
    return part || null
  }
  return null
}

/** Avoid showing the same abnormal line twice (legacy rows store it in notes). */
function vitalsNotesBody(entry, vitalReason) {
  if (entry.type !== 'vitals' || !entry.notes?.trim()) return entry.notes
  if (!vitalReason || !entry.notes.includes(vitalReason)) return entry.notes
  const rest = entry.notes
    .split('\n\n')
    .filter(p => p.trim() && p.trim() !== vitalReason.trim())
    .join('\n\n')
    .trim()
  return rest || null
}

export default function HorseDetails() {
  const { horseId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showPhotoCropModal, setShowPhotoCropModal] = useState(false)
  const [photoCropSource, setPhotoCropSource] = useState('')
  const [photoCropFilename, setPhotoCropFilename] = useState('photo.jpg')
  const [photoCrop, setPhotoCrop] = useState({ x: 0, y: 0 })
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoCroppedAreaPixels, setPhotoCroppedAreaPixels] = useState(null)
  const photoInputRef = useRef(null)
  const horseVideoInputRef = useRef(null)

  const [horse, setHorse] = useState(null)
  const [activeTab, setActiveTab] = useState('details') // details | medical | vitals | reminders
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null })

  const [medical, setMedical] = useState([])
  const [reminders, setReminders] = useState([])
  const [vaccinationLog, setVaccinationLog] = useState([])
  const [horseVideos, setHorseVideos] = useState([])
  const [videoTitle, setVideoTitle] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUploadError, setVideoUploadError] = useState('')

  const [horseForm, setHorseForm] = useState({
    name: '',
    breed: '',
    sex: 'unknown',
    dob: '',
    birth_year: '',
    color: '',
    microchip_or_passport: '',
  })

  const [showMedicalModal, setShowMedicalModal] = useState(false)
  const [addingMedical, setAddingMedical] = useState(false)
  const [medicalForm, setMedicalForm] = useState({
    type: 'vaccination',
    title: '',
    date: todayISO(),
    notes: '',
  })
  const [showVitalsModal, setShowVitalsModal] = useState(false)
  const [addingVital, setAddingVital] = useState(false)
  const [vitalForm, setVitalForm] = useState({
    vital_type: 'temperature',
    value: '',
    gut_sounds: 'normal',
    notes: '',
  })

  const [addingReminder, setAddingReminder] = useState(false)
  const [medicalTypeFilter, setMedicalTypeFilter] = useState('all')
  const [showAddReminderForm, setShowAddReminderForm] = useState(false)
  const [vacFluForm, setVacFluForm] = useState({ v1_date: '', v2_date: '', v3_date: '', annual_last_date: '', vet_name: '', competition_date: '', notes: '' })
  const [vacAhsForm, setVacAhsForm] = useState({ v1_date: '', v2_date: '', v3_date: '', annual_last_date: '', vet_name: '', competition_date: '', notes: '' })
  const [savingVaccFlu, setSavingVaccFlu] = useState(false)
  const [savingVaccAhs, setSavingVaccAhs] = useState(false)
  const [reminderForm, setReminderForm] = useState({
    reminder_type: 'farrier',
    custom_label: '',
    last_done_date: todayISO(),
    next_due_date: '',
    vet_name: '',
    notes: '',
    is_primary_course_complete: false,
    notification_days_before: [30, 14, 7, 1],
    interval_value: 6,
    interval_unit: 'weeks',
    shod_state: 'shod',
    product_used: '',
    coggins_result: 'negative',
    competition_date: '',
    v1_date: '',
    v2_date: '',
    v3_date: '',
    annual_last_date: '',
  })

  useTabQueryParam({
    activeTab,
    setActiveTab,
    allowedTabs: HORSE_DETAILS_TABS,
  })

  useEffect(() => {
    if (!profile?.id || !horseId) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, horseId])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('tutorial') === 'photo') {
      setActiveTab('details')
      setIsEditingDetails(true)
    }
  }, [location.search])

  useEffect(() => {
    return () => {
      if (photoCropSource) URL.revokeObjectURL(photoCropSource)
    }
  }, [photoCropSource])

  async function fetchAll() {
    setLoading(true)
    try {
      const [horseRes, medicalRes, rawVideosRes] = await Promise.all([
        supabase
          .from('horses')
          .select('*')
          .eq('id', horseId)
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('horse_medical_entries')
          .select('*')
          .eq('horse_id', horseId)
          .eq('user_id', profile.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('horse_videos')
          .select('*')
          .eq('horse_id', horseId)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
      ])

      let videosRes = rawVideosRes
      if (videosRes.error && isMissingColumnOrTableError(videosRes.error, 'horse_videos')) {
        videosRes = { data: [], error: null }
      }

      let remindersRes = await supabase
        .from('horse_reminders')
        .select('*')
        .eq('horse_id', horseId)
        .eq('user_id', profile.id)
        .order('next_due_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (remindersRes.error && isMissingColumnOrTableError(remindersRes.error, 'next_due_date')) {
        remindersRes = await supabase
          .from('horse_reminders')
          .select('*')
          .eq('horse_id', horseId)
          .eq('user_id', profile.id)
          .order('due_date', { ascending: true })
          .order('created_at', { ascending: false })
      }

      let vaccinationLogRes = await supabase
        .from('vaccination_log')
        .select('*')
        .eq('horse_id', horseId)
        .eq('user_id', profile.id)
        .order('date_administered', { ascending: false })
        .order('created_at', { ascending: false })

      if (vaccinationLogRes.error && isMissingColumnOrTableError(vaccinationLogRes.error, 'vaccination_log')) {
        vaccinationLogRes = { data: [], error: null }
      }

      if (horseRes.error) throw horseRes.error
      if (medicalRes.error) throw medicalRes.error
      if (videosRes.error) throw videosRes.error
      if (remindersRes.error) throw remindersRes.error
      if (vaccinationLogRes.error) throw vaccinationLogRes.error

      if (!horseRes.data) {
        setHorse(null)
        setMedical([])
        setHorseVideos([])
        setReminders([])
        return
      }

      setHorse(horseRes.data)
      setMedical(medicalRes.data || [])
      setHorseVideos(videosRes.data || [])
      setReminders((remindersRes.data || []).map(r => ({
        ...r,
        next_due_date: r.next_due_date || r.due_date || null
      })))
      setVaccinationLog(vaccinationLogRes.data || [])

      setHorseForm({
        name: horseRes.data.name || '',
        breed: horseRes.data.breed || '',
        sex: horseRes.data.sex || 'unknown',
        dob: horseRes.data.dob || '',
        birth_year: horseRes.data.birth_year ? String(horseRes.data.birth_year) : '',
        color: horseRes.data.color || '',
        microchip_or_passport: horseRes.data.microchip_or_passport || '',
      })
    } catch (e) {
      console.error(e)
      toast.error('Error loading horse')
    } finally {
      setLoading(false)
    }
  }

  const upcomingReminders = useMemo(
    () => [...reminders].sort((a, b) => String(a.next_due_date || '').localeCompare(String(b.next_due_date || ''))),
    [reminders]
  )
  const vitalsEntries = useMemo(() => {
    const validTypes = new Set(['temperature', 'heart_rate'])
    const labels = {
      temperature: { label: 'Temperature', unit: '°C' },
      heart_rate: { label: 'Heart rate', unit: 'bpm' },
    }

    return medical
      .filter(entry => entry?.type === 'vitals' && validTypes.has(entry.vital_type))
      .map(entry => {
        const value = Number.parseFloat(entry.vital_value)
        const timestamp = entry.recorded_at || entry.date || entry.created_at || null
        if (Number.isNaN(value) || !timestamp) return null

        const config = labels[entry.vital_type]
        return {
          id: entry.id,
          type: entry.vital_type,
          typeLabel: config.label,
          value,
          valueLabel: `${value.toFixed(1)} ${config.unit}`,
          timestamp,
          notes: entry.notes || null,
        }
      })
      .filter(Boolean)
  }, [medical])

  const vitalTrendSeries = useMemo(() => {
    const points = [...vitalsEntries]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return {
      temperaturePoints: points.filter(point => point.type === 'temperature'),
      heartRatePoints: points.filter(point => point.type === 'heart_rate'),
    }
  }, [vitalsEntries])

  const reminderTypeGroups = useMemo(() => {
    return REMINDER_GROUP_ORDER.map(group => ({
      group,
      options: REMINDER_TYPES.filter(type => type.group === group)
    }))
  }, [])

  const isVaccinationForm = reminderForm.reminder_type === 'flu_vaccination' || reminderForm.reminder_type === 'ahs_vaccination'
  const isFluVaccination = reminderForm.reminder_type === 'flu_vaccination'
  const isAhsVaccination = reminderForm.reminder_type === 'ahs_vaccination'
  const v1v2Days = reminderForm.v1_date && reminderForm.v2_date ? dayDiff(reminderForm.v1_date, reminderForm.v2_date) : null
  const v2v3Days = reminderForm.v2_date && reminderForm.v3_date ? dayDiff(reminderForm.v2_date, reminderForm.v3_date) : null
  const primaryComplete = isAhsVaccination
    ? Boolean(reminderForm.v1_date && reminderForm.v2_date)
    : Boolean(reminderForm.v1_date && reminderForm.v2_date && reminderForm.v3_date)
  const annualDuePreview = reminderForm.annual_last_date ? annualDueDate(reminderForm.annual_last_date) : ''
  const lastSafeVaccinationDate = reminderForm.competition_date ? addDays(reminderForm.competition_date, -7) : ''
  const isBlackoutConflict = Boolean(
    reminderForm.competition_date &&
      annualDuePreview &&
      dayDiff(lastSafeVaccinationDate, annualDuePreview) !== null &&
      dayDiff(lastSafeVaccinationDate, annualDuePreview) > 0
  )
  const horseBirthYear = horse?.birth_year || (horse?.dob ? parseISODate(horse.dob)?.getFullYear() : null)
  const requiresLegacyAnnualHistory = horseBirthYear && horseBirthYear < 2020
  const fluHistory = vaccinationLog.filter(v => v.vaccination_type === 'flu')
  const ahsHistory = vaccinationLog.filter(v => v.vaccination_type === 'ahs')

  async function handleSaveHorse() {
    const name = horseForm.name.trim()
    if (!name) {
      toast.error('Horse name is required')
      return
    }

    const birthYear = horseForm.birth_year.trim()
      ? parseInt(horseForm.birth_year.trim(), 10)
      : null

    if (birthYear !== null && (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > 2100)) {
      toast.error('Birth year must be a valid year')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('horses')
        .update({
          name,
          breed: horseForm.breed.trim() || null,
          sex: horseForm.sex || 'unknown',
          dob: horseForm.dob || null,
          birth_year: birthYear,
          color: horseForm.color.trim() || null,
          microchip_or_passport: horseForm.microchip_or_passport.trim() || null,
        })
        .eq('id', horseId)
        .eq('user_id', profile.id)

      if (error) throw error
      toast.success('Horse details saved')
      await fetchAll()
      setIsEditingDetails(false)
    } catch (e) {
      console.error(e)
      toast.error('Error saving horse details')
    } finally {
      setSaving(false)
    }
  }

  const closePhotoCropModal = useCallback(() => {
    setShowPhotoCropModal(false)
    setPhotoCrop({ x: 0, y: 0 })
    setPhotoZoom(1)
    setPhotoCroppedAreaPixels(null)
    setPhotoCropFilename('photo.jpg')
    setPhotoCropSource(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    if (photoInputRef.current) photoInputRef.current.value = ''
  }, [])

  function handleHorsePhotoFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const source = URL.createObjectURL(file)
    setPhotoCropFilename(file.name || 'photo.jpg')
    setPhotoCrop({ x: 0, y: 0 })
    setPhotoZoom(1)
    setPhotoCroppedAreaPixels(null)
    setPhotoCropSource(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return source
    })
    setShowPhotoCropModal(true)
  }

  async function handleHorsePhotoUpload() {
    if (!photoCropSource || !photoCroppedAreaPixels) {
      toast.error('Please position the crop area first')
      return
    }

    try {
      setUploadingPhoto(true)

      if (!profile?.id) throw new Error('Not signed in')
      const croppedFile = await createCroppedImageFile({
        imageSrc: photoCropSource,
        cropPixels: photoCroppedAreaPixels,
        fileName: photoCropFilename.replace(/\.[^.]+$/, '') + '.jpg',
      })

      const filePath = `${profile.id}/${horseId}/photo.jpg`
      const { publicUrl } = await uploadImageToBucket({
        bucket: 'horse-photos',
        path: filePath,
        file: croppedFile,
      })

      const { error: updateError } = await supabase
        .from('horses')
        .update({ photo_url: publicUrl })
        .eq('id', horseId)
        .eq('user_id', profile.id)
      if (updateError) throw updateError

      toast.success('Photo updated')
      closePhotoCropModal()
      await fetchAll()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Error uploading photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handleHorseVideoFileSelect(event) {
    const file = event.target.files?.[0] || null
    setVideoUploadError('')
    setVideoFile(file)
    if (file && !videoTitle.trim()) {
      setVideoTitle(file.name.replace(/\.[^.]+$/, ''))
    }
  }

  async function handleHorseVideoUpload() {
    if (!videoFile) {
      setVideoUploadError('Please choose a video file first.')
      return
    }
    const title = videoTitle.trim()
    if (!title) {
      setVideoUploadError('Please enter a video title.')
      return
    }

    setUploadingVideo(true)
    setVideoUploadError('')
    setVideoUploadProgress(0)

    try {
      const extension = videoFile.type === 'video/quicktime' ? 'mov' : 'mp4'
      const path = `${profile.id}/${horseId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
      const { publicUrl } = await uploadVideoToBucket({
        bucket: 'videos',
        path,
        file: videoFile,
        onProgress: setVideoUploadProgress,
      })

      const { error } = await supabase.from('horse_videos').insert({
        user_id: profile.id,
        horse_id: horseId,
        qualifier_id: null,
        video_url: publicUrl,
        title,
      })
      if (error) throw error

      toast.success('Video uploaded')
      setVideoTitle('')
      setVideoFile(null)
      if (horseVideoInputRef.current) horseVideoInputRef.current.value = ''
      setVideoUploadProgress(0)
      await fetchAll()
    } catch (error) {
      console.error(error)
      const message =
        error instanceof UploadValidationError
          ? error.message
          : error?.message || 'Could not upload video.'
      setVideoUploadError(message)
      toast.error(message)
    } finally {
      setUploadingVideo(false)
    }
  }

  function handleDeleteHorseVideo(videoId) {
    setConfirmDialog({
      open: true,
      title: 'Delete video?',
      description: 'This cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('horse_videos')
            .delete()
            .eq('id', videoId)
            .eq('user_id', profile.id)
          if (error) throw error
          toast.success('Video deleted')
          await fetchAll()
        } catch (error) {
          console.error(error)
          toast.error('Could not delete video')
        }
      },
    })
  }

  async function handleAddMedical() {
    if (!medicalForm.title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (!medicalForm.date) {
      toast.error('Please choose a date')
      return
    }

    setAddingMedical(true)
    try {
      const { error } = await supabase
        .from('horse_medical_entries')
        .insert({
          horse_id: horseId,
          user_id: profile.id,
          type: medicalForm.type,
          title: medicalForm.title.trim(),
          date: medicalForm.date,
          notes: medicalForm.notes.trim() || null,
        })
      if (error) throw error

      toast.success('Medical entry added')
      setShowMedicalModal(false)
      setMedicalForm({ type: 'vaccination', title: '', date: todayISO(), notes: '' })
      await fetchAll()
      setActiveTab('medical')
    } catch (e) {
      console.error(e)
      toast.error('Error adding medical entry')
    } finally {
      setAddingMedical(false)
    }
  }

  function handleDeleteMedical(entryId) {
    setConfirmDialog({
      open: true,
      title: 'Delete medical entry?',
      description: 'This cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('horse_medical_entries')
            .delete()
            .eq('id', entryId)
            .eq('user_id', profile.id)
          if (error) throw error
          toast.success('Entry deleted')
          await fetchAll()
        } catch (e) {
          console.error(e)
          toast.error('Error deleting entry')
        }
      },
    })
  }

  async function handleAddVital() {
    const selectedType = vitalForm.vital_type
    const selectedVital = VITAL_TYPES.find(v => v.value === selectedType)
    if (!selectedVital) {
      toast.error('Please choose a vital')
      return
    }

    if (selectedType !== 'gut_sounds' && !vitalForm.value.trim()) {
      toast.error('Please enter a vital value')
      return
    }

    const vitalCheck = evaluateVital(selectedType, vitalForm.value.trim())
    if (selectedType !== 'gut_sounds' && vitalCheck.numericValue === null) {
      toast.error('Please enter a valid number')
      return
    }

    const recordedAt = nowISO()
    const entryDate = recordedAt.slice(0, 10)
    const displayValue = selectedType === 'gut_sounds'
      ? vitalForm.gut_sounds
      : `${vitalCheck.numericValue} ${selectedVital.unit}`.trim()

    const baseTitle = `${selectedVital.label}: ${displayValue}`
    const legacyTitle = vitalCheck.isAbnormal ? `Flagged — ${baseTitle}` : baseTitle

    setAddingVital(true)
    try {
      const fullRow = {
        horse_id: horseId,
        user_id: profile.id,
        type: 'vitals',
        title: baseTitle,
        date: entryDate,
        notes: vitalForm.notes.trim() || null,
        vital_type: selectedType,
        vital_value: selectedType === 'gut_sounds' ? null : vitalCheck.numericValue,
        vital_text_value: selectedType === 'gut_sounds' ? vitalForm.gut_sounds : null,
        recorded_at: recordedAt,
        is_abnormal: vitalCheck.isAbnormal,
        abnormal_reason: vitalCheck.abnormalReason,
      }

      let { error } = await supabase.from('horse_medical_entries').insert(fullRow)

      if (error && isMissingVitalsColumnsError(error)) {
        const legacyRow = {
          horse_id: horseId,
          user_id: profile.id,
          type: 'vitals',
          title: legacyTitle,
          date: entryDate,
          notes: buildLegacyVitalNotes(vitalForm.notes, vitalCheck),
        }
        const retry = await supabase.from('horse_medical_entries').insert(legacyRow)
        error = retry.error
      }

      if (error) {
        console.error(error)
        toast.error(error.message || 'Error adding vitals entry')
        return
      }

      toast.success('Vitals entry added')
      setShowVitalsModal(false)
      setVitalForm({
        vital_type: 'temperature',
        value: '',
        gut_sounds: 'normal',
        notes: '',
      })
      await fetchAll()
      setActiveTab('medical')
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Error adding vitals entry')
    } finally {
      setAddingVital(false)
    }
  }

  async function handleSaveVaccination(vaccType, formData, setSaving) {
    const isAhs = vaccType === 'ahs_vaccination'
    const doseDates = isAhs
      ? [formData.v1_date, formData.v2_date].filter(Boolean)
      : [formData.v1_date, formData.v2_date, formData.v3_date].filter(Boolean)
    if (doseDates.length === 0 && !formData.annual_last_date) {
      toast.error('Log at least one vaccination date')
      return
    }
    if (!formData.vet_name.trim()) {
      toast.error('Vet name is required for vaccinations')
      return
    }
    const v1v2 = formData.v1_date && formData.v2_date ? dayDiff(formData.v1_date, formData.v2_date) : null
    const v2v3 = formData.v2_date && formData.v3_date ? dayDiff(formData.v2_date, formData.v3_date) : null
    if (v1v2 !== null && (v1v2 < 21 || v1v2 > 92)) { toast.error('V2 must be 21–92 days after V1'); return }
    if (!isAhs && v2v3 !== null && (v2v3 < 150 || v2v3 > 215)) { toast.error('V3 must be 150–215 days after V2'); return }

    const primaryCourseComplete = isAhs
      ? Boolean(formData.v1_date && formData.v2_date)
      : Boolean(formData.v1_date && formData.v2_date && formData.v3_date)
    const lastDoneDate = formData.annual_last_date || formData.v3_date || formData.v2_date || formData.v1_date
    const nextDueDate = annualDueDate(lastDoneDate)
    if (!nextDueDate) { toast.error('Could not calculate next due date'); return }

    const label = vaccType === 'flu_vaccination' ? 'Flu Vaccination (Equine Influenza)' : 'AHS Vaccination (African Horse Sickness)'
    setSaving(true)
    try {
      const fullPayload = {
        horse_id: horseId, user_id: profile.id, reminder_type: vaccType, label,
        last_done_date: lastDoneDate || null, next_due_date: nextDueDate, due_date: nextDueDate,
        vet_name: formData.vet_name.trim() || null, notes: formData.notes.trim() || null,
        is_primary_course_complete: primaryCourseComplete, is_done: false,
        notification_days_before: 30,
      }
      const compactPayload = { horse_id: horseId, user_id: profile.id, reminder_type: vaccType, label, last_done_date: lastDoneDate || null, next_due_date: nextDueDate, due_date: nextDueDate, is_done: false }
      const legacyPayload = { horse_id: horseId, user_id: profile.id, label, due_date: nextDueDate, is_done: false }
      let error = null
      for (const attempt of [fullPayload, compactPayload, legacyPayload]) {
        const r = await supabase.from('horse_reminders').insert(attempt)
        if (!r.error) { error = null; break }
        error = r.error
      }
      if (error) throw error

      const doseRows = isAhs
        ? [{ dose: 1, date: formData.v1_date }, { dose: 2, date: formData.v2_date }]
        : [{ dose: 1, date: formData.v1_date }, { dose: 2, date: formData.v2_date }, { dose: 3, date: formData.v3_date }]
      const logRows = doseRows.filter(d => d.date).map(d => ({
        horse_id: horseId, user_id: profile.id,
        vaccination_type: isAhs ? 'ahs' : 'flu',
        dose_number: d.dose, date_administered: d.date,
        vet_name: formData.vet_name.trim(),
      }))
      if (formData.annual_last_date) {
        logRows.push({ horse_id: horseId, user_id: profile.id, vaccination_type: isAhs ? 'ahs' : 'flu', dose_number: null, date_administered: formData.annual_last_date, vet_name: formData.vet_name.trim() })
      }
      if (logRows.length > 0) {
        await supabase.from('horse_vaccination_log').insert(logRows)
      }

      toast.success('Vaccination logged & reminder set!')
      await fetchAll()
      setActiveTab('vaccinations')
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Error saving vaccination')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddReminder() {
      const isVaccination = reminderForm.reminder_type === 'flu_vaccination' || reminderForm.reminder_type === 'ahs_vaccination'
      const isAhsVaccinationFlow = reminderForm.reminder_type === 'ahs_vaccination'
    const isCustom = reminderForm.reminder_type === 'custom'
    if (!reminderForm.last_done_date && !isVaccination) {
      toast.error('Please choose the last done date')
      return
    }
    if (isCustom && !reminderForm.custom_label.trim()) {
      toast.error('Please enter a custom label')
      return
    }

    setAddingReminder(true)
    try {
      let nextDueDate = reminderForm.next_due_date
      let label = reminderTypeConfig(reminderForm.reminder_type).label
      const metadata = {}
      let primaryCourseComplete = false
      let lastDoneDate = reminderForm.last_done_date

      if (isCustom) {
        label = reminderForm.custom_label.trim()
        if (!reminderForm.interval_value || reminderForm.interval_value < 1) {
          toast.error('Custom interval must be at least 1')
          setAddingReminder(false)
          return
        }
        const days = reminderForm.interval_unit === 'days'
          ? reminderForm.interval_value
          : reminderForm.interval_unit === 'weeks'
          ? reminderForm.interval_value * 7
          : reminderForm.interval_value * 30
        nextDueDate = addDays(reminderForm.last_done_date, days)
      } else if (reminderForm.reminder_type === 'farrier') {
        nextDueDate = addDays(reminderForm.last_done_date, reminderForm.interval_value * 7)
        metadata.shod_state = reminderForm.shod_state
      } else if (reminderForm.reminder_type === 'deworming') {
        nextDueDate = addDays(reminderForm.last_done_date, reminderForm.interval_value * 7)
        metadata.product_used = reminderForm.product_used.trim() || null
      } else if (reminderForm.reminder_type === 'dental') {
        nextDueDate = addMonths(reminderForm.last_done_date, reminderForm.interval_value)
      } else if (reminderForm.reminder_type === 'coggins_test') {
        nextDueDate = addMonths(reminderForm.last_done_date, 12)
        metadata.coggins_result = reminderForm.coggins_result
      } else if (reminderForm.reminder_type === 'passport_renewal') {
        nextDueDate = addMonths(reminderForm.last_done_date, 12)
      } else if (isVaccination) {
        const doseDates = isAhsVaccinationFlow
          ? [reminderForm.v1_date, reminderForm.v2_date].filter(Boolean)
          : [reminderForm.v1_date, reminderForm.v2_date, reminderForm.v3_date].filter(Boolean)
        if (doseDates.length === 0 && !reminderForm.annual_last_date) {
          toast.error('Log at least one vaccination date')
          setAddingReminder(false)
          return
        }
        if (!reminderForm.vet_name.trim()) {
          toast.error('Vet name is required for vaccinations')
          setAddingReminder(false)
          return
        }

        const v1v2 = reminderForm.v1_date && reminderForm.v2_date ? dayDiff(reminderForm.v1_date, reminderForm.v2_date) : null
        const v2v3 = reminderForm.v2_date && reminderForm.v3_date ? dayDiff(reminderForm.v2_date, reminderForm.v3_date) : null
        if (v1v2 !== null && (v1v2 < 21 || v1v2 > 92)) {
          toast.error('V2 must be 21-92 days after V1')
          setAddingReminder(false)
          return
        }
        if (!isAhsVaccinationFlow && v2v3 !== null && (v2v3 < 150 || v2v3 > 215)) {
          toast.error('V3 must be 150-215 days after V2')
          setAddingReminder(false)
          return
        }

        const hasCompletePrimary = isAhsVaccinationFlow
          ? Boolean(reminderForm.v1_date && reminderForm.v2_date)
          : Boolean(reminderForm.v1_date && reminderForm.v2_date && reminderForm.v3_date)
        primaryCourseComplete = hasCompletePrimary
        lastDoneDate = reminderForm.annual_last_date || reminderForm.v3_date || reminderForm.v2_date || reminderForm.v1_date
        nextDueDate = annualDueDate(lastDoneDate)
      }

      if (!nextDueDate) {
        toast.error('Could not calculate next due date')
        setAddingReminder(false)
        return
      }

      const fullReminderPayload = {
        horse_id: horseId,
        user_id: profile.id,
        reminder_type: reminderForm.reminder_type,
        label,
        custom_label: isCustom ? reminderForm.custom_label.trim() : null,
        last_done_date: lastDoneDate || null,
        next_due_date: nextDueDate,
        due_date: nextDueDate,
        vet_name: reminderForm.vet_name.trim() || null,
        notes: reminderForm.notes.trim() || null,
        is_primary_course_complete: primaryCourseComplete,
        notification_days_before: reminderForm.notification_days_before,
        interval_value: reminderForm.interval_value || null,
        interval_unit: reminderForm.interval_unit || null,
        metadata,
        is_done: false
      }

      const compactReminderPayload = {
        horse_id: horseId,
        user_id: profile.id,
        reminder_type: reminderForm.reminder_type,
        label,
        last_done_date: lastDoneDate || null,
        next_due_date: nextDueDate,
        due_date: nextDueDate,
        is_done: false
      }

      const typePreservingLegacyPayload = {
        horse_id: horseId,
        user_id: profile.id,
        reminder_type: reminderForm.reminder_type,
        label,
        due_date: nextDueDate,
        is_done: false
      }

      const legacyReminderPayload = {
        horse_id: horseId,
        user_id: profile.id,
        label,
        due_date: nextDueDate,
        is_done: false
      }

      const insertAttempts = [
        fullReminderPayload,
        compactReminderPayload,
        typePreservingLegacyPayload,
        legacyReminderPayload,
      ]

      let error = null
      for (let i = 0; i < insertAttempts.length; i += 1) {
        const attempt = await supabase
          .from('horse_reminders')
          .insert(insertAttempts[i])
        if (!attempt.error) {
          error = null
          break
        }
        if (!isReminderInsertCompatibilityError(attempt.error)) {
          error = attempt.error
          break
        }
        error = attempt.error
      }

      if (error) throw error

      if (isVaccination) {
        const vaccinationType = reminderForm.reminder_type === 'flu_vaccination' ? 'flu' : 'ahs'
        const doseRows = reminderForm.reminder_type === 'ahs_vaccination'
          ? [
              { dose: 1, date: reminderForm.v1_date },
              { dose: 2, date: reminderForm.v2_date },
            ]
          : [
              { dose: 1, date: reminderForm.v1_date },
              { dose: 2, date: reminderForm.v2_date },
              { dose: 3, date: reminderForm.v3_date },
            ]
        const logRows = doseRows.filter(d => d.date).map(d => ({
          horse_id: horseId,
          user_id: profile.id,
          vaccination_type: vaccinationType,
          dose_number: d.dose,
          date_administered: d.date,
          vet_name: reminderForm.vet_name.trim(),
          notes: reminderForm.notes.trim() || null
        }))

        if (reminderForm.annual_last_date) {
          logRows.push({
            horse_id: horseId,
            user_id: profile.id,
            vaccination_type: vaccinationType,
            dose_number: null,
            date_administered: reminderForm.annual_last_date,
            vet_name: reminderForm.vet_name.trim(),
            notes: reminderForm.notes.trim() || null
          })
        }

        if (logRows.length > 0) {
          const { error: logError } = await supabase.from('vaccination_log').insert(logRows)
          if (logError && !isMissingColumnOrTableError(logError, 'vaccination_log')) {
            throw logError
          }
        }
      }

      toast.success('Reminder added')
      setReminderForm({
        reminder_type: 'farrier',
        custom_label: '',
        last_done_date: todayISO(),
        next_due_date: '',
        vet_name: '',
        notes: '',
        is_primary_course_complete: false,
        notification_days_before: [30, 14, 7, 1],
        interval_value: 6,
        interval_unit: 'weeks',
        shod_state: 'shod',
        product_used: '',
        coggins_result: 'negative',
        competition_date: '',
        v1_date: '',
        v2_date: '',
        v3_date: '',
        annual_last_date: '',
      })
      await fetchAll()
      setActiveTab('reminders')
    } catch (e) {
      console.error(e)
      toast.error('Error adding reminder')
    } finally {
      setAddingReminder(false)
    }
  }

  async function toggleReminderDone(reminder) {
    try {
      const today = todayISO()
      let nextDueDate = reminder.next_due_date
      const intervalUnit = reminder.interval_unit || 'weeks'
      const intervalValue = Number(reminder.interval_value) || 0
      const isVaccination = reminder.reminder_type === 'flu_vaccination' || reminder.reminder_type === 'ahs_vaccination'

      if (isVaccination) {
        if (!reminder.is_primary_course_complete) {
          toast.error('Complete and validate V1-V3 first before logging annual boosters.')
          return
        }
        nextDueDate = annualDueDate(today)
      } else if (intervalValue > 0) {
        if (intervalUnit === 'days') nextDueDate = addDays(today, intervalValue)
        if (intervalUnit === 'weeks') nextDueDate = addDays(today, intervalValue * 7)
        if (intervalUnit === 'months') nextDueDate = addMonths(today, intervalValue)
      }

      const { error } = await supabase
        .from('horse_reminders')
        .update({
          is_done: false,
          last_done_date: today,
          next_due_date: nextDueDate,
          due_date: nextDueDate,
        })
        .eq('id', reminder.id)
        .eq('user_id', profile.id)
      if (error) throw error

      if (isVaccination) {
        const { error: vaccError } = await supabase.from('vaccination_log').insert({
          horse_id: horseId,
          user_id: profile.id,
          vaccination_type: reminder.reminder_type === 'flu_vaccination' ? 'flu' : 'ahs',
          dose_number: null,
          date_administered: today,
          vet_name: reminder.vet_name || 'Registered veterinarian',
          notes: reminder.notes || null
        })
        if (vaccError) throw vaccError
      }

      await fetchAll()
      toast.success('Reminder logged as done')
    } catch (e) {
      console.error(e)
      toast.error('Error updating reminder')
    }
  }

  function handleDeleteReminder(reminderId) {
    setConfirmDialog({
      open: true,
      title: 'Delete reminder?',
      description: 'This cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('horse_reminders')
            .delete()
            .eq('id', reminderId)
            .eq('user_id', profile.id)
          if (error) throw error
          toast.success('Reminder deleted')
          await fetchAll()
        } catch (e) {
          console.error(e)
          toast.error('Error deleting reminder')
        }
      },
    })
  }

  async function handleDeleteHorse() {
    try {
      const { error } = await supabase
        .from('horses')
        .delete()
        .eq('id', horseId)
        .eq('user_id', profile.id)
      if (error) throw error
      toast.success('Horse deleted')
      navigate('/horses')
    } catch (e) {
      console.error(e)
      toast.error('Error deleting horse')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!horse) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Horse not found"
          description="This horse may have been deleted, or you may not have access."
          actions={
            <Link to="/horses" className="text-sm font-semibold text-green-800 hover:underline">
              Back to horses →
            </Link>
          }
        />
        <EmptyState title="Nothing here" description="Go back to your horses list." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={horse.name}
        description="Details, medical log, and reminders"
        actions={
          <Button variant="secondary" onClick={() => navigate('/horses')}>
            <ArrowLeft size={16} />
            Back
          </Button>
        }
      />

      {/* Persistent horse identity strip */}
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
          {horse.photo_url ? (
            <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-2xl">{horse.name?.charAt(0)?.toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-black text-gray-900 truncate">{horse.name}</p>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {[horse.breed, horse.color, horse.sex && horse.sex !== 'unknown' ? horse.sex : null].filter(Boolean).join(' · ') || 'No details yet'}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 text-right flex-shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reminders</span>
          <span className={`text-2xl font-black ${upcomingReminders.filter(r => reminderUrgency(r.next_due_date).tone === 'red').length > 0 ? 'text-red-600' : 'text-green-700'}`}>
            {upcomingReminders.length}
          </span>
        </div>
      </div>

      {/* Mobile tab grid */}
      {(() => {
        const sections = [
          { key: 'details',      label: 'Details',    icon: Info,        count: null },
          { key: 'medical',      label: 'Medical',    icon: Activity,    count: medical.length },
          { key: 'vitals',       label: 'Vitals',     icon: Heart,       count: vitalTrendSeries.temperaturePoints.length + vitalTrendSeries.heartRatePoints.length },
          { key: 'reminders',    label: 'Reminders',  icon: Bell,        count: upcomingReminders.length },
          { key: 'vaccinations', label: 'Vaccines',   icon: Syringe,     count: upcomingReminders.filter(r => r.reminder_type === 'flu_vaccination' || r.reminder_type === 'ahs_vaccination').length },
        ]
        return (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:hidden">
            {sections.map(({ key, label, icon: Icon, count }) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-semibold transition relative ${
                    active
                      ? 'bg-green-700 border-green-700 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                  {count !== null && count > 0 && (
                    <span className={`absolute top-1.5 right-1.5 text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ${active ? 'bg-white/30 text-white' : 'bg-green-100 text-green-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Desktop sidebar + content */}
      <div className="flex gap-5 items-start">

        {/* Desktop sidebar */}
        {(() => {
          const sections = [
            { key: 'details',      label: 'Details',      icon: Info,        count: null },
            { key: 'medical',      label: 'Medical log',  icon: Activity,    count: medical.length },
            { key: 'vitals',       label: 'Vitals',       icon: Heart,       count: vitalTrendSeries.temperaturePoints.length + vitalTrendSeries.heartRatePoints.length },
            { key: 'reminders',    label: 'Reminders',    icon: Bell,        count: upcomingReminders.length },
            { key: 'vaccinations', label: 'Vaccines',     icon: Syringe,     count: upcomingReminders.filter(r => r.reminder_type === 'flu_vaccination' || r.reminder_type === 'ahs_vaccination').length },
          ]
          return (
            <nav className="hidden md:flex flex-col gap-1 flex-shrink-0 w-44 bg-white rounded-xl border border-gray-200 p-2">
              {sections.map(({ key, label, icon: Icon, count }) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition text-left ${
                      active
                        ? 'bg-green-700 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {count !== null && count > 0 && (
                      <span className={`text-[10px] font-bold min-w-[18px] h-4 flex items-center justify-center rounded-full px-1 ${active ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          )
        })()}

        {/* Tab panels */}
        <div className="flex-1 min-w-0">

      {/* DETAILS */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {!isEditingDetails ? (
            /* ── READ-ONLY VIEW ── */
            <Card>
              <CardContent className="p-0">

                {/* Hero banner */}
                <div className="relative bg-gradient-to-br from-green-700 to-green-900 px-6 py-6 rounded-t-xl">
                  <div className="flex items-center gap-5">
                    {/* Photo */}
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg flex-shrink-0 bg-white/10 flex items-center justify-center">
                      {horse.photo_url ? (
                        <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-3xl">
                          {horse.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Name + subtitle */}
                    <div className="flex-1 min-w-0 pr-16">
                      <h2 className="text-2xl font-bold text-white leading-tight truncate">{horse.name}</h2>
                      <p className="text-green-200 text-sm mt-1">
                        {[horse.breed, horse.color].filter(Boolean).join(' · ') || 'No breed / colour info'}
                      </p>
                      {horse.sex && horse.sex !== 'unknown' && (
                        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white capitalize">
                          {SEX_OPTIONS.find(o => o.value === horse.sex)?.label || horse.sex}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit button — floating top-right */}
                  <button
                    onClick={() => setIsEditingDetails(true)}
                    className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition border border-white/20"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                </div>

                {/* Detail fields */}
                <div className="divide-y divide-gray-100">
                  {[
                    {
                      label: 'Breed',
                      value: horse.breed || null,
                    },
                    {
                      label: 'Colour',
                      value: horse.color || null,
                    },
                    {
                      label: 'Sex',
                      value: horse.sex && horse.sex !== 'unknown'
                        ? SEX_OPTIONS.find(o => o.value === horse.sex)?.label
                        : null,
                    },
                    {
                      label: 'Date of birth',
                      value: horse.dob
                        ? new Date(horse.dob).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : null,
                    },
                    {
                      label: 'Birth year',
                      value: horse.birth_year ? String(horse.birth_year) : null,
                    },
                    {
                      label: 'Microchip / Passport #',
                      value: horse.microchip_or_passport || null,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-6 py-3.5 gap-4">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {label}
                      </span>
                      <span className={`text-sm text-right ${value ? 'text-gray-800 font-medium' : 'text-gray-300 italic'}`}>
                        {value || 'Not set'}
                      </span>
                    </div>
                  ))}
                </div>

              </CardContent>
            </Card>
          ) : (
            /* ── EDIT VIEW ── */
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-gray-900">Edit horse details</h3>
                  <button
                    onClick={() => {
                      setIsEditingDetails(false)
                      // Reset form to current horse data
                      setHorseForm({
                        name: horse.name || '',
                        breed: horse.breed || '',
                        sex: horse.sex || 'unknown',
                        dob: horse.dob || '',
                        birth_year: horse.birth_year ? String(horse.birth_year) : '',
                        color: horse.color || '',
                        microchip_or_passport: horse.microchip_or_passport || '',
                      })
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Cancel"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Photo upload */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-green-50 border border-green-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {horse.photo_url ? (
                      <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-green-800 font-bold text-2xl">
                        {horse.name?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">Photo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Upload a photo for this horse.</p>
                    <div className="mt-3">
                      <label className="inline-flex" data-tour="horse-photo-upload">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleHorsePhotoFileSelect}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                        <span className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-4 h-10 text-sm cursor-pointer ${
                          uploadingPhoto
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
                        }`}>
                          {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={horseForm.name}
                      onChange={e => setHorseForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                    <Input
                      value={horseForm.breed}
                      onChange={e => setHorseForm(f => ({ ...f, breed: e.target.value }))}
                      placeholder="e.g. Quarter Horse"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                    <select
                      value={horseForm.sex}
                      onChange={e => setHorseForm(f => ({ ...f, sex: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {SEX_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <Input
                      value={horseForm.color}
                      onChange={e => setHorseForm(f => ({ ...f, color: e.target.value }))}
                      placeholder="e.g. Bay"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
                    <Input
                      type="date"
                      value={horseForm.dob}
                      onChange={e => setHorseForm(f => ({ ...f, dob: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birth year</label>
                    <Input
                      type="number"
                      value={horseForm.birth_year}
                      onChange={e => setHorseForm(f => ({ ...f, birth_year: e.target.value }))}
                      placeholder="e.g. 2016"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Microchip / Passport #</label>
                    <Input
                      value={horseForm.microchip_or_passport}
                      onChange={e => setHorseForm(f => ({ ...f, microchip_or_passport: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Save + Delete row */}
                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 size={15} />
                    Delete horse
                  </button>
                  <Button onClick={handleSaveHorse} disabled={saving}>
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-green-700" />
                <h3 className="text-base font-semibold text-gray-900">Videos</h3>
              </div>
              <p className="text-xs text-gray-500">Upload MP4 or MOV files up to 100MB.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="Video title"
                  disabled={uploadingVideo}
                />
                <input
                  ref={horseVideoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={handleHorseVideoFileSelect}
                  disabled={uploadingVideo}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900"
                />
                <Button onClick={handleHorseVideoUpload} disabled={uploadingVideo}>
                  {uploadingVideo ? 'Uploading video…' : 'Attach video'}
                </Button>
              </div>
              {uploadingVideo && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all"
                      style={{ width: `${videoUploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{videoUploadProgress}% uploaded</p>
                </div>
              )}
              {videoUploadError && (
                <p className="text-sm text-red-600">{videoUploadError}</p>
              )}
              {videoFile && (
                <p className="text-xs text-gray-500">Selected file: {videoFile.name}</p>
              )}
              {horseVideos.length === 0 ? (
                <EmptyState
                  title="No videos yet"
                  description="Upload your horse's run videos to view and play them here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {horseVideos.map(video => (
                    <div key={video.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{video.title}</p>
                        <button
                          onClick={() => handleDeleteHorseVideo(video.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">{formatDateTime(video.created_at)}</p>
                      <video
                        src={video.video_url}
                        controls
                        preload="metadata"
                        className="w-full rounded-lg bg-black"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MEDICAL */}
      {activeTab === 'medical' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-gray-500">{medical.length} {medical.length === 1 ? 'entry' : 'entries'}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowVitalsModal(true)}>
                <Heart size={15} />
                Vitals
              </Button>
              <Button onClick={() => setShowMedicalModal(true)}>
                <Plus size={16} />
                Add entry
              </Button>
            </div>
          </div>

          {/* Type filter pills */}
          {medical.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All', icon: null },
                { value: 'vaccination', label: 'Vaccination', icon: Syringe },
                { value: 'deworming', label: 'Deworming', icon: Bug },
                { value: 'farrier', label: 'Farrier', icon: Scissors },
                { value: 'vet_visit', label: 'Vet Visit', icon: Activity },
                { value: 'injury', label: 'Injury', icon: AlertTriangle },
                { value: 'vitals', label: 'Vitals', icon: Heart },
                { value: 'other', label: 'Other', icon: Wrench },
              ].filter(f => f.value === 'all' || medical.some(e => (e.type || 'other') === f.value)).map(f => {
                const active = medicalTypeFilter === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => setMedicalTypeFilter(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      active ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'
                    }`}
                  >
                    {f.icon && <f.icon size={11} />}
                    {f.label}
                    {f.value !== 'all' && (
                      <span className={`ml-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>
                        {medical.filter(e => (e.type || 'other') === f.value).length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {medical.length === 0 ? (
            <EmptyState
              title="No medical entries yet"
              description="Add vaccinations, deworming, farrier visits, vet notes, injuries, and more."
            />
          ) : (() => {
            const filtered = medicalTypeFilter === 'all'
              ? medical
              : medical.filter(e => (e.type || 'other') === medicalTypeFilter)
            const TYPE_ICON = {
              vaccination: { icon: Syringe,       bg: 'bg-blue-100',   text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
              deworming:   { icon: Bug,            bg: 'bg-purple-100', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
              farrier:     { icon: Scissors,       bg: 'bg-orange-100', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
              vet_visit:   { icon: Activity,       bg: 'bg-teal-100',   text: 'text-teal-600',   badge: 'bg-teal-100 text-teal-700' },
              injury:      { icon: AlertTriangle,  bg: 'bg-red-100',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700' },
              vitals:      { icon: Heart,          bg: 'bg-green-100',  text: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
              other:       { icon: Wrench,         bg: 'bg-gray-100',   text: 'text-gray-500',   badge: 'bg-gray-100 text-gray-700' },
            }
            return (
              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No entries of this type.</p>
                )}
                {filtered.map(entry => {
                  const vitalFlagged = vitalsEntryShowsFlagged(entry)
                  const vitalReason = vitalsAbnormalReasonForDisplay(entry)
                  const vitalNotesBody = vitalsNotesBody(entry, vitalReason)
                  const cfg = TYPE_ICON[entry.type] || TYPE_ICON.other
                  const EntryIcon = cfg.icon
                  return (
                    <div key={entry.id} className="bg-white rounded-xl border border-gray-200 flex overflow-hidden hover:border-green-200 transition">
                      {/* Icon column */}
                      <div className={`w-14 flex-shrink-0 flex items-center justify-center ${cfg.bg}`}>
                        <EntryIcon size={20} className={cfg.text} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.badge}`}>
                                {entry.type === 'vitals' ? 'Vitals' : (MEDICAL_TYPES.find(t => t.value === entry.type)?.label || 'Other')}
                              </span>
                              {entry.type === 'vitals' && vitalFlagged && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                  <AlertTriangle size={10} /> Flagged
                                </span>
                              )}
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={11} />
                                {formatDate(entry.recorded_at || entry.date)}
                              </span>
                            </div>
                            <p className="mt-1.5 font-semibold text-gray-900 break-words text-sm">{entry.title}</p>
                            {entry.type === 'vitals' && vitalFlagged && vitalReason && (
                              <p className="mt-0.5 text-xs text-red-600">{vitalReason}</p>
                            )}
                            {entry.type === 'vitals' && vitalNotesBody ? (
                              <p className="mt-0.5 text-xs text-gray-500 whitespace-pre-wrap break-words">{vitalNotesBody}</p>
                            ) : entry.type !== 'vitals' && entry.notes ? (
                              <p className="mt-0.5 text-xs text-gray-500 whitespace-pre-wrap break-words">{entry.notes}</p>
                            ) : null}
                          </div>
                          <button
                            onClick={() => handleDeleteMedical(entry.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                            title="Delete entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* VITALS */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
          {/* Latest readings summary */}
          {vitalsEntries.length > 0 && (() => {
            const lastTemp = [...vitalsEntries].filter(v => v.type === 'temperature').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
            const lastHR = [...vitalsEntries].filter(v => v.type === 'heart_rate').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
            const lastResp = [...vitalsEntries].filter(v => v.type === 'respiration_rate').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
            const isTempOk = lastTemp && lastTemp.value >= 37.2 && lastTemp.value <= 38.6
            const isHROk = lastHR && lastHR.value >= 28 && lastHR.value <= 44
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {lastTemp && (
                  <div className={`rounded-xl border p-4 text-center ${isTempOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temperature</p>
                    <p className={`text-2xl font-black ${isTempOk ? 'text-green-700' : 'text-red-600'}`}>{lastTemp.value}<span className="text-sm font-semibold ml-0.5">°C</span></p>
                    <p className="text-xs text-gray-400 mt-1">Normal: 37.2–38.6</p>
                    <p className={`text-xs font-semibold mt-1 ${isTempOk ? 'text-green-600' : 'text-red-600'}`}>{isTempOk ? '✓ Normal' : '⚠ Abnormal'}</p>
                  </div>
                )}
                {lastHR && (
                  <div className={`rounded-xl border p-4 text-center ${isHROk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Heart Rate</p>
                    <p className={`text-2xl font-black ${isHROk ? 'text-green-700' : 'text-red-600'}`}>{lastHR.value}<span className="text-sm font-semibold ml-0.5">bpm</span></p>
                    <p className="text-xs text-gray-400 mt-1">Normal: 28–44</p>
                    <p className={`text-xs font-semibold mt-1 ${isHROk ? 'text-green-600' : 'text-red-600'}`}>{isHROk ? '✓ Normal' : '⚠ Abnormal'}</p>
                  </div>
                )}
                {lastResp && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Respiration</p>
                    <p className="text-2xl font-black text-blue-700">{lastResp.value}<span className="text-sm font-semibold ml-0.5">/min</span></p>
                    <p className="text-xs text-gray-400 mt-1">Normal: 8–16</p>
                    <p className={`text-xs font-semibold mt-1 ${lastResp.value >= 8 && lastResp.value <= 16 ? 'text-green-600' : 'text-red-600'}`}>
                      {lastResp.value >= 8 && lastResp.value <= 16 ? '✓ Normal' : '⚠ Abnormal'}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Add vitals CTA */}
          <button
            onClick={() => setShowVitalsModal(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-300 bg-green-50 py-4 text-sm font-semibold text-green-700 hover:bg-green-100 hover:border-green-400 transition"
          >
            <Plus size={18} />
            Record vitals
          </button>

          <VitalsTrendCard
            temperaturePoints={vitalTrendSeries.temperaturePoints}
            heartRatePoints={vitalTrendSeries.heartRatePoints}
            vitalsEntries={vitalsEntries}
          />
        </div>
      )}

      {/* REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          {/* Add reminder toggle button */}
          <button
            onClick={() => setShowAddReminderForm(v => !v)}
            className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 py-4 text-sm font-semibold transition ${
              showAddReminderForm
                ? 'border-green-400 bg-green-700 text-white'
                : 'border-dashed border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400'
            }`}
          >
            <Plus size={18} className={showAddReminderForm ? 'rotate-45 transition-transform' : 'transition-transform'} />
            {showAddReminderForm ? 'Cancel' : 'Add new reminder'}
          </button>

          {showAddReminderForm && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900">New reminder</h3>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reminder type</label>
                  <select
                    value={reminderForm.reminder_type}
                    onChange={e => setReminderForm(f => ({ ...f, reminder_type: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {reminderTypeGroups.map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date last done</label>
                  <Input
                    type="date"
                    value={reminderForm.last_done_date}
                    onChange={e => setReminderForm(f => ({ ...f, last_done_date: e.target.value }))}
                  />
                </div>
              </div>

              {(reminderForm.reminder_type === 'farrier' || reminderForm.reminder_type === 'deworming') && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interval (weeks)</label>
                    <select
                      value={String(reminderForm.interval_value)}
                      onChange={e => setReminderForm(f => ({ ...f, interval_value: Number(e.target.value), interval_unit: 'weeks' }))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {(reminderForm.reminder_type === 'farrier' ? [4, 5, 6, 8] : [6, 8, 10, 12]).map(v => (
                        <option key={v} value={v}>{v} weeks</option>
                      ))}
                    </select>
                  </div>
                  {reminderForm.reminder_type === 'farrier' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hoof status</label>
                      <select
                        value={reminderForm.shod_state}
                        onChange={e => setReminderForm(f => ({ ...f, shod_state: e.target.value }))}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="shod">Shod</option>
                        <option value="barefoot">Barefoot</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product used (optional)</label>
                      <Input
                        value={reminderForm.product_used}
                        onChange={e => setReminderForm(f => ({ ...f, product_used: e.target.value }))}
                        placeholder="Paste, gel, oral dose..."
                      />
                    </div>
                  )}
                </div>
              )}

              {reminderForm.reminder_type === 'dental' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval</label>
                  <select
                    value={String(reminderForm.interval_value)}
                    onChange={e => setReminderForm(f => ({ ...f, interval_value: Number(e.target.value), interval_unit: 'months' }))}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="12">12 months (default)</option>
                    <option value="6">6 months (young horses)</option>
                  </select>
                </div>
              )}

              {reminderForm.reminder_type === 'coggins_test' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                  <select
                    value={reminderForm.coggins_result}
                    onChange={e => setReminderForm(f => ({ ...f, coggins_result: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="negative">Negative</option>
                    <option value="positive">Positive</option>
                  </select>
                </div>
              )}

              {reminderForm.reminder_type === 'custom' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">What is this reminder for?</label>
                    <Input
                      value={reminderForm.custom_label}
                      onChange={e => setReminderForm(f => ({ ...f, custom_label: e.target.value }))}
                      placeholder="e.g. Saddle fitting"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interval</label>
                    <Input
                      type="number"
                      min="1"
                      value={reminderForm.interval_value}
                      onChange={e => setReminderForm(f => ({ ...f, interval_value: Number(e.target.value || 1) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      value={reminderForm.interval_unit}
                      onChange={e => setReminderForm(f => ({ ...f, interval_unit: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              )}

              {isVaccinationForm && (
                <div className="mt-4 space-y-3 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {isAhsVaccination ? 'AHS annual course tracker (V1, V2)' : 'Primary course tracker (V1, V2, V3)'}
                  </p>
                  <div className={`grid grid-cols-1 gap-3 ${isAhsVaccination ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">V1 date</label>
                      <Input type="date" value={reminderForm.v1_date} onChange={e => setReminderForm(f => ({ ...f, v1_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">V2 date</label>
                      <Input type="date" value={reminderForm.v2_date} onChange={e => setReminderForm(f => ({ ...f, v2_date: e.target.value }))} />
                    </div>
                    {isFluVaccination && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">V3 date</label>
                        <Input type="date" value={reminderForm.v3_date} onChange={e => setReminderForm(f => ({ ...f, v3_date: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <p className={`text-xs ${v1v2Days !== null && (v1v2Days < 21 || v1v2Days > 92) ? 'text-red-600' : 'text-gray-500'}`}>
                    V2 must be 21-92 days after V1. {v1v2Days !== null ? `Current: ${v1v2Days} days.` : ''}
                  </p>
                  {isFluVaccination && (
                    <p className={`text-xs ${v2v3Days !== null && (v2v3Days < 150 || v2v3Days > 215) ? 'text-red-600' : 'text-gray-500'}`}>
                      V3 must be 150-215 days after V2. {v2v3Days !== null ? `Current: ${v2v3Days} days.` : ''}
                    </p>
                  )}
                  <p className={`text-sm font-medium ${primaryComplete ? 'text-green-700' : 'text-amber-700'}`}>
                    {primaryComplete
                      ? (isAhsVaccination ? 'AHS annual V1-V2 course complete.' : 'Primary course complete.')
                      : (isAhsVaccination ? 'AHS annual V1-V2 course incomplete.' : 'Primary course incomplete.')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of last vaccination</label>
                      <Input type="date" value={reminderForm.annual_last_date} onChange={e => setReminderForm(f => ({ ...f, annual_last_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vet name</label>
                      <Input value={reminderForm.vet_name} onChange={e => setReminderForm(f => ({ ...f, vet_name: e.target.value }))} placeholder="Registered veterinarian" />
                    </div>
                  </div>
                  {annualDuePreview && (
                    <p className="text-sm text-gray-700">Next annual booster due: <span className="font-semibold">{formatDate(annualDuePreview)}</span></p>
                  )}
                  {isAhsVaccination && (
                    <p className="text-xs text-blue-700">
                      AHS vaccinations follow a 2-dose yearly course (V1 and V2).
                    </p>
                  )}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <p className="font-semibold">If you exceed 365 days (366 in leap year), the full Primary Course must be repeated.</p>
                    <p className="mt-1">No vaccination may be given within 7 days before any competition or measuring session.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Next competition date (optional)</label>
                      <Input type="date" value={reminderForm.competition_date} onChange={e => setReminderForm(f => ({ ...f, competition_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last safe vaccination date</label>
                      <Input type="text" readOnly value={lastSafeVaccinationDate ? formatDate(lastSafeVaccinationDate) : ''} />
                    </div>
                  </div>
                  {isBlackoutConflict && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      Your booster is due during a competition blackout period. Vaccinate before {formatDate(lastSafeVaccinationDate)} instead.
                    </div>
                  )}
                  <p className="text-xs text-blue-700">All vaccinations must be administered by a registered veterinarian.</p>
                  {requiresLegacyAnnualHistory && (
                    <p className="text-xs text-blue-700">For horses born before 1 Jan 2020, maintain at least 6 annual vaccinations with no gap over 1 year.</p>
                  )}
                </div>
              )}

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <Textarea
                  value={reminderForm.notes}
                  onChange={e => setReminderForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Extra details for this reminder..."
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => { handleAddReminder(); setShowAddReminderForm(false) }} disabled={addingReminder}>
                  <Plus size={16} />
                  {addingReminder ? 'Adding…' : 'Add reminder'}
                </Button>
              </div>
            </CardContent>
          </Card>
          )}

          {upcomingReminders.length === 0 ? (
            <EmptyState title="No reminders yet" description="Add your first reminder above to track due dates." />
          ) : (
            <div className="space-y-2">
              {upcomingReminders.map(r => {
                const urg = reminderUrgency(r.next_due_date)
                const RIcon = reminderTypeConfig(resolvedReminderType(r)).icon || Calendar
                return (
                  <div
                    key={r.id}
                    className={`bg-white rounded-xl border overflow-hidden flex items-stretch ${
                      urg.tone === 'red' ? 'border-red-200' :
                      urg.tone === 'amber' ? 'border-amber-200' :
                      urg.tone === 'yellow' ? 'border-yellow-200' :
                      'border-green-200'
                    }`}
                  >
                    {/* Left accent */}
                    <div className={`w-1.5 flex-shrink-0 ${
                      urg.tone === 'red' ? 'bg-red-400' :
                      urg.tone === 'amber' ? 'bg-amber-400' :
                      urg.tone === 'yellow' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`} />
                    {/* Icon column */}
                    <div className={`w-12 flex-shrink-0 flex items-center justify-center ${
                      urg.tone === 'red' ? 'bg-red-50' :
                      urg.tone === 'amber' ? 'bg-amber-50' :
                      urg.tone === 'yellow' ? 'bg-yellow-50' :
                      'bg-green-50'
                    }`}>
                      <RIcon size={18} className={
                        urg.tone === 'red' ? 'text-red-500' :
                        urg.tone === 'amber' ? 'text-amber-500' :
                        urg.tone === 'yellow' ? 'text-yellow-600' :
                        'text-green-600'
                      } />
                    </div>
                    {/* Content */}
                    <div className="flex items-center gap-3 flex-1 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm break-words">{reminderDisplayLabel(r)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last done: {r.last_done_date ? formatDate(r.last_done_date) : 'Not recorded'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Due {new Date(r.next_due_date || r.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {/* Countdown badge */}
                      <div className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center min-w-[52px] ${
                        urg.tone === 'red' ? 'bg-red-100 text-red-700' :
                        urg.tone === 'amber' ? 'bg-amber-100 text-amber-700' :
                        urg.tone === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        <p className="text-xs font-black leading-none">{urg.text.split(' ')[0]}</p>
                        <p className="text-[9px] font-semibold leading-none mt-0.5 opacity-80">{urg.text.split(' ').slice(1).join(' ')}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex-shrink-0 flex flex-col gap-1">
                        <button
                          onClick={() => toggleReminderDone(r)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                            urg.tone === 'red' || urg.tone === 'amber'
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                          }`}
                          title="Mark as done"
                        >
                          <CheckCircle2 size={13} />
                          Done
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(r.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete reminder"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900">Vaccination history</h4>
              <div className="mt-3 space-y-3">
                {[
                  { label: 'Flu', rows: fluHistory },
                  { label: 'AHS', rows: ahsHistory }
                ].map(group => (
                  <details key={group.label} className="rounded-lg border border-gray-200 p-3">
                    <summary className="cursor-pointer font-medium text-gray-800">
                      {group.label} history ({group.rows.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {group.rows.length === 0 ? (
                        <p className="text-sm text-gray-500">No entries logged yet.</p>
                      ) : group.rows.map(row => (
                        <div key={row.id} className="rounded-md bg-gray-50 p-2 text-sm text-gray-700">
                          <p className="font-medium">
                            {formatDate(row.date_administered)} · {row.dose_number ? `V${row.dose_number}` : 'Annual'}
                          </p>
                          <p>Vet: {row.vet_name}</p>
                          {row.notes ? <p className="text-gray-500">{row.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VACCINATIONS */}
      {activeTab === 'vaccinations' && (
        <div className="space-y-5">
          {/* Nationals eligibility summary */}
          {(() => {
            const fluR = upcomingReminders.find(r => r.reminder_type === 'flu_vaccination')
            const ahsR = upcomingReminders.find(r => r.reminder_type === 'ahs_vaccination')
            const fluDays = fluR ? dayDiff(todayISO(), fluR.next_due_date) : null
            const ahsDays = ahsR ? dayDiff(todayISO(), ahsR.next_due_date) : null
            const fluOk = Boolean(fluR?.is_primary_course_complete && fluDays !== null && fluDays > 7)
            const ahsOk = Boolean(ahsR?.is_primary_course_complete && ahsDays !== null && ahsDays > 7)
            const bothOk = fluOk && ahsOk
            const neitherLogged = !fluR && !ahsR
            return (
              <div className={`rounded-2xl border p-5 ${bothOk ? 'bg-green-50 border-green-300' : neitherLogged ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${bothOk ? 'bg-green-600' : neitherLogged ? 'bg-gray-300' : 'bg-amber-500'}`}>
                    {bothOk
                      ? <ShieldCheck size={28} className="text-white" />
                      : <AlertTriangle size={28} className="text-white" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-lg font-black ${bothOk ? 'text-green-800' : neitherLogged ? 'text-gray-600' : 'text-amber-800'}`}>
                      {bothOk ? 'Vaccination eligible for nationals' : neitherLogged ? 'No vaccinations logged yet' : 'Not fully vaccination eligible'}
                    </p>
                    <p className={`text-sm mt-0.5 ${bothOk ? 'text-green-600' : neitherLogged ? 'text-gray-400' : 'text-amber-700'}`}>
                      {bothOk
                        ? `Flu: ${fluDays} days left · AHS: ${ahsDays} days left`
                        : neitherLogged
                        ? 'Log your flu and AHS vaccinations below'
                        : [!fluOk && (fluR ? `Flu: ${fluDays !== null && fluDays <= 0 ? 'overdue' : fluDays === null ? 'no record' : 'primary incomplete'}` : 'Flu: not logged'), !ahsOk && (ahsR ? `AHS: ${ahsDays !== null && ahsDays <= 0 ? 'overdue' : ahsDays === null ? 'no record' : 'primary incomplete'}` : 'AHS: not logged')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
                  <div className="flex items-start gap-1.5"><CheckCircle2 size={13} className="text-gray-400 mt-0.5 flex-shrink-0" /><span>Primary course complete (Flu: V1+V2+V3 · AHS: V1+V2)</span></div>
                  <div className="flex items-start gap-1.5"><CheckCircle2 size={13} className="text-gray-400 mt-0.5 flex-shrink-0" /><span>Annual booster within 365 days (366 in leap year)</span></div>
                  <div className="flex items-start gap-1.5"><CheckCircle2 size={13} className="text-gray-400 mt-0.5 flex-shrink-0" /><span>No vaccination within 7 days before any competition</span></div>
                </div>
              </div>
            )
          })()}

          {/* Flu + AHS cards side by side on larger screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* FLU VACCINATION CARD */}
            {(() => {
              const fluR = upcomingReminders.find(r => r.reminder_type === 'flu_vaccination')
              const fluDays = fluR ? dayDiff(todayISO(), fluR.next_due_date) : null
              const fluOk = Boolean(fluR?.is_primary_course_complete && fluDays !== null && fluDays > 7)
              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className={`px-5 py-4 flex items-center gap-3 ${fluOk ? 'bg-blue-600' : fluR ? 'bg-amber-500' : 'bg-gray-200'}`}>
                    <Syringe size={20} className={fluR ? 'text-white' : 'text-gray-500'} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${fluR ? 'text-white' : 'text-gray-700'}`}>Equine Influenza (Flu)</p>
                      {fluR && (
                        <p className={`text-xs ${fluOk ? 'text-blue-100' : 'text-amber-100'}`}>
                          Next booster: {new Date(fluR.next_due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {fluDays !== null && ` · ${fluDays <= 0 ? `${Math.abs(fluDays)}d overdue` : `${fluDays}d left`}`}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${fluOk ? 'bg-white/20 text-white' : fluR ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {fluOk ? '✓ OK' : fluR ? '⚠ Action needed' : 'Not logged'}
                    </span>
                  </div>

                  {/* History */}
                  {fluHistory.length > 0 && (
                    <div className="px-5 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History ({fluHistory.length} entries)</p>
                      <div className="space-y-1.5">
                        {fluHistory.slice(0, 3).map(row => (
                          <div key={row.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-semibold text-gray-800">{row.dose_number ? `V${row.dose_number}` : 'Annual'}</span>
                            <span className="text-gray-400">·</span>
                            <span>{formatDate(row.date_administered)}</span>
                            {row.vet_name && <><span className="text-gray-400">·</span><span className="text-gray-500 truncate">{row.vet_name}</span></>}
                          </div>
                        ))}
                        {fluHistory.length > 3 && <p className="text-xs text-gray-400 text-center">+{fluHistory.length - 3} more</p>}
                      </div>
                    </div>
                  )}

                  {/* Log form */}
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Log vaccination</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['v1_date','v2_date','v3_date'].map((key, i) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">V{i+1} date</label>
                          <Input type="date" value={vacFluForm[key]} onChange={e => setVacFluForm(f => ({ ...f, [key]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    {vacFluForm.v1_date && vacFluForm.v2_date && (() => {
                      const diff = dayDiff(vacFluForm.v1_date, vacFluForm.v2_date)
                      return diff !== null && (diff < 21 || diff > 92) ? (
                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={11} /> V2 must be 21–92 days after V1 (currently {diff} days)</p>
                      ) : null
                    })()}
                    {vacFluForm.v2_date && vacFluForm.v3_date && (() => {
                      const diff = dayDiff(vacFluForm.v2_date, vacFluForm.v3_date)
                      return diff !== null && (diff < 150 || diff > 215) ? (
                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={11} /> V3 must be 150–215 days after V2 (currently {diff} days)</p>
                      ) : null
                    })()}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Last annual booster</label>
                        <Input type="date" value={vacFluForm.annual_last_date} onChange={e => setVacFluForm(f => ({ ...f, annual_last_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vet name <span className="text-red-500">*</span></label>
                        <Input value={vacFluForm.vet_name} onChange={e => setVacFluForm(f => ({ ...f, vet_name: e.target.value }))} placeholder="Registered vet" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Next competition (optional — checks 7-day blackout)</label>
                      <Input type="date" value={vacFluForm.competition_date} onChange={e => setVacFluForm(f => ({ ...f, competition_date: e.target.value }))} />
                    </div>
                    {vacFluForm.annual_last_date && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                        <p className="font-semibold">Next annual booster due: {formatDate(annualDueDate(vacFluForm.annual_last_date))}</p>
                        {vacFluForm.competition_date && (() => {
                          const lastSafe = addDays(vacFluForm.competition_date, -7)
                          const annualDue = annualDueDate(vacFluForm.annual_last_date)
                          const conflict = annualDue && lastSafe && dayDiff(annualDue, lastSafe) < 0
                          return conflict ? (
                            <p className="mt-1 text-red-700 flex items-center gap-1"><AlertTriangle size={11} /> Booster due during blackout — vaccinate before {formatDate(lastSafe)}</p>
                          ) : (
                            <p className="mt-1 text-blue-600">Last safe vaccination date: {formatDate(lastSafe)}</p>
                          )
                        })()}
                      </div>
                    )}
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      If gap exceeds 365 days (366 in leap year), the full primary course must be repeated.
                    </div>
                    <Button
                      onClick={() => handleSaveVaccination('flu_vaccination', vacFluForm, setSavingVaccFlu)}
                      disabled={savingVaccFlu}
                      className="w-full"
                    >
                      <Syringe size={15} />
                      {savingVaccFlu ? 'Saving…' : 'Save & set reminder'}
                    </Button>
                  </div>
                </div>
              )
            })()}

            {/* AHS VACCINATION CARD */}
            {(() => {
              const ahsR = upcomingReminders.find(r => r.reminder_type === 'ahs_vaccination')
              const ahsDays = ahsR ? dayDiff(todayISO(), ahsR.next_due_date) : null
              const ahsOk = Boolean(ahsR?.is_primary_course_complete && ahsDays !== null && ahsDays > 7)
              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className={`px-5 py-4 flex items-center gap-3 ${ahsOk ? 'bg-green-600' : ahsR ? 'bg-amber-500' : 'bg-gray-200'}`}>
                    <ShieldAlert size={20} className={ahsR ? 'text-white' : 'text-gray-500'} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${ahsR ? 'text-white' : 'text-gray-700'}`}>African Horse Sickness (AHS)</p>
                      {ahsR && (
                        <p className={`text-xs ${ahsOk ? 'text-green-100' : 'text-amber-100'}`}>
                          Next booster: {new Date(ahsR.next_due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {ahsDays !== null && ` · ${ahsDays <= 0 ? `${Math.abs(ahsDays)}d overdue` : `${ahsDays}d left`}`}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${ahsOk ? 'bg-white/20 text-white' : ahsR ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {ahsOk ? '✓ OK' : ahsR ? '⚠ Action needed' : 'Not logged'}
                    </span>
                  </div>

                  {ahsHistory.length > 0 && (
                    <div className="px-5 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History ({ahsHistory.length} entries)</p>
                      <div className="space-y-1.5">
                        {ahsHistory.slice(0, 3).map(row => (
                          <div key={row.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-semibold text-gray-800">{row.dose_number ? `V${row.dose_number}` : 'Annual'}</span>
                            <span className="text-gray-400">·</span>
                            <span>{formatDate(row.date_administered)}</span>
                            {row.vet_name && <><span className="text-gray-400">·</span><span className="text-gray-500 truncate">{row.vet_name}</span></>}
                          </div>
                        ))}
                        {ahsHistory.length > 3 && <p className="text-xs text-gray-400 text-center">+{ahsHistory.length - 3} more</p>}
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Log vaccination</p>
                    <p className="text-xs text-gray-500">AHS follows a 2-dose annual course (V1 + V2).</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['v1_date','v2_date'].map((key, i) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">V{i+1} date</label>
                          <Input type="date" value={vacAhsForm[key]} onChange={e => setVacAhsForm(f => ({ ...f, [key]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    {vacAhsForm.v1_date && vacAhsForm.v2_date && (() => {
                      const diff = dayDiff(vacAhsForm.v1_date, vacAhsForm.v2_date)
                      return diff !== null && (diff < 21 || diff > 92) ? (
                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={11} /> V2 must be 21–92 days after V1 (currently {diff} days)</p>
                      ) : null
                    })()}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Last annual booster</label>
                        <Input type="date" value={vacAhsForm.annual_last_date} onChange={e => setVacAhsForm(f => ({ ...f, annual_last_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vet name <span className="text-red-500">*</span></label>
                        <Input value={vacAhsForm.vet_name} onChange={e => setVacAhsForm(f => ({ ...f, vet_name: e.target.value }))} placeholder="Registered vet" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Next competition (optional)</label>
                      <Input type="date" value={vacAhsForm.competition_date} onChange={e => setVacAhsForm(f => ({ ...f, competition_date: e.target.value }))} />
                    </div>
                    {vacAhsForm.annual_last_date && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                        <p className="font-semibold">Next annual booster due: {formatDate(annualDueDate(vacAhsForm.annual_last_date))}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      All vaccinations must be administered by a registered veterinarian.
                    </div>
                    <Button
                      onClick={() => handleSaveVaccination('ahs_vaccination', vacAhsForm, setSavingVaccAhs)}
                      disabled={savingVaccAhs}
                      className="w-full"
                    >
                      <ShieldAlert size={15} />
                      {savingVaccAhs ? 'Saving…' : 'Save & set reminder'}
                    </Button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

        </div> {/* end tab panels */}
      </div> {/* end sidebar + content flex */}

      {/* Delete horse confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900">Delete horse?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will permanently delete <span className="font-semibold text-gray-800">{horse.name}</span> and all associated medical entries and reminders.
            </p>
            <p className="text-sm font-medium text-red-600 mt-2">This cannot be undone.</p>
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <button
                onClick={handleDeleteHorse}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                <Trash2 size={15} />
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhotoCropModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900">Crop horse photo</h3>
            <p className="text-sm text-gray-600 mt-1">Drag to move and zoom until the horse is centered.</p>

            <div className="mt-4 relative h-72 sm:h-96 rounded-xl overflow-hidden bg-gray-900">
              <Cropper
                image={photoCropSource}
                crop={photoCrop}
                zoom={photoZoom}
                aspect={1}
                objectFit="contain"
                onCropChange={setPhotoCrop}
                onZoomChange={setPhotoZoom}
                onCropComplete={(_, croppedAreaPixels) => setPhotoCroppedAreaPixels(croppedAreaPixels)}
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zoom</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={photoZoom}
                onChange={e => setPhotoZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={closePhotoCropModal} disabled={uploadingPhoto}>
                Cancel
              </Button>
              <Button onClick={handleHorsePhotoUpload} disabled={uploadingPhoto}>
                {uploadingPhoto ? 'Uploading…' : 'Crop and upload'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add medical modal */}
      {showMedicalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add medical entry</h3>
                <p className="text-sm text-gray-500 mt-0.5">Log what happened for {horse.name}</p>
              </div>
              <button onClick={() => setShowMedicalModal(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type selector — icon buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'vaccination', label: 'Vaccination', icon: Syringe,       color: 'blue' },
                    { value: 'deworming',   label: 'Deworming',   icon: Bug,            color: 'purple' },
                    { value: 'farrier',     label: 'Farrier',     icon: Scissors,       color: 'orange' },
                    { value: 'vet_visit',   label: 'Vet Visit',   icon: Activity,       color: 'teal' },
                    { value: 'injury',      label: 'Injury',      icon: AlertTriangle,  color: 'red' },
                    { value: 'other',       label: 'Other',       icon: Wrench,         color: 'gray' },
                  ].map(({ value, label, icon: Icon, color }) => {
                    const active = medicalForm.type === value
                    const activeClasses = {
                      blue:   'bg-blue-600 border-blue-600 text-white',
                      purple: 'bg-purple-600 border-purple-600 text-white',
                      orange: 'bg-orange-500 border-orange-500 text-white',
                      teal:   'bg-teal-600 border-teal-600 text-white',
                      red:    'bg-red-600 border-red-600 text-white',
                      gray:   'bg-gray-600 border-gray-600 text-white',
                    }
                    return (
                      <button
                        key={value}
                        onClick={() => setMedicalForm(f => ({ ...f, type: value }))}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-semibold transition ${active ? activeClasses[color] : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                      >
                        <Icon size={18} />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <Input
                  value={medicalForm.title}
                  onChange={e => setMedicalForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Flu + Tetanus booster"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <Input type="date" value={medicalForm.date} onChange={e => setMedicalForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Textarea
                  value={medicalForm.notes}
                  onChange={e => setMedicalForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Dosage, vet name, observations..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <Button variant="secondary" onClick={() => setShowMedicalModal(false)} disabled={addingMedical}>Cancel</Button>
              <Button onClick={handleAddMedical} disabled={addingMedical}>
                <Plus size={16} />
                {addingMedical ? 'Adding…' : 'Add entry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record vitals</h3>
                <p className="text-sm text-gray-500 mt-0.5">Timestamp added automatically</p>
              </div>
              <button onClick={() => setShowVitalsModal(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Vital type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What are you recording?</label>
                <div className="grid grid-cols-2 gap-2">
                  {VITAL_TYPES.map(type => {
                    const active = vitalForm.vital_type === type.value
                    const threshold = VITAL_THRESHOLDS[type.value]
                    return (
                      <button
                        key={type.value}
                        onClick={() => setVitalForm(f => ({ ...f, vital_type: type.value, value: '' }))}
                        className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition ${active ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'}`}
                      >
                        <span className="text-sm font-semibold">{type.label}</span>
                        {threshold && <span className={`text-xs ${active ? 'text-green-200' : 'text-gray-400'}`}>{threshold.min}–{threshold.max} {threshold.unit}</span>}
                        {!threshold && <span className={`text-xs ${active ? 'text-green-200' : 'text-gray-400'}`}>Select value</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Value input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value <span className="text-red-500">*</span>
                  {VITAL_THRESHOLDS[vitalForm.vital_type] && (
                    <span className="ml-2 font-normal text-gray-400 text-xs">Normal: {VITAL_THRESHOLDS[vitalForm.vital_type].min}–{VITAL_THRESHOLDS[vitalForm.vital_type].max} {VITAL_THRESHOLDS[vitalForm.vital_type].unit}</span>
                  )}
                </label>
                {vitalForm.vital_type === 'gut_sounds' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {GUT_SOUND_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setVitalForm(f => ({ ...f, gut_sounds: opt.value }))}
                        className={`rounded-lg border py-2.5 text-sm font-medium transition ${vitalForm.gut_sounds === opt.value ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={vitalForm.value}
                    onChange={e => setVitalForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={`e.g. ${VITAL_THRESHOLDS[vitalForm.vital_type] ? (VITAL_THRESHOLDS[vitalForm.vital_type].min + VITAL_THRESHOLDS[vitalForm.vital_type].max) / 2 : ''} ${VITAL_TYPES.find(t => t.value === vitalForm.vital_type)?.unit || ''}`}
                    autoFocus
                    type="number"
                    step="0.1"
                  />
                )}
                {/* Live range indicator */}
                {vitalForm.value && VITAL_THRESHOLDS[vitalForm.vital_type] && (() => {
                  const num = parseFloat(vitalForm.value)
                  const thr = VITAL_THRESHOLDS[vitalForm.vital_type]
                  if (Number.isNaN(num)) return null
                  const ok = num >= thr.min && num <= thr.max
                  return (
                    <p className={`mt-1.5 text-xs font-semibold flex items-center gap-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>
                      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {ok ? 'Within normal range' : `Outside normal range (${thr.min}–${thr.max} ${thr.unit})`}
                    </p>
                  )
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <Textarea value={vitalForm.notes} onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any observations..." />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <Button variant="secondary" onClick={() => setShowVitalsModal(false)} disabled={addingVital}>Cancel</Button>
              <Button onClick={handleAddVital} disabled={addingVital}>
                <Heart size={15} />
                {addingVital ? 'Saving…' : 'Save vitals'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(d => ({ ...d, open: false }))}
        onConfirm={confirmDialog.onConfirm ?? (() => {})}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}


