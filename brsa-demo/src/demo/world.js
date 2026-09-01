import { CLASS_FEES } from './money'

const UNOFFICIAL_POSTED = '2026-08-30T16:00:00+02:00'

export function createSeed() {
  return {
    version: 1,
    season: '2026/27',
    membershipIncludesApp: true,
    sponsor: {
      name: 'Rietvlei Feeds',
      tag: 'Official feed partner',
      mark: 'RF',
    },
    currentUserId: 'admin',
    users: [
      { id: 'admin', username: 'admin', password: 'demo', role: 'admin', name: 'BRSA Admin' },
      { id: 'rider', username: 'rider', password: 'demo', role: 'rider', name: 'Sunny Kruger', riderId: 'sunny' },
      { id: 'fan', username: 'fan', password: 'demo', role: 'fan', name: 'Sarel Venter', fanId: 'sarel' },
      { id: 'producer', username: 'producer', password: 'demo', role: 'producer', name: 'Ansie Nel', producerId: 'ansie' },
    ],
    riders: [
      rider('sunny', 'Sunny Kruger', 'SA1001', 'Adult', 'Gauteng', 16, 18400, 4200, 420, 'Member · due 15 Sep'),
      rider('ruan', 'Ruan Botha', 'SA1002', 'Adult', 'Western Cape', 18, 31200, 9800, 1100),
      rider('lindi', 'Lindi van Wyk', 'SA1008', 'Youth', 'Free State', 12, 14100, 3600, 280),
      rider('jaco', 'Jaco Steyn', 'SA1015', 'Senior', 'Gauteng', 14, 22100, 5100, 640),
      rider('thandi', 'Thandi Mokoena', 'SA1020', 'Adult', 'KwaZulu-Natal', 16, 19800, 4400, 510),
      rider('piet', 'Piet du Preez', 'SA1033', 'Open', 'Eastern Cape', 11, 16700, 3900, 200),
      rider('mia', 'Mia Jacobs', 'SA1041', 'Junior', 'Gauteng', 8, 6200, 900, 90),
      rider('kyle', 'Kyle Adams', 'SA1055', 'Adult', 'Gauteng', 9, 8800, 1500, 150),
    ],
    horses: [
      { id: 'diesel', name: 'Diesel', riderId: 'sunny', sex: 'Gelding', age: 8, lte: 9200, rank: 4, futurity: false },
      { id: 'comet', name: 'Comet', riderId: 'ruan', sex: 'Mare', age: 7, lte: 15400, rank: 1, futurity: false },
      { id: 'pepper', name: 'Pepper', riderId: 'lindi', sex: 'Mare', age: 6, lte: 7100, rank: 6, futurity: false },
      { id: 'smoke', name: 'Smoke', riderId: 'jaco', sex: 'Gelding', age: 12, lte: 12100, rank: 3, futurity: false },
      { id: 'ember', name: 'Ember', riderId: 'thandi', sex: 'Mare', age: 9, lte: 9800, rank: 5, futurity: false },
      { id: 'ranger', name: 'Ranger', riderId: 'piet', sex: 'Stallion', age: 10, lte: 10200, rank: 2, futurity: true },
      { id: 'buddy', name: 'Buddy', riderId: 'kyle', sex: 'Gelding', age: 11, lte: 4100, rank: 8, futurity: false },
    ],
    fans: [
      {
        id: 'sarel',
        name: 'Sarel Venter',
        follows: ['sunny'],
        biggestFanOf: 'sunny',
        wallet: 200,
      },
    ],
    producers: [
      {
        id: 'ansie',
        name: 'Ansie Nel',
        region: 'Western Cape',
        phone: '082 441 0091',
        email: 'ansie@westfest.example',
        eventIds: ['west-fest'],
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
        resultsPostedAt: UNOFFICIAL_POSTED,
        adminFee: 150,
        flyer:
          'One-day jackpot. Open to BRSA members and day members. Dress code: long sleeve, hat, collar. Welfare steward on the gate.',
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
        resultsPostedAt: null,
        adminFee: 150,
        flyer: 'Entries open next month. Placeholder flyer for the pitch.',
        classes: Object.keys(CLASS_FEES),
      },
    ],
    entries: [
      ...westFestField(),
      ...karooField(),
    ],
    results: [
      ...westFestResults(),
      ...karooResults(),
    ],
    payouts: {
      'karoo-rodeo': {
        eventId: 'karoo-rodeo',
        producing: 750,
        prizePool: 1400,
        brsaAdmin: 600,
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
        text: 'Sarel boosted Sunny Kruger — R50',
      },
      {
        id: 'feed-official-karoo',
        type: 'system',
        at: '2026-08-15T09:00:00+02:00',
        text: 'Karoo Night Rodeo results are official. Points are on the board.',
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
      },
      {
        id: 'com-2',
        riderId: 'ruan',
        at: '2026-08-16T11:40:00+02:00',
        kind: 'result',
        text: 'Comet and I will take that Karoo 1D. See you at West Fest.',
      },
    ],
    hallOfFame: [
      { id: 'hof-1', year: '2025/26', title: 'Top Rider', name: 'Ruan Botha', horse: 'Comet' },
      { id: 'hof-2', year: '2025/26', title: 'Horse of the Year', name: 'Comet', rider: 'Ruan Botha' },
      { id: 'hof-3', year: '2024/25', title: 'Top Rider', name: 'Annelie Vos', horse: 'Cinnamon' },
      { id: 'hof-4', year: '2024/25', title: 'Biggest Fan', name: 'Sarel Venter' },
    ],
    priorYearStandings: [
      { rank: 1, name: 'Ruan Botha', points: 86, province: 'Western Cape' },
      { rank: 2, name: 'Annelie Vos', points: 81, province: 'Gauteng' },
      { rank: 3, name: 'Sunny Kruger', points: 74, province: 'Gauteng' },
    ],
    toasts: [],
  }
}

function rider(id, name, sa, klass, province, points, lte, earnings, wallet, membershipNote = 'Member') {
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
    bio: `${name.split(' ')[0]} rides out of ${province}. Season ${klass}.`,
    sponsors: id === 'sunny' ? ['Dust & Diesel Outfitters'] : [],
  }
}

function westFestField() {
  return [
    entry('ent-wf-ruan', 'west-fest', 'ruan', 'comet', 'Adult', false, true, CLASS_FEES.Adult),
    entry('ent-wf-lindi', 'west-fest', 'lindi', 'pepper', 'Youth', false, true, CLASS_FEES.Youth),
    entry('ent-wf-thandi', 'west-fest', 'thandi', 'ember', 'Adult', false, true, CLASS_FEES.Adult),
    entry('ent-wf-jaco', 'west-fest', 'jaco', 'smoke', 'Senior', false, true, CLASS_FEES.Senior),
    entry('ent-wf-kyle', 'west-fest', 'kyle', 'buddy', 'Adult', false, true, CLASS_FEES.Adult),
  ]
}

function westFestResults() {
  return [
    result('res-wf-ruan', 'ent-wf-ruan', 'west-fest', 'ruan', 'comet', 'Adult', '1D', 2, 16.91),
    result('res-wf-thandi', 'ent-wf-thandi', 'west-fest', 'thandi', 'ember', 'Adult', '1D', 3, 17.22),
    result('res-wf-kyle', 'ent-wf-kyle', 'west-fest', 'kyle', 'buddy', 'Adult', '2D', 1, 17.88),
    result('res-wf-lindi', 'ent-wf-lindi', 'west-fest', 'lindi', 'pepper', 'Youth', '1D', 1, 17.05),
    result('res-wf-jaco', 'ent-wf-jaco', 'west-fest', 'jaco', 'smoke', 'Senior', '2D', 2, 18.11),
  ]
}

function karooField() {
  return [
    entry('ent-karoo-ruan', 'karoo-rodeo', 'ruan', 'comet', 'Adult', false, true, CLASS_FEES.Adult),
    entry('ent-karoo-thandi', 'karoo-rodeo', 'thandi', 'ember', 'Adult', false, true, CLASS_FEES.Adult),
    entry('ent-karoo-sunny', 'karoo-rodeo', 'sunny', 'diesel', 'Adult', false, true, CLASS_FEES.Adult),
    entry('ent-karoo-lindi', 'karoo-rodeo', 'lindi', 'pepper', 'Youth', false, true, CLASS_FEES.Youth),
    entry('ent-karoo-piet', 'karoo-rodeo', 'piet', 'ranger', 'Open', false, true, CLASS_FEES.Open),
  ]
}

function karooResults() {
  return [
    result('res-karoo-ruan', 'ent-karoo-ruan', 'karoo-rodeo', 'ruan', 'comet', 'Adult', '1D', 1, 16.44),
    result('res-karoo-thandi', 'ent-karoo-thandi', 'karoo-rodeo', 'thandi', 'ember', 'Adult', '1D', 2, 16.9),
    result('res-karoo-sunny', 'ent-karoo-sunny', 'karoo-rodeo', 'sunny', 'diesel', 'Adult', '1D', 3, 17.18),
    result('res-karoo-lindi', 'ent-karoo-lindi', 'karoo-rodeo', 'lindi', 'pepper', 'Youth', '1D', 1, 17.4),
    result('res-karoo-piet', 'ent-karoo-piet', 'karoo-rodeo', 'piet', 'ranger', 'Open', '1D', 2, 16.7),
  ]
}

function entry(id, eventId, riderId, horseId, klass, carryOver, paid, fee) {
  return { id, eventId, riderId, horseId, class: klass, carryOver, paid, fee }
}

function result(id, entryId, eventId, riderId, horseId, klass, division, place, time) {
  return { id, entryId, eventId, riderId, horseId, class: klass, division, place, time, carryOver: false }
}
