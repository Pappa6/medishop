import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert } from "react-native";
import { hashPin } from "./pin";

// Every counter option is just a label — no separate Firebase login per
// staff member, since that would need a backend admin step this
// client-only app doesn't have. The Owner option is the one that matters
// for security: it's gated behind the shop's PIN (set in Owner Dashboard
// > Change PIN) because Owner can edit/void other people's sales and see
// money totals. Counter roles need no PIN — anyone handed the shop phone
// can ring up a sale, but they can't touch anything after it's submitted.
const COUNTERS = ["Counter 1", "Counter 2", "Counter 3"];

export default function RoleSelectScreen({ shopName, ownerPinHash, onSelectRole }) {
  const [pinEntryOpen, setPinEntryOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  async function submitPin() {
    setChecking(true);
    const enteredHash = await hashPin(pin);
    setChecking(false);
    if (enteredHash === ownerPinHash) {
      setPin("");
      setPinEntryOpen(false);
      onSelectRole({ type: "owner", label: "Owner" });
    } else {
      Alert.alert("Wrong PIN", "That PIN doesn't match. Ask the shop owner for the current PIN.");
      setPin("");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{shopName}</Text>
        <Text style={styles.subtitle}>Who's working right now?</Text>

        {COUNTERS.map((label) => (
          <TouchableOpacity key={label} style={styles.roleBtn} onPress={() => onSelectRole({ type: "counter", label })}>
            <Text style={styles.roleBtnText}>{label}</Text>
          </TouchableOpacity>
        ))}

        {!pinEntryOpen ? (
          <TouchableOpacity style={styles.ownerBtn} onPress={() => setPinEntryOpen(true)}>
            <Text style={styles.ownerBtnText}>Owner</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.pinBox}>
            <Text style={styles.pinLabel}>Enter owner PIN</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="PIN"
              keyboardType="numeric"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              autoFocus
            />
            <TouchableOpacity style={styles.ownerBtn} onPress={submitPin} disabled={checking}>
              <Text style={styles.ownerBtnText}>{checking ? "Checking..." : "Continue as Owner"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPinEntryOpen(false); setPin(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 },
  roleBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  roleBtnText: { fontSize: 15, fontWeight: "500" },
  ownerBtn: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  ownerBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  pinBox: { marginTop: 12 },
  pinLabel: { fontSize: 13, color: "#666", marginBottom: 8, textAlign: "center" },
  pinInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 10,
  },
  cancelText: { textAlign: "center", color: "#888", fontSize: 13, marginTop: 12 },
});
