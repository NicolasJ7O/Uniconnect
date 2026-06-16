import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image, ActivityIndicator } from 'react-native';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { eventApi } from '@/lib/event-api';
import { useToast } from '@/components/Toast';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

const storage = {
  get: async (key: string) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    try { return await SecureStore.getItemAsync(key); } catch (e) { return null; }
  },
  set: async (key: string, value: string) => {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else try { await SecureStore.setItemAsync(key, value); } catch (e) {}
  }
};

export default function VerifyQrScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { showToast } = useToast();

  const [pendingScans, setPendingScans] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      const pending = await storage.get('pending_qr_scans');
      if (pending) setPendingScans(JSON.parse(pending));
    })();
  }, []);

  const savePending = async (tokens: string[]) => {
    setPendingScans(tokens);
    await storage.set('pending_qr_scans', JSON.stringify(tokens));
  };

  const syncPending = async () => {
    if (pendingScans.length === 0 || syncing) return;
    setSyncing(true);
    const newPending = [...pendingScans];
    for (let i = newPending.length - 1; i >= 0; i--) {
      try {
        await eventApi.verifyQr(newPending[i]);
        newPending.splice(i, 1);
      } catch (e: any) {
        // If it's a network error, we keep it. If it's a server error (e.g. invalid), we can remove it.
        if (e.response) newPending.splice(i, 1);
      }
    }
    await savePending(newPending);
    setSyncing(false);
    showToast(newPending.length === 0 ? 'Sincronización completa' : `Quedan ${newPending.length} pendientes`, newPending.length === 0 ? 'success' : 'info');
  };

  const handleBarCodeScanned = async ({ data }: BarCodeScannerResult) => {
    if (scanned) return;
    setScanned(true);
    try {
      const res = await eventApi.verifyQr(data);
      setResult(res);
      showToast(res.valid ? 'Pase válido' : String(res.reason || 'No válido'), res.valid ? 'success' : 'error');
    } catch (e: any) {
      console.error('Error verifying QR', e);
      if (!e.response) {
        // Offline or Network Error
        await savePending([...pendingScans, data]);
        setResult({
          status: 'PENDING_SYNC',
          reason: 'Sin conexión. El pase se validará cuando se recupere la red.',
          valid: false,
        });
        showToast('Guardado localmente', 'info');
      } else {
        setResult({ status: 'INVALID', reason: 'Token inválido o malformado' });
        showToast('Error al verificar QR', 'error');
      }
    }
  };

  const renderResult = () => {
    if (!result) return null;

    let bgColor = '#fef2f2';
    let borderColor = '#fecaca';
    let iconName: any = 'close-circle';
    let iconColor = '#ef4444';
    let statusText = 'No válido';

    if (result.status === 'VALID' || result.valid) {
      bgColor = '#f0fdf4';
      borderColor = '#bbf7d0';
      iconName = 'checkmark-circle';
      iconColor = '#22c55e';
      statusText = 'Válido';
    } else if (result.status === 'ALREADY_VERIFIED') {
      bgColor = '#fefce8';
      borderColor = '#fef08a';
      iconName = 'warning';
      iconColor = '#eab308';
      statusText = 'Ya verificado';
    } else if (result.status === 'PENDING_SYNC') {
      bgColor = '#f1f5f9';
      borderColor = '#cbd5e1';
      iconName = 'cloud-offline';
      iconColor = '#64748b';
      statusText = 'Pendiente de Sincronización';
    }

    return (
      <View style={[styles.resultCard, { backgroundColor: bgColor, borderColor }]}>
        <View style={styles.resultHeader}>
          <Ionicons name={iconName} size={28} color={iconColor} />
          <Text style={[styles.resultTitle, { color: iconColor }]}>{statusText}</Text>
        </View>
        <Text style={styles.reasonText}>{result.reason || 'Acceso concedido'}</Text>
        
        {result.status === 'ALREADY_VERIFIED' && result.verifiedAt && (
          <Text style={styles.timestampText}>Primer acceso: {new Date(result.verifiedAt).toLocaleString()}</Text>
        )}

        {result.attendee && (
          <View style={styles.attendeeProfile}>
            <Image 
              source={{ uri: result.attendee.avatarUrl || 'https://i.pravatar.cc/150?u=' + result.attendee.id }} 
              style={styles.avatar} 
            />
            <View>
              <Text style={styles.attendeeName}>{result.attendee.name || 'Usuario'}</Text>
              <Text style={styles.attendeeEmail}>{result.attendee.email}</Text>
            </View>
          </View>
        )}
      </View>
    );
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.title}>Escanea el QR</Text>
        {pendingScans.length > 0 && (
          <Pressable onPress={syncPending} style={styles.syncBtn}>
            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={16} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Sync ({pendingScans.length})</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={Platform.OS === 'web' ? styles.webScanner : StyleSheet.absoluteFillObject}
        />
      </View>

      {scanned && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.btn} onPress={() => { setScanned(false); setResult(null); }}>
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.btnText}>Escanear nuevamente</Text>
          </Pressable>
        </View>
      )}

      {renderResult()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#0f172a' },
  scannerContainer: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 4, borderColor: '#e2e8f0' },
  webScanner: { width: '100%', height: 480 },
  btn: { marginTop: 16, backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  actionsRow: { marginTop: 4 },
  syncBtn: { flexDirection: 'row', backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignItems: 'center' },
  resultCard: { marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 2 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  resultTitle: { fontWeight: '900', fontSize: 18 },
  reasonText: { color: '#475569', fontSize: 14, marginBottom: 12, fontWeight: '500' },
  timestampText: { color: '#b45309', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  attendeeProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e2e8f0' },
  attendeeName: { fontWeight: '800', fontSize: 15, color: '#0f172a' },
  attendeeEmail: { color: '#64748b', fontSize: 13 },
});
