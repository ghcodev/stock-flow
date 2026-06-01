import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import './styles/app.css'

function Root() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem('splash_shown') !== '1'
    } catch {
      return true
    }
  })

  function handleSplashComplete() {
    try {
      sessionStorage.setItem('splash_shown', '1')
    } catch {}
    setShowSplash(false)
  }

  return (
    <>
      <App />
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
