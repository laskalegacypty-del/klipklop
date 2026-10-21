/**
 * KlipKlop seat-tier pricing: the only place prices live.
 * Edit the numbers here; components and the API read from this file.
 * All amounts are in South African Rand.
 *
 * Source: KlipKlop_Seat_Tier_Pricing.xlsx
 */

export const ROLES = [
  { key: 'rider',     label: 'Riders',     singular: 'Rider' },
  { key: 'supporter', label: 'Supporters', singular: 'Supporter' },
  { key: 'producer',  label: 'Producers',  singular: 'Producer' },
  { key: 'admin',     label: 'Admins',     singular: 'Admin' },
]

/** List price of one seat, per role, per month. */
export const SEAT_PRICES = {
  rider: 10,
  supporter: 2,
  producer: 50,
  admin: 100,
}

/** Annual prepay: fee = monthly fee x (12 - this). */
export const MONTHS_FREE_ANNUAL = 2

/** Monthly tier fees are rounded to the nearest multiple of this. */
export const FEE_ROUNDING = 10

/** Discount applies to the full-price seat value. Seats are included per role. */
export const TIERS = [
  { name: 'Micro',    discount: 0,    seats: { rider: 20,  supporter: 10,  producer: 1, admin: 1 },  blurb: 'Base rate for small associations.' },
  { name: 'Starter',  discount: 0.25, seats: { rider: 40,  supporter: 20,  producer: 2, admin: 2 },  blurb: 'For growing associations.' },
  { name: 'Standard', discount: 0.30, seats: { rider: 80,  supporter: 40,  producer: 4, admin: 4 },  blurb: 'Our most common fit.' },
  { name: 'Growth',   discount: 0.35, seats: { rider: 160, supporter: 80,  producer: 8, admin: 8 },  blurb: 'Established, multi-region associations.' },
  { name: 'Large',    discount: 0.40, seats: { rider: 320, supporter: 160, producer: 9, admin: 16 }, blurb: 'National bodies. Producers stop at 9, one per province.' },
]

export const CUSTOM_TIER = {
  name: 'Custom',
  blurb: 'Quoted individually for associations above the Large tier.',
}

/**
 * Size gauge: the top of each band (smallest to largest) per role. A count at or
 * below bands[i] lights i+1 of the five segments.
 */
export const SIZE_BANDS = {
  rider:     [15, 50, 120, 250, Infinity],
  supporter: [20, 50, 100, 200, Infinity],
  producer:  [1, 3, 5, 8, Infinity],
  admin:     [1, 3, 6, 10, Infinity],
}

/** Labels for the five-segment size gauge, smallest to largest. */
export const SIZE_LABELS = ['Tiny', 'Small', 'Medium', 'Large', 'Very large']

/** Input limits shared by the page and the server-side validation. */
export const LIMITS = {
  maxSeatCount: 100000,
  maxPricePerSeat: 5000,
  maxNoteLength: 2000,
  maxFieldLength: 200,
}

export const SALES_EMAIL = 'sales@klipklop.co.za'

/** Plain-language explanation shown on the first page and in the PDF. */
export const HOW_IT_WORKS = [
  { title: 'One seat per member', text: 'Each member registered with your association takes one seat, in their role: rider, supporter, producer or admin.' },
  { title: 'Your tier bundles seats at a discount', text: 'You pay one monthly tier fee that includes a set number of seats for each role. Bigger tiers include more seats and a bigger discount.' },
  { title: 'Extra seats are added automatically', text: 'If you go above the seats in your tier for a role, the extra seats are billed monthly at the per-seat price, pro rata from the date each member registers.' },
  { title: 'Prepay and get months free', text: `Pay your tier fee annually in advance and get ${MONTHS_FREE_ANNUAL} months free. Extra seats stay on monthly billing.` },
  { title: 'Tiers change once a year', text: 'You can move to a different tier on the anniversary of your Effective Date.' },
]
