import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { uploadImageToBucket } from '../../lib/storageUploads'
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Calendar,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Scissors,
  ShieldAlert,
  Syringe,
  Trash2,
  Wrench,
  X
} from 'lucide-react'
import { Button, Card, CardContent, EmptyState, Input, PageHeader, Skeleton, Textarea } from '../../components/ui'
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

function reminderDisplayLabel(reminder) {
  if (reminder.reminder_type === 'custom') {
    return reminder.custom_label || reminder.label || 'Custom reminder'
  }
  return reminderTypeConfig(reminder.reminder_type).label
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

  const [horse, setHorse] = useState(null)
  const [activeTab, setActiveTab] = useState('details') // details | medical | vitals | reminders
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [medical, setMedical] = useState([])
  const [reminders, setReminders] = useState([])
  const [vaccinationLog, setVaccinationLog] = useState([])

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

  useEffect(() => {
    if (!profile?.id || !horseId) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, horseId])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab === 'reminders') setActiveTab('reminders')
  }, [location.search])

  async function fetchAll() {
    setLoading(true)
    try {
      const [horseRes, medicalRes] = await Promise.all([
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
      ])

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
      if (remindersRes.error) throw remindersRes.error
      if (vaccinationLogRes.error) throw vaccinationLogRes.error

      if (!horseRes.data) {
        setHorse(null)
        setMedical([])
        setReminders([])
        return
      }

      setHorse(horseRes.data)
      setMedical(medicalRes.data || [])
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

  async function handleHorsePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingPhoto(true)

      if (!profile?.id) throw new Error('Not signed in')

      const filePath = `${profile.id}/${horseId}/photo.jpg`
      const { publicUrl } = await uploadImageToBucket({
        bucket: 'horse-photos',
        path: filePath,
        file,
      })

      const { error: updateError } = await supabase
        .from('horses')
        .update({ photo_url: publicUrl })
        .eq('id', horseId)
        .eq('user_id', profile.id)
      if (updateError) throw updateError

      toast.success('Photo updated')
      await fetchAll()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Error uploading photo')
    } finally {
      setUploadingPhoto(false)
      // allow uploading same file again
      e.target.value = ''
    }
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

  async function handleDeleteMedical(entryId) {
    if (!confirm('Delete this medical entry?')) return
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

      const { error } = await supabase
        .from('horse_reminders')
        .insert({
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
        })
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
          if (logError) throw logError
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

  async function handleDeleteReminder(reminderId) {
    if (!confirm('Delete this reminder?')) return
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'details', label: 'Details' },
          { key: 'medical', label: `Medical log (${medical.length})` },
          {
            key: 'vitals',
            label: `Vitals (${vitalTrendSeries.temperaturePoints.length + vitalTrendSeries.heartRatePoints.length})`,
          },
          { key: 'reminders', label: `Reminders (${upcomingReminders.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === t.key
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
                      <label className="inline-flex">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleHorsePhotoUpload}
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
        </div>
      )}

      {/* MEDICAL */}
      {activeTab === 'medical' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setShowVitalsModal(true)}>
              <Plus size={16} />
              Vitals entry
            </Button>
            <Button onClick={() => setShowMedicalModal(true)}>
              <Plus size={16} />
              Add entry
            </Button>
          </div>

          {medical.length === 0 ? (
            <EmptyState
              title="No medical entries yet"
              description="Add vaccinations, deworming, farrier visits, vet notes, injuries, and more."
            />
          ) : (
            <div className="space-y-3">
              {medical.map(entry => {
                const vitalFlagged = vitalsEntryShowsFlagged(entry)
                const vitalReason = vitalsAbnormalReasonForDisplay(entry)
                const vitalNotesBody = vitalsNotesBody(entry, vitalReason)
                return (
                <Card key={entry.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            {entry.type === 'vitals'
                              ? 'Vitals'
                              : (MEDICAL_TYPES.find(t => t.value === entry.type)?.label || 'Other')}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(entry.recorded_at || entry.date)}
                          </span>
                          {entry.type === 'vitals' && vitalFlagged ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Flagged
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-semibold text-gray-900 break-words">{entry.title}</p>
                        {entry.type === 'vitals' ? (
                          <div className="mt-1 text-sm text-gray-600 space-y-1">
                            <p>Recorded: {formatDateTime(entry.recorded_at || entry.created_at)}</p>
                            {vitalFlagged && vitalReason ? (
                              <p className="text-red-700">{vitalReason}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {entry.type === 'vitals' && vitalNotesBody ? (
                          <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap break-words">{vitalNotesBody}</p>
                        ) : entry.type !== 'vitals' && entry.notes ? (
                          <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap break-words">{entry.notes}</p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => handleDeleteMedical(entry.id)}
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                        title="Delete entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VITALS */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowVitalsModal(true)}>
              <Plus size={16} />
              Vitals entry
            </Button>
          </div>
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
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900">Horse health & maintenance reminders</h3>

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
                <Button onClick={handleAddReminder} disabled={addingReminder}>
                  <Plus size={16} />
                  {addingReminder ? 'Adding…' : 'Add reminder'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {upcomingReminders.length === 0 ? (
            <EmptyState title="No upcoming reminders" description="Add one above to start tracking due dates." />
          ) : (
            <div className="space-y-2">
              {upcomingReminders.map(r => (
                <div
                  key={r.id}
                  className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-3 ${
                    reminderUrgency(r.next_due_date).tone === 'red'
                      ? 'border-red-300'
                      : reminderUrgency(r.next_due_date).tone === 'amber'
                      ? 'border-amber-300'
                      : reminderUrgency(r.next_due_date).tone === 'yellow'
                      ? 'border-yellow-300'
                      : 'border-green-300'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{reminderDisplayLabel(r)}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Last done {r.last_done_date ? formatDate(r.last_done_date) : 'Not set'} · Next due{' '}
                      {new Date(r.next_due_date || r.due_date).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs mt-1 text-gray-500">{reminderUrgency(r.next_due_date).text}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleReminderDone(r)}
                      className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                      title="Log as done"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete reminder"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
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

      {/* Add medical modal */}
      {showMedicalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add medical entry</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Log vaccinations, deworming, farrier, vet visits, injuries, etc.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowMedicalModal(false)}
                disabled={addingMedical}
              >
                Close
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={medicalForm.type}
                  onChange={e => setMedicalForm(f => ({ ...f, type: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {MEDICAL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={medicalForm.title}
                  onChange={e => setMedicalForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Flu + Tetanus booster"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={medicalForm.date}
                  onChange={e => setMedicalForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Textarea
                  value={medicalForm.notes}
                  onChange={e => setMedicalForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional details (dosage, vet name, observations, etc.)"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowMedicalModal(false)}
                disabled={addingMedical}
              >
                Cancel
              </Button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Vitals entry</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Save a vital with automatic date and time.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setShowVitalsModal(false)} disabled={addingVital}>
                Close
              </Button>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Normal ranges</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-700">
                <p><span className="font-semibold">Temp:</span> 37.2-38.6 °C</p>
                <p><span className="font-semibold">HR:</span> 28-44 bpm</p>
                <p><span className="font-semibold">Resp:</span> 8-16 breaths/min</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vital <span className="text-red-500">*</span>
                </label>
                <select
                  value={vitalForm.vital_type}
                  onChange={e => setVitalForm(f => ({ ...f, vital_type: e.target.value, value: '' }))}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {VITAL_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {vitalForm.vital_type === 'gut_sounds' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={vitalForm.gut_sounds}
                    onChange={e => setVitalForm(f => ({ ...f, gut_sounds: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {GUT_SOUND_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={vitalForm.value}
                    onChange={e => setVitalForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={`Enter value in ${VITAL_TYPES.find(t => t.value === vitalForm.vital_type)?.unit || ''}`}
                    autoFocus
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Textarea
                  value={vitalForm.notes}
                  onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional observations"
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Date and time are added automatically when this entry is saved.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowVitalsModal(false)} disabled={addingVital}>
                Cancel
              </Button>
              <Button onClick={handleAddVital} disabled={addingVital}>
                <Plus size={16} />
                {addingVital ? 'Saving…' : 'Save vitals'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


