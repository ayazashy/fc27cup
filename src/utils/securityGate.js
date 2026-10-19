/**
 * Security Gate & Cryptographic Decryption Engine
 * Implements Web Crypto API AES-256-GCM + PBKDF2 decryption for /KSUHTSTAFF
 */

// Cryptographic parameters and AES-256-GCM encrypted payload
export const ENCRYPTED_SALT_B64 = "NXuXOAFaS4v8RooUvP6q0w==";
export const ENCRYPTED_IV_B64 = "WFzEfedLhhf35Yu7";
export const ENCRYPTED_COMBINED_B64 = "LFF6Sahb8QEzHxw3WAjJJ/GEAlTL9+7lCABZs78p475z3mqK2cYoAW3i4U1cewXPs8AcbbGeIGJy/8f1qJOkxchd4IMzJuUPrsNNq7b1iX+IvWIkyPMFwrDyGKELZI28YnfpV4YGwQB3mjv47Gu9IpX9R2KvVm0jCU0ip/fN7xlwmHfA0pxd6Dls4e9+tlfYWIvI4xFH6s/oixWv/DzWD2WTUu8e7uALpfrzuP1a6sw=";

export const ADMIN_STORAGE_KEY = "ksu_staff_admin_key_v1";
export const ADMIN_ROUTE_PATH = "/KSUHTSTAFF";

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Attempt to decrypt the verification payload using the user-provided password/key
 * Returns decrypted payload if key is correct, or null if key is wrong
 */
export async function verifyAndDecodeKey(inputKey) {
  if (!inputKey || typeof inputKey !== 'string') {
    return { success: false, error: 'missing_key' };
  }

  const trimmed = inputKey.trim();
  if (!trimmed) {
    return { success: false, error: 'empty_key' };
  }

  try {
    const salt = base64ToUint8Array(ENCRYPTED_SALT_B64);
    const iv = base64ToUint8Array(ENCRYPTED_IV_B64);
    const combinedCipher = base64ToUint8Array(ENCRYPTED_COMBINED_B64);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(trimmed),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      derivedKey,
      combinedCipher
    );

    const dec = new TextDecoder();
    const decodedText = dec.decode(decryptedBuffer);
    const payload = JSON.parse(decodedText);

    if (payload && payload.authenticated && payload.secretCode) {
      return { success: true, payload };
    }
    return { success: false, error: 'invalid_payload' };
  } catch (error) {
    // Decryption failed: wrong key or corrupted ciphertext
    return { success: false, error: 'invalid_key' };
  }
}

export function getStoredAdminKey() {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}

export function storeAdminKey(key) {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, key);
  } catch (e) {}
}

export function clearAdminKey() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Check if current window location represents the /KSUHTSTAFF admin route
 */
export function isKsuStaffRoute() {
  try {
    const p = window.location.pathname.toUpperCase();
    const s = window.location.search.toUpperCase();
    const h = window.location.hash.toUpperCase();
    return p.includes('KSUHTSTAFF') || s.includes('KSUHTSTAFF') || h.includes('KSUHTSTAFF');
  } catch (e) {
    return false;
  }
}
