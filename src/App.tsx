import { useState, useEffect } from 'react'
import './App.css'
import { getHttpV4Endpoint } from '@orbs-network/ton-access';
const stringToBits = (str: string) => {
  const bits = new BitString(Buffer.from(str), 0, str.length * 8)
  return bits
}
import WebApp from '@twa-dev/sdk'
import { TonClient, Address, beginCell, toNano, BitString } from '@ton/ton'

function App() {
  const [count, setCount] = useState(0)
  const [walletConnected, setWalletConnected] = useState(false)
  const [contract, setContract] = useState<any>(null)
  const [contractAddress, setContractAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [newContractName, setNewContractName] = useState('')
  const [newContractSymbol, setNewContractSymbol] = useState('')
  const [newContractSupply, setNewContractSupply] = useState('')
  const [client, setClient] = useState<TonClient | null>(null)

  useEffect(() => {
    // Check if wallet is already connected
    if (WebApp.initDataUnsafe.user) {
      setWalletConnected(true)
    }

    // Initialize TonClient
    const initTonClient = async () => {
      const newClient = new TonClient({
        endpoint: await getHttpV4Endpoint({ network: 'mainnet' }),
      });
      setClient(newClient)
    }

    initTonClient()

    // Load the memecoinlaunchpad contract
    const loadContract = async () => {
      try {
        if (!client) return
        const contractAddress = Address.parse('EQAKGFo1pp6xuzlAxvgK7LLYeF120UhAtCUS9qu-rsEmQcjc')
        const contractData = await client.getContractState(contractAddress)
        setContract(contractData)
        console.log('Contract loaded:', contractData)
      } catch (error) {
        console.error('Failed to load contract:', error)
        WebApp.showAlert('Failed to load memecoinlaunchpad contract. Please try again.')
      }
    }

    if (client) {
      loadContract()
    }
  }, [client])

  const connectWallet = async () => {
    try {
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

  const buyTokens = async () => {
    if (!walletConnected || !client) {
      WebApp.showAlert('Please connect your wallet first.')
      return
    }
    try {
      const amountCoins = toNano(amount)
      const message = beginCell()
        .storeUint(2, 32) // op code for buy
        .storeUint(amountCoins, 64)
        .endCell()

      await client.sendExternalMessage(contract, message)
      WebApp.showAlert(`Attempting to buy ${amount} tokens from ${contractAddress}`)
    } catch (error) {
      console.error('Failed to buy tokens:', error)
      WebApp.showAlert('Failed to buy tokens. Please try again.')
    }
  }

  const sellTokens = async () => {
    if (!walletConnected || !client) {
      WebApp.showAlert('Please connect your wallet first.')
      return
    }
    try {
      const amountCoins = toNano(amount)
      const message = beginCell()
        .storeUint(3, 32) // op code for sell
        .storeCoins(amountCoins)
        .endCell()

      await client.sendExternalMessage(contract, message)
      WebApp.showAlert(`Attempting to sell ${amount} tokens to ${contractAddress}`)
    } catch (error) {
      console.error('Failed to sell tokens:', error)
      WebApp.showAlert('Failed to sell tokens. Please try again.')
    }
  }

  const createNewContract = async () => {
    if (!walletConnected || !client) {
      WebApp.showAlert('Please connect your wallet first.')
      return
    }
    try {
      const message = beginCell()
        .storeUint(1, 32) // op code for deploy
        .storeBits(stringToBits(newContractName))
        .storeBits(stringToBits(newContractSymbol))
        .storeCoins(toNano(newContractSupply))
        .endCell()

      await client.sendExternalMessage(contract, message)
      WebApp.showAlert(`Attempting to create new contract: ${newContractName} (${newContractSymbol}) with supply: ${newContractSupply}`)
    } catch (error) {
      console.error('Failed to create new contract:', error)
      WebApp.showAlert('Failed to create new contract. Please try again.')
    }
  }

  return (
    <>
      <div>
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
      <div className="card">
        <button onClick={() => WebApp.showAlert(contract ? 'Contract loaded' : 'Contract not loaded')}>
          Check Contract Status
        </button>
      </div>
      <div className="card">
        <h3>Buy/Sell Tokens</h3>
        <input
          type="text"
          placeholder="Contract Address"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button onClick={buyTokens}>Buy Tokens</button>
        <button onClick={sellTokens}>Sell Tokens</button>
      </div>
      <div className="card">
        <h3>Create New Contract</h3>
        <input
          type="text"
          placeholder="Contract Name"
          value={newContractName}
          onChange={(e) => setNewContractName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Contract Symbol"
          value={newContractSymbol}
          onChange={(e) => setNewContractSymbol(e.target.value)}
        />
        <input
          type="number"
          placeholder="Initial Supply"
          value={newContractSupply}
          onChange={(e) => setNewContractSupply(e.target.value)}
        />
        <button onClick={createNewContract}>Create New Contract</button>
      </div>
    </>
  )
}

export default App
