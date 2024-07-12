import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import WebApp from '@twa-dev/sdk';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

WebApp.ready();

const calculateCost = (amount: number) => {
  const initialPrice = 1000000; // Initial price in nanotons (0.001 TON)
  const priceIncrement = 1000000; // Price increment per token (0.001 TON)
  let price = initialPrice;
  for (let i = 0; i < amount; i++) {
    price += priceIncrement;
  }
  return price * amount;
};

const TokenCalculator = () => {
  const [amount, setAmount] = useState(0);
  const [cost, setCost] = useState(0);

  const handleCalculate = () => {
    const cost = calculateCost(amount);
    setCost(cost);
  };

  return (
    <div className="card">
      <input
        id="token-amount"
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <button id="calculate-cost" onClick={handleCalculate}>
        Calculate Cost
      </button>
      <p id="cost-display">Cost: {cost} TON</p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl="https://staccdotsol.github.io/vite-boilerplate/tonconnect-manifest.json">
      <App />
    </TonConnectUIProvider>

  </React.StrictMode>
);