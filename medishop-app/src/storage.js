import {
  collection, doc,
  onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch,
  runTransaction, getDoc, getDocs,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ---------------------------------------------------------------------------
// Stock  —  shops/{shopId}/stock/{medicineId}
// Each medicine is its own document; document id == medicine UUID.
// ---------------------------------------------------------------------------

export function watchStock(shopId, callback) {
  const ref = collection(db, "shops", shopId, "stock");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => console.error("[watchStock]", err));
}

// Add or update a single medicine document.
export async function saveMedicine(shopId, medicine) {
  const { id, ...data } = medicine;
  await setDoc(doc(db, "shops", shopId, "stock", id), data);
}

// Deletes every document in the stock subcollection — used when a real shop
// wants to start from an empty inventory instead of the demo catalog. Does
// not touch salesLog, pendingSales, or settings — only stock.
export async function clearAllStock(shopId) {
  const ref = collection(db, "shops", shopId, "stock");
  const snap = await getDocs(ref);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// Replace the entire stock with a new list (owner "load default catalog").
// Uses a batch so all writes land together; safe up to ~500 medicines.
export async function replaceAllStock(shopId, medicines) {
  const batch = writeBatch(db);
  medicines.forEach((m) => {
    const { id, ...data } = m;
    batch.set(doc(db, "shops", shopId, "stock", id), data);
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Sales log  —  shops/{shopId}/salesLog/{entryId}
// ---------------------------------------------------------------------------

export function watchLog(shopId, callback) {
  const ref = collection(db, "shops", shopId, "salesLog");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => console.error("[watchLog]", err));
}

// ---------------------------------------------------------------------------
// Pending sales  —  shops/{shopId}/pendingSales/{entryId}
// ---------------------------------------------------------------------------

export function watchPending(shopId, callback) {
  const ref = collection(db, "shops", shopId, "pendingSales");
  return onSnapshot(ref, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(docs);
  }, (err) => console.error("[watchPending]", err));
}

// Write a single pending entry (counter submits a bill).
export async function addPendingEntry(shopId, entry) {
  const { id, ...data } = entry;
  await setDoc(doc(db, "shops", shopId, "pendingSales", id), data);
}

// ---------------------------------------------------------------------------
// Atomic approve-sale transaction
//
// Runs stock decrement + log write + pending delete in a single Firestore
// transaction.  Either all three succeed or none do — no partial state.
// Also validates stock levels inside the transaction so two concurrent
// approvals cannot double-decrement the same medicine.
// ---------------------------------------------------------------------------

export async function approveSaleTransaction(shopId, entry) {
  await runTransaction(db, async (tx) => {
    // 1. Read current stock for every sold item.
    const stockRefs = entry.items.map((it) =>
      doc(db, "shops", shopId, "stock", it.id)
    );
    const stockSnaps = await Promise.all(stockRefs.map((r) => tx.get(r)));

    // 2. Validate and schedule stock decrements.
    stockSnaps.forEach((snap, i) => {
      if (!snap.exists()) {
        throw new Error(`Medicine "${entry.items[i].name}" no longer exists in stock.`);
      }
      const newQty = snap.data().stock - entry.items[i].qty;
      if (newQty < 0) {
        throw new Error(
          `Insufficient stock for "${entry.items[i].name}" — only ${snap.data().stock} left.`
        );
      }
      tx.update(stockRefs[i], { stock: newQty });
    });

    // 3. Write approved sale to log.
    const { id: entryId, ...entryData } = entry;
    tx.set(doc(db, "shops", shopId, "salesLog", entryId), entryData);

    // 4. Remove from pending.
    tx.delete(doc(db, "shops", shopId, "pendingSales", entryId));
  });
}

// ---------------------------------------------------------------------------
// Atomic void-sale transaction
//
// Restores stock + marks original entry voided + adds reversal record —
// all in one transaction.
// ---------------------------------------------------------------------------

export async function voidSaleTransaction(shopId, originalEntry, reversalEntry) {
  await runTransaction(db, async (tx) => {
    // 1. Read current stock for every item to restore.
    const stockRefs = originalEntry.items.map((it) =>
      doc(db, "shops", shopId, "stock", it.id)
    );
    const stockSnaps = await Promise.all(stockRefs.map((r) => tx.get(r)));

    // 2. Schedule stock increments (skip if medicine was deleted).
    stockSnaps.forEach((snap, i) => {
      if (snap.exists()) {
        tx.update(stockRefs[i], {
          stock: snap.data().stock + originalEntry.items[i].qty,
        });
      }
    });

    // 3. Mark original log entry as voided.
    tx.update(doc(db, "shops", shopId, "salesLog", originalEntry.id), {
      voided: true,
    });

    // 4. Write reversal log entry.
    const { id: reversalId, ...reversalData } = reversalEntry;
    tx.set(doc(db, "shops", shopId, "salesLog", reversalId), reversalData);
  });
}

// ---------------------------------------------------------------------------
// Settings  —  shops/{shopId}/data/settings  (unchanged, single document)
// ---------------------------------------------------------------------------

export async function loadSettings(shopId) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { ownerPinHash: null, pinChangeRequired: false };
}

export async function saveSettings(shopId, settings) {
  const ref = doc(db, "shops", shopId, "data", "settings");
  await setDoc(ref, settings);
}
