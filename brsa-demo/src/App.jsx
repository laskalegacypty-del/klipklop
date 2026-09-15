import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { Events } from './pages/Events'
import { EventPage } from './pages/EventPage'
import { EventDay } from './pages/EventDay'
import { Timekeeper } from './pages/Timekeeper'
import { Standings } from './pages/Standings'
import { Wallet } from './pages/Wallet'
import { RiderProfile } from './pages/RiderProfile'
import { HorseProfile } from './pages/HorseProfile'
import { FanProfile } from './pages/FanProfile'
import { Feed } from './pages/Feed'
import { Community } from './pages/Community'
import { HallOfFame } from './pages/HallOfFame'
import { Rules } from './pages/Rules'
import { Barry } from './pages/Barry'
import { Ask } from './pages/Ask'
import { AdminPage } from './pages/AdminPage'
import { ProducerPage } from './pages/ProducerPage'
import { Complaints } from './pages/Complaints'
import { MyTimes } from './pages/MyTimes'

export default function App() {
  return (
    <Routes>
      <Route path="/events/:eventId/timekeeper" element={<Timekeeper />} />
      <Route path="/ask" element={<Ask />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:eventId" element={<EventPage />} />
        <Route path="/events/:eventId/day" element={<EventDay />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/invoices" element={<Navigate to="/wallet" replace />} />
        <Route path="/times" element={<MyTimes />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/riders/:riderId" element={<RiderProfile />} />
        <Route path="/horses/:horseId" element={<HorseProfile />} />
        <Route path="/fans/:fanId" element={<FanProfile />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/community" element={<Community />} />
        <Route path="/hof" element={<HallOfFame />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/barry" element={<Barry />} />
        <Route path="/brandy" element={<Navigate to="/barry" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dev" element={<AdminPage mode="dev" />} />
        <Route path="/producer" element={<ProducerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
