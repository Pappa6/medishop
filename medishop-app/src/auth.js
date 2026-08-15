import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { DEFAULT_CATALOG } from "./catalog";
import { hashPin } from "./pin";

export async function signUpShop(shopName, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const shopId = cred.user.uid;

  await setDoc(doc(db, "shops", shopId), {
    name: shopName,
    createdAt: Date.now(),
  });
  // Write each medicine as its own document in the stock subcollection.
  // salesLog and pendingSales subcollections start empty — Firestore creates
  // them lazily on first write, so no placeholder docs needed.
  const stockBatch = writeBatch(db);
  DEFAULT_CATALOG.forEach((m) => {
    const { id, ...data } = m;
    stockBatch.set(doc(db, "shops", shopId, "stock", id), data);
  });
  await stockBatch.commit();
  // Fix #3: pinChangeRequired forces the owner to set a real PIN before
  // they can use the dashboard. The default "0000" is only ever stored as
  // a PBKDF2 hash (fix #1), but any default PIN is a risk if forgotten to
  // change, so we block access to the owner role until it is replaced.
  await setDoc(doc(db, "shops", shopId, "data", "settings"), {
    ownerPinHash: await hashPin("0000"),
    pinChangeRequired: true,
  });

  return shopId;
}

export async function logInShop(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

export function logOutShop() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    const shopDoc = await getDoc(doc(db, "shops", user.uid));
    callback({
      shopId: user.uid,
      shopName: shopDoc.exists() ? shopDoc.data().name : "Your shop",
    });
  });
}
