"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRightLeft, Shield } from "lucide-react";
import { TokenSelector } from "@/components/swap/token-selector";
import { useWallet } from "@/lib/wallet-context";
import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
} from "@solana/kit";
import { buildBridgeSolInstructions } from "@/lib/base-bridge";

const tokens = [
  { symbol: "SOL", name: "Solana", balance: "12.5" },
  { symbol: "BASE", name: "Base Wrapped SOL", balance: "0.00" },
];

// Reserve for Solana transaction fees on the stealth wallet
const TX_FEE_RESERVE = 0.01; // SOL - enough for tx fees

// Minimum amount to create the stealth wallet account on-chain
const ACCOUNT_CREATION_MIN = 0.01; // SOL - rent exempt minimum

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_WS_URL = RPC_URL.replace("https://", "wss://").replace("http://", "ws://");

export default function BridgePage() {
  const [fromToken] = useState(tokens[0]); // Always SOL
  const [toToken] = useState(tokens[1]); // Always Base
  const [amount, setAmount] = useState("");
  const [baseAddress, setBaseAddress] = useState("");
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState("");

  const wallet = useWallet();
  const { deposit, withdraw, getStealthAddress, publicKey, sendPublic } = wallet;

  const handleBridge = async () => {
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!baseAddress || !baseAddress.startsWith("0x")) {
      alert("Please enter a valid Base address (0x...)");
      return;
    }

    if (!publicKey) {
      alert("Please connect your Solana wallet");
      return;
    }

    setIsBridging(true);

    try {
      const bridgeAmount = parseFloat(amount);
      
      // Total amount needed = bridge amount + fee reserve + account creation minimum
      const totalToStealth = bridgeAmount + TX_FEE_RESERVE;
      
      // Step 1: Generate a stealth address (temporary wallet)
      setBridgeStatus("Generating stealth wallet...");
      const stealthIndex = Math.floor(Math.random() * 1000);
      const stealthWallet = getStealthAddress(stealthIndex);
      
      if (!stealthWallet) {
        throw new Error("Failed to generate stealth wallet");
      }

      console.log("Private bridge initiated:", {
        bridgeAmount,
        feeReserve: TX_FEE_RESERVE,
        totalToStealth,
        baseRecipient: baseAddress,
        stealthWallet: stealthWallet.publicKey,
      });

      // Step 2: Create stealth wallet account by sending minimum SOL
      setBridgeStatus("Creating stealth wallet account...");
      const createAccountSig = await sendPublic(stealthWallet.publicKey, ACCOUNT_CREATION_MIN);
      console.log("Stealth wallet account created:", createAccountSig);

      // Step 3: Deposit SOL to private pool
      setBridgeStatus("Depositing SOL to private pool...");
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const privateAmount = totalToStealth - ACCOUNT_CREATION_MIN;
      const depositSig = await deposit(privateAmount, SOL_MINT, 9);
      console.log("Deposit complete:", depositSig);

      // Step 4: Withdraw privately to the stealth wallet
      setBridgeStatus("Withdrawing privately to stealth wallet...");
      const withdrawSig = await withdraw(stealthWallet.publicKey, privateAmount, SOL_MINT, 9);
      console.log("Private withdraw complete:", withdrawSig);

      // Step 5: Build and send bridge transaction using SDK
      setBridgeStatus("Building bridge transaction...");
      
      // Convert keypair to @solana/kit signer
      const signer = await createKeyPairSignerFromBytes(stealthWallet.keypair.secretKey);
      
      // Build bridge instructions using the SDK (matches Base repo implementation)
      // Note: payForRelay is disabled as the relayer may not be initialized
      // Without relay, the message will be relayed by validators (may take longer)
      const instructions = await buildBridgeSolInstructions({
        payer: signer,
        to: baseAddress,
        amount: bridgeAmount,
        payForRelay: true, // Relay service may not be available
      });
      
      console.log("Bridge instructions built:", instructions.length);

      // Create RPC clients
      setBridgeStatus("Sending bridge transaction...");
      const rpc = createSolanaRpc(RPC_URL);
      const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_WS_URL);
      
      // Get latest blockhash
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      
      // Build and sign transaction using @solana/kit
      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(signer.address, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx)
      );

      const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
      const signature = getSignatureFromTransaction(signedTransaction);
      
      // Send and confirm transaction (skip preflight simulation)
      const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
      await sendAndConfirm(signedTransaction as Parameters<typeof sendAndConfirm>[0], { 
        commitment: "confirmed",
        skipPreflight: true, // Skip simulation, send directly to chain
      });
      
      console.log("Bridge transaction sent:", signature);
      setBridgeStatus("");
      
      alert(
        `🎉 Private bridge complete!\n\n` +
        `Bridge signature: ${signature}\n\n` +
        `Your SOL was:\n` +
        `1. Sent privately to a stealth wallet\n` +
        `2. Bridged to Base from the stealth wallet\n\n` +
        `${bridgeAmount} wrapped SOL will arrive at:\n${baseAddress}\n\n` +
        `Estimated arrival: 5-10 minutes`
      );
      
      // Clear form
      setAmount("");
      setBaseAddress("");

    } catch (error: unknown) {
      console.error("Bridge error:", error);
      setBridgeStatus("");
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Bridge error: ${message}`);
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-md">
      <Card className="bg-transparent border-0">
        <CardContent className="p-0">
          <div className="space-y-4">
            <TokenSelector
              token={fromToken}
              label="From"
              amount={amount}
              onAmountChange={setAmount}
              onClick={() => {}}
            />

            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-gray-400" />
            </div>

            <TokenSelector
              token={toToken}
              label="To"
              amount={amount}
              disabled={true}
              onClick={() => {}}
            />

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Base Recipient Address</label>
              <Input
                placeholder="0x..."
                value={baseAddress}
                onChange={(e) => setBaseAddress(e.target.value)}
              />
            </div>

            {amount && (
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">You will receive</span>
                  <span className="font-semibold">
                    {parseFloat(amount).toFixed(4)} wrapped SOL on Base
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Privacy overhead</span>
                  <span>{(TX_FEE_RESERVE + ACCOUNT_CREATION_MIN).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total from wallet</span>
                  <span>{(parseFloat(amount) + TX_FEE_RESERVE + ACCOUNT_CREATION_MIN).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated time</span>
                  <span>5-10 minutes</span>
                </div>
              </div>
            )}

            <Button 
              className="w-full" 
              size="lg" 
              disabled={!amount || !baseAddress || isBridging || !publicKey}
              onClick={handleBridge}
            >
              <Shield className="h-4 w-4 mr-2" />
              {isBridging ? "Bridging..." : "Bridge Privately to Base"}
            </Button>

            {bridgeStatus && (
              <div className="text-center text-sm text-gray-400">
                {bridgeStatus}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
