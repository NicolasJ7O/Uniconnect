import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { eventApi } from '@/lib/event-api';
import { useToast } from '@/components/Toast';

export default function VerifyQrScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: BarCodeScannerResult) => {
    if (scanned) return;
    setScanned(true);
    try {
      const res = await eventApi.verifyQr(data);
      setResult(res);
      showToast(res.valid ? 'Pase válido' : String(res.reason || 'No válido'), res.valid ? 'success' : 'error');
    } catch (e) {
      console.error('Error verifying QR', e);
      showToast('Error al verificar QR', 'error');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}><Text>Solicitando permiso de cámara...</Text></View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}><Text>No se otorgó permiso de cámara. Habilítalo en la configuración del dispositivo.</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escanea el QR para verificar</Text>
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={Platform.OS === 'web' ? styles.webScanner : StyleSheet.absoluteFillObject}
        />
      </View>

      {scanned && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.btn} onPress={() => { setScanned(false); setResult(null); }}>
            <Text style={styles.btnText}>Escanear nuevamente</Text>
          </Pressable>
        </View>
      )}

      {result && (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Resultado: {String(result.status)}</Text>
          <Text>{result.reason}</Text>
          {result.attendee && <Text>Asistente: {result.attendee.name || result.attendee.email}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  scannerContainer: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  webScanner: { width: '100%', height: 480 },
  btn: { marginTop: 12, backgroundColor: '#0284c7', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  actionsRow: { marginTop: 12 },
  result: { marginTop: 16, backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  resultTitle: { fontWeight: '800', marginBottom: 6 },
});
