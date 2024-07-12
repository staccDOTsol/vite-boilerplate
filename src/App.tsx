import { useState, useEffect } from 'react'
import './App.css'
import WebApp from '@twa-dev/sdk'
import { TonClient, Address, beginCell, toNano, CellType, fromNano, BitString, Contract } from '@ton/ton'
import { getHttpEndpoint } from '@orbs-network/ton-access'
function App() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [contract, setContract] = useState<Contract | null>(null)
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
  const [calculatedCost, setCalculatedCost] = useState<string>('')

  useEffect(() => {
    if (WebApp.initDataUnsafe.user) {
      setWalletConnected(true)
    }

    const initTonClient = async () => {
      if (client) return
      try {
        const endpoint = await getHttpEndpoint(); // get the decentralized RPC endpoint
        const newClient = new TonClient({ 
          endpoint,
          timeout: 30000, // 30 seconds timeout
        });
        setClient(newClient);
      } catch (error: any) {
        console.error('Failed to initialize TonClient:', error);
        WebApp.showAlert(error.toString());
      }
    }

    initTonClient()
  }, [])

  useEffect(() => {
    const loadContract = async () => {
      if (!client) return
      if (contract) return
      try {
        const contractAddress = Address.parse('EQAKGFo1pp6xuzlAxvgK7LLYeF120UhAtCUS9qu-rsEmQcjc')
        setContract({address: contractAddress})
      } catch (error: any) {
        console.error('Failed to load contract:', error)
        WebApp.showAlert(error.toString())
      }
    }

    loadContract()
  }, [client, contract])

  useEffect(() => {
    const fetchLaunchedContracts = async () => {
      if (!client || !contract) return
      if (launchedContracts.length > 0) return

      try {
        const transactions = await client.getTransactions(contract.address, { limit: 100 });

        const contractsData = await Promise.all(transactions
          .filter(tx => tx.inMessage?.body?.type === CellType.Ordinary)
          .map(async tx => {
            const body = tx.inMessage?.body;
            if (!body || body.type !== CellType.Ordinary) {
                return null;
            }
            const slice = body.beginParse();
            const op = slice.loadUint(32);
            if (op !== 1) {
                return null;
            }
            
            const tokenAddressSlice = slice.loadAddress();
            
            const result = await client.callGetMethod(contract.address, 'get_token_info', [{ type: 'slice', cell: beginCell().storeAddress(tokenAddressSlice).endCell() }]);
            const name = result.stack.readString();
            const symbol = result.stack.readString();
            const totalSupplyResult = await client.callGetMethod(contract.address, 'get_total_supply', []);
            const totalSupply = totalSupplyResult.stack.readBigNumber();
            
            const initialPrice = 1000000n;
            const priceIncrement = 1000000n;
            
            const currentPrice = initialPrice + (totalSupply * priceIncrement);
            const marketCap = currentPrice * totalSupply;
            
            const alpha = Number(currentPrice) / Number(totalSupply);
            const beta = Number(priceIncrement);
            const gamma = 2 * Number(priceIncrement) / Number(totalSupply);
            const delta = Number(currentPrice) / Number(initialPrice + totalSupply * priceIncrement);
            const epsilon = Number(totalSupply * priceIncrement) / Number(currentPrice);

            return {
              address: tokenAddressSlice.toString(),
              name,
              symbol,
              totalSupply: totalSupply.toString(),
              currentPrice: currentPrice.toString(),
              marketCap: Number(marketCap),
              alpha: Number(alpha),
              beta: Number(beta),
              gamma: Number(gamma),
              delta: Number(delta),
              epsilon: Number(epsilon),
              launchDate: new Date(tx.now * 1000),
              value: Number(currentPrice) / 1e9,
            };
          }));

        setLaunchedContracts(contractsData.filter((contract): contract is NonNullable<typeof contract> => contract !== null));
      } catch (error) {
        console.error('Failed to fetch launched contracts:', error)
        WebApp.showAlert('Failed to fetch launched contracts. Please try again.')
      }
    }

    fetchLaunchedContracts()
  }, [client, contract, launchedContracts])


  const buyTokens = async () => {
    if (!walletConnected || !client) {
      WebApp.showAlert('Please connect your wallet first.')
      return
    }
    try {
      const amountCoins = toNano(amount)
      const message = beginCell()
        .storeUint(2, 32)
        .storeUint(amountCoins, 64)
        .endCell()

      await client.sendExternalMessage(contract as Contract, message)
      WebApp.showAlert(`Attempting to buy ${amount} tokens from ${contractAddress}`)
    } catch (error: any) {
      console.error('Failed to buy tokens:', error)
      WebApp.showAlert(error.toString())
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
        .storeUint(3, 32)
        .storeCoins(amountCoins)
        .endCell()

      await client.sendExternalMessage(contract as Contract, message)
      WebApp.showAlert(`Attempting to sell ${amount} tokens to ${contractAddress}`)
    } catch (error: any) {
      console.error('Failed to sell tokens:', error)
      WebApp.showAlert(error.toString())
    }
  }

  const createNewContract = async () => {
    if (!walletConnected || !client) {
      WebApp.showAlert('Please connect your wallet first.')
      return
    }
    try {
      const message = beginCell()
        .storeUint(1, 32)
        .storeStringTail(newContractName)
        .storeStringTail(newContractSymbol)
        .storeCoins(toNano(newContractSupply))
        .endCell()

      await client.sendExternalMessage(contract as Contract, message)
      WebApp.showAlert(`Attempting to create new contract: ${newContractName} (${newContractSymbol}) with supply: ${newContractSupply}`)
    } catch (error: any) {
      console.error('Failed to create new contract:', error)
      WebApp.showAlert(error.toString())
    }
  }

  const calculateCost = (amount: string) => {
    if (!contract) return '0'

    const totalSupply = BigInt(0)
    const initialPrice = 1000000n
    const priceIncrement = 1000000n
    const amountBigInt = amount !== '' ? BigInt(amount) : 0n
    const currentPrice = initialPrice + (totalSupply * priceIncrement)
    const cost = currentPrice * amountBigInt
    return cost.toString()
  }

  useEffect(() => {
    setCalculatedCost(calculateCost(amount))
  }, [amount, contract])

  const selectContract = (address: string) => {
    setContractAddress(address);
  }

  return (
    <>
      <div>
      </div>
      <h1>MemeTon Launchpad</h1>
     
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
        <div>
          <h4>Cost: {fromNano(calculatedCost)} TON</h4>
        </div>
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
            <li key={index} onClick={() => selectContract(contract.address)}>
              {contract.name} ({contract.symbol}) - Market Cap: {contract.marketCap}
            </li>
          ))}
        </ul>
        <h4>Newest 2 Contracts</h4>
        <ul>
          {launchedContracts.sort((a, b) => b.launchDate.getTime() - a.launchDate.getTime()).slice(0, 2).map((contract, index) => (
            <li key={index} onClick={() => selectContract(contract.address)}>
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
                <li key={index} onClick={() => selectContract(contract.address)}>
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