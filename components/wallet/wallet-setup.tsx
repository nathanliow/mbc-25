"use client";

import { useState } from "react";
import { 
  Card,
  CardContent,
  Button,
  Input
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { 
  Shield, 
  Plus, 
  Download, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  AlertTriangle 
} from "lucide-react";

type SetupStep = "choice" | "create" | "import" | "backup" | "confirm";

export function WalletSetup() {
  const { createWallet, importWallet } = useWallet();
  const [step, setStep] = useState<SetupStep>("choice");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [importMnemonic, setImportMnemonic] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const handleCreate = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const newMnemonic = await createWallet(password);
      setMnemonic(newMnemonic);
      setStep("backup");
    } catch (err) {
      setError("Failed to create wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!importMnemonic.trim()) {
      setError("Please enter your recovery phrase");
      return;
    }

    const words = importMnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError("Recovery phrase must be 12 or 24 words");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await importWallet(importMnemonic.trim(), password);
    } catch (err) {
      setError("Invalid recovery phrase");
    } finally {
      setIsLoading(false);
    }
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderChoice = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Welcome to ShadeWallet</h1>
        <p className="text-sm text-gray-400">
          Privacy-first Solana wallet with automatic shielding
        </p>
      </div>

      <div className="space-y-3">
        <Button
          className="w-full h-14"
          size="lg"
          onClick={() => setStep("create")}
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Wallet
        </Button>
        <Button
          variant="outline"
          className="w-full h-14"
          size="lg"
          onClick={() => setStep("import")}
        >
          <Download className="h-5 w-5 mr-2" />
          Import Existing Wallet
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Your keys are encrypted locally and never leave your device
      </p>
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Create New Wallet</h1>
        <p className="text-sm text-gray-400">
          Set a strong password to encrypt your wallet
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Confirm Password</label>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setStep("choice");
              setError("");
            }}
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Wallet"}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderImportForm = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Import Wallet</h1>
        <p className="text-sm text-gray-400">
          Enter your 12 or 24 word recovery phrase
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Recovery Phrase</label>
          <textarea
            className="w-full h-24 px-3 py-2 rounded-lg bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter your 12 or 24 word recovery phrase..."
            value={importMnemonic}
            onChange={(e) => setImportMnemonic(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">New Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Confirm Password</label>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setStep("choice");
              setError("");
            }}
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleImport}
            disabled={isLoading}
          >
            {isLoading ? "Importing..." : "Import Wallet"}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold">Backup Recovery Phrase</h1>
        <p className="text-sm text-gray-400">
          Write down these words in order and store them securely
        </p>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-2">
            {mnemonic.split(" ").map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded bg-background"
              >
                <span className="text-xs text-gray-500 w-4">{index + 1}.</span>
                <span className="text-sm font-mono">{word}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={copyMnemonic}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={backupConfirmed}
            onChange={(e) => setBackupConfirmed(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-muted"
          />
          <span className="text-sm text-gray-400">
            I have securely saved my recovery phrase
          </span>
        </label>

        <Button
          className="w-full"
          disabled={!backupConfirmed}
          onClick={() => {
            setMnemonic("");
            setStep("choice");
          }}
        >
          Continue to Wallet
        </Button>
      </div>

      <p className="text-xs text-center text-red-400">
        Never share your recovery phrase. Anyone with these words can access your funds.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {step === "choice" && renderChoice()}
        {step === "create" && renderCreateForm()}
        {step === "import" && renderImportForm()}
        {step === "backup" && renderBackup()}
      </div>
    </div>
  );
}

