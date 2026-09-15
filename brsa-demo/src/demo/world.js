import { CLASS_FEES, HOF_CATEGORIES } from './money'
import { defaultAccent } from './accents'

const UNOFFICIAL_POSTED = '2026-09-10T16:00:00+02:00'

/** Pitch account levels (high → low): sysadmin → brsa → producer → rider/fan */
export function isSysAdmin(role) {
  return role === 'sysadmin'
}

export function isBrsa(role) {
  return role === 'brsa' || role === 'admin'
}

/** Federation staff: BRSA management + sys admins */
export function isFedStaff(role) {
  return isSysAdmin(role) || isBrsa(role)
}

export function roleLabel(role) {
  if (!role) return ''
  if (role === 'sysadmin') return 'Sys admin'
  if (role === 'brsa' || role === 'admin') return 'BRSA'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function migrateUsers(users = []) {
  const next = users.map((u) => {
    if (u.id === 'admin' || u.role === 'admin') {
      return { ...u, id: u.id === 'admin' ? 'brsa' : u.id, role: 'brsa', name: u.name === 'BRSA Support' ? 'BRSA Management' : u.name }
    }
    return u
  })
  if (!next.some((u) => u.role === 'sysadmin')) {
    next.unshift({ id: 'sysadmin', username: 'sysadmin', password: 'demo', role: 'sysadmin', name: 'Sys Admin' })
  }
  if (!next.some((u) => u.role === 'brsa')) {
    next.unshift({ id: 'brsa', username: 'brsa', password: 'demo', role: 'brsa', name: 'BRSA Management' })
  }
  return next
}

export const RULE_BOOK = [
  { id: 'A', title: 'Membership', body: 'BRSA membership runs July–June. Day members may enter a single event and owe the class membership fee if they take a payout. Unpaid fines block the next entry.' },
  { id: 'B', title: 'Classes', body: 'Peewee, Junior, Youth, Adult, Senior, Open, Training and Futurity. A rider enters the class they are a member in. Carry-over is a second run on the same horse for an extra fee.' },
  { id: 'C', title: 'Entries', body: 'Entries close when the books are marked official. Pay-later names stay off the draw until the entry invoice is paid. Producers may take a late (guest) entry on the day.' },
  { id: 'D', title: 'Draw', body: 'The draw is a random shuffle of paid names. Draw numbers are posted before the first horse. A missing number is a producer warning, not an automatic scratch.' },
  { id: 'E', title: 'Timing & divisions', body: 'BRSA currently pays 3D. The split is a straight one second off the fastest completed time in the class. Place is inside the division. A two-run jackpot keeps the better run. Points are still calculated across five divisions in the written book, but payouts run 3D today.' },
  { id: 'F', title: 'Dress & welfare', body: 'Long sleeve, hat, collar. Under-18s wear a helmet. A welfare steward stands the gate. Abuse or an unsafe horse is a producer scratch and a possible fine.' },
  { id: 'G', title: 'Points', body: 'Five participation points plus 5–1 for places 1–5. Carry-over does not add a bonus. Futurity points sit on the horse; a carry-over credits the rider the same points as the horse.' },
  { id: 'H', title: 'Payouts', body: 'The entry includes a set R150 event cost, deducted first. Of the remainder, BRSA keeps 30% and pays out 70% to competitors. Wins apply to an unpaid membership invoice unless written off as cash.' },
  { id: 'I', title: 'Protests', body: 'Unofficial times stand for seven days. A rider may query a time. The producer can accept (re-open for re-timing), reject, or ask for more detail.' },
  { id: 'J', title: 'Championships', body: 'Qualification is by class points across official events in the season. The rider Dashboard tracks the cut.' },
  { id: 'K', title: 'Conduct', body: 'Federation voice in the feed. Community is member-to-member. Boosts and gifts are optional and never buy a placing.' },
  { id: 'L', title: 'Records', body: 'Hall of Fame categories: BRSA Record, South African Record, Championship Win, Special Recognition. Category is required; the achievement line is free text.' },
]

export function createSeed() {
  return {
    version: 4,
    season: '2026/27',
    membershipIncludesApp: true,
    appPrice: 180,
    accent: defaultAccent(),
    brsaWallet: 18400,
    sponsor: {
      name: 'Rietvlei Feeds',
      tag: 'Official feed partner',
      mark: 'RF',
    },
    links: {
      website: 'https://barrelracing-southafrica.co.za',
      facebook: 'https://facebook.com/BRSAdemo',
      instagram: 'https://instagram.com/brsa.demo',
      tiktok: 'https://tiktok.com/@brsa.demo',
      whatsapp: 'https://wa.me/27824410091',
      email: 'mailto:info@brsa.demo',
    },
    viewAsLog: [],
    currentUserId: 'brsa',
    users: [
      { id: 'sysadmin', username: 'sysadmin', password: 'demo', role: 'sysadmin', name: 'Sys Admin' },
      { id: 'brsa', username: 'brsa', password: 'demo', role: 'brsa', name: 'BRSA Management' },
      { id: 'rider', username: 'rider', password: 'demo', role: 'rider', name: 'Liani van der Walt', riderId: 'sunny' },
      { id: 'fan', username: 'fan', password: 'demo', role: 'fan', name: 'Sarel Venter', fanId: 'sarel' },
      { id: 'producer', username: 'producer', password: 'demo', role: 'producer', name: 'Ansie Nel', producerId: 'ansie' },
    ],
    riders: [
      rider('sunny', 'Liani van der Walt', 'SA1001', 'Adult', 'Gauteng', 16, 18400, 4200, 420, 'Member · due 15 Sep', {
        birthday: null,
        debitOrder: true,
        joinedAt: '2024-07-12',
        bio: 'Liani rides out of Gauteng with two horses on the trailer — Diesel in the 1D and her Appaloosa gelding Eagle bringing the experience. Chasing a Championships qualification this season.',
        sponsors: ['Dust & Diesel Outfitters', 'Highveld Tack & Feed'],
        photo: '/photos/Liani_ProfilePhoto.jpg',
        cover: '/photos/Liani_CoverPhoto.jpg',
        achievements: ['2025 Rookie of the Year', '2026 West Fest Jackpot Champion — 1D', 'Gauteng Adult Division — Season Top 5'],
        bank: { bank: 'FNB', account: '6274 1190 03', branch: '250655' },
      }),
      rider('ruan', 'Ruan Botha', 'SA1002', 'Adult', 'Western Cape', 18, 31200, 9800, 1100, 'Member', { joinedAt: '2023-07-01' }),
      rider('lindi', 'Lindi van Wyk', 'SA1008', 'Youth', 'Free State', 12, 14100, 3600, 280, 'Member', { birthday: '2008-09-12', joinedAt: '2025-08-02' }),
      rider('jaco', 'Jaco Steyn', 'SA1015', 'Senior', 'Gauteng', 14, 22100, 5100, 640, 'Member', { joinedAt: '2022-07-01' }),
      rider('thandi', 'Thandi Mokoena', 'SA1020', 'Adult', 'KwaZulu-Natal', 16, 19800, 4400, 510, 'Member', { joinedAt: '2024-09-18' }),
      rider('piet', 'Piet du Preez', 'SA1033', 'Open', 'Eastern Cape', 11, 16700, 3900, 200, 'Day member', { joinedAt: '2026-08-08' }),
      rider('mia', 'Mia Jacobs', 'SA1041', 'Junior', 'Gauteng', 8, 6200, 900, 90, 'Member', { joinedAt: '2026-07-20' }),
      rider('kyle', 'Kyle Adams', 'SA1055', 'Adult', 'Gauteng', 9, 8800, 1500, 150, 'Member · due 1 Oct', { joinedAt: '2025-07-04' }),
    ],
    horses: [
      horse('diesel', 'Diesel', 'sunny', {
        sex: 'Gelding',
        age: 8,
        breed: 'American Quarter Horse',
        lte: 9200,
        rank: 4,
        sire: 'Dash For Diesel',
        dam: 'Sunny Miss',
        colour: 'Sorrel',
        height: '15.0hh',
        registered: false,
        vaccinationProof: true,
        bio: 'Steady in the alley, strongest first-barrel turn on the card.',
        photo: null,
      }),
      horse('eagle', 'Eagle', 'sunny', {
        sex: 'Gelding',
        age: 16,
        breed: 'Appaloosa',
        lte: 2100,
        rank: 9,
        sire: "Chief's Eagle",
        dam: 'Dixie Spot',
        colour: 'Leopard Appaloosa',
        height: '14.3hh',
        registered: true,
        vaccinationProof: true,
        achievements: ['2026 Karoo Night Rodeo — 2D Reserve'],
        bio: 'Seasoned campaigner — experienced in the alley and steady even in a loud rodeo crowd.',
        photo: '/photos/Eagle_Photo.jpg',
      }),
      horse('comet', 'Comet', 'ruan', { sex: 'Mare', age: 7, lte: 15400, rank: 1 }),
      horse('pepper', 'Pepper', 'lindi', { sex: 'Mare', age: 6, lte: 7100, rank: 6 }),
      horse('smoke', 'Smoke', 'jaco', { sex: 'Gelding', age: 12, lte: 12100, rank: 3 }),
      horse('ember', 'Ember', 'thandi', { sex: 'Mare', age: 9, lte: 9800, rank: 5 }),
      horse('ranger', 'Ranger', 'piet', { sex: 'Stallion', age: 10, lte: 10200, rank: 2, futurity: true }),
      horse('buddy', 'Buddy', 'kyle', { sex: 'Gelding', age: 11, lte: 4100, rank: 8 }),
    ],
    fans: [
      {
        id: 'sarel',
        name: 'Sarel Venter',
        follows: ['sunny'],
        biggestFanOf: 'sunny',
        wallet: 200,
        debitOrder: false,
        bio: 'West Coast. Biggest fan of Liani and Diesel.',
        bank: { bank: 'Capitec', account: '1522 8841 09', branch: '470010' },
      },
    ],
    producers: [
      {
        id: 'ansie',
        name: 'Ansie Nel',
        region: 'Western Cape',
        phone: '082 441 0091',
        email: 'ansie@westfest.example',
        eventIds: ['west-fest', 'karoo-rodeo', 'highveld-mini'],
      },
    ],
    contacts: [
      { region: 'Gauteng', name: 'Nico Kruger', phone: '082 111 2001' },
      { region: 'Western Cape', name: 'Ansie Nel', phone: '082 441 0091' },
      { region: 'Eastern Cape', name: 'Hannes Botha', phone: '083 220 4410' },
      { region: 'Free State', name: 'Elmarie Venter', phone: '084 330 1188' },
      { region: 'KwaZulu-Natal', name: 'Sipho Dlamini', phone: '071 555 0199' },
    ],
    events: [
      {
        id: 'west-fest',
        name: 'West Fest Jackpot',
        type: 'Jackpot',
        region: 'Western Cape',
        venue: 'West Coast Arena, Malmesbury',
        date: '2026-09-05',
        producerId: 'ansie',
        official: false,
        status: 'live',
        runs: 2,
        resultsPostedAt: UNOFFICIAL_POSTED,
        adminFee: 150,
        featured: true,
        flyer:
          'One-day jackpot. Open to BRSA members and day members. Dress code: long sleeve, hat, collar. Welfare steward on the gate. Two runs — better time stands.',
        classes: Object.keys(CLASS_FEES),
      },
      {
        id: 'karoo-rodeo',
        name: 'Karoo Night Rodeo',
        type: 'Rodeo',
        region: 'Eastern Cape',
        venue: 'Cradock Showgrounds',
        date: '2026-08-08',
        producerId: 'ansie',
        official: true,
        status: 'official',
        runs: 1,
        resultsPostedAt: '2026-08-08T20:00:00+02:00',
        officialAt: '2026-08-15T09:00:00+02:00',
        adminFee: 150,
        flyer: 'Night rodeo under lights. Official — points already on the board.',
        classes: Object.keys(CLASS_FEES),
      },
      {
        id: 'highveld-mini',
        name: 'Highveld Mini-Qualifier',
        type: 'Mini-Qualifier',
        region: 'Gauteng',
        venue: 'Kyalami Pony Club',
        date: '2026-10-17',
        producerId: 'ansie',
        official: false,
        status: 'upcoming',
        runs: 1,
        resultsPostedAt: null,
        adminFee: 150,
        flyer: 'Entries open 1 October. Dress code: long sleeve, hat, collar. Welfare steward on the gate.',
        classes: Object.keys(CLASS_FEES),
      },
    ],
    entries: [...westFestField(), ...karooField()],
    results: [...westFestResults(), ...karooResults()],
    timeQueries: [],
    transactions: [
      tx('tx-mem-sunny', 'sunny', 'rider', 'debit', 600, 'Adult membership 2026/27', '2026-07-02T09:00:00+02:00'),
      tx('tx-karoo-sunny', 'sunny', 'rider', 'debit', 350, 'Karoo Night Rodeo — Adult', '2026-08-01T12:00:00+02:00'),
      tx('tx-karoo-payout', 'sunny', 'rider', 'credit', 280, 'Karoo Night Rodeo — 3rd Adult', '2026-08-15T09:10:00+02:00'),
      tx('tx-boost-1', 'sunny', 'rider', 'credit', 50, 'Boost from Sarel Venter', '2026-08-20T14:22:00+02:00'),
      tx('tx-boost-fan', 'sarel', 'fan', 'debit', 50, 'Boost Liani van der Walt', '2026-08-20T14:22:00+02:00'),
    ],
    payouts: {
      'karoo-rodeo': {
        eventId: 'karoo-rodeo',
        producing: 750,
        prizePool: 1400,
        brsaAdmin: 600,
        payoutPool: 2150,
        gross: 2150 + 750,
        groundLevy: 750,
        riderShares: [
          { riderId: 'ruan', amount: 700 },
          { riderId: 'thandi', amount: 420 },
          { riderId: 'sunny', amount: 280 },
        ],
      },
    },
    invoices: [
      {
        id: 'inv-fine-sunny',
        riderId: 'sunny',
        type: 'fine',
        fineType: 'late-admin',
        label: 'Late admin fee — Karoo Night Rodeo',
        amount: 250,
        paid: false,
        createdAt: '2026-08-16T10:00:00+02:00',
      },
      {
        id: 'inv-mem-sunny',
        riderId: 'sunny',
        type: 'membership',
        label: 'Adult membership 2026/27',
        amount: 600,
        paid: true,
        paidAt: '2026-07-02T09:00:00+02:00',
        createdAt: '2026-07-01T08:00:00+02:00',
      },
      {
        id: 'inv-mem-kyle',
        riderId: 'kyle',
        type: 'membership',
        label: 'Adult membership 2026/27',
        amount: 600,
        paid: false,
        createdAt: '2026-07-01T08:00:00+02:00',
      },
      {
        id: 'inv-karoo-sunny',
        riderId: 'sunny',
        type: 'entry',
        label: 'Karoo Night Rodeo — Adult',
        amount: 350,
        paid: true,
        paidAt: '2026-08-01T12:00:00+02:00',
        createdAt: '2026-08-01T12:00:00+02:00',
        entryId: 'ent-karoo-sunny',
        eventId: 'karoo-rodeo',
      },
    ],
    feed: [
      {
        id: 'feed-boost-1',
        type: 'boost',
        at: '2026-08-20T14:22:00+02:00',
        fromFanId: 'sarel',
        riderId: 'sunny',
        amount: 50,
        text: 'Sarel Venter boosted Liani van der Walt — R50',
      },
      {
        id: 'feed-official-karoo',
        type: 'system',
        at: '2026-08-15T09:00:00+02:00',
        text: 'Karoo Night Rodeo results are official. Points are on the board.',
      },
      {
        id: 'feed-award-1',
        type: 'award',
        category: 'Best Run',
        at: '2026-08-31T08:00:00+02:00',
        riderId: 'ruan',
        text: 'August Best Run — Ruan Botha and Comet, 16.440 at Karoo.',
      },
      {
        id: 'feed-award-2',
        type: 'award',
        category: 'Cowboy/Cowgirl of the Month',
        at: '2026-08-31T08:05:00+02:00',
        riderId: 'thandi',
        text: 'August Cowboy/Cowgirl of the Month — Thandi Mokoena.',
      },
      {
        id: 'feed-rule',
        type: 'rule',
        at: '2026-07-15T09:00:00+02:00',
        text: 'Rule update: producing cost (R150) comes off first; BRSA then keeps 30% of the remainder and pays out 70%.',
      },
      {
        id: 'feed-hof',
        type: 'system',
        at: '2026-07-01T08:00:00+02:00',
        text: '2025/26 Hall of Fame inductees are up. Have a look.',
      },
    ],
    community: [
      {
        id: 'com-1',
        riderId: 'lindi',
        at: '2026-08-22T18:10:00+02:00',
        kind: 'photo',
        text: 'Pepper after the Karoo. Still buzzing.',
        likes: ['sunny', 'ruan'],
        comments: [{ id: 'c1', riderId: 'sunny', text: 'What a mare.', at: '2026-08-22T18:40:00+02:00' }],
      },
      {
        id: 'com-2',
        riderId: 'ruan',
        at: '2026-08-16T11:40:00+02:00',
        kind: 'result',
        resultId: 'res-karoo-ruan',
        text: 'Comet and I will take that Karoo 1D. See you at West Fest.',
        likes: ['sarel'],
        comments: [],
      },
    ],
    hallOfFame: [
      { id: 'hof-1', year: '2025/26', category: 'championship', title: 'Top Rider', name: 'Ruan Botha', horse: 'Comet', achievement: 'Season points champion' },
      { id: 'hof-2', year: '2025/26', category: 'brsa-record', title: 'BRSA Record', name: 'Ruan Botha', horse: 'Comet', achievement: '16.210 Open — Highveld Finals' },
      { id: 'hof-3', year: '2024/25', category: 'sa-record', title: 'South African Record', name: 'Annelie Vos', horse: 'Cinnamon', achievement: '15.980 Youth — SA Champs' },
      { id: 'hof-4', year: '2024/25', category: 'special', title: 'Biggest Fan', name: 'Sarel Venter', achievement: 'Most boosts in a season' },
      { id: 'hof-5', year: '2025/26', category: 'producer-year', title: 'Producer of the Year', name: 'Ansie Nel', achievement: 'Western Cape — 2025/26' },
    ],
    hofCategories: HOF_CATEGORIES,
    priorYearStandings: {
      '2025/26': [
        { rank: 1, name: 'Ruan Botha', class: 'Adult', points: 86, province: 'Western Cape' },
        { rank: 2, name: 'Annelie Vos', class: 'Adult', points: 81, province: 'Gauteng' },
        { rank: 3, name: 'Liani van der Walt', class: 'Adult', points: 74, province: 'Gauteng' },
      ],
      '2024/25': [
        { rank: 1, name: 'Annelie Vos', class: 'Adult', points: 90, province: 'Gauteng' },
        { rank: 2, name: 'Ruan Botha', class: 'Adult', points: 77, province: 'Western Cape' },
        { rank: 3, name: 'Jaco Steyn', class: 'Senior', points: 61, province: 'Gauteng' },
      ],
    },
    complaints: [
      {
        id: 'cmp-1',
        fromId: 'sunny',
        fromRole: 'rider',
        reason: 'Draw / running order',
        message: 'West Fest heat 2 started before Diesel was at the gate. Asking the office to look at the clock.',
        status: 'open',
        at: '2026-09-05T18:10:00+02:00',
        replies: [],
      },
      {
        id: 'cmp-2',
        fromId: 'sarel',
        fromRole: 'fan',
        reason: 'Membership / app',
        message: 'Boost receipt did not show on Liani’s public profile the same evening.',
        status: 'resolved',
        at: '2026-08-21T09:00:00+02:00',
        replies: [{ at: '2026-08-21T11:20:00+02:00', from: 'producer', text: 'Feed item was delayed; it is up now.' }],
        resolvedAt: '2026-08-21T11:20:00+02:00',
      },
    ],
    follows: { sarel: ['sunny'], ruan: ['sunny'] },
    toasts: [],
  }
}

function rider(id, name, sa, klass, province, points, lte, earnings, wallet, membershipNote = 'Member', extra = {}) {
  return {
    id,
    name,
    sa,
    class: klass,
    province,
    points,
    lte,
    earnings,
    wallet,
    membershipNote,
    debitOrder: extra.debitOrder ?? false,
    birthday: extra.birthday ?? null,
    joinedAt: extra.joinedAt ?? '2024-07-01',
    bio: extra.bio ?? `${name.split(' ')[0]} rides out of ${province}. Season ${klass}.`,
    sponsors: extra.sponsors ?? (id === 'sunny' ? ['Dust & Diesel Outfitters'] : []),
    photo: extra.photo ?? name.slice(0, 1),
    cover: extra.cover ?? 'dust',
    bank: extra.bank ?? { bank: '', account: '', branch: '' },
    achievements: extra.achievements ?? [],
  }
}

function horse(id, name, riderId, extra = {}) {
  return {
    id,
    name,
    riderId,
    sex: extra.sex ?? 'Gelding',
    age: extra.age ?? 8,
    lte: extra.lte ?? 0,
    rank: extra.rank ?? null,
    futurity: extra.futurity ?? false,
    points: extra.points ?? 0,
    sire: extra.sire ?? '—',
    dam: extra.dam ?? '—',
    colour: extra.colour ?? 'Bay',
    height: extra.height ?? '15.0hh',
    breed: extra.breed ?? '',
    registered: extra.registered ?? false,
    vaccinationProof: extra.vaccinationProof ?? false,
    birthdateProof: extra.birthdateProof ?? false,
    bio: extra.bio ?? '',
    photo: extra.photo ?? null,
    achievements: extra.achievements ?? [],
  }
}

function tx(id, ownerId, ownerType, dir, amount, label, at) {
  return { id, ownerId, ownerType, dir, amount, label, at }
}

function westFestField() {
  return [
    entry('ent-wf-ruan', 'west-fest', 'ruan', 'comet', 'Adult', false, true, CLASS_FEES.Adult, 1),
    entry('ent-wf-lindi', 'west-fest', 'lindi', 'pepper', 'Youth', false, true, CLASS_FEES.Youth, 2),
    entry('ent-wf-thandi', 'west-fest', 'thandi', 'ember', 'Adult', false, true, CLASS_FEES.Adult, 3),
    entry('ent-wf-jaco', 'west-fest', 'jaco', 'smoke', 'Senior', false, true, CLASS_FEES.Senior, 4),
    entry('ent-wf-kyle', 'west-fest', 'kyle', 'buddy', 'Adult', false, true, CLASS_FEES.Adult, 5),
  ]
}

function westFestResults() {
  return [
    result('res-wf-ruan', 'ent-wf-ruan', 'west-fest', 'ruan', 'comet', 'Adult', '1D', 2, 16.91, 16.91, 17.02),
    result('res-wf-thandi', 'ent-wf-thandi', 'west-fest', 'thandi', 'ember', 'Adult', '1D', 3, 17.22, 17.22, null),
    result('res-wf-kyle', 'ent-wf-kyle', 'west-fest', 'kyle', 'buddy', 'Adult', '2D', 1, 17.88, 17.88, 18.01),
    result('res-wf-lindi', 'ent-wf-lindi', 'west-fest', 'lindi', 'pepper', 'Youth', '1D', 1, 17.05, 17.05, 17.4),
    result('res-wf-jaco', 'ent-wf-jaco', 'west-fest', 'jaco', 'smoke', 'Senior', '2D', 2, 18.11, 18.11, null),
  ]
}

function karooField() {
  return [
    entry('ent-karoo-ruan', 'karoo-rodeo', 'ruan', 'comet', 'Adult', false, true, CLASS_FEES.Adult, 1),
    entry('ent-karoo-thandi', 'karoo-rodeo', 'thandi', 'ember', 'Adult', false, true, CLASS_FEES.Adult, 2),
    entry('ent-karoo-sunny', 'karoo-rodeo', 'sunny', 'diesel', 'Adult', false, true, CLASS_FEES.Adult, 3),
    entry('ent-karoo-lindi', 'karoo-rodeo', 'lindi', 'pepper', 'Youth', false, true, CLASS_FEES.Youth, 4),
    entry('ent-karoo-piet', 'karoo-rodeo', 'piet', 'ranger', 'Open', false, true, CLASS_FEES.Open, 5),
  ]
}

function karooResults() {
  return [
    result('res-karoo-ruan', 'ent-karoo-ruan', 'karoo-rodeo', 'ruan', 'comet', 'Adult', '1D', 1, 16.44, 16.44),
    result('res-karoo-thandi', 'ent-karoo-thandi', 'karoo-rodeo', 'thandi', 'ember', 'Adult', '1D', 2, 16.9, 16.9),
    result('res-karoo-sunny', 'ent-karoo-sunny', 'karoo-rodeo', 'sunny', 'diesel', 'Adult', '1D', 3, 17.18, 17.18),
    result('res-karoo-lindi', 'ent-karoo-lindi', 'karoo-rodeo', 'lindi', 'pepper', 'Youth', '1D', 1, 17.4, 17.4),
    result('res-karoo-piet', 'ent-karoo-piet', 'karoo-rodeo', 'piet', 'ranger', 'Open', '1D', 2, 16.7, 16.7),
  ]
}

function entry(id, eventId, riderId, horseId, klass, carryOver, paid, fee, drawNo = null) {
  return { id, eventId, riderId, horseId, class: klass, carryOver, paid, fee, drawNo }
}

function result(id, entryId, eventId, riderId, horseId, klass, division, place, time, run1 = time, run2 = null) {
  return { id, entryId, eventId, riderId, horseId, class: klass, division, place, time, run1, run2, carryOver: false, scratch: false }
}
