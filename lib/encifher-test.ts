/**
 * Test utilities for Encifher SDK
 * 
 * This file provides utilities to test the SDK without requiring an API key.
 * It can be used to:
 * 1. Test SDK initialization
 * 2. Verify SDK methods are callable
 * 3. Test error handling
 * 4. Mock SDK responses for development
 */

import { Keypair } from "@solana/web3.js";
import { DefiClient } from "encifher-swap-sdk";
import { getConnection } from "./solana";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Test if SDK can be imported and initialized
 * This will fail if there are import/build issues
 */
export function testSDKImport(): boolean {
  try {
    // Just check if we can reference the SDK
    const clientType = typeof DefiClient;
    console.log("[Encifher Test] SDK import successful, DefiClient type:", clientType);
    return true;
  } catch (error) {
    console.error("[Encifher Test] SDK import failed:", error);
    return false;
  }
}

/**
 * Test SDK client initialization with a dummy API key
 * This tests if the SDK can be instantiated without errors
 */
export function testSDKInitialization(): {
  success: boolean;
  error?: string;
} {
  try {
    const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
    const testClient = new DefiClient({
      rpcUrl: RPC_URL,
      encifherKey: "test-key-for-initialization-only", // Dummy key for testing
      mode: mode as "Mainnet" | "Devnet",
    });
    
    console.log("[Encifher Test] SDK client initialized successfully");
    // Don't return the client object to avoid circular references
    return {
      success: true,
    };
  } catch (error: any) {
    console.error("[Encifher Test] SDK initialization failed:", error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

/**
 * Test if SDK methods exist and are callable
 * This doesn't require an API key, just checks method availability
 */
export function testSDKMethods(client: DefiClient): {
  methodsExist: boolean;
  availableMethods: string[];
  missingMethods: string[];
} {
  const requiredMethods = [
    "getMessageToSign",
    "getBalance",
    "getDepositTxn",
    "getWithdrawTxn",
    "getAnonTransferMessageToSign",
    "sendSignedAnonTransferParams",
    "getSwapQuote",
    "getSwapTxn",
    "executeSwapTxn",
  ];

  const availableMethods: string[] = [];
  const missingMethods: string[] = [];

  for (const method of requiredMethods) {
    if (typeof (client as any)[method] === "function") {
      availableMethods.push(method);
    } else {
      missingMethods.push(method);
    }
  }

  console.log("[Encifher Test] Available methods:", availableMethods);
  if (missingMethods.length > 0) {
    console.warn("[Encifher Test] Missing methods:", missingMethods);
  }

  return {
    methodsExist: missingMethods.length === 0,
    availableMethods,
    missingMethods,
  };
}

/**
 * Test SDK with a real keypair (but no API key)
 * This tests error handling when API key is missing
 */
export async function testSDKWithoutAPIKey(keypair: Keypair): Promise<{
  canGetMessageToSign: boolean;
  error?: string;
  errorType?: string;
}> {
  try {
    const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
    const testClient = new DefiClient({
      rpcUrl: RPC_URL,
      encifherKey: "", // Empty key to test error handling
      mode: mode as "Mainnet" | "Devnet",
    });

    // Try to call a method that requires API key
    try {
      await testClient.getMessageToSign();
      return {
        canGetMessageToSign: true,
      };
    } catch (error: any) {
      // This is expected - SDK should fail without API key
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      const errorType = error?.name || "Error";
      
      console.log("[Encifher Test] Expected error when calling SDK without API key:", errorMessage);
      return {
        canGetMessageToSign: false,
        error: errorMessage,
        errorType,
      };
    }
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || "Unknown error";
    const errorType = error?.name || "Error";
    
    return {
      canGetMessageToSign: false,
      error: errorMessage,
      errorType,
    };
  }
}

/**
 * Run all SDK tests
 */
export async function runAllSDKTests(keypair?: Keypair): Promise<{
  importTest: boolean;
  initializationTest: { success: boolean; error?: string };
  methodsTest?: { methodsExist: boolean; availableMethods: string[]; missingMethods: string[] };
  errorHandlingTest?: { canGetMessageToSign: boolean; error?: string; errorType?: string };
}> {
  console.log("[Encifher Test] Running all SDK tests...");

  // Test 1: Import test
  const importTest = testSDKImport();

  // Test 2: Initialization test
  const initializationTest = testSDKInitialization();

  let methodsTest;
  let errorHandlingTest;

  // Test 3: Methods test (if initialization succeeded)
  if (initializationTest.success) {
    try {
      const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
      const testClient = new DefiClient({
        rpcUrl: RPC_URL,
        encifherKey: "test-key-for-methods-test",
        mode: mode as "Mainnet" | "Devnet",
      });
      methodsTest = testSDKMethods(testClient);
    } catch (error) {
      console.error("[Encifher Test] Failed to create client for methods test:", error);
    }
  }

  // Test 4: Error handling test (if keypair provided)
  if (keypair) {
    errorHandlingTest = await testSDKWithoutAPIKey(keypair);
  }

  console.log("[Encifher Test] All tests completed");

  return {
    importTest,
    initializationTest,
    methodsTest,
    errorHandlingTest,
  };
}

/**
 * Test helper to check if SDK is properly configured
 * Use this in development to verify setup
 */
export function checkSDKConfiguration(): {
  hasAPIKey: boolean;
  hasRPCUrl: boolean;
  mode: "Mainnet" | "Devnet" | "Unknown";
  recommendations: string[];
} {
  const apiKey = process.env.NEXT_PUBLIC_ENCIFHER_API_KEY || "";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "";
  const hasAPIKey = apiKey.trim() !== "";
  const hasRPCUrl = rpcUrl.trim() !== "";
  const mode = rpcUrl.includes("mainnet") ? "Mainnet" : "Unknown";

  const recommendations: string[] = [];

  if (!hasAPIKey) {
    recommendations.push("Set NEXT_PUBLIC_ENCIFHER_API_KEY in your .env file to use Encifher features");
  }

  if (!hasRPCUrl) {
    recommendations.push("Set NEXT_PUBLIC_RPC_URL in your .env file for better RPC performance");
  }

  if (mode === "Unknown") {
    recommendations.push("Set NEXT_PUBLIC_RPC_URL to a valid Solana RPC endpoint (mainnet)");
  }

  return {
    hasAPIKey,
    hasRPCUrl,
    mode,
    recommendations,
  };
}

