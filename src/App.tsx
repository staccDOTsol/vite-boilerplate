import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import twaLogo from './assets/tapps.png'
import viteLogo from '/vite.svg'
import './App.css'

import WebApp from '@twa-dev/sdk'

function App() {
  const [count, setCount] = useState(0)
  const [walletConnected, setWalletConnected] = useState(false)

  useEffect(() => {
    // Check if wallet is already connected
    if (WebApp.initDataUnsafe.user) {
      setWalletConnected(true)
    }
  }, [])

  const connectWallet = async () => {
    try {
      // There's no direct method to request write access in the WebApp interface
      // We'll assume the user is connected if we can access their data
      if (WebApp.initDataUnsafe.user) {
        setWalletConnected(true)
        WebApp.showAlert('TON Wallet connected successfully!')
      } else {
        throw new Error('User data not available')
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      WebApp.showAlert('Failed to connect TON Wallet. Please try again.')
    }
  }

  return (
    <>
      <div>
        <a href="https://ton.org/dev" target="_blank">
          <img src={twaLogo} className="logo" alt="TWA logo" />
        </a>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>TWA + Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <div className="card">
        <button onClick={() => WebApp.showAlert(`Hello World! Current count is ${count}`)}>
          Show Alert
        </button>
      </div>
      <div className="card">
        <button onClick={connectWallet} disabled={walletConnected}>
          {walletConnected ? 'Wallet Connected' : 'Connect TON Wallet'}
        </button>
      </div>
    </>
  )
}

export default App
