import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthShell from '../auth/AuthShell';
import { keepInvite, useAuth } from '../auth/auth';
import { t } from '../domain/i18n';
import { Button, Text } from '../ui/kit';
import { View } from 'react-native';
import { useColors, fonts } from '../ui/theme';

/** Davet bağlantısı: kod saklanır, hesap açıldıktan / giriş yapıldıktan sonra mülke bağlanılır. */
export default function Katil() {
  const { kod } = useLocalSearchParams<{ kod?: string }>();
  const { user, ready, join, live } = useAuth();
  const router = useRouter();
  const c = useColors();
  // Statik çıktıda adres parametresi yoktur; hidrasyon uyuşsun diye kod bağlandıktan sonra çizilir.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const code = mounted ? String(Array.isArray(kod) ? kod[0] : kod || '').toUpperCase() : '';
  useEffect(() => {
    if (!mounted) return;
    if (!code) { router.replace('/giris'); return; }
    keepInvite(code);
    if (ready && live && user && !user.admin) join(code).then(() => router.replace('/uygulama'));
  }, [mounted, code, ready, live, user, join, router]);
  return (
    <AuthShell title={t('Kiraladığın mülke davet edildin')} lead={t('Mülk sahibin seni Kiracım’a davet etti. Hesabını oluştur ya da giriş yap; kiraladığın mülke otomatik bağlanacaksın.')}>
      {code ? (
        <View style={{ backgroundColor: c.cream, borderRadius: 20, padding: 16, alignItems: 'center' }}>
          <Text v="h2" selectable style={{ letterSpacing: 4, fontFamily: fonts.siteBold }}>{code}</Text>
        </View>
      ) : null}
      <Button kind="primary" block title={t('Kiracı hesabı oluştur')} onPress={() => router.push('/kayit/kiraci')} />
      <Button block kind="primary" title={t('Hesabım var, giriş yap')} onPress={() => router.push('/giris/kiraci')} />
    </AuthShell>
  );
}
