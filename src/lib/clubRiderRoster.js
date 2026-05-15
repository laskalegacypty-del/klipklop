import { supabase } from './supabaseClient'

const MANAGED_SELECT = 'id, rider_name, age_category, province, profile_photo_url, club_head_id, created_at'

export function toManagedRiderOption(row) {
  if (!row) return null
  return {
    id: row.id,
    rider_name: row.rider_name,
    age_category: row.age_category,
    province: row.province,
    profile_photo_url: row.profile_photo_url,
    source: 'managed',
  }
}

export async function fetchManagedRiders(clubHeadId) {
  const { data, error } = await supabase
    .from('club_managed_riders')
    .select(MANAGED_SELECT)
    .eq('club_head_id', clubHeadId)
    .order('rider_name', { ascending: true })

  if (error) throw error
  return (data || []).map(toManagedRiderOption)
}

export async function createManagedRider(clubHeadId, { rider_name, age_category, province }) {
  const { data, error } = await supabase
    .from('club_managed_riders')
    .insert({
      club_head_id: clubHeadId,
      rider_name: rider_name.trim(),
      age_category: age_category || null,
      province: province || null,
    })
    .select(MANAGED_SELECT)
    .single()

  if (error) throw error
  return toManagedRiderOption(data)
}

export async function updateManagedRider(id, updates) {
  const payload = { updated_at: new Date().toISOString() }
  if (updates.rider_name != null) payload.rider_name = updates.rider_name.trim()
  if (updates.age_category !== undefined) payload.age_category = updates.age_category
  if (updates.province !== undefined) payload.province = updates.province
  if (updates.profile_photo_url !== undefined) payload.profile_photo_url = updates.profile_photo_url

  const { data, error } = await supabase
    .from('club_managed_riders')
    .update(payload)
    .eq('id', id)
    .select(MANAGED_SELECT)
    .single()

  if (error) throw error
  return toManagedRiderOption(data)
}

export async function deleteManagedRider(id) {
  const { error } = await supabase
    .from('club_managed_riders')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function fetchHeadHorses(clubHeadId) {
  const { data, error } = await supabase
    .from('horses')
    .select('id, name, photo_url, breed, color')
    .eq('user_id', clubHeadId)
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchCombosForManagedRider(managedRiderId) {
  const { data, error } = await supabase
    .from('horse_rider_combos')
    .select('*')
    .eq('managed_rider_id', managedRiderId)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchCombosForLinkedRider(riderId) {
  const { data, error } = await supabase
    .from('horse_rider_combos')
    .select('*')
    .eq('user_id', riderId)
    .is('managed_rider_id', null)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchCombosForRider(rider) {
  if (!rider?.id) return []
  if (rider.source === 'managed') {
    return fetchCombosForManagedRider(rider.id)
  }
  return fetchCombosForLinkedRider(rider.id)
}

export async function createManagedCombo(clubHeadId, { managedRiderId, horseId, horseName, currentLevel = 0 }) {
  const { data, error } = await supabase
    .from('horse_rider_combos')
    .insert({
      user_id: clubHeadId,
      managed_rider_id: managedRiderId,
      horse_id: horseId || null,
      horse_name: horseName,
      current_level: currentLevel,
      is_pinned: false,
      is_archived: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function deleteCombo(comboId) {
  const { error } = await supabase
    .from('horse_rider_combos')
    .delete()
    .eq('id', comboId)

  if (error) throw error
}

/** Club head roster: managed members only (primary path). */
export async function fetchClubHeadRoster(clubHeadId) {
  return fetchManagedRiders(clubHeadId)
}
