import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare, Square, ArrowRight, HeartPulse, Clock, Calendar,
  BarChart2, Trophy, MessageCircle, Table2, ClipboardList,
  Lightbulb, Star, Zap, Shield, Info,
} from 'lucide-react'
import { PageHeader } from '../../components/ui'

const CHECKLIST_KEY = 'klipklop_getting_started_checklist'

const CHECKLIST_ITEMS = [
  { id: 'horse', label: 'Add your horse on the Horses page' },
  { id: 'combo', label: 'Set your current level on your Profile' },
  { id: 'times', label: 'Enter your first qualifier results in My Times' },
  { id: 'season', label: 'Explore your Season Overview' },
]

function loadChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}')
  } catch {
    return {}
  }
}

function StepBadge({ number, color = 'green' }) {
  const colors = {
    green:  'bg-green-600 text-white',
    blue:   'bg-blue-600 text-white',
    purple: 'bg-purple-600 text-white',
    orange: 'bg-orange-500 text-white',
    teal:   'bg-teal-600 text-white',
  }
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${colors[color]}`}>
      {number}
    </span>
  )
}

function SectionHeader({ icon: Icon, title, subtitle, color = 'green' }) {
  const colors = {
    green:  'from-green-700 to-green-600',
    blue:   'from-blue-700 to-blue-600',
    purple: 'from-purple-700 to-purple-600',
    orange: 'from-orange-600 to-orange-500',
    teal:   'from-teal-700 to-teal-600',
  }
  return (
    <div className={`bg-gradient-to-r ${colors[color]} rounded-2xl px-6 py-5 mb-4`}>
      <div className="flex items-center gap-3">
        <div className="bg-white/20 rounded-xl p-2.5">
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">{subtitle}</p>
          <h2 className="text-white text-xl font-bold">{title}</h2>
        </div>
      </div>
    </div>
  )
}

function StepCard({ number, title, where, path, pathLabel, body, tip, color = 'green', stepColor = 'green' }) {
  const borderColors = {
    green:  'border-l-green-500',
    blue:   'border-l-blue-500',
    purple: 'border-l-purple-500',
    orange: 'border-l-orange-500',
    teal:   'border-l-teal-500',
  }
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColors[color]} p-5 shadow-sm`}>
      <div className="flex items-start gap-4">
        <StepBadge number={number} color={stepColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-gray-900 text-base">{title}</h3>
            {path && (
              <Link
                to={path}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full hover:bg-green-100 transition"
              >
                {pathLabel || 'Go there'}
                <ArrowRight size={11} />
              </Link>
            )}
          </div>
          {where && (
            <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
              Where: {where}
            </p>
          )}
          <div className="text-sm text-gray-600 space-y-1">{body}</div>
          {tip && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoBox({ children, icon: Icon = Info, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  const iconColors = { blue: 'text-blue-500', green: 'text-green-600', amber: 'text-amber-500' }
  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${colors[color]}`}>
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconColors[color]}`} />
      <p className="text-sm">{children}</p>
    </div>
  )
}

export default function GettingStarted() {
  const [checked, setChecked] = useState(loadChecklist)

  function toggle(id) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const doneCount = CHECKLIST_ITEMS.filter(i => checked[i.id]).length

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-10">

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-800 via-green-700 to-green-600 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 mb-4">
              <Zap size={13} className="text-yellow-300" />
              <span className="text-xs font-semibold text-white/90">Getting Started Guide</span>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight mb-2">Welcome to KlipKlop</h1>
            <p className="text-green-100 text-base leading-relaxed max-w-lg">
              Your all-in-one tracker for South African Western Mounted Games. Follow this guide to set up your profile and get the most out of every feature.
            </p>
          </div>
          <div className="hidden sm:block text-6xl opacity-20 select-none">🐎</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { icon: HeartPulse,    label: 'Horse Health' },
            { icon: Clock,         label: 'Time Tracking' },
            { icon: Trophy,        label: 'Level Prediction' },
            { icon: MessageCircle, label: 'AI Assistant' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
              <Icon size={13} className="text-green-200" />
              <span className="text-xs font-medium text-white/90">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start Checklist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Quick Start Checklist</h2>
          <span className="text-sm text-gray-500 font-medium">{doneCount}/{CHECKLIST_ITEMS.length} done</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / CHECKLIST_ITEMS.length) * 100}%` }}
            />
          </div>
          <div className="divide-y divide-gray-100">
            {CHECKLIST_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left"
              >
                {checked[item.id]
                  ? <CheckSquare size={20} className="text-green-600 flex-shrink-0" />
                  : <Square size={20} className="text-gray-300 flex-shrink-0" />}
                <span className={`text-sm font-medium ${checked[item.id] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {item.label}
                </span>
                {checked[item.id] && (
                  <span className="ml-auto text-xs text-green-600 font-semibold">Done</span>
                )}
              </button>
            ))}
          </div>
          {doneCount === CHECKLIST_ITEMS.length && (
            <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2">
              <Star size={15} className="text-green-600" />
              <p className="text-sm font-semibold text-green-700">You're all set! Enjoy KlipKlop.</p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Setup */}
      <div className="space-y-4">
        <SectionHeader icon={HeartPulse} title="Setting Up Your Profile" subtitle="Step 1 — Do this first" color="green" />

        <StepCard
          number={1} color="green" stepColor="green"
          title="Add Your Horse"
          where="Horses page" path="/horses" pathLabel="Horses"
          body={
            <ul className="space-y-1">
              <li>• Tap <strong>Add Horse</strong> and fill in your horse's name, breed, colour, and birth year.</li>
              <li>• Add the microchip or passport number — required for Nationals entry.</li>
              <li>• Upload a photo so you can easily identify each horse.</li>
            </ul>
          }
          tip="If you have multiple horses, add them all — each one is tracked separately."
        />

        <StepCard
          number={2} color="green" stepColor="green"
          title="Create Your Horse-Rider Combo & Set Your Level"
          where="Profile page → Horses & Combos" path="/profile" pathLabel="Profile"
          body={
            <ul className="space-y-1">
              <li>• A <strong>combo</strong> is the pairing of you and a specific horse.</li>
              <li>• Go to Profile → scroll to <strong>Horses & Combos</strong> → tap <strong>Add Combo</strong>.</li>
              <li>• Select your horse and set your <strong>current competition level</strong> (L0 = newcomer, L4 = elite).</li>
              <li>• Your level is the starting point for all predictions — set it correctly!</li>
            </ul>
          }
          tip="Not sure of your level? Start at L0. KlipKlop predicts your Nationals level from your actual qualifier results."
        />

        <InfoBox icon={Info} color="blue">
          Your <strong>combo level</strong> is your registered starting level for the season. KlipKlop then applies the official SAWMGA overcount rule — chaining through each qualifier you attend — to predict your Nationals competition level.
        </InfoBox>
      </div>

      {/* SECTION 2: Entering Times */}
      <div className="space-y-4">
        <SectionHeader icon={Clock} title="Entering Your Times" subtitle="Step 2 — After each qualifier" color="blue" />

        <StepCard
          number={3} color="blue" stepColor="blue"
          title="Enter Your Qualifier Results"
          where="My Times page" path="/my-times" pathLabel="My Times"
          body={
            <ul className="space-y-1">
              <li>• After riding a qualifier, go to <strong>My Times</strong> → tap <strong>Add Times</strong>.</li>
              <li>• Select the qualifier event and your horse-rider combo.</li>
              <li>• Enter your time (in seconds) for each game you rode.</li>
              <li>• Tick <strong>NT</strong> (No Time) if you were disqualified or didn't finish.</li>
              <li>• KlipKlop instantly shows your level for each game based on the SAWMGA matrix.</li>
            </ul>
          }
          tip="Times are stored to 3 decimal places (e.g. 18.432s). Enter exactly as shown on the scoresheet."
        />

        <StepCard
          number={4} color="blue" stepColor="blue"
          title="View Your Personal Bests"
          where="My Times → Personal Bests tab" path="/my-times" pathLabel="My Times"
          body={
            <ul className="space-y-1">
              <li>• The <strong>Personal Bests</strong> tab shows your best time ever for each of the 13 games.</li>
              <li>• Each game shows its current level badge (L0–L4).</li>
              <li>• The <strong>To Next</strong> column shows exactly how many seconds to cut to reach the next level.</li>
              <li>• Use the <strong>Qualifier Grid</strong> tab to see all results side-by-side across events.</li>
              <li>• Use the <strong>Trends</strong> tab to see your improvement over time per game.</li>
            </ul>
          }
          tip="Star icons mark your personal bests in the history view."
        />
      </div>

      {/* SECTION 3: Competition Planning */}
      <div className="space-y-4">
        <SectionHeader icon={Calendar} title="Planning Your Season" subtitle="Step 3 — Know what's coming" color="purple" />

        <StepCard
          number={5} color="purple" stepColor="purple"
          title="See Upcoming Qualifiers"
          where="Qualifiers page" path="/qualifiers" pathLabel="Qualifiers"
          body={
            <ul className="space-y-1">
              <li>• See all upcoming qualifier events with dates, venues, and provinces.</li>
              <li>• Each qualifier runs <strong>5 of the 13 games</strong> — the specific games are fixed per qualifier number.</li>
              <li>• Events in your province are highlighted.</li>
              <li>• For Nationals eligibility you need <strong>2+ qualifiers total</strong> and <strong>2+ in your province</strong>.</li>
            </ul>
          }
          tip="Q1 and Q7 run the same 5 games, Q2 and Q8 the same, and so on — two chances per game set."
        />

        <StepCard
          number={6} color="purple" stepColor="purple"
          title="Use the Level Matrix"
          where="Matrix page" path="/matrix" pathLabel="Matrix"
          body={
            <ul className="space-y-1">
              <li>• Shows the official SAWMGA time thresholds for all 13 games across levels L0–L4.</li>
              <li>• Filter by game or level to focus on what matters to you.</li>
              <li>• Use it for goal-setting before a qualifier — know your target time.</li>
            </ul>
          }
        />
      </div>

      {/* SECTION 4: Season Insights */}
      <div className="space-y-4">
        <SectionHeader icon={BarChart2} title="Tracking Your Season" subtitle="Step 4 — Know where you stand" color="teal" />

        <StepCard
          number={7} color="teal" stepColor="teal"
          title="Season Overview — Your Predicted Nationals Level"
          where="Season Overview page" path="/season" pathLabel="Season Overview"
          body={
            <ul className="space-y-1">
              <li>• KlipKlop predicts the level you'll compete at Nationals using the <strong>official SAWMGA overcount rule</strong>.</li>
              <li>• It chains through every qualifier you've attended this season in date order.</li>
              <li>• Shows your Nationals eligibility status — games covered, qualifiers attended, provincial requirements.</li>
              <li>• The <strong>Solidify Your Level</strong> section shows which games are still below your predicted level and at which upcoming qualifiers you can ride them.</li>
            </ul>
          }
          tip="A strong qualifier where you ride several games above your level adds bonus overcounts — your level can jump faster than you think."
        />

        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-teal-600" />
            <span className="text-sm font-bold text-teal-800">How the SAWMGA Overcount Rule Works</span>
          </div>
          <div className="text-sm text-teal-700 space-y-1">
            <p>Per qualifier you attend, KlipKlop calculates:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Per-game OC = max(0, level achieved − level entered) for each game</li>
              <li>Bonus OC = number of games where your OC was 3 or more</li>
              <li>Effective OC = total game OC + bonus OC</li>
              <li>Level jump = floor(effective OC ÷ 4)</li>
              <li>New level = min(4, entered level + jump)</li>
            </ol>
            <p className="mt-1">This new level becomes your entering level for the next qualifier.</p>
          </div>
        </div>

        <StepCard
          number={8} color="teal" stepColor="teal"
          title="Live Qualifier Tracker"
          where="Qualifier Tracker page" path="/tracker" pathLabel="Tracker"
          body={
            <ul className="space-y-1">
              <li>• Use on the <strong>day of a qualifier</strong> to enter times as you ride.</li>
              <li>• Shows instant level badges and PB indicators as you type.</li>
              <li>• Supports back-to-back weekend qualifiers — enter both events in one session.</li>
              <li>• Automatically saves to your history and updates your personal bests.</li>
            </ul>
          }
          tip="Great for club heads entering times for multiple riders on the day."
        />

        <StepCard
          number={9} color="teal" stepColor="teal"
          title="Event Day — Track All Riders"
          where="Event Day page" path="/event-day" pathLabel="Event Day"
          body={
            <ul className="space-y-1">
              <li>• Upload the official <strong>running list PDF</strong> from the day's event.</li>
              <li>• KlipKlop parses all riders and groups from the PDF automatically.</li>
              <li>• Search for and select the riders you want to track.</li>
              <li>• Enter times for selected riders during the event — live level feedback included.</li>
              <li>• Save all times to KlipKlop in one go at the end of the day.</li>
            </ul>
          }
          tip="The session saves locally — if you leave and come back, your entered times are still there."
        />
      </div>

      {/* SECTION 5: Stable */}
      <div className="space-y-4">
        <SectionHeader icon={HeartPulse} title="Managing Your Stable" subtitle="Step 5 — Keep your horses healthy" color="orange" />

        <StepCard
          number={10} color="orange" stepColor="orange"
          title="Horse Health — Vitals, Medical & Reminders"
          where="Horses → tap a horse" path="/horses" pathLabel="Horses"
          body={
            <ul className="space-y-1">
              <li>• <strong>Vitals:</strong> Record temperature, pulse, and respiration rate. Abnormal readings are flagged in red.</li>
              <li>• <strong>Medical log:</strong> Track vet visits, treatments, injuries, and notes.</li>
              <li>• <strong>Vaccinations:</strong> Log vaccination dates — KlipKlop tracks when the next one is due.</li>
              <li>• <strong>Reminders:</strong> Set recurring reminders for farrier, deworming, dentist, vet checks, and more.</li>
              <li>• <strong>Videos:</strong> Upload competition videos linked to specific qualifiers.</li>
            </ul>
          }
          tip="Vaccination records are checked against Nationals entry requirements — keep them up to date."
        />
      </div>

      {/* SECTION 6: Assistant */}
      <div className="space-y-4">
        <SectionHeader icon={MessageCircle} title="Your AI Assistant" subtitle="Step 6 — Ask anything" color="teal" />

        <StepCard
          number={11} color="teal" stepColor="teal"
          title="KlipKlop Assistant — Rules & Personal Insights"
          where="Assistant page" path="/assistant" pathLabel="Assistant"
          body={
            <>
              <ul className="space-y-1 mb-3">
                <li>• Ask any question about <strong>SAWMGA rules</strong> — games, penalties, equipment, levels, the constitution.</li>
                <li>• Ask about <strong>your own data</strong> — full access to your times, horses, season, eligibility, and health records.</li>
                <li>• Uses the official SAWMGA overcount rule when answering level questions.</li>
              </ul>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Am I eligible for Nationals?',
                  'What level will I compete at?',
                  'What games do I still need to ride?',
                  'When is my next qualifier?',
                  'Are my horses\' vaccinations up to date?',
                  'What is the penalty for knocking a barrel?',
                ].map(q => (
                  <span key={q} className="text-xs bg-gray-100 text-gray-700 rounded-lg px-2 py-1 border border-gray-200">
                    "{q}"
                  </span>
                ))}
              </div>
            </>
          }
        />
      </div>

      {/* Eligibility Quick Reference */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-yellow-400" />
            <h2 className="text-white font-bold text-base">Nationals Eligibility — Quick Reference</h2>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            {
              icon: '🎯',
              label: '11+ of 13 games covered',
              detail: 'Ride at least 11 different games during the season (any qualifier, any province). NT results count as covered.',
            },
            {
              icon: '📅',
              label: '2+ qualifiers attended',
              detail: 'Attend at least 2 qualifier events anywhere in South Africa.',
            },
            {
              icon: '📍',
              label: '2+ qualifiers in your province',
              detail: 'At least 2 of those qualifiers must be in your registered province.',
            },
            {
              icon: '📊',
              label: 'Predicted level via overcount rule',
              detail: 'Your competition level at Nationals is predicted by chaining the SAWMGA overcount rule through each qualifier you attended, in date order.',
            },
          ].map(item => (
            <div key={item.label} className="px-6 py-4 flex items-start gap-4">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3">
        <p className="text-gray-500 text-sm">Ready to go? Start by adding your horse.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/horses"
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
          >
            <HeartPulse size={16} />
            Add Your Horse
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-5 py-2.5 rounded-xl border border-gray-200 transition shadow-sm"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
