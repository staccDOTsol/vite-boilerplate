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
  const contractAddress = 'EQBnncEDIFSjzpOS55Rty1UUjLE6ngerfkskz2hshBHYgqgi';

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
      if (!client) return;
      try {
        const contract = client.provider(Address.parse(contractAddress));
        const fetchPotSize = async () => {
          try {
            const potSizeResult = await contract.get('get_pot_size', []);
            setPotSize(Number(fromNano(potSizeResult.stack.readBigNumber())));
          } catch (error) {
            console.error('Error fetching pot size:', error);
          }
        };

        const fetchTimeLeft = async () => {
          try {
            const timeLeftResult = await contract.get('get_time_left', []);
            setTimeLeft(Number(timeLeftResult.stack.readNumber()));
          } catch (error) {
            console.error('Error fetching time left:', error);
          }
        };

        const fetchKeyPrice = async () => {
          try {
            const keyPriceResult = await contract.get('get_key_price', []);
            setKeyPrice(Number(fromNano(keyPriceResult.stack.readBigNumber())) + 0.01);
          } catch (error) {
            console.error('Error fetching key price:', error);
          }
        };

        const fetchPlayerKeys = async () => {
          try {
            const playerKeysResult = await contract.get('balance_of', [{ type: 'slice', cell: beginCell().storeAddress(Address.parse(wallet?.account.address ?? '')).endCell() }]);
            setPlayerKeys(Number(playerKeysResult.stack.readNumber()));
          } catch (error) {
            console.error('Error fetching player keys:', error);
          }
        };

        const fetchLastBuyer = async () => {
          try {
            const lastBuyerResult = await contract.get('get_last_buyer', []);
            setLastBuyer(lastBuyerResult.stack.readAddress().toString());
          } catch (error) {
            console.error('Error fetching last buyer:', error);
          }
        };

        const fetchTotalSupply = async () => {
          try {
            const totalSupplyResult = await contract.get('get_total_supply', []);
            setTotalSupply(Number(totalSupplyResult.stack.readBigNumber()));
          } catch (error) {
            console.error('Error fetching total supply:', error);
          }
        };

        await Promise.all([
          fetchPotSize(),
          fetchTimeLeft(),
          fetchKeyPrice(),
          fetchPlayerKeys(),
          fetchLastBuyer(),
          fetchTotalSupply()
        ]);
      } catch (error) {
        console.error('Error fetching game data:', error);
      }
    };

    fetchGameData();
    const timer = setInterval(fetchGameData, 5000); // Update every 5 seconds

    return () => clearInterval(timer);
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
            amount: toNano('0.01').toString(), // Small amount for gas
            payload: beginCell()
              .storeUint(2, 32) // op code for claim_win
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
        </ul>
        <p>Remember: Only invest what you can afford to lose. Good luck!</p>
      </div>
    </div>
  );
};

export default App;