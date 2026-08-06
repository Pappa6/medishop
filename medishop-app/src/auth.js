import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { DEFAULT_CATALOG } from "./catalog";
import { hashPin } from "./pin";

// The Firebase user's uid IS the shop's tenant id everywhere else in the
// app (storage.js). This is what makes one app build work for every shop:
// every read/write is scoped under shops/{uid}/... and Firebase's own
// auth rules keep one shop from ever reading another shop's data.

export async function signUpShop(shopName, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const shopId = cred.user.uid;

  await setDoc(doc(db, "shops", shopId), {
    name: shopName,
    createdAt: Date.now(),
  });
  // Seed this new shop with the starter catalog so it has something to
  // sell on day one. The shop owner can edit/replace this later from a
  // catalog-management screen (see README "Next steps").
  await setDoc(doc(db, "shops", shopId, "data", "stock"), {
    items: DEFAULT_CATALOG,
  });
  await setDoc(doc(db, "shops", shopId, "data", "salesLog"), {
    entries: [],
  });
  // Default PIN so the shop can log in as Owner on day one — the README
  // and the Owner Dashboard's "Change PIN" section both point out that
  // this should be changed before the shop actually opens. Stored as a
  // hash, never as plain text.
  await setDoc(doc(db, "shops", shopId, "data", "settings"), {
    ownerPinHash: await hashPin("0000"),
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
  // callback receives either null (logged out) or { shopId, shopName }
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
