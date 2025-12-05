import { SOL_MINT, USDC_MINT, USDT_MINT } from "./const";

const PRIVATE_TOKEN_CONFIG_KEY = "encifher_private_token_config";

export interface PrivateTokenConfig {
  mints: string[];
  decimals: Record<string, number>;
}

const DEFAULT_MINTS = [
  SOL_MINT, // SOL
  USDC_MINT, // USDC
  USDT_MINT, // USDT
];

const DEFAULT_DECIMALS: Record<string, number> = {
  SOL_MINT: 9, // SOL
  USDC_MINT: 6, // USDC
  USDT_MINT: 6, // USDT
};

/**
 * Get the private token config from localStorage
 */
export function getPrivateTokenConfig(): PrivateTokenConfig {
  if (typeof window === "undefined") {
    return {
      mints: DEFAULT_MINTS,
      decimals: DEFAULT_DECIMALS,
    };
  }

  try {
    const stored = localStorage.getItem(PRIVATE_TOKEN_CONFIG_KEY);
    if (!stored) {
      // Initialize with defaults
      const defaultConfig: PrivateTokenConfig = {
        mints: DEFAULT_MINTS,
        decimals: DEFAULT_DECIMALS,
      };
      setPrivateTokenConfig(defaultConfig);
      return defaultConfig;
    }

    const parsed = JSON.parse(stored) as PrivateTokenConfig;
    // Ensure defaults are included
    const mints = new Set(parsed.mints || []);
    DEFAULT_MINTS.forEach((mint) => mints.add(mint));
    
    const decimals = { ...DEFAULT_DECIMALS, ...(parsed.decimals || {}) };
    
    return {
      mints: Array.from(mints),
      decimals,
    };
  } catch (error) {
    console.error("[PrivateTokenConfig] Failed to load config:", error);
    return {
      mints: DEFAULT_MINTS,
      decimals: DEFAULT_DECIMALS,
    };
  }
}

/**
 * Save the private token config to localStorage
 */
export function setPrivateTokenConfig(config: PrivateTokenConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PRIVATE_TOKEN_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("[PrivateTokenConfig] Failed to save config:", error);
  }
}

/**
 * Add a token mint to the private token config
 */
export function addPrivateToken(mint: string, decimals: number): void {
  const config = getPrivateTokenConfig();
  
  if (!config.mints.includes(mint)) {
    config.mints.push(mint);
  }
  
  config.decimals[mint] = decimals;
  
  setPrivateTokenConfig(config);
  console.log(`[PrivateTokenConfig] Added token ${mint} with ${decimals} decimals`);
}

/**
 * Get all token mints from the config
 */
export function getPrivateTokenMints(): string[] {
  return getPrivateTokenConfig().mints;
}

/**
 * Get decimals for a specific mint
 */
export function getPrivateTokenDecimals(mint: string): number {
  const config = getPrivateTokenConfig();
  return config.decimals[mint] ?? 9; // Default to 9 if not found
}

