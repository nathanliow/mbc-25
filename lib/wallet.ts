import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const SOLANA_DERIVATION_PATH = "m/44'/501'";

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39.generateMnemonic(strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  return new Uint8Array(seed);
}

export function deriveKeypairFromSeed(
  seed: Uint8Array,
  accountIndex: number = 0,
  changeIndex: number = 0
): Keypair {
  const path = `${SOLANA_DERIVATION_PATH}/${accountIndex}'/${changeIndex}'`;
  const derived = derivePath(path, Buffer.from(seed).toString("hex"));
  return Keypair.fromSeed(derived.key);
}

export function deriveMultipleKeypairs(
  seed: Uint8Array,
  count: number = 5
): Keypair[] {
  const keypairs: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    keypairs.push(deriveKeypairFromSeed(seed, i, 0));
  }
  return keypairs;
}

export function keypairToBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

export function base58ToKeypair(base58SecretKey: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(base58SecretKey));
}

export function publicKeyToString(publicKey: PublicKey): string {
  return publicKey.toBase58();
}

export function stringToPublicKey(address: string): PublicKey {
  return new PublicKey(address);
}

export function truncateAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export interface DerivedWallet {
  keypair: Keypair;
  publicKey: string;
  index: number;
  path: string;
}

export function deriveWalletsFromSeed(
  seed: Uint8Array,
  count: number = 5
): DerivedWallet[] {
  const wallets: DerivedWallet[] = [];
  for (let i = 0; i < count; i++) {
    const path = `${SOLANA_DERIVATION_PATH}/${i}'/0'`;
    const keypair = deriveKeypairFromSeed(seed, i, 0);
    wallets.push({
      keypair,
      publicKey: publicKeyToString(keypair.publicKey),
      index: i,
      path,
    });
  }
  return wallets;
}

export function deriveStealthAddress(
  seed: Uint8Array,
  stealthIndex: number
): DerivedWallet {
  const path = `${SOLANA_DERIVATION_PATH}/stealth/${stealthIndex}'/0'`;
  const derived = derivePath(
    `${SOLANA_DERIVATION_PATH}/${1000 + stealthIndex}'/0'`,
    Buffer.from(seed).toString("hex")
  );
  const keypair = Keypair.fromSeed(derived.key);
  return {
    keypair,
    publicKey: publicKeyToString(keypair.publicKey),
    index: stealthIndex,
    path,
  };
}

