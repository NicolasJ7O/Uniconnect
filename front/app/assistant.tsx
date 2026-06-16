import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import AssistantWidget from '@/components/AssistantWidget';
import { loadSession } from '@/lib/session';

export default function AssistantPage() {
  const [session, setSession] = React.useState<any | null>(null);

  React.useEffect(() => {
    (async () => {
      const s = await loadSession();
      setSession(s);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chatbot UniConnect</Text>
      <AssistantWidget session={session} roleLabel={session?.user?.role ?? 'user'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontWeight: '800', fontSize: 18, marginBottom: 12 },
});
