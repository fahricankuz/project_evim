import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import AuthShell from './AuthShell';
import { Role, useAuth } from './auth';
import { Captcha } from './captcha';
import { CONFIG } from '../domain/config';
import { t } from '../domain/i18n';
import { Button, Field, PressScale, Text } from '../ui/kit';
import { fonts, radius, useColors } from '../ui/theme';

export default function SignupForm({ role }: { role: Role }) {
  const { user, ready, signUp } = useAuth();
  const router = useRouter();
  const c = useColors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Redirect href="/uygulama" />;
  const submit = async () => {
    if (!consent) { setErr(t('Devam etmek için koşulları kabul etmelisin.')); return; }
    setBusy(true); setErr(null);
    const e = await signUp({ name, email, password: pw, role });
    setBusy(false);
    if (e === 'CONFIRM') setInfo(t('E-postana bir onay bağlantısı gönderdik. Onayladıktan sonra giriş yapabilirsin.'));
    else if (e) setErr(e);
    else router.replace('/uygulama');
  };
  const landlord = role === 'landlord';
  return (
    <AuthShell title={landlord ? t('Mülk sahibi olarak kayıt ol') : t('Kiracı olarak kayıt ol')} lead={landlord ? t('Mülk sahipleri 14 gün kartsız dener.') : t('Kiracılar ücretsiz.')}>
      <Field label={t('Ad soyad')} value={name} onChangeText={setName} autoComplete="name" maxLength={60} />
      <Field label={t('E-posta')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t('Şifre')} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" hint={t('En az 8 karakter.')} />
      <PressScale onPress={() => setConsent(!consent)} accessibilityRole="checkbox" aria-checked={consent} accessibilityState={{ checked: consent }} scaleTo={0.99} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: consent ? c.accent : c.line, backgroundColor: consent ? c.accent : c.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          {consent && <Text v="small" color={c.accentInk} style={{ fontFamily: fonts.bodyXBold, lineHeight: 18 }}>✓</Text>}
        </View>
        <Text v="small" muted style={{ flex: 1 }}>
          <Text v="small" color={c.accentText} onPress={() => Linking.openURL(CONFIG.legal.terms)}>{t('Kullanım Koşulları’nı')}</Text>
          {t(' kabul ediyorum; ')}
          <Text v="small" color={c.accentText} onPress={() => Linking.openURL(CONFIG.legal.privacy)}>{t('Gizlilik ve KVKK Aydınlatma Metni’ni')}</Text>
          {t(' okudum.')}
        </Text>
      </PressScale>
      {err ? <Text v="small" color={c.badInk}>{err}</Text> : null}
      {info ? <Text v="small" color={c.okInk}>{info}</Text> : null}
      <Captcha />
      <Button kind="primary" block title={t('Hesap oluştur')} onPress={submit} loading={busy} />
      <PressScale onPress={() => router.push(landlord ? '/giris/mulk-sahibi' : '/giris/kiraci')} accessibilityRole="link"><Text v="small" color={c.accentText} style={{ fontFamily: fonts.bodyBold }}>{t('Hesabın var mı? Giriş yap')}</Text></PressScale>
      <PressScale onPress={() => router.replace(landlord ? '/kayit/kiraci' : '/kayit/mulk-sahibi')} accessibilityRole="link"><Text v="small" muted>{landlord ? t('Kiracı mısın? Kiracı olarak kayıt ol') : t('Mülk sahibi misin? Mülk sahibi olarak kayıt ol')}</Text></PressScale>
    </AuthShell>
  );
}
