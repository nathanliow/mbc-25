"use client";

import { useState } from "react";
import { 
  Button,
  Input
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Trash2 
} from "lucide-react";

export function WalletUnlock() {
  const { unlockWallet, deleteWallet } = useWallet();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUnlock = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await unlockWallet(password);
    } catch (err) {
      setError("Incorrect password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    deleteWallet();
    setShowDeleteConfirm(false);
  };

  if (showDeleteConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold">Delete Wallet?</h1>
            <p className="text-sm text-gray-400">
              This will permanently delete your wallet from this device.
              Make sure you have your recovery phrase backed up.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
            >
              Delete Wallet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-sm text-gray-400">
            Enter your password to unlock your wallet
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
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

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleUnlock}
            disabled={isLoading}
          >
            {isLoading ? "Unlocking..." : "Unlock Wallet"}
          </Button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Forgot password? Reset wallet
          </button>
        </div>
      </div>
    </div>
  );
}

