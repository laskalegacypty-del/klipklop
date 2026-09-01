import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { DemoProvider } from './demo/store'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DemoProvider>
        <App />
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      </DemoProvider>
    </BrowserRouter>
  </StrictMode>,
)
