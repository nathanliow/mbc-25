/**
 * Base-Solana Bridge SDK Integration
 * Based on: https://github.com/base/bridge/tree/main/scripts/src/commands/sol/bridge/solana-to-base
 */

import {
  address,
  getProgramDerivedAddress,
  createSolanaRpc,
  type Address,
  type TransactionSigner,
  type Instruction,
} from "@solana/kit";

// Re-export from the Base Bridge SDK
export { Bridge, BaseRelayer } from "@/base-ts";
import { Bridge, BaseRelayer } from "@/base-ts";

// System program address
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

// Program addresses from Base - MAINNET
export const BRIDGE_PROGRAM_ADDRESS = "HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM" as Address;
export const BASE_RELAYER_PROGRAM_ADDRESS = "g1et5VenhfJHJwsdJsDbxWZuotD5H4iELNG61kS4fb9" as Address;

// IDL Constants - these match the Anchor program's seeds
const BRIDGE_SEED = "bridge";
const SOL_VAULT_SEED = "sol_vault";
const CFG_SEED = "cfg";
const MESSAGE_TO_RELAY_SEED = "message_to_relay";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Convert hex string to bytes (replacement for viem's toBytes)
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive the Bridge PDA - matches Base repo implementation
 * seeds: [BRIDGE_SEED]
 */
export async function deriveBridgePDA(
  programAddress: Address = BRIDGE_PROGRAM_ADDRESS
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(BRIDGE_SEED)],
  });
  return pda;
}

/**
 * Derive the SOL Vault PDA - matches Base repo's solVaultPubkey
 * seeds: [SOL_VAULT_SEED]
 */
export async function deriveSolVaultPDA(
  programAddress: Address = BRIDGE_PROGRAM_ADDRESS
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(SOL_VAULT_SEED)],
  });
  return pda;
}

/**
 * Generate outgoing message PDA with a random salt
 * This matches the Base repo's outgoingMessagePubkey function
 * Returns both the salt and the derived pubkey
 */
export async function deriveOutgoingMessagePDA(
  programAddress: Address = BRIDGE_PROGRAM_ADDRESS
): Promise<{ salt: Uint8Array; pubkey: Address }> {
  // Generate random 32-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(32));
  
  const [pubkey] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from("outgoing_message"), salt],
  });
  
  return { salt, pubkey };
}

/**
 * Derive the Relayer Config PDA
 * seeds: [CFG_SEED]
 */
export async function deriveRelayerCfgPDA(
  programAddress: Address = BASE_RELAYER_PROGRAM_ADDRESS
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(CFG_SEED)],
  });
  return pda;
}

/**
 * Derive the Message To Relay PDA
 * This matches the Base repo's implementation
 */
export async function deriveMessageToRelayPDA(
  outgoingMessage: Address,
  salt: Uint8Array,
  programAddress: Address = BASE_RELAYER_PROGRAM_ADDRESS
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(MESSAGE_TO_RELAY_SEED), Buffer.from(outgoingMessage), salt],
  });
  return pda;
}

/**
 * Fetch the Bridge account data
 */
export async function fetchBridgeData(bridgeAddress?: Address) {
  const rpc = createSolanaRpc(RPC_URL);
  const bridgePDA = bridgeAddress || await deriveBridgePDA();
  
  try {
    const bridgeAccount = await Bridge.fetchBridge(rpc, bridgePDA);
    return bridgeAccount;
  } catch (error) {
    console.error("Failed to fetch bridge account:", error);
    throw new Error(`Failed to fetch bridge account at ${bridgePDA}: ${error}`);
  }
}

/**
 * Build the Pay For Relay instruction
 * Based on Base repo's buildPayForRelayInstruction
 */
export async function buildPayForRelayInstruction(
  outgoingMessage: Address,
  payer: TransactionSigner,
  programAddress: Address = BASE_RELAYER_PROGRAM_ADDRESS
): Promise<Instruction> {
  const rpc = createSolanaRpc(RPC_URL);
  
  // Derive relayer config PDA
  const cfgAddress = await deriveRelayerCfgPDA(programAddress);
  
  // Fetch relayer config to get gas fee receiver
  const cfg = await BaseRelayer.fetchCfg(rpc, cfgAddress);
  
  // Generate salt for message to relay
  const mtrSalt = crypto.getRandomValues(new Uint8Array(32));
  
  // Derive message to relay PDA
  const [messageToRelay] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(MESSAGE_TO_RELAY_SEED), Buffer.from(outgoingMessage), mtrSalt],
  });
  
  return BaseRelayer.getPayForRelayInstruction(
    {
      payer,
      cfg: cfgAddress,
      gasFeeReceiver: cfg.data.gasConfig.gasFeeReceiver,
      messageToRelay,
      mtrSalt,
      outgoingMessage,
      gasLimit: BigInt(200000), // Default gas limit
    },
    { programAddress }
  );
}

/**
 * Build bridge SOL instructions - matches Base repo's bridge-sol.handler.ts
 */
export async function buildBridgeSolInstructions(params: {
  payer: TransactionSigner;
  to: string; // Base address (0x...)
  amount: number; // Amount in SOL
  payForRelay?: boolean;
}): Promise<Instruction[]> {
  const { payer, to, amount, payForRelay = false } = params; // Default to false - relay may not be available
  
  console.log("=== Building Bridge SOL Instructions ===");
  console.log("Bridge Program:", BRIDGE_PROGRAM_ADDRESS);
  console.log("Payer:", payer.address);
  console.log("To (Base address):", to);
  console.log("Amount:", amount, "SOL");
  
  // Derive bridge PDA
  const bridgeAccountAddress = await deriveBridgePDA();
  console.log("Bridge PDA:", bridgeAccountAddress);
  
  // Fetch bridge state
  const rpc = createSolanaRpc(RPC_URL);
  
  let bridge;
  try {
    bridge = await Bridge.fetchBridge(rpc, bridgeAccountAddress);
    console.log("Bridge account fetched successfully");
    console.log("Bridge paused:", bridge.data.paused);
    console.log("Bridge nonce:", bridge.data.nonce.toString());
    console.log("Gas fee receiver:", bridge.data.gasConfig.gasFeeReceiver);
  } catch (fetchError) {
    console.error("Failed to fetch bridge account:", fetchError);
    throw new Error(`Bridge account not found at ${bridgeAccountAddress}. The Base-Solana bridge may not be deployed on mainnet yet.`);
  }
  
  // Check if bridge is paused
  if (bridge.data.paused) {
    throw new Error("Bridge is currently paused. Please try again later.");
  }
  
  // Derive sol vault PDA
  const solVaultAddress = await deriveSolVaultPDA();
  console.log("Sol Vault PDA:", solVaultAddress);
  
  // Verify sol vault exists by checking account info
  try {
    const solVaultInfo = await rpc.getAccountInfo(solVaultAddress, { encoding: "base64" }).send();
    if (!solVaultInfo.value) {
      console.warn("Sol Vault account may not exist yet");
    } else {
      console.log("Sol Vault owner:", solVaultInfo.value.owner);
      console.log("Sol Vault lamports:", solVaultInfo.value.lamports.toString());
    }
  } catch (e) {
    console.warn("Could not fetch sol vault info:", e);
  }
  
  // Calculate scaled amount (amount * 10^9 for SOL decimals)
  const scaledAmount = BigInt(Math.floor(amount * Math.pow(10, 9)));
  console.log("Scaled amount:", scaledAmount.toString(), "lamports");
  
  // Generate outgoing message PDA with random salt
  const { salt, pubkey: outgoingMessage } = await deriveOutgoingMessagePDA();
  console.log("Outgoing message PDA:", outgoingMessage);
  console.log("Salt:", Buffer.from(salt).toString("hex"));
  
  // Convert the 'to' address to bytes
  const toBytes = hexToBytes(to);
  console.log("To bytes length:", toBytes.length);
  
  console.log("=== All accounts for bridge instruction ===");
  console.log("payer:", payer.address);
  console.log("from:", payer.address);
  console.log("gasFeeReceiver:", bridge.data.gasConfig.gasFeeReceiver);
  console.log("solVault:", solVaultAddress);
  console.log("bridge:", bridgeAccountAddress);
  console.log("outgoingMessage:", outgoingMessage);
  console.log("systemProgram:", SYSTEM_PROGRAM_ADDRESS);
  
  console.log("=== Building bridge instruction ===");
  const bridgeIx = Bridge.getBridgeSolInstruction(
    {
      // Accounts
      payer,
      from: payer,
      gasFeeReceiver: bridge.data.gasConfig.gasFeeReceiver,
      solVault: solVaultAddress,
      bridge: bridgeAccountAddress,
      outgoingMessage,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      // Arguments
      outgoingMessageSalt: salt,
      to: toBytes,
      amount: scaledAmount,
      call: null,
    },
    { programAddress: BRIDGE_PROGRAM_ADDRESS }
  );
  console.log("Bridge instruction built successfully");
  console.log("Instruction program:", bridgeIx.programAddress);
  console.log("Instruction accounts:", bridgeIx.accounts.length);
  
  const ixs: Instruction[] = [bridgeIx];
  
  if (payForRelay) {
    try {
      const relayIx = await buildPayForRelayInstruction(
        outgoingMessage,
        payer
      );
      ixs.push(relayIx);
      console.log("Relay instruction added");
    } catch (relayError) {
      console.warn("Failed to build relay instruction, proceeding without relay:", relayError);
      // Continue without relay - user will need to relay manually or wait for validators
    }
  }
  
  return ixs;
}

/**
 * Convert Base address (0x...) to 20-byte Uint8Array for the SDK
 */
export function baseAddressToBytes(baseAddress: string): Uint8Array {
  return hexToBytes(baseAddress);
}

/**
 * Generate a random 32-byte salt for outgoing messages
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Get estimated bridge fee
 */
export function getEstimatedBridgeFee(): number {
  return 0.001; // ~0.001 SOL for relay gas
}
