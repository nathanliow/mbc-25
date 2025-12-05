/**
 * Browser Crypto Adapter for Encifher Swap SDK
 * 
 * Replaces Node.js crypto module with crypto-js (sync) and Web Crypto API (async fallback)
 */

// Use crypto-js for synchronous operations (already in encifher-swap-sdk dependencies)
let CryptoJS;
try {
  // Try to load crypto-js (should be available via encifher-swap-sdk)
  CryptoJS = require('crypto-js');
} catch (e) {
  // Fallback if not available
  CryptoJS = null;
}

// Browser-compatible crypto adapter
const browserCrypto = {
  /**
   * Create a hash (replaces crypto.createHash)
   * @param {string} algorithm - Hash algorithm (e.g., 'sha256')
   * @returns {Object} Hash object with update() and digest() methods
   */
  createHash(algorithm) {
    const normalizedAlgo = algorithm.toLowerCase().replace('-', '');
    const webCryptoAlgo = normalizedAlgo === 'sha256' ? 'SHA-256' : normalizedAlgo.toUpperCase();

    let data = new Uint8Array(0);

    return {
      update(buffer) {
        // Accumulate data
        const bufferArray = buffer instanceof Uint8Array 
          ? buffer 
          : Buffer.isBuffer(buffer) 
            ? new Uint8Array(buffer)
            : new Uint8Array(buffer);
        
        const newData = new Uint8Array(data.length + bufferArray.length);
        newData.set(data);
        newData.set(bufferArray, data.length);
        data = newData;
        return this;
      },

      digest(encoding) {
        // Use crypto-js for synchronous hashing (maintains SDK compatibility)
        if (CryptoJS) {
          const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(data));
          
          if (encoding === 'hex') {
            return hash.toString(CryptoJS.enc.Hex);
          }
          
          // Convert to Uint8Array (Buffer-like)
          const words = hash.words;
          const sigBytes = hash.sigBytes;
          const result = new Uint8Array(sigBytes);
          
          for (let i = 0; i < sigBytes; i++) {
            const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            result[i] = byte;
          }
          
          return result;
        }
        
        // Fallback: throw error if crypto-js not available
        throw new Error('crypto-js is required for browser crypto operations. Make sure encifher-swap-sdk is installed.');
      }
    };
  },

  /**
   * Generate random bytes (replaces crypto.randomBytes)
   * @param {number} size - Number of bytes to generate
   * @returns {Uint8Array} Random bytes
   */
  randomBytes(size) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  },

  /**
   * Create cipher (replaces crypto.createCipheriv)
   * @param {string} algorithm - Cipher algorithm (e.g., 'aes-256-cbc')
   * @param {Uint8Array} key - Encryption key
   * @param {Uint8Array} iv - Initialization vector
   * @returns {Object} Cipher object
   */
  createCipheriv(algorithm, key, iv) {
    // Parse algorithm (e.g., 'aes-256-cbc' -> { name: 'AES-CBC', length: 256 })
    const parts = algorithm.toLowerCase().split('-');
    const cipherName = parts[0].toUpperCase() + '-' + parts[2].toUpperCase(); // aes-256-cbc -> AES-CBC
    const keyLength = parseInt(parts[1]) || 256;

    let accumulatedData = new Uint8Array(0);

    return {
      update(data) {
        // Accumulate data for encryption
        const newData = new Uint8Array(accumulatedData.length + data.length);
        newData.set(accumulatedData);
        newData.set(data instanceof Uint8Array ? data : new Uint8Array(data), accumulatedData.length);
        accumulatedData = newData;
        return this;
      },

      final() {
        // Use crypto-js for synchronous encryption (maintains SDK compatibility)
        if (CryptoJS) {
          const keyWordArray = CryptoJS.lib.WordArray.create(key);
          const ivWordArray = CryptoJS.lib.WordArray.create(iv);
          const dataWordArray = CryptoJS.lib.WordArray.create(accumulatedData);
          
          const encrypted = CryptoJS.AES.encrypt(dataWordArray, keyWordArray, {
            iv: ivWordArray,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          
          // Convert to Uint8Array
          const ciphertext = encrypted.ciphertext;
          const result = new Uint8Array(ciphertext.sigBytes);
          const words = ciphertext.words;
          
          for (let i = 0; i < ciphertext.sigBytes; i++) {
            const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            result[i] = byte;
          }
          
          return result;
        }
        
        // Fallback: throw error if crypto-js not available
        throw new Error('crypto-js is required for browser crypto operations. Make sure encifher-swap-sdk is installed.');
      }
    };
  },

  /**
   * Create decipher (replaces crypto.createDecipheriv)
   */
  createDecipheriv(algorithm, key, iv) {
    const parts = algorithm.toLowerCase().split('-');
    const cipherName = parts[0].toUpperCase() + '-' + parts[2].toUpperCase();
    const keyLength = parseInt(parts[1]) || 256;

    let accumulatedData = new Uint8Array(0);

    return {
      update(data) {
        const newData = new Uint8Array(accumulatedData.length + data.length);
        newData.set(accumulatedData);
        newData.set(data instanceof Uint8Array ? data : new Uint8Array(data), accumulatedData.length);
        accumulatedData = newData;
        return this;
      },

      async final() {
        const key = await crypto.subtle.importKey(
          'raw',
          key,
          { name: cipherName, length: keyLength },
          false,
          ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: cipherName, iv: iv },
          key,
          accumulatedData
        );

        return new Uint8Array(decrypted);
      }
    };
  }
};

// Export as CommonJS to match Node.js crypto module
module.exports = browserCrypto;

