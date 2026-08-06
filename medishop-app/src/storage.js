import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { hashPin } from "./pin";

// Every function here now takes a shopId (the logged-in shop's tenant id
// from auth.js) and reads/writes only that shop's own data in Firestore.
// This file is still the one place the rest of the app talks to for data
// — the earlier AsyncStorage version and this Firestore version have the
// exact same function signatures, so App.js barely changed when this
// moved from on-device storage to a real shared backend.

export async function loadStock(shopId) {
  const ref = doc(db, "shops", shopId, "data", "stock");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().items : [];
}

export async function saveStock(shopId, stock) {
  const ref = doc(db, "shops", shopId, "data", "stock");
  await setDoc(ref, { items: stock });
}

export async function loadLog(shopId) {
  const ref = doc(db, "shops", shopId, "data", "salesLog");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().entries : [];
}

export async function saveLog(shopId, log) {
  const ref = doc(db, "shops", shopId, "data", "salesLog");
  await setDoc(ref, { entries: log });
}

// Bills the counter has submitted but the owner hasn't approved yet. Kept
// separate from salesLog so a pending bill never shows up in sales history
// (and stock is never deducted) until the owner explicitly approves it.
export async function loadPending(shopId) {
  const ref = doc(db, "shops", shopId, "data", "pendingSales");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().entries : [];
}

export async function savePending(shopId, pending) {
  const ref = doc(db, "shops", shopId, "data", "pendingSales");
  await setDoc(ref, { entries: pending });
}

// Shop-wide settings — currently just the Owner PIN (hashed), used to gate
// the Owner role behind something more than "pick Owner from a list" on a
// shared shop device. Kept as its own doc so it's cheap to read on every
// role-switch without pulling the whole stock/log/pending payloads.
export async function loadSettings(shopId) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { ownerPinHash: await hashPin("0000") };
}

export async function saveSettings(shopId, settings) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  await setDoc(ref, settings);
}
