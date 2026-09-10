// Whitelist of BFF resources. This is not a generic SQL proxy: only these
// tables are exposed, with explicit owner / admin rules.

const COMBO_OWNER = {
  table: 'horse_rider_combos',
  localKey: 'combo_id',
  ownerCol: 'user_id',
}

export const RESOURCES = {
  horses: {
    table: 'horses',
    ownerCol: 'user_id',
    d1Ready: true,
  },
  combos: {
    table: 'horse_rider_combos',
    ownerCol: 'user_id',
    boolCols: ['is_pinned', 'is_archived'],
    d1Ready: true,
  },
  medical: {
    table: 'horse_medical_entries',
    ownerCol: 'user_id',
    filterCols: ['horse_id', 'type'],
    boolCols: ['is_abnormal'],
    d1Ready: true,
  },
  reminders: {
    table: 'horse_reminders',
    ownerCol: 'user_id',
    filterCols: ['horse_id'],
    boolCols: ['is_done', 'is_primary_course_complete'],
    jsonCols: ['notification_days_before', 'metadata'],
    d1Ready: true,
  },
  vaccinations: {
    table: 'vaccination_log',
    ownerCol: 'user_id',
    filterCols: ['horse_id'],
    d1Ready: true,
  },
  videos: {
    table: 'horse_videos',
    ownerCol: 'user_id',
    filterCols: ['horse_id', 'qualifier_id'],
    d1Ready: true,
  },
  notifications: {
    table: 'notifications',
    ownerCol: 'user_id',
    filterCols: ['is_read', 'type'],
    boolCols: ['is_read'],
    d1Ready: true,
  },
  bookmarks: {
    table: 'bookmarked_events',
    ownerCol: 'user_id',
    filterCols: ['event_id', 'combo_id'],
    d1Ready: true,
  },
  'push-subscriptions': {
    table: 'push_subscriptions',
    ownerCol: 'user_id',
    filterCols: ['endpoint'],
    d1Ready: true,
  },
  'horse-times': {
    table: 'horse_times',
    ownerCol: 'user_id',
    d1Ready: true,
  },
  results: {
    table: 'qualifier_results',
    ownerVia: COMBO_OWNER,
    filterCols: ['combo_id', 'event_id', 'game'],
    boolCols: ['is_nt'],
    d1Ready: false,
  },
  pbs: {
    table: 'personal_bests',
    ownerVia: COMBO_OWNER,
    filterCols: ['combo_id', 'game', 'season_year'],
    d1Ready: false,
  },
  'event-day-results': {
    table: 'event_day_results',
    ownerVia: COMBO_OWNER,
    filterCols: ['combo_id', 'event_id', 'game'],
    boolCols: ['is_nt'],
    d1Ready: false,
  },
  events: {
    table: 'qualifier_events',
    publicRead: true,
    adminWrite: true,
    d1Ready: true,
  },
  announcements: {
    table: 'announcements',
    publicRead: true,
    adminWrite: true,
    boolCols: ['is_pinned'],
    d1Ready: true,
  },
  profiles: {
    table: 'profiles',
    ownerCol: 'id',
    listAdminOnly: true,
    allowInsert: false,
    allowDelete: false,
    boolCols: ['has_seen_tutorial', 'paygate_exempt'],
    jsonCols: ['extra'],
    patchAllow: [
      'rider_name',
      'province',
      'age_category',
      'profile_photo_url',
      'has_seen_tutorial',
    ],
    adminPatchAllow: [
      'rider_name',
      'province',
      'age_category',
      'profile_photo_url',
      'has_seen_tutorial',
      'role',
      'status',
      'paygate_exempt',
      'subscription_status',
      'subscription_end_at',
    ],
    d1Ready: true,
  },
  friendships: {
    table: 'user_friendships',
    filterCols: ['requester_id', 'addressee_id', 'status'],
    d1Ready: false,
  },
  reactions: {
    table: 'friend_reactions',
    ownerCol: 'from_user_id',
    filterCols: ['to_user_id', 'reaction'],
    d1Ready: true,
  },
  'club-links': {
    table: 'club_member_links',
    filterCols: ['club_head_id', 'rider_id', 'status'],
    d1Ready: false,
  },
  'club-riders': {
    table: 'club_managed_riders',
    ownerCol: 'club_head_id',
    d1Ready: true,
  },
  'supporter-links': {
    table: 'supporter_rider_links',
    filterCols: ['supporter_id', 'rider_id', 'status'],
    d1Ready: false,
  },
  grants: {
    table: 'profile_access_grants',
    filterCols: ['admin_id', 'user_id', 'status'],
    d1Ready: false,
  },
  'staged-sessions': {
    table: 'staged_edit_sessions',
    filterCols: ['admin_id', 'user_id', 'grant_id', 'status'],
    d1Ready: false,
  },
  'staged-items': {
    table: 'staged_edit_items',
    filterCols: ['session_id'],
    jsonCols: ['payload'],
    d1Ready: false,
  },
  reports: {
    table: 'problem_reports',
    ownerCol: 'user_id',
    filterCols: ['status', 'category'],
    jsonCols: ['context'],
    listAdminOnly: true,
    d1Ready: true,
  },
}

export const RESOURCE_PATHS = Object.keys(RESOURCES)

export function getResource(name) {
  return RESOURCES[name] || null
}

export const UPLOAD_BUCKETS = ['avatars', 'horse-photos', 'videos']
