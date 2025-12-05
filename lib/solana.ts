import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction,
  SendTransactionError,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  const conn = getConnection();
  try {
    const lamports = await conn.getBalance(publicKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch (e) {
    console.error(
      "[Solana] Failed to get balance for",
      publicKey.toBase58(),
      ":",
      e
    );
    return 0;
  }
}

export async function getBalanceLamports(publicKey: PublicKey): Promise<number> {
  const conn = getConnection();
  try {
    return await conn.getBalance(publicKey);
  } catch (e) {
    console.error(
      "[Solana] Failed to get balance (lamports) for",
      publicKey.toBase58(),
      ":",
      e
    );
    return 0;
  }
}

export async function sendSol(
  fromKeypair: Keypair,
  toAddress: string,
  amountSol: number
): Promise<string> {
  const conn = getConnection();
  const toPubkey = new PublicKey(toAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports: amountSol * LAMPORTS_PER_SOL,
    })
  );

  try {
    const signature = await sendAndConfirmTransaction(conn, transaction, [
      fromKeypair,
    ]);
    return signature;
  } catch (e: any) {
    if (e instanceof SendTransactionError) {
      try {
        const logs = await e.getLogs(conn);
        console.error("[Solana] sendSol transaction logs:", logs);
        throw new Error(
          logs && logs.length
            ? `Send SOL failed:\n${logs.join("\n")}`
            : e.message
        );
      } catch {
        throw new Error(e.message ?? "Failed to send SOL");
      }
    }
    throw e;
  }
}

export async function sendSplToken(
  fromKeypair: Keypair,
  mintAddress: string,
  toAddress: string,
  amountTokens: number,
  decimals: number
): Promise<string> {
  const conn = getConnection();
  const mintPubkey = new PublicKey(mintAddress);
  const toPubkey = new PublicKey(toAddress);

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    conn,
    fromKeypair,
    mintPubkey,
    fromKeypair.publicKey
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    conn,
    fromKeypair,
    mintPubkey,
    toPubkey
  );

  const amountRaw = BigInt(
    Math.floor(amountTokens * Math.pow(10, decimals || 0))
  );

  const transaction = new Transaction().add(
    createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      fromKeypair.publicKey,
      amountRaw
    )
  );

  try {
    const signature = await sendAndConfirmTransaction(conn, transaction, [
      fromKeypair,
    ]);
    return signature;
  } catch (e: any) {
    if (e instanceof SendTransactionError) {
      try {
        const logs = await e.getLogs(conn);
        console.error("[Solana] sendSplToken transaction logs:", logs);
        throw new Error(
          logs && logs.length
            ? `Send token failed:\n${logs.join("\n")}`
            : e.message
        );
      } catch {
        throw new Error(e.message ?? "Failed to send token");
      }
    }
    throw e;
  }
}
export async function signAndSendTransaction(
  keypair: Keypair,
  instructions: TransactionInstruction[]
): Promise<string> {
  const conn = getConnection();

  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([keypair]);

  const signature = await conn.sendTransaction(transaction);

  await conn.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature,
  });

  return signature;
}

export async function requestAirdrop(
  publicKey: PublicKey,
  amountSol: number = 1
): Promise<string> {
  const conn = getConnection();
  const signature = await conn.requestAirdrop(
    publicKey,
    amountSol * LAMPORTS_PER_SOL
  );
  await conn.confirmTransaction(signature);
  return signature;
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}

export async function getRecentTransactions(
  publicKey: PublicKey,
  limit: number = 10
) {
  const conn = getConnection();
  const signatures = await conn.getSignaturesForAddress(publicKey, { limit });
  return signatures;
}

