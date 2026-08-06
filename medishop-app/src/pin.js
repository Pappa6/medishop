import * as Crypto from "expo-crypto";

// The owner PIN gates edit/void/approve power on a shared shop device, so
// it shouldn't sit in Firestore as plain text where anyone with console
// access (or a phone screenshot of a debug log) could read it. This just
// SHA-256 hashes it — good enough to stop casual exposure, though it's
// still a 4-digit PIN so it's not meant to resist a serious attacker with
// direct database access. Real per-staff accounts (see README) would be
// the next step up in security.
export async function hashPin(pin) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}
