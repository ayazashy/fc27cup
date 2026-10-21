/**
 * Security Gate & Cryptographic Decryption Engine
 * Implements Web Crypto API AES-256-GCM + PBKDF2 decryption for /KSUHTSTAFF
 */

// Cryptographic parameters and AES-256-GCM encrypted payload
export const ENCRYPTED_SALT_B64 = "NXuXOAFaS4v8RooUvP6q0w==";
export const ENCRYPTED_IV_B64 = "WFzEfedLhhf35Yu7";
export const ENCRYPTED_COMBINED_B64 = "LFF6Sahb8QEzHxw3WAjJJ/GEAlTL9+7lCABZs78p475z3mqK2cYoAW3i4U1cewXPs8AcbbGeIGJy/8f1qJOkxchd4IMzJuUPrsNNq7b1iX+IvWIkyPMFwrDyGKELZI28YnfpV4YGwQB3mjv47Gu9IpX9R2KvVm0jCU0ip/fN7xlwmHfA0pxd6Dls4e9+tlfYWIvI4xFH6s/oixWv/DzWD2WTUu8e7uALpfrzuP1a6sw=";

export const ADMIN_STORAGE_KEY = "ksu_staff_admin_key_v1";
export const ADMIN_ROLE_KEY = "ksu_staff_admin_role_v1";
export const ADMIN_ROUTE_PATH = "/KSUHTSTAFF";

// Salt for coordinator passcode verification
export const COORD_SALT_PREFIX = "ksu_fc27_coord_salt_v1:";

// Salted SHA-256 hash of coordinator passcode (One-way hash - raw key is never stored)
export const DEFAULT_COORDINATOR_HASH = "e60d420bdb50f4a29ee9489a96a3aa94bfa4b37c0c52a822564abb3a2213564b";

export const DEFAULT_MASTER_PINS = ["KSUADMIN", "ADMIN2027", "KSUHTSTAFF", "KSU2027ADMIN"];

/**
 * Computes salted SHA-256 hash using Web Crypto API
 */
export async function computeCoordHash(pin) {
  if (!pin) return '';
  const enc = new TextEncoder();
  const data = enc.encode(COORD_SALT_PREFIX + String(pin).trim());
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
 * Supports two distinct roles:
 * 1. 'coordinator' (منظم الصالة): Access limited to Matches, Knockout, and Stats. Header is removed.
 * 2. 'master_admin' (المدير العام): Full administrative access.
 */
export async function verifyAndDecodeKey(inputKey, config = null) {
  if (!inputKey || typeof inputKey !== 'string') {
    return { success: false, error: 'missing_key' };
  }

  const trimmed = inputKey.trim();
  if (!trimmed) {
    return { success: false, error: 'empty_key' };
  }

  // Explicitly disallow the old deprecated passcode 2027
  if (trimmed === '2027') {
    return { success: false, error: 'invalid_key' };
  }

  // 1. Check Coordinator via Salted SHA-256 Hash (Zero plain-text in codebase)
  try {
    const inputHash = await computeCoordHash(trimmed);
    const configuredHash = config?.coordinatorPinHash || DEFAULT_COORDINATOR_HASH;
    const isCoord = (inputHash === DEFAULT_COORDINATOR_HASH) || (inputHash === configuredHash);

    if (isCoord) {
      return {
        success: true,
        role: 'coordinator',
        payload: {
          authenticated: true,
          role: 'coordinator',
          title: 'منظم الصالة 🎮',
          secretCode: 'COORDINATOR_' + inputHash.slice(0, 8)
        }
      };
    }
  } catch (e) {
    console.warn('Coordinator hash verification error:', e);
  }

  // 2. Check Master Admin Fallback PINs
  const configuredMasterPin = config?.adminPin ? String(config.adminPin).trim() : null;
  if ((configuredMasterPin && trimmed === configuredMasterPin) || DEFAULT_MASTER_PINS.includes(trimmed.toUpperCase())) {
    return {
      success: true,
      role: 'master_admin',
      payload: {
        authenticated: true,
        role: 'master_admin',
        title: 'المدير العام 🛡️',
        secretCode: 'MASTER_ADMIN'
      }
    };
  }

  // 3. Attempt AES-256-GCM Web Crypto Decryption
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
      return { success: true, role: 'master_admin', payload: { ...payload, role: 'master_admin' } };
    }
    return { success: false, error: 'invalid_payload' };
  } catch (error) {
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

export function getStoredAdminRole() {
  try {
    return localStorage.getItem(ADMIN_ROLE_KEY) || 'master_admin';
  } catch (e) {
    return 'master_admin';
  }
}

export function storeAdminRole(role) {
  try {
    localStorage.setItem(ADMIN_ROLE_KEY, role);
  } catch (e) {}
}

export function clearAdminRole() {
  try {
    localStorage.removeItem(ADMIN_ROLE_KEY);
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

/**
 * Safely compute the Admin URL without stripping repository prefix on GitHub Pages
 */
export function getAdminNavigationUrl() {
  if (typeof window === 'undefined') return '?KSUHTSTAFF';
  const isGH = window.location.hostname.includes('github.io');
  let pathname = window.location.pathname;
  if (isGH) {
    pathname = '/fc27cup/';
  } else {
    pathname = pathname.replace(/\/KSUHTSTAFF\/?$/i, '') || '/';
    if (!pathname.endsWith('/')) pathname += '/';
  }
  return `${pathname}?KSUHTSTAFF`;
}

/**
 * Safely compute the Public URL without stripping repository prefix on GitHub Pages
 */
export function getPublicNavigationUrl() {
  if (typeof window === 'undefined') return '/';
  const isGH = window.location.hostname.includes('github.io');
  let pathname = window.location.pathname;
  if (isGH) {
    return '/fc27cup/';
  } else {
    pathname = pathname.replace(/\/KSUHTSTAFF\/?$/i, '') || '/';
    if (!pathname.endsWith('/')) pathname += '/';
    return pathname;
  }
}
