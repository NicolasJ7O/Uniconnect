import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable } from 'react-native';
import { searchStudents } from '@/lib/student-api';
import StudentProfileModal from '@/components/StudentProfileModal';
import { Colors } from '@/constants/Colors';

export default function StudentSearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const doSearch = (text: string, nextPage = 1) => {
    setQuery(text);
    if (debounceRef.current) window.clearTimeout(debounceRef.current as any);
    debounceRef.current = window.setTimeout(async () => {
      if (!text || text.trim().length < 2) {
        setResults([]);
        setTotal(undefined);
        return;
      }
      setLoading(true);
      try {
        const { results: res, total: t } = await searchStudents(text.trim(), nextPage, 20);
        if (nextPage > 1) setResults((prev) => [...prev, ...res]);
        else setResults(res || []);
        setTotal(t);
        setPage(nextPage);
      } catch (e) {
        console.error('Error searching students', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350) as unknown as number;
  };

  const openProfile = (id: string) => {
    setSelected(id);
    setModalOpen(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Buscar Estudiantes</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre o correo"
        value={query}
        onChangeText={(t) => doSearch(t, 1)}
      />

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openProfile(item.id)}>
            <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{(item.name || item.email || 'U').charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || item.email}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
            <Text style={styles.viewText}>Ver</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Buscando...' : 'Empieza a escribir para buscar'}</Text>}
        ListFooterComponent={() => (
          total && results.length < (total || 0) ? (
            <Pressable style={{ padding: 12, alignItems: 'center' }} onPress={() => doSearch(query, page + 1)}>
              <Text style={{ color: '#0a7ea4', fontWeight: '800' }}>{loading ? 'Cargando...' : 'Cargar más'}</Text>
            </Pressable>
          ) : null
        )}
      />

      <StudentProfileModal visible={modalOpen} onClose={() => setModalOpen(false)} userId={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  header: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#eef2f7' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarInitial: { color: '#fff', fontWeight: '800' },
  name: { fontWeight: '800' },
  email: { color: '#64748b', fontSize: 12 },
  viewText: { color: Colors.light.tint, fontWeight: '800' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },
});
