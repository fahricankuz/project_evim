import { useState } from 'react';
import { View } from 'react-native';
import AuthShell from '../auth/AuthShell';
import { useAuth } from '../auth/auth';
import { t } from '../domain/i18n';
import { Button, Field, Text } from '../ui/kit';

/** Mülke bağlı olmayan gerçek hesaplı kiracı: mülk sahibinin verdiği kodu girer. */
export default function JoinCode() {
  const { user, join, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setErr(null); const e = await join(code); setBusy(false); if (e) setErr(e); };
  return (
    <AuthShell title={t('Mülkine bağlan')} lead={t('Mülk sahibinden aldığın davet kodunu gir. Kodu mülk sahibin Kiracım’da “Kiracı ekle” ile oluşturur.')}>
      <Text v="small" muted>{user?.name ? t('Merhaba') + ' ' + user.name : t('Hoş geldin')}</Text>
      <Field label={t('Davet kodu')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={12} onSubmitEditing={submit} error={err} />
      <Button block title={t('Mülke bağlan')} onPress={submit} loading={busy} />
      <View style={{ alignItems: 'center' }}><Button kind="ghost" title={t('Çıkış yap')} onPress={() => signOut()} /></View>
    </AuthShell>
  );
}
