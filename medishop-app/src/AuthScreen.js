import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { signUpShop, logInShop } from "./auth";

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
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpShop(shopName.trim(), email.trim(), password);
      } else {
        await logInShop(email.trim(), password);
      }
      // No further action needed here — App.js listens for the auth
      // state change and switches to the main app automatically.
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
  submitBtn: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 6 },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  switchText: { fontSize: 12, color: "#666", textAlign: "center", marginTop: 16 },
});
