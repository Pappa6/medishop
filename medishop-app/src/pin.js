import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import * as Crypto from "expo-crypto";

// Fix #1: PBKDF2 with a random salt instead of plain SHA-256.
// A 4-digit PIN has only 10,000 values — without a salt, all possible
// hashes can be precomputed in milliseconds (rainbow table). With a
// random 16-byte salt and 100,000 PBKDF2-SHA256 iterations, an offline
// attacker must run 100,000 hash operations per PIN guess and cannot
// reuse work across targets.
//
// Format of a new hash: "v2:<saltHex>:<derivedKeyHex>"
// Legacy format (no prefix): plain SHA-256, no salt — supported for
// reading only; the hash is upgraded to v2 on the next PIN change.

const ITERATIONS = 100_000;
const KEY_LEN = 32;

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin) {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const saltHex = bytesToHex(saltBytes);
  const derived = pbkdf2(sha256, pin, saltBytes, { c: ITERATIONS, dkLen: KEY_LEN });
  return `v2:${saltHex}:${bytesToHex(derived)}`;
}

// Fix #10 (partial): verifyPin is called by verifyOwnerPin in App.js,
// which fetches the hash fresh from Firestore each time — the raw hash
// is never stored in RoleSelectScreen's props or state.
export async function verifyPin(pin, stored) {
  if (!stored) return false;

  if (stored.startsWith("v2:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const [, saltHex, hashHex] = parts;
    const derived = pbkdf2(sha256, pin, hexToBytes(saltHex), { c: ITERATIONS, dkLen: KEY_LEN });
    return bytesToHex(derived) === hashHex;
  }

  // Legacy plain SHA-256 — only used until the owner next changes their PIN
  const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  return legacy === stored;
}
