import { useState, useEffect } from 'react';
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { TonConnectButton } from '@tonconnect/ui-react';
import './App.css';
import { beginCell } from '@ton/core';
import { TonClient, Address, toNano, fromNano } from '@ton/ton'
import { getHttpEndpoint } from '@orbs-network/ton-access';
import WebApp from '@twa-dev/sdk';
// Constants from the smart contract
const TIMER_DURATION = 3600; // 1 hour in seconds
const PAYOUT_PERCENTAGE = 70; // 70% of the pot is paid out on a win
const INITIAL_KEY_PRICE = 1000000; // Initial price in nanotons (0.001 TON)
const DIVIDEND_PERCENTAGE = 5; // 5% of each purchase goes to key holders as dividends

const App = () => {
  const [potSize, setPotSize] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [keyPrice, setKeyPrice] = useState(0);
  const [playerKeys, setPlayerKeys] = useState(0);
  const [lastBuyer, setLastBuyer] = useState('');
  const [totalSupply, setTotalSupply] = useState(0);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [client, setClient] = useState<TonClient | undefined>();
  const contractAddress = 'EQBmWomOhf3bOVMLmfhjeQ2MRcf_ceDS1LyAUAvRi4XoLZsu';

  useEffect(() => {
    const initTonClient = async () => {
      if (client) return;
      try {
        const endpoint = await getHttpEndpoint();
        const newClient = new TonClient({ 
          endpoint,
          timeout: 30000,
        });
        setClient(newClient);
      } catch (error: any) {
        console.error('Failed to initialize TonClient:', error);
        WebApp.showAlert(error.toString());
      }
    };

    initTonClient();
  }, []);

  useEffect(() => {
    const fetchGameData = async () => {
      if (!client || !wallet) return;
      try {
        const contract = client.provider(Address.parse(contractAddress));
        
        const fetchData = async (method, setter, errorMessage) => {
          try {
            const result = await contract.get(method, []);
            
              const value = method === 'get_last_buyer' 
                ? result.stack.readAddress().toString()
                : Number(method.includes('price') ? fromNano(result.stack.readBigNumber()) : result.stack.readBigNumber());
              setter(method === 'get_key_price' ? Number(value) + 0.3 : value);
          } catch (error) {
            console.error(errorMessage, error);
            if (method === 'get_key_price') setter(0.3);
          }
        };

        await Promise.all([
          fetchData('get_pot_size', setPotSize, 'Error fetching pot size:'),
          fetchData('get_time_left', setTimeLeft, 'Error fetching time left:'),
          fetchData('get_key_price', setKeyPrice, 'Error fetching key price:'),
          fetchData('get_total_supply', setPlayerKeys, 'Error fetching player keys:'),
          fetchData('get_last_buyer', setLastBuyer, 'Error fetching last buyer:'),
          fetchData('get_total_supply', setTotalSupply, 'Error fetching total supply:')
        ]);

      } catch (error) {
        console.error('Error fetching game data:', error);
      }
      setTimeout(fetchGameData, 5000); // Update every 5 seconds
    };

    fetchGameData();
     

  }, [client, wallet]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 0) return 0;
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const buyKeys = async () => {
    if (!wallet) {
      WebApp.showAlert('Please connect your wallet first.');
      return;
    }
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: contractAddress,
            amount: toNano(keyPrice).toString(),
            payload: beginCell()
              .storeUint(1, 32) // op code for buy_keys
              .storeUint(0, 64) // query_id
              .endCell()
              .toBoc()
              .toString('base64'),
          },
        ],
      });
      WebApp.showAlert('Key purchase initiated. Please wait for confirmation.');
    } catch (error: any) {
      console.error('Failed to buy keys:', error);
      WebApp.showAlert(error.toString());
    }
  };

  const burnKeys = async (keysToBurn: number) => {
    if (!wallet) {
      WebApp.showAlert('Please connect your wallet first.');
      return;
    }
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: contractAddress,
            amount: toNano('0.3').toString(), // Small amount for gas
            payload: beginCell()
              .storeUint(0x595f07bc, 32) // op code for burn
              .storeUint(0, 64) // query_id
              .storeCoins(keysToBurn)
              .endCell()
              .toBoc()
              .toString('base64'),
          },
        ],
      });
      WebApp.showAlert('Key burn initiated. Please wait for confirmation.');
    } catch (error: any) {
      console.error('Failed to burn keys:', error);
      WebApp.showAlert(error.toString());
    }
  };

  const claimWin = async () => {
    if (!wallet) {
      WebApp.showAlert('Please connect your wallet first.');
      return;
    }
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: contractAddress,
            amount: toNano('0.3').toString(), // Small amount for gas
            payload: beginCell()
              .storeUint(2, 32) // op code for claim_win
              .storeUint(0, 64) // query_id
              .endCell()
              .toBoc()
              .toString('base64'),
          },
        ],
      });
      WebApp.showAlert('Claim win initiated. Please wait for confirmation.');
    } catch (error: any) {
      console.error('Failed to claim win:', error);
      WebApp.showAlert(error.toString());
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isWinner = wallet && lastBuyer === wallet.account.address;
  const canClaimWin = timeLeft === 0 && isWinner;

  return (
    <div className="App">
      <h1>Fomo3D on TON</h1>
      {!wallet ? (
        <div className="connect-wallet">
          <p>Connect your wallet to play</p>
          <TonConnectButton />
        </div>
      ) : (
        <>
          <div className="game-info">
            <h2>Current Pot: {potSize.toFixed(2)} TON</h2>
            <h2>Time Left: {formatTime(timeLeft)}</h2>
            <h3>Key Price: {keyPrice.toFixed(3)} TON</h3>
            <h3>Your Keys: {playerKeys}</h3>
            <h3>Total Keys: {totalSupply}</h3>
            <h4>Last Buyer: {lastBuyer.slice(0, 6)}...{lastBuyer.slice(-4)}</h4>
          </div>
          <div className="actions">
            <button className="buy-keys" onClick={buyKeys}>Buy Keys for {keyPrice.toFixed(3)} TON</button>
            <button className="burn-keys" onClick={() => burnKeys(1)}>Burn 1 Key</button>
            {canClaimWin && (
              <button className="claim-win" onClick={claimWin}>Claim Win</button>
            )}
          </div>
        </>
      )}
      <div className="game-explanation">
        <h2>How to Play Fomo3D</h2>
        <p>Fomo3D is an exciting game of chance and strategy on the TON blockchain:</p>
        <ul>
          <li>Buy keys to increase your chances of winning the pot</li>
          <li>Each key purchase extends the timer by {TIMER_DURATION / 3600} hour</li>
          <li>The last key buyer when the timer hits zero wins {PAYOUT_PERCENTAGE}% of the pot</li>
          <li>Key prices increase as more are bought, starting at {fromNano(INITIAL_KEY_PRICE)} TON</li>
          <li>{DIVIDEND_PERCENTAGE}% of each purchase goes to key holders as dividends</li>
          <li>You can burn keys to extend the timer and increase your chances of winning</li>
        </ul>
        <p>Remember: Only invest what you can afford to lose. Good luck!</p>
      </div>
    </div>
  );
};

export default App;