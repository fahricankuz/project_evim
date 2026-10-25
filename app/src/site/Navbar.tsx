/* Üst alan: ince duyuru şeridi ve açılır menülü yapışkan gezinme (özellikler paneli). */
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../domain/i18n';
import { CONFIG } from '../domain/config';
import { Button, Container, PressScale, Text } from '../ui/kit';
import { Wordmark } from '../ui/Wordmark';
import { fonts, radius, shadows, useBreakpoint, useColors } from '../ui/theme';
import { Icon } from '../app-ui/blocks';
import { menu } from './content';

/** Duyuru şeridi: lacivertten mora geçen gradyan, üzerinde yavaşça gezinen mor bir ışık. Sayfayla birlikte kayar. */
export function TopBar() {
  const c = useColors();
  const { phone } = useBreakpoint();
  const reduced = useReducedMotion();
  const [w, setW] = useState(900);
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, p]);
  const glow = useAnimatedStyle(() => ({ transform: [{ translateX: -w * 0.1 + p.value * w * 0.7 }] }));
  const mail = () => Linking.openURL('mailto:' + CONFIG.supportEmail).catch(() => {});
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ backgroundColor: c.deepA, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="tb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#141C42" />
            <Stop offset="0.55" stopColor="#262C70" />
            <Stop offset="1" stopColor="#1B2350" />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="10" fill="url(#tb)" />
      </Svg>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: -26, width: 320, height: 64 }, glow]}>
        <Svg width="320" height="64" viewBox="0 0 320 64">
          <Defs>
            <RadialGradient id="gl" cx="50%" cy="60%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#A99BFF" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#A99BFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="160" cy="38" rx="160" ry="32" fill="url(#gl)" />
        </Svg>
      </Animated.View>
      <Container>
        <View style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: phone ? 'center' : 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="key" size={16} color={c.butter} />
            <RNText style={{ fontFamily: fonts.bodyBold, fontSize: phone ? 13 : 14, color: c.heroInk }}>{t('Kiracılar ücretsiz · Mülk sahipleri 14 gün kartsız dener')}</RNText>
          </View>
          {!phone && (
            <PressScale onPress={mail} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
              <Icon name="chat" size={16} color={c.heroInk} />
              <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: c.heroInk }}>{CONFIG.supportEmail}</RNText>
            </PressScale>
          )}
        </View>
      </Container>
    </View>
  );
}

function Dd({ children, size, color }: { children: any; size: number; color?: string }) {
  const c = useColors();
  return <RNText style={{ fontFamily: fonts.siteBold, fontSize: size, lineHeight: Math.round(size * 1.1), letterSpacing: -size * 0.02, color: color ?? c.ink }}>{children}</RNText>;
}

/** Açılır panel: sol kategoriler, ortada ilgili özellikler, sağda kayıt kartı. */
function MegaPanel({ onPick, go }: { onPick: () => void; go: (p: string) => void }) {
  const c = useColors();
  const { desktop } = useBreakpoint();
  const cats = menu();
  const [active, setActive] = useState(cats[0].id);
  const cat = cats.find((x) => x.id === active) || cats[0];
  return (
    <View style={{ position: 'absolute', top: 76, left: 0, right: 0, zIndex: 60 }}>
      <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(120)}
        style={{ backgroundColor: c.surface, borderRadius: 32, borderWidth: 1, borderColor: c.line, padding: 14, flexDirection: 'row', gap: 6, boxShadow: shadows.lift }}>
        <View style={{ width: 270, gap: 4 }} accessibilityRole="tablist">
          {cats.map((x) => {
            const on = x.id === active;
            return (
              <Pressable key={x.id} onHoverIn={() => setActive(x.id)} onPress={() => setActive(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52, borderRadius: 18, backgroundColor: on ? c.surface2 : 'transparent' }}>
                <Icon name={x.icon} size={20} color={on ? c.accentText : c.ink} />
                <RNText style={{ flex: 1, fontFamily: on ? fonts.bodyXBold : fonts.bodyBold, fontSize: 16, color: c.ink }}>{x.title}</RNText>
                <View style={{ transform: [{ rotate: '180deg' }], opacity: on ? 1 : 0.35 }}><Icon name="back" size={16} /></View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ width: 1, backgroundColor: c.line, marginVertical: 8 }} />
        <Animated.View key={cat.id} entering={FadeIn.duration(220)} style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 22, paddingVertical: 10, columnGap: 28, rowGap: 22, alignContent: 'flex-start' }}>
          {cat.items.map((it) => (
            <PressScale key={it.title} onPress={() => { onPick(); }} accessibilityRole="link" scaleTo={0.98} style={{ width: desktop ? '46%' : '100%', gap: 4 }}>
              <RNText style={{ fontFamily: fonts.bodyXBold, fontSize: 16, color: c.ink }}>{it.title}</RNText>
              <RNText style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: c.muted }}>{it.body}</RNText>
            </PressScale>
          ))}
        </Animated.View>
        {desktop && (
          <>
            <View style={{ width: 1, backgroundColor: c.line, marginVertical: 8 }} />
            <View style={{ width: 280, padding: 10, gap: 12 }}>
              <View style={{ height: 140, borderRadius: 22, backgroundColor: c.butter, padding: 14, justifyContent: 'center', gap: 8 }}>
                {[['Ocak', true], ['Şubat', true], ['Mart', false]].map(([m, ok]) => (
                  <View key={String(m)} style={{ backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: c.ink }}>{String(m)}</RNText>
                    <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: ok ? c.okInk : c.warnInk }}>{ok ? t('Ödendi') : t('Bekliyor')}</RNText>
                  </View>
                ))}
              </View>
              <Dd size={20}>{t('Ücretsiz hesabını aç')}</Dd>
              <Text v="small" muted>{t('Kiracılar ücretsiz. Mülk sahipleri 14 gün kartsız dener.')}</Text>
              <Button kind="primary" title={t('Kayıt ol')} onPress={() => { onPick(); go('/kayit'); }} />
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** Yapışkan hap menü. "Özellikler"e basınca panel açılır ve açık kalır; yeniden basınca (ya da Esc ile) kapanır. */
export function Nav({ go, scrollTo }: { go: (p: string) => void; scrollTo: (k: string) => void }) {
  const c = useColors();
  const { phone, desktop } = useBreakpoint();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  const links: [string, string][] = [['fiyat', t('Fiyatlar')], ['iletisim', t('İletişim')]];
  return (
    <View style={{ paddingTop: 14, paddingBottom: 6, backgroundColor: c.cream, zIndex: 20 }}>
      <Container>
        <View style={{ position: 'relative' }}>
          <View style={{ minHeight: 64, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingLeft: phone ? 14 : 22, paddingRight: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {phone ? <Wordmark size={22} animate /> : <Wordmark size={28} animate />}
            {!phone && (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Pressable onPress={() => setOpen((o) => !o)}
                  accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('Özellikler')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: open ? c.surface2 : 'transparent' }}>
                  <Text v="small" style={{ fontFamily: fonts.bodyXBold }}>{t('Özellikler')}</Text>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '-90deg' }] }}><Icon name="back" size={14} /></View>
                </Pressable>
                {links.map(([k, l]) => (
                  <PressScale key={k} onPress={() => { setOpen(false); scrollTo(k); }} accessibilityRole="link" style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                    <Text v="small" style={{ fontFamily: fonts.bodyXBold }}>{l}</Text>
                  </PressScale>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Button kind="ghost" title={t('Giriş yap')} onPress={() => go('/giris')} style={phone ? { paddingHorizontal: 10, minHeight: 44 } : undefined} />
              <Button kind="primary" title={t('Kayıt ol')} onPress={() => go('/kayit')} style={phone ? { paddingHorizontal: 14, minHeight: 44 } : undefined} />
            </View>
          </View>
          {open && !phone && (
            <MegaPanel go={go}
              onPick={() => { setOpen(false); scrollTo('ozellikler'); }} />
          )}
        </View>
      </Container>
    </View>
  );
}
