import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

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

export async function loadPending(shopId) {
  const ref = doc(db, "shops", shopId, "data", "pendingSales");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().entries : [];
}

export async function savePending(shopId, pending) {
  const ref = doc(db, "shops", shopId, "data", "pendingSales");
  await setDoc(ref, { entries: pending });
}

export async function loadSettings(shopId) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  // Fix #13: Do NOT silently fall back to "0000" if the settings doc is
  // missing — that would grant owner access via the default PIN to anyone
  // who deletes or corrupts the document. Return null so the caller can
  // refuse to grant access and show an error instead.
  return { ownerPinHash: null, pinChangeRequired: false };
}

export async function saveSettings(shopId, settings) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  await setDoc(ref, settings);
}
