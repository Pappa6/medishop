import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert } from "react-native";

const COUNTERS = ["Counter 1", "Counter 2", "Counter 3"];

// Fix #4: Brute-force lockout.
// After MAX_ATTEMPTS wrong PINs the entry UI is locked for an escalating
// duration. Durations (in seconds): 30s, 2m, 5m, 10m, 30m.
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATIONS_S = [30, 120, 300, 600, 1800];

// Fix #10: receives verifyOwnerPin(pin) → Promise<boolean> instead of
// the raw ownerPinHash string, so the hash never appears in this
// component's props or state.
export default function RoleSelectScreen({ shopName, verifyOwnerPin, onSelectRole }) {
  const [pinEntryOpen, setPinEntryOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutExpiry, setLockoutExpiry] = useState(null); // timestamp ms
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!lockoutExpiry) {
      clearInterval(timerRef.current);
      setCountdown(0);
      return;
    }
    function tick() {
      const remaining = Math.ceil((lockoutExpiry - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutExpiry(null);
        clearInterval(timerRef.current);
      } else {
        setCountdown(remaining);
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lockoutExpiry]);

  const isLocked = lockoutExpiry && Date.now() < lockoutExpiry;

  async function submitPin() {
    if (isLocked) return;
    setChecking(true);
    try {
      const ok = await verifyOwnerPin(pin);
      if (ok) {
        setPin("");
        setFailedAttempts(0);
        setLockoutExpiry(null);
        setPinEntryOpen(false);
        onSelectRole({ type: "owner", label: "Owner" });
      } else {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        setPin("");
        if (next >= MAX_ATTEMPTS) {
          const durationIdx = Math.min(next - MAX_ATTEMPTS, LOCKOUT_DURATIONS_S.length - 1);
          setLockoutExpiry(Date.now() + LOCKOUT_DURATIONS_S[durationIdx] * 1000);
          Alert.alert(
            "Too many wrong PINs",
            `PIN entry locked for ${formatDuration(LOCKOUT_DURATIONS_S[durationIdx])}.`
          );
        } else {
          Alert.alert(
            "Wrong PIN",
            `That PIN doesn't match. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} remaining before lockout.`
          );
        }
      }
    } catch {
      Alert.alert("Error", "Could not verify PIN. Check your connection and try again.");
    } finally {
      setChecking(false);
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
            {isLocked ? (
              <Text style={styles.lockText}>Locked — try again in {formatDuration(countdown)}</Text>
            ) : (
              <TextInput
                style={styles.pinInput}
                placeholder="PIN"
                keyboardType="numeric"
                secureTextEntry
                value={pin}
                onChangeText={setPin}
                autoFocus
                maxLength={6}
              />
            )}
            <TouchableOpacity
              style={[styles.ownerBtn, (isLocked || checking) && styles.ownerBtnDisabled]}
              onPress={submitPin}
              disabled={isLocked || checking}
            >
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

function formatDuration(seconds) {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
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
  ownerBtnDisabled: { backgroundColor: "#999" },
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
  lockText: { color: "#c0392b", textAlign: "center", fontSize: 13, marginBottom: 10, fontWeight: "600" },
  cancelText: { textAlign: "center", color: "#888", fontSize: 13, marginTop: 12 },
});
