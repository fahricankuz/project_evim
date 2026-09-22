/* Konut kira geliri için tahmini vergi hesabı.

   ORANLAR KODA GÖMÜLÜDÜR ve her yıl güncellenmelidir. Yeni yıl için:
   1. Aşağıdaki RATES tablosuna yılı ekleyin.
   2. istisna: GVK md. 21 konut kira geliri istisna tutarı (o yılın gelirleri için).
   3. brackets: GVK md. 103 ücret dışı gelir tarifesi — [dilim üst sınırı, oran].
   4. goturu: götürü gider oranı.
   Kaynak: Gelir İdaresi Başkanlığı (gib.gov.tr) yıllık rehberleri.

   Bir yılın verisi yoksa en yakın önceki yıl kullanılır ve ekranda
   "yaklaşık" uyarısı gösterilir. Hesap bilgi amaçlıdır; beyan öncesi
   mali müşavire danışılmalıdır. */

export const RATES = {
  2023: {
    istisna: 21000,
    goturu: 0.15,
    brackets: [[70000, 0.15], [150000, 0.20], [370000, 0.27], [1900000, 0.35], [Infinity, 0.40]]
  },
  2024: {
    istisna: 33000,
    goturu: 0.15,
    brackets: [[110000, 0.15], [230000, 0.20], [580000, 0.27], [3000000, 0.35], [Infinity, 0.40]]
  },
  2025: {
    istisna: 47000,
    goturu: 0.15,
    brackets: [[158000, 0.15], [330000, 0.20], [800000, 0.27], [4300000, 0.35], [Infinity, 0.40]]
  }
};

/** Yılın oranları; yoksa en yakın önceki yıl (approx: true). */
export function ratesFor(year){
  const y = Number(year);
  if (RATES[y]) return { year:y, approx:false, ...RATES[y] };
  const known = Object.keys(RATES).map(Number).sort((a, b) => a - b);
  const prev = known.filter(k => k < y).pop() ?? known[0];
  return { year:prev, approx:true, ...RATES[prev] };
}

/** Artan oranlı tarifeye göre vergi. */
export function progressive(base, brackets){
  let tax = 0, lower = 0;
  for (const [upper, rate] of brackets){
    if (base <= lower) break;
    tax += (Math.min(base, upper) - lower) * rate;
    lower = upper;
  }
  return Math.max(0, Math.round(tax));
}

/**
 * Götürü ve gerçek gider yöntemlerini karşılaştırır.
 * @param {number} gross   yıl içinde tahsil edilen konut kira geliri
 * @param {number} expenses belgeli giderler
 * @param {{year:number, noExemption?:boolean}} o
 */
export function estimate(gross, expenses, o){
  const r = ratesFor(o.year);
  const istisna = o.noExemption ? 0 : r.istisna;

  if (gross <= istisna){
    return { rates:r, istisna, gross, taxable:0, belowExemption:true, goturu:{ base:0, tax:0 }, gercek:{ base:0, tax:0, allowed:0 }, best:'goturu' };
  }

  const taxable = gross - istisna;
  // İstisna uygulanınca giderlerin yalnızca vergiye tabi kısma düşen payı indirilebilir.
  const allowed = Math.round(expenses * (taxable / gross));

  const goturuBase = Math.round(taxable * (1 - r.goturu));
  const gercekBase = Math.max(0, taxable - allowed);

  const goturu = { base:goturuBase, tax:progressive(goturuBase, r.brackets) };
  const gercek = { base:gercekBase, tax:progressive(gercekBase, r.brackets), allowed };

  return { rates:r, istisna, gross, taxable, belowExemption:false, goturu, gercek, best: gercek.tax < goturu.tax ? 'gercek' : 'goturu' };
}
