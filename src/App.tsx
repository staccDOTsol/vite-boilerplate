import { useState, useEffect } from 'react'
import './App.css'
import WebApp from '@twa-dev/sdk'
import { TonClient, Address, beginCell, toNano, CellType, fromNano } from '@ton/ton'
import { getHttpEndpoint } from '@orbs-network/ton-access'
import { Blockchain, SandboxContract } from '@ton/sandbox';
import { Cell } from '@ton/core';
import { MemeTon } from '../wrappers/MemeTon'
import '@ton/test-utils';

function App() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [contract, setContract] = useState<any | null>(null)
  const [contractAddress, setContractAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [newContractName, setNewContractName] = useState('')
  const [newContractSymbol, setNewContractSymbol] = useState('')
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
  
      let blockchain: Blockchain;
      let memeTon: SandboxContract<MemeTon>;
  
      blockchain = await Blockchain.create();
  
      memeTon = blockchain.openContract(
              MemeTon.createFromConfig(
                  {
                      id: 0,
                      counter: 0,
                  },
                  Cell.fromBoc(Buffer.from('b5ee9c724102190100034a000114ff00f4a413f4bcf2c80b0102016202160202cc0310020120040a0201200509020120060801f71480b434c0cc7e9008f1c02497c13834c0c05c6c2497c13800f4c7f4cfcc48700066db107587f5824c3c01d7c0f80c3b51343e803e903e903d013d010c097000a7841157c140b4cfcc00fe800c3c02380dc93000e3884d01be800c00d4117c025105140cf214017e809400f3c58073c5bd003d00327b553804d7c0e007002a01c0049a03fa40fa00304034f00be05f04840ff2f000330c208203d0901c24d4c0ae6640608203d0902800693a0c006a20003d482080f42405112a121a8a070935302b9990182080f4240a101a4e83001a880201200b0c001b5f90074c8cb0212ca07cbffc9d080201200d0e001f3e911c083232c072c084b281f2fff26001e51c081b7208fe80be0a33c5be0a33c5bd00325c7e0a3c01951c4cf232c072c032c03332c03332c032573c0148b232c7f25de0063232c148f3c5897e80b2dac4f304b33260103ec03b51343e803e903e903d013d010c0517c1087e910c7209b3c58973c5b240a0c1fd05fe0a3e0a1b4411504c200f0028c85005fa025003cf1601cf16f400f400c9ed54590201481114020120121300b908f0803cb819977c006fbcb819fb51343e803e903e903d013d010c1b104875c2ffc860c1fd039be85c00650c3e800c244c78b21445683e8080b5c2ffc060c1fd10c0a81b5b5600db407214017e809400f3c58073c5bd003d00327b5520009508f0803cb8198875c2ffc860c1fd039be87cb819fe800c14c12fbcb819d4d0fc00b21449a844be8088f5c2ffd540a0c1fd10d40d285c20043232c15400f3c59400fe80b2dab260103ec02001f5522c200f2e06624d70bff228307f40e6fa1f2e067fa00305303bef2e067238103e8a9045340a102c806a115fa0206d70bff46038307f44323d70bff218307f40e6fa193fa0030923070e2c803a012fa0203d70bff43008307f44322d70bff218307f40e6fa193fa0030923070e2c803a012fa0202d70bff0183078150038f4436d6d6d58036d01c85005fa025003cf1601cf16f400f400c9ed5402037db817180056a8aaed44d0fa00fa40fa40f404f40430145f0401d70bff018307f40f6fa196d0d61fd60930e0308b088b080024abf6ed44d0fa00fa40fa40f404f404305f04ad8e855a', 'hex'))[0],
              )
          );
      try {
        const contractAddress = Address.parse('EQDNtSKblX4-stYHbJj0gzXvbxN4Dz0je7rk1-I73REFABrh')
        setContract({address: contractAddress, memeTon})
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
      const totalSupply = await contract.memeTon.getTotalSupply();
      const result = await contract.memeTon.sendBuyTokens(WebApp.initDataUnsafe.user, {
        amount: amountCoins,
        total_supply: totalSupply,
        sender: WebApp.initDataUnsafe.user,
        msg_value: amountCoins
      });
      if (result.success) {
        WebApp.showAlert(`Successfully bought ${amount} tokens. You received ${fromNano(result.price)} TON.`);
      } else {
        throw new Error(result.error || 'Failed to buy tokens');
      }
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
      const totalSupply = await contract.memeTon.getTotalSupply();
      const result = await contract.memeTon.sendSellTokens(WebApp.initDataUnsafe.user, {
        amount: amountCoins,
        total_supply: totalSupply,
        sender: WebApp.initDataUnsafe.user
      });
      if (result.success) {
        WebApp.showAlert(`Successfully sold ${amount} tokens. You received ${fromNano(result.price)} TON.`);
      } else {
        throw new Error(result.error || 'Failed to sell tokens');
      }
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
      console.log(contract.memeTon)
      const message = await contract.memeTon.sendDeployMemecoin(WebApp.initDataUnsafe.user, {
        name: newContractName,
        symbol: newContractSymbol,
        value: toNano('0.02'),
      });
      if (message.success) {
        WebApp.showAlert(`Successfully created new contract: ${newContractName} (${newContractSymbol})`);
      } else {
        throw new Error(message.error || 'Failed to create new contract');
      }
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