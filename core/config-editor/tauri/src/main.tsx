import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './tauri' // Initialize Tauri API compatibility layer
import './styles/global.css' // Global styles

console.log("Hello World!")

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

