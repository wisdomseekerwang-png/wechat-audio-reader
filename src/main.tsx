import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Global styles
const style = document.createElement('style')
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 0; background: #0f0f23; color: #e0e0e0; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
  button { font-family: inherit; }
  input, select { font-family: inherit; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
