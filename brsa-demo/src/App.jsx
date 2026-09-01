import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { Events } from './pages/Events'
import { EventPage } from './pages/EventPage'
import { Standings } from './pages/Standings'
import { Wallet } from './pages/Wallet'
import { Invoices } from './pages/Invoices'
import { RiderProfile } from './pages/RiderProfile'
import { Feed } from './pages/Feed'
import { Community } from './pages/Community'
import { HallOfFame } from './pages/HallOfFame'
import { Rules } from './pages/Rules'
import { AdminPage } from './pages/AdminPage'
import { ProducerPage } from './pages/ProducerPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:eventId" element={<EventPage />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/riders/:riderId" element={<RiderProfile />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/community" element={<Community />} />
        <Route path="/hof" element={<HallOfFame />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/producer" element={<ProducerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
