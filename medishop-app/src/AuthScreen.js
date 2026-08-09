import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { signUpShop, logInShop } from "./auth";

// Fix #6: Password strength rules enforced before calling Firebase.
// Firebase's own minimum is only 6 characters, which allows passwords
// like "123456". This shop account protects all stock and financial
// history, so we require at least 8 characters with a mix of letters
// and digits.
function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!email || !password || (mode === "signup" && !shopName)) {
      Alert.alert("Missing details", "Please fill in every field.");
      return;
    }
    if (mode === "signup") {
      const pwError = validatePassword(password);
      if (pwError) {
        Alert.alert("Weak password", pwError);
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpShop(shopName.trim(), email.trim(), password);
      } else {
        await logInShop(email.trim(), password);
      }
    } catch (err) {
      Alert.alert("Could not continue", err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>MediShop inventory</Text>
        <Text style={styles.subtitle}>
          {mode === "signup" ? "Create your shop's account" : "Log in to your shop"}
        </Text>

        {mode === "signup" && (
          <TextInput
            style={styles.input}
            placeholder="Shop name"
            value={shopName}
            onChangeText={setShopName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === "signup" && (
          <Text style={styles.hint}>Min. 8 characters, must include a letter and a number.</Text>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={busy}>
          <Text style={styles.submitBtnText}>
            {busy ? "Please wait..." : mode === "signup" ? "Create shop account" : "Log in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === "signup" ? "login" : "signup")}>
          <Text style={styles.switchText}>
            {mode === "signup" ? "Already have an account? Log in" : "New shop? Create an account"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 12, fontSize: 14 },
  hint: { fontSize: 11, color: "#888", marginBottom: 10, marginTop: -6 },
  submitBtn: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 6 },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  switchText: { fontSize: 12, color: "#666", textAlign: "center", marginTop: 16 },
});
