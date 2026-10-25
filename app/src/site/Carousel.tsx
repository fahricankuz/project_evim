/* Yatay kayan özellik kartları: her kartta küçük bir arayüz çizimi, başlık, açıklama ve düğme. */
import React, { useRef, useState } from 'react';
import { Text as RNText, ScrollView, View } from 'react-native';
import { t } from '../domain/i18n';
import { Button, PressScale, Text } from '../ui/kit';
import { fonts, radius, useBreakpoint, useColors } from '../ui/theme';
import { Icon } from '../app-ui/blocks';
import { more } from './content';

function Row2({ a, b, tone }: { a: string; b: string; tone?: 'ok' | 'warn' | 'plain' }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: c.ink }}>{a}</RNText>
      <RNText style={{ fontFamily: fonts.bodyXBold, fontSize: 13, color: tone === 'ok' ? c.okInk : tone === 'warn' ? c.warnInk : c.ink }}>{b}</RNText>
    </View>
  );
}

/** Kartın içindeki küçük çizim; her biri uygulamadaki gerçek bir parçanın sadeleştirilmişi. */
function Art({ id }: { id: string }) {
  const c = useColors();
  switch (id) {
    case 'foto': return (
      <View style={{ gap: 8 }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: c.surface, borderRadius: 18, borderBottomLeftRadius: 6, padding: 8, gap: 6, maxWidth: '85%' }}>
          <View style={{ height: 76, borderRadius: 12, backgroundColor: c.sky, alignItems: 'center', justifyContent: 'center' }}><Icon name="meter" size={34} color={c.accentText} /></View>
          <RNText style={{ fontFamily: fonts.body, fontSize: 13, color: c.ink }}>{t('Kombi basıncı düşüyor')}</RNText>
        </View>
        <View style={{ alignSelf: 'flex-end', backgroundColor: c.ink, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
          <RNText style={{ fontFamily: fonts.body, fontSize: 13, color: c.bg }}>{t('Gördüm, yarın servis arayacak.')}</RNText>
        </View>
      </View>
    );
    case 'kontrol': return (
      <View style={{ gap: 8 }}>
        <Row2 a="dekont-ekim.jpg" b={t('İncelemede')} tone="warn" />
        <Row2 a="sozlesme.pdf" b={t('Onaylandı')} tone="ok" />
        <Row2 a="fatura.jpg" b={t('Onaylandı')} tone="ok" />
      </View>
    );
    case 'gecmis': return (
      <View style={{ gap: 8 }}>
        <Row2 a={t('1 Ocak')} b="₺30.000" />
        <Row2 a={t('1 Temmuz')} b="₺36.500" />
        <Row2 a={t('Yeni dönem')} b="₺45.000" tone="ok" />
      </View>
    );
    case 'gider': return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 }}>
        {[40, 62, 48, 80, 66, 100].map((h, i) => <View key={i} style={{ flex: 1, height: h, borderRadius: 8, backgroundColor: i === 5 ? c.accent : c.sky }} />)}
      </View>
    );
    case 'vergi': return (
      <View style={{ gap: 8 }}>
        <Row2 a={t('Götürü gider')} b="₺18.400" />
        <Row2 a={t('Gerçek gider')} b="₺12.150" tone="ok" />
        <Row2 a={t('Tahmini fark')} b="₺6.250" />
      </View>
    );
    case 'tip': return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {[['home', t('Konut')], ['office', t('Ofis')], ['shop', t('Mağaza')], ['box', t('Depo')]].map(([n, l]) => (
          <View key={n} style={{ width: '44%', backgroundColor: c.surface, borderRadius: 18, alignItems: 'center', paddingVertical: 14, gap: 4 }}>
            <Icon name={n} size={26} /><RNText style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: c.ink }}>{l}</RNText>
          </View>
        ))}
      </View>
    );
    case 'stopaj': return (
      <View style={{ gap: 8 }}>
        <Row2 a={t('Brüt kira')} b="₺50.000" />
        <Row2 a={t('Stopaj %20')} b="− ₺10.000" tone="warn" />
        <Row2 a={t('Hesaba yatacak')} b="₺40.000" tone="ok" />
      </View>
    );
    case 'coklu': return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 20 }}>
        {['AK', 'MY', 'SD'].map((x, i) => (
          <View key={x} style={{ width: 62, height: 62, borderRadius: 31, marginLeft: i ? -14 : 0, backgroundColor: [c.butter, c.sage, c.peach][i], borderWidth: 3, borderColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <RNText style={{ fontFamily: fonts.bodyXBold, fontSize: 17, color: c.ink }}>{x}</RNText>
          </View>
        ))}
      </View>
    );
    case 'takip': return (
      <View style={{ gap: 8 }}>
        <Row2 a={t('Kira vadesi')} b={t('3 gün')} tone="warn" />
        <Row2 a={t('DASK bitişi')} b={t('52 gün')} />
        <Row2 a={t('Sözleşme yenileme')} b={t('69 gün')} />
      </View>
    );
    default: return (
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['JSON', 'CSV', t('Yazışma')].map((x) => <View key={x} style={{ backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12 }}><RNText style={{ fontFamily: fonts.bodyXBold, fontSize: 14, color: c.ink }}>{x}</RNText></View>)}
      </View>
    );
  }
}

export function FeatureCarousel({ go }: { go: (p: string) => void }) {
  const c = useColors();
  const { phone, desktop } = useBreakpoint();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [x, setX] = useState(0);
  const cards = more();
  const cw = phone ? 276 : 340, gap = 16, step = cw + gap;
  const go2 = (dir: number) => ref.current?.scrollTo({ x: Math.max(0, Math.round(x / step) * step + dir * step), animated: true });
  const tones = [c.sky, c.butter, c.sage, c.peach, c.rose];
  return (
    <View style={{ gap: 16 }}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" scrollEventThrottle={32}
        onScroll={(e) => setX(e.nativeEvent.contentOffset.x)} contentContainerStyle={{ gap, paddingVertical: 4, paddingRight: 8 }}>
        {cards.map((m: any, i: number) => (
          <View key={m.id} style={{ width: cw, backgroundColor: c.surface, borderRadius: 32, borderWidth: 1, borderColor: c.line, padding: 22, gap: 14 }}>
            <RNText style={{ fontFamily: fonts.siteBold, fontSize: 22, lineHeight: 25, letterSpacing: -0.4, color: c.ink }}>{m.title}</RNText>
            <Text v="small" muted style={{ minHeight: 60 }}>{m.body}</Text>
            <View style={{ height: 190, borderRadius: 22, backgroundColor: tones[i % tones.length], padding: 16, justifyContent: 'center' }}><Art id={m.id} /></View>
            <Button kind="primary" block title={t('Hemen dene')} onPress={() => go('/kayit')} />
          </View>
        ))}
      </ScrollView>
      {desktop && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[-1, 1].map((d) => (
            <PressScale key={d} onPress={() => go2(d)} accessibilityRole="button" accessibilityLabel={d < 0 ? t('Önceki') : t('Sonraki')}
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ transform: [{ rotate: d < 0 ? '0deg' : '180deg' }] }}><Icon name="back" size={18} /></View>
            </PressScale>
          ))}
        </View>
      )}
    </View>
  );
}
