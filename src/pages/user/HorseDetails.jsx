import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { uploadImageToBucket } from '../../lib/storageUploads'
import { ArrowLeft, Calendar, CheckCircle2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button, Card, CardContent, EmptyState, Input, PageHeader, Skeleton, Textarea } from '../../components/ui'

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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function HorseDetails() {
  const { horseId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [horse, setHorse] = useState(null)
  const [activeTab, setActiveTab] = useState('details') // details | medical | reminders
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [medical, setMedical] = useState([])
  const [reminders, setReminders] = useState([])

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

  const [addingReminder, setAddingReminder] = useState(false)
  const [reminderForm, setReminderForm] = useState({
    label: '',
    due_date: todayISO(),
  })

  useEffect(() => {
    if (!profile?.id || !horseId) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, horseId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [horseRes, medicalRes, remindersRes] = await Promise.all([
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
          .from('horse_reminders')
          .select('*')
          .eq('horse_id', horseId)
          .eq('user_id', profile.id)
          .order('is_done', { ascending: true })
          .order('due_date', { ascending: true })
          .order('created_at', { ascending: false }),
      ])

      if (horseRes.error) throw horseRes.error
      if (medicalRes.error) throw medicalRes.error
      if (remindersRes.error) throw remindersRes.error

      if (!horseRes.data) {
        setHorse(null)
        setMedical([])
        setReminders([])
        return
      }

      setHorse(horseRes.data)
      setMedical(medicalRes.data || [])
      setReminders(remindersRes.data || [])

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

  const upcomingReminders = useMemo(() => reminders.filter(r => !r.is_done), [reminders])
  const doneReminders = useMemo(() => reminders.filter(r => r.is_done), [reminders])

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

  async function handleAddReminder() {
    if (!reminderForm.label.trim()) {
      toast.error('Please enter a reminder label')
      return
    }
    if (!reminderForm.due_date) {
      toast.error('Please choose a due date')
      return
    }

    setAddingReminder(true)
    try {
      const { error } = await supabase
        .from('horse_reminders')
        .insert({
          horse_id: horseId,
          user_id: profile.id,
          label: reminderForm.label.trim(),
          due_date: reminderForm.due_date,
          is_done: false,
        })
      if (error) throw error
      toast.success('Reminder added')
      setReminderForm({ label: '', due_date: todayISO() })
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
      const { error } = await supabase
        .from('horse_reminders')
        .update({ is_done: !reminder.is_done })
        .eq('id', reminder.id)
        .eq('user_id', profile.id)
      if (error) throw error
      await fetchAll()
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
    <div className="space-y-6 max-w-3xl">
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
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'details', label: 'Details' },
          { key: 'medical', label: `Medical log (${medical.length})` },
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
          <div className="flex justify-end">
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
              {medical.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            {MEDICAL_TYPES.find(t => t.value === entry.type)?.label || 'Other'}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(entry.date).toLocaleDateString('en-ZA', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="mt-2 font-semibold text-gray-900 break-words">{entry.title}</p>
                        {entry.notes ? (
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900">Add reminder</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <Input
                    value={reminderForm.label}
                    onChange={e => setReminderForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. Deworming due"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                  <Input
                    type="date"
                    value={reminderForm.due_date}
                    onChange={e => setReminderForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
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
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{r.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Due{' '}
                      {new Date(r.due_date).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleReminderDone(r)}
                      className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                      title="Mark done"
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

          {doneReminders.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Completed
              </p>
              <div className="space-y-2">
                {doneReminders.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3 opacity-70">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-700 break-words line-through">{r.label}</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        Due{' '}
                        {new Date(r.due_date).toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleReminderDone(r)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition"
                        title="Mark as not done"
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
            </div>
          )}
        </div>
      )}

      {/* Delete horse confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
    </div>
  )
}

