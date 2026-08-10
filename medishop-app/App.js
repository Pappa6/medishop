import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  SYMPTOMS,
  DEFAULT_CATALOG,
  CATEGORY_LABELS,
  netPrice,
  netPiecePrice,
  formatStock,
  GST_PERCENT,
} from "./src/catalog";
import { loadStock, saveStock, loadLog, saveLog, loadPending, savePending, loadSettings, saveSettings } from "./src/storage";
import { watchAuthState, logOutShop } from "./src/auth";
import AuthScreen from "./src/AuthScreen";
import BarcodeScanner from "./src/BarcodeScanner";
import RoleSelectScreen from "./src/RoleSelectScreen";
import { hashPin, verifyPin } from "./src/pin";

// Fix #5: escapeHtml prevents XSS when user-supplied strings (shop name,
// patient name, medicine names) are interpolated into the printed bill's
// HTML. Without escaping, a shop named "<script>...</script>" would
// execute arbitrary JS inside the expo-print WebView.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [shop, setShop] = useState(null);
  const [role, setRole] = useState(null);
  const [settings, setSettings] = useState({ ownerPinHash: null, pinChangeRequired: false });

  const [catalog, setCatalog] = useState([]);
  const [log, setLog] = useState([]);
  const [pending, setPending] = useState([]);
  const [cart, setCart] = useState({});
  const [qtyInputs, setQtyInputs] = useState({});
  const [visibleIds, setVisibleIds] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [activeVoidId, setActiveVoidId] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [toast, setToast] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddingMedicine, setIsAddingMedicine] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("fever");
  const [newUnit, setNewUnit] = useState("strip");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newLooseAllowed, setNewLooseAllowed] = useState(false);
  const [newPiecesPerUnit, setNewPiecesPerUnit] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  // Fix #8: batch number and expiry are now real fields on each medicine.
  const [newBatch, setNewBatch] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  useEffect(() => {
    const unsubscribe = watchAuthState((result) => {
      setShop(result);
      setRole(null);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!shop) return;
    (async () => {
      setCatalog(await loadStock(shop.shopId));
      setLog(await loadLog(shop.shopId));
      setPending(await loadPending(shop.shopId));
      setSettings(await loadSettings(shop.shopId));
    })();
  }, [shop]);

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.itemMeta}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!shop) return <AuthScreen />;

  // Fix #10: verifyOwnerPin fetches settings fresh from Firestore on each
  // attempt so the raw hash is never stored in RoleSelectScreen's props.
  // Falls back to the cached copy only if the network call fails.
  async function verifyOwnerPin(pin) {
    if (!settings.ownerPinHash) {
      Alert.alert(
        "Settings error",
        "Owner PIN settings could not be loaded. Please log out and back in."
      );
      return false;
    }
    try {
      const fresh = await loadSettings(shop.shopId);
      if (!fresh.ownerPinHash) return false;
      return verifyPin(pin, fresh.ownerPinHash);
    } catch {
      return verifyPin(pin, settings.ownerPinHash);
    }
  }

  if (!role) {
    return (
      <RoleSelectScreen
        shopName={shop.shopName}
        verifyOwnerPin={verifyOwnerPin}
        onSelectRole={setRole}
      />
    );
  }

  // Fix #3: Block owner dashboard access until the default PIN is replaced.
  if (role.type === "owner" && settings.pinChangeRequired) {
    return (
      <MandatoryPinChangeScreen
        changeOwnerPin={changeOwnerPin}
        onDone={() => setRole(null)}
      />
    );
  }

  function byId(id) {
    return catalog.find((m) => m.id === id);
  }

  function unitPriceOf(item) {
    return item.looseAllowed ? netPiecePrice(item) : netPrice(item);
  }

  function showCategory(key) {
    setToast("");
    setSearchText("");
    const ids = catalog.filter((m) => m.category === key).map((m) => m.id);
    setVisibleIds(ids);
  }

  function findByScannedCode(code) {
    const trimmed = (code || "").trim();
    return catalog.find((m) => m.barcode === trimmed) || catalog.find((m) => m.id === trimmed);
  }

  function onBarcodeScanned(code) {
    setShowScanner(false);
    setToast("");
    const item = findByScannedCode(code);
    if (!item) {
      Alert.alert(
        "Not found in stock",
        `Scanned code "${code}" doesn't match any medicine in your catalog yet.`
      );
      return;
    }
    if (item.stock <= (cart[item.id] || 0)) {
      Alert.alert("Out of stock", `${item.name} has no stock left to add.`);
      return;
    }
    setVisibleIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    const step = item.looseAllowed ? Math.min(item.piecesPerUnit, item.stock - (cart[item.id] || 0)) : 1;
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + step }));
    setToast(`Added ${item.name}`);
    setTimeout(() => setToast(""), 1500);
  }

  function changeQty(id, direction) {
    const item = byId(id);
    if (!item) return;
    setCart((prev) => {
      const current = prev[id] || 0;
      let next = current + direction;
      if (next < 0) next = 0;
      if (next > item.stock) next = item.stock;
      return { ...prev, [id]: next };
    });
  }

  function setExactQty(id, rawText) {
    const digitsOnly = rawText.replace(/[^0-9]/g, "");
    setQtyInputs((prev) => ({ ...prev, [id]: digitsOnly }));
    const item = byId(id);
    if (!item) return;
    const n = parseInt(digitsOnly, 10);
    if (isNaN(n) || n <= 0) {
      setCart((prev) => ({ ...prev, [id]: 0 }));
      return;
    }
    setCart((prev) => ({ ...prev, [id]: Math.min(n, item.stock) }));
  }

  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = byId(id);
      return item ? { item, qty, lineTotal: unitPriceOf(item) * qty } : null;
    })
    .filter(Boolean);

  const rawSubtotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const subtotal = Math.round(rawSubtotal * 100) / 100;
  const gstAmount = Math.round(subtotal * GST_PERCENT) / 100;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

  function openBillForm() {
    if (cartLines.length === 0) return;
    setShowBillForm(true);
  }

  async function submitForApproval() {
    const itemsDetail = [];
    cartLines.forEach((l) => {
      itemsDetail.push({
        id: l.item.id,
        name: l.item.name,
        qty: l.qty,
        soldAs: l.item.looseAllowed ? "loose (pieces)" : l.item.unit,
        unitPrice: unitPriceOf(l.item),
        // Fix #8: use the medicine's actual batch and expiry instead of
        // a randomly generated fake. Shows "—" when not yet recorded.
        batch: l.item.batch || "",
        expiry: l.item.expiry || "",
      });
    });
    if (itemsDetail.length === 0) return;

    // Fix #7: crypto.randomUUID() instead of Date.now() — two bills
    // submitted in the same millisecond no longer collide.
    const entry = {
      id: crypto.randomUUID(),
      type: "sale",
      voided: false,
      counter: role.label,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toLocaleDateString("en-IN"),
      items: itemsDetail,
      subtotal,
      gstPercent: GST_PERCENT,
      gstAmount,
      total: grandTotal,
      patientName: patientName.trim(),
      doctorName: doctorName.trim(),
    };
    const updatedPending = [...pending, entry];

    setPending(updatedPending);
    await savePending(shop.shopId, updatedPending);

    setCart({});
    setQtyInputs({});
    setVisibleIds([]);
    setSearchText("");
    setShowBillForm(false);
    setPatientName("");
    setDoctorName("");
    setToast("Bill sent to owner for approval");
    setTimeout(() => setToast(""), 2500);
  }

  async function approveSale(entry) {
    const updatedCatalog = catalog.map((m) => {
      const sold = entry.items.find((it) => it.id === m.id);
      return sold ? { ...m, stock: m.stock - sold.qty } : m;
    });
    const updatedLog = [...log, entry];
    const updatedPending = pending.filter((p) => p.id !== entry.id);

    setCatalog(updatedCatalog);
    setLog(updatedLog);
    setPending(updatedPending);
    await saveStock(shop.shopId, updatedCatalog);
    await saveLog(shop.shopId, updatedLog);
    await savePending(shop.shopId, updatedPending);

    await printOrShareBill(entry);
  }

  async function rejectSale(entry) {
    const updatedPending = pending.filter((p) => p.id !== entry.id);
    setPending(updatedPending);
    await savePending(shop.shopId, updatedPending);
  }

  async function voidEntry(entry) {
    const restoredCatalog = catalog.map((m) => {
      const sold = entry.items.find((it) => it.id === m.id);
      return sold ? { ...m, stock: m.stock + sold.qty } : m;
    });
    const reversal = {
      id: crypto.randomUUID(), // Fix #7
      type: "reversal",
      linkedTo: entry.id,
      counter: entry.counter,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      items: entry.items,
      total: -entry.total,
      reason: reasonText || "No reason given",
    };
    const updatedLog = log.map((e) => (e.id === entry.id ? { ...e, voided: true } : e));
    updatedLog.push(reversal);

    setCatalog(restoredCatalog);
    setLog(updatedLog);
    await saveStock(shop.shopId, restoredCatalog);
    await saveLog(shop.shopId, updatedLog);
    setActiveVoidId(null);
    setReasonText("");
  }

  async function printOrShareBill(sale) {
    const html = buildBillHtml(sale, shop);
    try {
      await Print.printAsync({ html });
    } catch (e) {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    }
  }

  // Returns true on success, false on validation failure.
  async function changeOwnerPin(newPin) {
    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert("Invalid PIN", "Use 4 to 6 digits, numbers only.");
      return false;
    }
    const ownerPinHash = await hashPin(newPin);
    // pinChangeRequired cleared so the forced-change gate doesn't re-trigger.
    const updatedSettings = { ...settings, ownerPinHash, pinChangeRequired: false };
    setSettings(updatedSettings);
    await saveSettings(shop.shopId, updatedSettings);
    return true;
  }

  async function loadDefaultCatalogNow() {
    setCatalog(DEFAULT_CATALOG);
    await saveStock(shop.shopId, DEFAULT_CATALOG);
    setToast("Latest medicine catalog loaded (" + DEFAULT_CATALOG.length + " items)");
    setTimeout(() => setToast(""), 2500);
  }

  function confirmLoadDefaultCatalog() {
    Alert.alert(
      "Load latest catalog?",
      "This replaces the current stock list with the app's full default medicine list (" +
        DEFAULT_CATALOG.length +
        " items). Existing sales history is not affected.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load now", onPress: loadDefaultCatalogNow },
      ]
    );
  }

  function resetAddForm() {
    setNewName("");
    setNewCategory("fever");
    setNewUnit("strip");
    setNewPrice("");
    setNewStock("");
    setNewDiscount("");
    setNewLooseAllowed(false);
    setNewPiecesPerUnit("");
    setNewBarcode("");
    setNewBatch("");
    setNewExpiry("");
    setShowAddForm(false);
  }

  async function addNewMedicine() {
    if (isAddingMedicine) return; // prevent double-press

    const name = newName.trim();
    const price = parseFloat(newPrice);
    const stockUnits = parseInt(newStock, 10);
    const discount = newDiscount ? parseFloat(newDiscount) : 0;
    const piecesPerUnit = newLooseAllowed ? parseInt(newPiecesPerUnit, 10) : null;

    if (!name) { Alert.alert("Missing name", "Please enter the medicine name."); return; }
    if (isNaN(price) || price <= 0) { Alert.alert("Invalid price", "Please enter a valid price."); return; }
    if (isNaN(stockUnits) || stockUnits < 0) { Alert.alert("Invalid stock", "Please enter stock quantity."); return; }
    if (newLooseAllowed && (isNaN(piecesPerUnit) || piecesPerUnit <= 0)) {
      Alert.alert("Invalid pieces per strip", "Please enter tablets per strip.");
      return;
    }

    setIsAddingMedicine(true);
    try {
      const incomingStock = newLooseAllowed ? stockUnits * piecesPerUnit : stockUnits;

      // If a medicine with the same name already exists, update its stock
      // instead of creating a duplicate entry.
      const existingIndex = catalog.findIndex(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      );

      let updatedCatalog;
      let toastMsg;

      if (existingIndex !== -1) {
        updatedCatalog = catalog.map((m, i) =>
          i === existingIndex
            ? { ...m, stock: m.stock + incomingStock, price, discount,
                batch: newBatch.trim() || m.batch,
                expiry: newExpiry.trim() || m.expiry }
            : m
        );
        toastMsg = `"${name}" stock updated (+${incomingStock})`;
      } else {
        const newItem = {
          id: crypto.randomUUID(),
          name,
          category: newCategory,
          price,
          unit: newUnit.trim() || "strip",
          looseAllowed: newLooseAllowed,
          piecesPerUnit: newLooseAllowed ? piecesPerUnit : undefined,
          stock: incomingStock,
          discount,
          barcode: newBarcode.trim() || undefined,
          batch: newBatch.trim() || "",
          expiry: newExpiry.trim() || "",
        };
        updatedCatalog = [...catalog, newItem];
        toastMsg = `"${name}" added to stock`;
      }

      setCatalog(updatedCatalog);
      await saveStock(shop.shopId, updatedCatalog);
      setToast(toastMsg);
      setTimeout(() => setToast(""), 2500);
      resetAddForm();
    } finally {
      setIsAddingMedicine(false);
    }
  }

  const visibleItems = visibleIds.map(byId).filter(Boolean);
  const searchResults =
    searchText.trim().length === 0
      ? []
      : catalog.filter((m) => m.name.toLowerCase().includes(searchText.trim().toLowerCase()));
  const lowStock = catalog.filter((m) => {
    const pieces = m.looseAllowed ? m.piecesPerUnit : 1;
    return m.stock <= 10 * pieces || (m.looseAllowed && m.stock <= 10);
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <BarcodeScanner
        visible={showScanner}
        onScanned={onBarcodeScanned}
        onClose={() => setShowScanner(false)}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.shopName}>{shop.shopName}</Text>
            <Text style={styles.roleTag}>{role.label}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {role.type === "owner" && (
              <TouchableOpacity style={styles.smallBtn} onPress={() => setShowOwnerPanel((v) => !v)}>
                <Text style={styles.smallBtnText}>{showOwnerPanel ? "Back to counter" : "Owner dashboard"}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => { setShowOwnerPanel(false); setRole(null); }}
            >
              <Text style={styles.smallBtnText}>Switch role</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={logOutShop}>
              <Text style={styles.smallBtnText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showOwnerPanel ? (
          <OwnerDashboard
            catalog={catalog}
            log={log}
            pending={pending}
            approveSale={approveSale}
            rejectSale={rejectSale}
            changeOwnerPin={changeOwnerPin}
            activeVoidId={activeVoidId}
            setActiveVoidId={setActiveVoidId}
            reasonText={reasonText}
            setReasonText={setReasonText}
            voidEntry={voidEntry}
            onLoadDefaultCatalog={confirmLoadDefaultCatalog}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            newName={newName}
            setNewName={setNewName}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            newUnit={newUnit}
            setNewUnit={setNewUnit}
            newPrice={newPrice}
            setNewPrice={setNewPrice}
            newStock={newStock}
            setNewStock={setNewStock}
            newDiscount={newDiscount}
            setNewDiscount={setNewDiscount}
            newLooseAllowed={newLooseAllowed}
            setNewLooseAllowed={setNewLooseAllowed}
            newPiecesPerUnit={newPiecesPerUnit}
            setNewPiecesPerUnit={setNewPiecesPerUnit}
            newBarcode={newBarcode}
            setNewBarcode={setNewBarcode}
            newBatch={newBatch}
            setNewBatch={setNewBatch}
            newExpiry={newExpiry}
            setNewExpiry={setNewExpiry}
            addNewMedicine={addNewMedicine}
          />
        ) : (
          <>
            {lowStock.length > 0 && (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>{lowStock.map((m) => m.name).join(", ")} running low, reorder soon</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Quick dispense</Text>
            <View style={styles.symptomGrid}>
              {SYMPTOMS.map((s) => (
                <TouchableOpacity key={s.key} style={styles.symptomBtn} onPress={() => showCategory(s.key)}>
                  <Text style={styles.symptomBtnText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanner(true)}>
              <Text style={styles.scanBtnText}>📷 Scan a strip or box</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Search all medicines</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Type medicine name..."
              value={searchText}
              onChangeText={(t) => { setSearchText(t); setVisibleIds([]); }}
            />
            {searchText.trim().length > 0 &&
              (searchResults.length === 0 ? (
                <Text style={styles.emptyText}>No medicine found matching "{searchText}"</Text>
              ) : (
                searchResults.map((m) => (
                  <View key={m.id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{m.name}</Text>
                      <Text style={styles.itemMeta}>
                        {m.looseAllowed
                          ? `Rs. ${netPiecePrice(m)} / tablet · ${formatStock(m)} available`
                          : `Rs. ${netPrice(m)} / ${m.unit} · ${formatStock(m)} available`}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.qtyBox}
                      placeholder={m.looseAllowed ? "pcs" : "qty"}
                      keyboardType="number-pad"
                      value={qtyInputs[m.id] ?? (cart[m.id] ? String(cart[m.id]) : "")}
                      onChangeText={(t) => setExactQty(m.id, t)}
                    />
                  </View>
                ))
              ))}

            <Text style={styles.sectionLabel}>Current sale</Text>
            {visibleItems.length === 0 ? (
              <Text style={styles.emptyText}>Tap a symptom, scan, or search a medicine to begin</Text>
            ) : (
              visibleItems.map((m) => (
                <View key={m.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{m.name}</Text>
                    <Text style={styles.itemMeta}>
                      {m.looseAllowed
                        ? `Rs. ${netPiecePrice(m)} / tablet · ${formatStock(m)} available`
                        : `Rs. ${netPrice(m)} / ${m.unit} · ${formatStock(m)} available`}
                    </Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(m.id, -1)}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{cart[m.id] || 0}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(m.id, 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {cartLines.length > 0 && (
              <View style={styles.cartSummary}>
                {cartLines.map((l) => (
                  <View key={l.item.id} style={styles.billRow}>
                    <Text style={styles.billItemText}>
                      {l.item.name} x{l.qty} {l.item.looseAllowed ? "pcs" : l.item.unit}
                    </Text>
                    <Text style={styles.billItemText}>Rs. {Math.round(l.lineTotal)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValueSmall}>Rs. {subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST ({GST_PERCENT}%)</Text>
              <Text style={styles.totalValueSmall}>Rs. {gstAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs. {grandTotal.toFixed(2)}</Text>
            </View>

            {!showBillForm ? (
              <TouchableOpacity style={styles.confirmBtn} onPress={openBillForm}>
                <Text style={styles.confirmBtnText}>Generate bill</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.billFormBox}>
                <Text style={styles.sectionLabel}>Patient details (for the printed bill)</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Patient name"
                  value={patientName}
                  onChangeText={setPatientName}
                />
                <TextInput
                  style={[styles.reasonInput, { marginTop: 8 }]}
                  placeholder="Doctor's name (optional)"
                  value={doctorName}
                  onChangeText={setDoctorName}
                />
                <TouchableOpacity style={[styles.confirmBtn, { marginTop: 10 }]} onPress={submitForApproval}>
                  <Text style={styles.confirmBtnText}>Send for owner's approval</Text>
                </TouchableOpacity>
              </View>
            )}
            {!!toast && <Text style={styles.toast}>{toast}</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Fix #3: Shown to the owner the first time they log in (or whenever
// pinChangeRequired is true) before they can access the dashboard.
function MandatoryPinChangeScreen({ changeOwnerPin, onDone }) {
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (pin1 !== pin2) {
      Alert.alert("PINs don't match", "Type the same PIN in both boxes.");
      return;
    }
    setBusy(true);
    const ok = await changeOwnerPin(pin1);
    setBusy(false);
    if (ok) {
      Alert.alert("PIN set", "Your owner PIN has been saved. Tap OK to continue.", [
        { text: "OK", onPress: onDone },
      ]);
    }
    setPin1("");
    setPin2("");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.shopName}>Set your owner PIN</Text>
        <Text style={[styles.itemMeta, { textAlign: "center", marginBottom: 20 }]}>
          The default PIN must be changed before you can access the owner dashboard.
          Choose a PIN only you know (4–6 digits).
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="New PIN (4–6 digits)"
          keyboardType="numeric"
          secureTextEntry
          value={pin1}
          onChangeText={setPin1}
          maxLength={6}
        />
        <TextInput
          style={[styles.searchInput, { marginTop: 10 }]}
          placeholder="Confirm PIN"
          keyboardType="numeric"
          secureTextEntry
          value={pin2}
          onChangeText={setPin2}
          maxLength={6}
        />
        <TouchableOpacity style={[styles.confirmBtn, { marginTop: 16 }]} onPress={handleSave} disabled={busy}>
          <Text style={styles.confirmBtnText}>{busy ? "Saving..." : "Save PIN and continue"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function OwnerDashboard({
  catalog, log, pending, approveSale, rejectSale, changeOwnerPin,
  activeVoidId, setActiveVoidId, reasonText, setReasonText, voidEntry,
  onLoadDefaultCatalog, showAddForm, setShowAddForm,
  newName, setNewName, newCategory, setNewCategory,
  newUnit, setNewUnit, newPrice, setNewPrice,
  newStock, setNewStock, newDiscount, setNewDiscount,
  newLooseAllowed, setNewLooseAllowed, newPiecesPerUnit, setNewPiecesPerUnit,
  newBarcode, setNewBarcode,
  newBatch, setNewBatch, newExpiry, setNewExpiry,
  addNewMedicine,
}) {
  const categoryEntries = Object.entries(CATEGORY_LABELS);
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");

  async function submitPinChange() {
    if (newPin1 !== newPin2) {
      Alert.alert("PINs don't match", "Type the same PIN in both boxes.");
      return;
    }
    const ok = await changeOwnerPin(newPin1);
    if (ok) {
      setNewPin1("");
      setNewPin2("");
      Alert.alert("PIN updated", "New PIN takes effect immediately.");
    }
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>
        Bills waiting for your approval ({pending.length})
      </Text>
      <View style={styles.panel}>
        {pending.length === 0 && (
          <Text style={styles.emptyText}>No bills waiting.</Text>
        )}
        {pending.map((entry) => (
          <View key={entry.id} style={styles.billBox}>
            {(entry.patientName || entry.doctorName) && (
              <Text style={styles.billMeta}>
                {entry.patientName ? `Patient: ${entry.patientName}` : ""}
                {entry.doctorName ? `   Dr: ${entry.doctorName}` : ""}
              </Text>
            )}
            {entry.items.map((it) => (
              <View key={it.id} style={styles.billRow}>
                <Text style={styles.billItemText}>{it.name} x{it.qty}</Text>
                <Text style={styles.billItemText}>Rs. {(it.unitPrice * it.qty).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.billTotalRow}>
              <Text style={styles.totalLabel}>Total (incl. {entry.gstPercent}% GST)</Text>
              <Text style={styles.totalValue}>Rs. {entry.total.toFixed(2)}</Text>
            </View>
            <View style={styles.formRow}>
              <TouchableOpacity
                style={[styles.confirmBtn, { flex: 1, marginRight: 6 }]}
                onPress={() => approveSale(entry)}
              >
                <Text style={styles.confirmBtnText}>Approve & print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voidBtn, { flex: 1, marginLeft: 6, alignItems: "center" }]}
                onPress={() => rejectSale(entry)}
              >
                <Text style={styles.voidBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.reloadBtn} onPress={onLoadDefaultCatalog}>
        <Text style={styles.reloadBtnText}>Load latest medicine catalog ({DEFAULT_CATALOG.length} items)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm((v) => !v)}>
        <Text style={styles.addBtnText}>{showAddForm ? "Close add-medicine form" : "+ Add new medicine"}</Text>
      </TouchableOpacity>

      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>Medicine name</Text>
          <TextInput style={styles.formInput} placeholder="e.g. Azithromycin 500mg" value={newName} onChangeText={setNewName} />

          <Text style={styles.formLabel}>Category</Text>
          <View style={styles.chipRow}>
            {categoryEntries.map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, newCategory === key && styles.chipActive]}
                onPress={() => setNewCategory(key)}
              >
                <Text style={[styles.chipText, newCategory === key && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.formLabel}>Unit (strip/bottle/tube..)</Text>
              <TextInput style={styles.formInput} placeholder="strip" value={newUnit} onChangeText={setNewUnit} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.formLabel}>Price per {newUnit || "unit"} (Rs.)</Text>
              <TextInput style={styles.formInput} placeholder="e.g. 45" keyboardType="numeric" value={newPrice} onChangeText={setNewPrice} />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.formLabel}>Stock ({newUnit || "unit"}s in shop)</Text>
              <TextInput style={styles.formInput} placeholder="e.g. 20" keyboardType="numeric" value={newStock} onChangeText={setNewStock} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.formLabel}>Discount % (optional)</Text>
              <TextInput style={styles.formInput} placeholder="0" keyboardType="numeric" value={newDiscount} onChangeText={setNewDiscount} />
            </View>
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => setNewLooseAllowed((v) => !v)}>
            <View style={[styles.checkbox, newLooseAllowed && styles.checkboxChecked]}>
              {newLooseAllowed && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.toggleLabel}>Can this be sold loose (broken strip, a few tablets)?</Text>
          </TouchableOpacity>

          {newLooseAllowed && (
            <>
              <Text style={styles.formLabel}>Tablets/capsules per {newUnit || "strip"}</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 10"
                keyboardType="numeric"
                value={newPiecesPerUnit}
                onChangeText={setNewPiecesPerUnit}
              />
            </>
          )}

          <Text style={styles.formLabel}>Barcode (optional)</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. 8901234567890"
            keyboardType="numeric"
            value={newBarcode}
            onChangeText={setNewBarcode}
          />

          {/* Fix #8: batch and expiry fields so bills carry real, traceable values */}
          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.formLabel}>Batch no. (from box)</Text>
              <TextInput style={styles.formInput} placeholder="e.g. B427" value={newBatch} onChangeText={setNewBatch} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.formLabel}>Expiry (MM/YYYY)</Text>
              <TextInput style={styles.formInput} placeholder="e.g. 06/2027" value={newExpiry} onChangeText={setNewExpiry} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { marginTop: 12 }, isAddingMedicine && { opacity: 0.6 }]}
            onPress={addNewMedicine}
            disabled={isAddingMedicine}
          >
            <Text style={styles.confirmBtnText}>
              {isAddingMedicine ? "Saving..." : "Save medicine to stock"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>Current stock ({catalog.length} items)</Text>
      <View style={styles.panel}>
        {catalog.length === 0 && <Text style={styles.emptyText}>No stock yet.</Text>}
        {catalog.map((m) => (
          <View key={m.id} style={styles.stockRow}>
            <Text style={styles.stockName}>{m.name}</Text>
            <Text style={[styles.stockQty, m.stock <= (m.looseAllowed ? m.piecesPerUnit : 10) && styles.stockLow]}>
              {formatStock(m)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Sales history (owner only)</Text>
      <View style={styles.panel}>
        {log.length === 0 && <Text style={styles.emptyText}>No sales yet.</Text>}
        {[...log].reverse().map((entry) => (
          <View key={entry.id} style={styles.logRow}>
            <View style={styles.logTopRow}>
              <Text style={[styles.logCounter, entry.voided && styles.logDanger]}>
                {entry.type === "reversal" ? entry.counter + " – reversal" : entry.counter}
              </Text>
              <Text style={styles.logTime}>{entry.time}</Text>
            </View>
            {(entry.patientName || entry.doctorName) && (
              <Text style={styles.logMeta}>
                {entry.patientName ? `Patient: ${entry.patientName}` : ""}
                {entry.doctorName ? `  ·  Dr: ${entry.doctorName}` : ""}
              </Text>
            )}
            <Text style={[styles.logItems, entry.voided && styles.logDanger]}>
              {entry.items.map((it) => `${it.name} x${it.qty}`).join(", ")} – Rs. {entry.total.toLocaleString("en-IN")}
            </Text>
            {entry.type === "reversal" && <Text style={styles.logReason}>Reason: {entry.reason}</Text>}

            {entry.type !== "reversal" && !entry.voided && (
              <>
                <TouchableOpacity
                  style={styles.voidBtn}
                  onPress={() => setActiveVoidId(activeVoidId === entry.id ? null : entry.id)}
                >
                  <Text style={styles.voidBtnText}>Void this sale</Text>
                </TouchableOpacity>
                {activeVoidId === entry.id && (
                  <View style={styles.reasonRow}>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Reason, e.g. mis-tap, no real sale"
                      value={reasonText}
                      onChangeText={setReasonText}
                    />
                    <TouchableOpacity style={styles.reasonConfirmBtn} onPress={() => voidEntry(entry)}>
                      <Text style={styles.voidBtnText}>Confirm void</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
            {entry.voided && <Text style={styles.reversedTag}>Reversed</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Owner settings</Text>
      <View style={styles.panel}>
        <Text style={styles.formLabel}>Change owner PIN (4–6 digits)</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { flex: 1, marginRight: 6 }]}
            placeholder="New PIN"
            keyboardType="numeric"
            secureTextEntry
            value={newPin1}
            onChangeText={setNewPin1}
            maxLength={6}
          />
          <TextInput
            style={[styles.formInput, { flex: 1, marginLeft: 6 }]}
            placeholder="Confirm PIN"
            keyboardType="numeric"
            secureTextEntry
            value={newPin2}
            onChangeText={setNewPin2}
            maxLength={6}
          />
        </View>
        <TouchableOpacity style={[styles.confirmBtn, { marginTop: 10 }]} onPress={submitPinChange}>
          <Text style={styles.confirmBtnText}>Save new PIN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Fix #5: All user-supplied values are passed through escapeHtml() before
// being interpolated into the HTML string for the printed bill.
function buildBillHtml(sale, shop) {
  const rows = sale.items
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.name)}</td>
        <td style="text-align:center">${escapeHtml(it.qty)}</td>
        <td style="text-align:center">${escapeHtml(it.batch || "—")}</td>
        <td style="text-align:center">${escapeHtml(it.expiry || "—")}</td>
        <td style="text-align:right">Rs. ${Math.round(it.unitPrice * it.qty)}</td>
      </tr>`
    )
    .join("");
  return `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="margin-bottom:0">${escapeHtml(shop.shopName)}</h2>
        <p style="color:#666; margin-top:4px">${escapeHtml(sale.date || "")} ${escapeHtml(sale.time || "")}</p>
        <p>Patient: ${escapeHtml(sale.patientName || "—")} &nbsp;&nbsp; Doctor: ${escapeHtml(sale.doctorName || "—")}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead>
            <tr style="border-bottom:1px solid #333;">
              <th style="text-align:left">Medicine</th>
              <th>Qty</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <hr/>
        <p>Subtotal: Rs. ${sale.subtotal.toFixed(2)}</p>
        <p>GST (${sale.gstPercent}%): Rs. ${sale.gstAmount.toFixed(2)}</p>
        <h3>Total: Rs. ${sale.total.toFixed(2)}</h3>
      </body>
    </html>`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  shopName: { fontSize: 17, fontWeight: "600" },
  roleTag: { fontSize: 12, color: "#666", marginTop: 2 },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  smallBtnText: { fontSize: 12 },
  alertBox: { backgroundColor: "#FFF4E0", borderRadius: 8, padding: 10, marginBottom: 14 },
  alertText: { fontSize: 12, color: "#8a5a00" },
  sectionLabel: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 10 },
  symptomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  symptomBtn: { width: "48%", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  symptomBtnText: { fontSize: 13 },
  scanBtn: { paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center", marginBottom: 6 },
  scanBtnText: { fontSize: 13 },
  searchInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#999", textAlign: "center", paddingVertical: 20 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  itemName: { fontSize: 13, fontWeight: "600" },
  itemMeta: { fontSize: 12, color: "#666" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 16 },
  qtyValue: { fontSize: 14, minWidth: 18, textAlign: "center" },
  qtyBox: { width: 60, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, fontSize: 14, textAlign: "center" },
  cartSummary: { backgroundColor: "#fafafa", borderRadius: 8, padding: 10, marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4 },
  totalLabel: { fontSize: 13, color: "#666" },
  totalValueSmall: { fontSize: 14, fontWeight: "600" },
  totalValue: { fontSize: 22, fontWeight: "700" },
  confirmBtn: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 10 },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  billFormBox: { backgroundColor: "#f0f4ff", borderRadius: 8, padding: 12, marginTop: 10 },
  toast: { fontSize: 12, color: "#0a7a3d", textAlign: "center", marginTop: 8 },
  panel: { backgroundColor: "#fafafa", borderRadius: 8, padding: 10, marginBottom: 10 },
  reloadBtn: { backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#4f46e5", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 10 },
  reloadBtnText: { fontSize: 12, color: "#4f46e5", fontWeight: "600" },
  addBtn: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#059669", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  addBtnText: { fontSize: 12, color: "#059669", fontWeight: "600" },
  addForm: { backgroundColor: "#fafafa", borderRadius: 8, padding: 12, marginBottom: 14 },
  formLabel: { fontSize: 11, color: "#666", marginBottom: 4, marginTop: 8 },
  formInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, backgroundColor: "#fff" },
  formRow: { flexDirection: "row" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: "#ccc", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontSize: 11, color: "#333" },
  chipTextActive: { color: "#fff" },
  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: "#999", alignItems: "center", justifyContent: "center", marginRight: 8 },
  checkboxChecked: { backgroundColor: "#111", borderColor: "#111" },
  checkboxMark: { color: "#fff", fontSize: 13 },
  toggleLabel: { fontSize: 12, color: "#333", flex: 1 },
  stockRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  stockName: { fontSize: 12 },
  stockQty: { fontSize: 12, fontWeight: "600" },
  stockLow: { color: "#b45309" },
  logRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  logTopRow: { flexDirection: "row", justifyContent: "space-between" },
  logCounter: { fontSize: 12, fontWeight: "600" },
  logTime: { fontSize: 11, color: "#999" },
  logMeta: { fontSize: 11, color: "#555", marginTop: 2 },
  logItems: { fontSize: 12, marginTop: 2 },
  logDanger: { color: "#c0392b" },
  logReason: { fontSize: 11, color: "#c0392b", marginTop: 2 },
  voidBtn: { marginTop: 6, alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: "#c0392b" },
  voidBtnText: { fontSize: 11, color: "#c0392b" },
  reasonRow: { marginTop: 6 },
  reasonInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  reasonConfirmBtn: { marginTop: 6, alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#c0392b" },
  reversedTag: { fontSize: 11, color: "#c0392b", marginTop: 4, fontWeight: "600" },
  billBox: { backgroundColor: "#f5f5f5", borderRadius: 8, padding: 12, marginTop: 14 },
  billMeta: { fontSize: 12, color: "#444", marginBottom: 4 },
  billRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  billItemText: { fontSize: 12 },
  billTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
});
