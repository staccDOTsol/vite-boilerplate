import { useState, useEffect } from 'react'
import './App.css'
import { getHttpV4Endpoint } from '@orbs-network/ton-access';
import { Buffer } from 'buffer';

// Polyfill Buffer for browser environments if needed
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

const stringToBits = (str: string) => {
  const bits = new BitString(Buffer.from(str), 0, str.length * 8)
  return bits
}
import WebApp from '@twa-dev/sdk'
import { TonClient, Address, beginCell, toNano, BitString, CellType } from '@ton/ton'

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
  const [launchedContracts, setLaunchedContracts] = useState<Array<{
    name: string,
    symbol: string,
    address: string,
    marketCap: number,
    launchDate: Date,
    value: number,
    alpha: number,
    beta: number,
    gamma: number,
    delta: number,
    epsilon: number
  }>>([])

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

  useEffect(() => {
    const fetchLaunchedContracts = async () => {
      if (!client || !contract) return

      try {
        // Query the TON blockchain for transaction history
        const transactions = await client.getTransactions(contract.address, { limit: 100 });

        // Parse the transactions to extract launched contracts
        const contractsData = await transactions
          .filter(tx => tx.inMessage?.body?.type === CellType.Ordinary)
          .map(async tx => {
            const body = tx.inMessage?.body;
            if (!body || body.type !== CellType.Ordinary) {
                return null;
            }
            const slice = body.beginParse();
            const op = slice.loadUint(32);
            if (op !== 1) { // Assuming op 1 is for deploying a memecoin
                return null;
            }
            
            const tokenAddressSlice = slice.loadAddress();
            
            // Extract token info using getter methods
            const result = await client.callGetMethod(contract.address, 'get_token_info', [{ type: 'slice', cell: beginCell().storeAddress(tokenAddressSlice).endCell() }]);
            const name = result.stack.readString();
            const symbol = result.stack.readString();
            // Get total supply
            const totalSupplyResult = await client.callGetMethod(contract.address, 'get_total_supply', []);
            const totalSupply = totalSupplyResult.stack.readBigNumber();
            
            // Calculate value and Greeks
            const initialPrice = 1000000n; // 0.001 TON
            const priceIncrement = 1000000n; // 0.001 TON
            
            const currentPrice = initialPrice + (totalSupply * priceIncrement);
            const marketCap = currentPrice * totalSupply;
            
            // Calculate Greeks (simplified versions)
            const alpha = Number(currentPrice) / Number(totalSupply); // Price sensitivity to supply
            const beta = Number(priceIncrement); // Rate of price change
            const gamma = 2 * Number(priceIncrement) / Number(totalSupply); // Rate of change of beta
            const delta = Number(currentPrice) / Number(initialPrice + totalSupply * priceIncrement); // Ratio of price to initial price
            const epsilon = Number(totalSupply * priceIncrement) / Number(currentPrice); // Supply elasticity

            return {
              address: tokenAddressSlice.toString(),
              name: name,
              symbol: symbol,
              totalSupply: totalSupply.toString(),
              currentPrice: currentPrice.toString(),
              marketCap: Number(marketCap),
              alpha: Number(alpha),
              beta: Number(beta),
              gamma: Number(gamma),
              delta: Number(delta),
              epsilon: Number(epsilon),
              launchDate: new Date(tx.now * 1000),
              value: Number(currentPrice) / 1e9, // Convert from nanoTON to TON
            };
          })
          .filter((contract): contract is NonNullable<typeof contract> => contract !== null);
          const resolvedContractsData = (await Promise.all(contractsData)).filter((contract): contract is NonNullable<typeof contract> => contract !== null);
          setLaunchedContracts(resolvedContractsData);
        } catch (error) {
          console.error('Failed to fetch launched contracts:', error)
          WebApp.showAlert('Failed to fetch launched contracts. Please try again.')
        }
    }

    fetchLaunchedContracts()
  }, [client, contract])

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
      <div className="card">
        <h3>Leaderboards</h3>
        <h4>Top 2 by Market Cap</h4>
        <ul>
          {launchedContracts.sort((a, b) => b.marketCap - a.marketCap).slice(0, 2).map((contract, index) => (
            <li key={index}>
              {contract.name} ({contract.symbol}) - Market Cap: {contract.marketCap}
            </li>
          ))}
        </ul>
        <h4>Newest 2 Contracts</h4>
        <ul>
          {launchedContracts.sort((a, b) => b.launchDate.getTime() - a.launchDate.getTime()).slice(0, 2).map((contract, index) => (
            <li key={index}>
              {contract.name} ({contract.symbol}) - Launched: {contract.launchDate.toLocaleDateString()}
            </li>
          ))}
        </ul>
        <h4>Greek Rankings</h4>
        {['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(greek => (
          <div key={greek}>
            <h5>{greek.charAt(0).toUpperCase() + greek.slice(1)}</h5>
            <ul> 
              {launchedContracts.sort((a, b) => Number(b[greek as keyof typeof a]) - Number(a[greek as keyof typeof a])).slice(0, 2).map((contract, index) => (
                                                <li key={index}>
                                                {contract.name} ({contract.symbol}) - Value: {typeof contract[greek as keyof typeof contract] === 'object' ? (contract[greek as keyof typeof contract] as Date).toLocaleDateString() : String(contract[greek as keyof typeof contract])}
                                              </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

export default App
