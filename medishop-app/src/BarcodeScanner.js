import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

// Full-screen modal that opens the phone camera, scans a barcode (or QR
// code), and reports the raw scanned value back to the caller. App.js is
// responsible for looking that value up in the shop's catalog — this
// component only knows how to read a code off a strip/box, not what to
// do with it.
//
// Supported symbologies cover what's actually printed on Indian medicine
// packaging: ean13/ean8 (most strips and boxes), upc_a/upc_e (imported
// stock), and code128 (some hospital/distributor labels).
export default function BarcodeScanner({ visible, onScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const lockedRef = useRef(false);

  if (!visible) return null;

  function handleScan({ data }) {
    // Camera keeps firing while the same code stays in frame; ignore
    // repeats until the modal is closed and reopened for the next scan.
    if (lockedRef.current) return;
    lockedRef.current = true;
    onScanned(data);
  }

  function handleClose() {
    lockedRef.current = false;
    setTorchOn(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.centerBox}>
            <Text style={styles.infoText}>Checking camera permission...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerBox}>
            <Text style={styles.infoText}>
              Camera access is needed to scan medicine barcodes.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
              }}
              onBarcodeScanned={handleScan}
            />
            <View style={[styles.overlay, { pointerEvents: "box-none" }]}>
              <View style={styles.topBar}>
                <TouchableOpacity style={styles.roundBtn} onPress={handleClose}>
                  <Text style={styles.roundBtnText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.hintText}>Point the camera at the medicine's barcode</Text>
                <TouchableOpacity style={styles.roundBtn} onPress={() => setTorchOn((v) => !v)}>
                  <Text style={styles.roundBtnText}>{torchOn ? "💡" : "🔦"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.frame} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  infoText: { color: "#fff", fontSize: 14, textAlign: "center", marginBottom: 16 },
  primaryBtn: { backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 10 },
  primaryBtnText: { color: "#111", fontSize: 14, fontWeight: "600" },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  secondaryBtnText: { color: "#ccc", fontSize: 13 },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnText: { color: "#fff", fontSize: 16 },
  hintText: { color: "#fff", fontSize: 12, flex: 1, textAlign: "center", marginHorizontal: 8 },
  frame: {
    alignSelf: "center",
    width: "70%",
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    marginBottom: 90,
  },
});
