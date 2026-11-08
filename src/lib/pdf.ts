import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { byCategory, byDay, cardEstimate, dayLabel, money, periodLabel, rateText, totalJpy, yen, type Expense, type Trip } from './calc';
import { countryByCode } from './countries';

const INK = rgb(0.078, 0.137, 0.247);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.88, 0.91);
const ACCENT = rgb(0.122, 0.31, 0.847);
const STAMP = rgb(0.812, 0.227, 0.165);
const PAPER = rgb(0.933, 0.949, 0.961);
const W = 595.28;
const H = 841.89;
const M = 44;

const fetchFont = async (name: string) => {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${name}.ttf`);
  if (!res.ok) throw new Error(`font ${res.status}`);
  return res.arrayBuffer();
};

export const reportFilename = (trip: Trip) => `たびさいふ_${trip.name.replace(/[\\/:*?"<>|]/g, '')}.pdf`;

/** settle を渡すと「割り勘の精算」の欄を付ける（みんなの旅行用） */
export async function buildReportPdf(trip: Trip, expenses: Expense[], email: string, settle: string[] = []) {
  const [regBytes, boldBytes] = await Promise.all([fetchFont('NotoSansJP-Regular'), fetchFont('NotoSansJP-Bold')]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${trip.name} 旅行費用レポート`);
  doc.setCreator('たびさいふ');
  // pdf-lib の subset は日本語グリフが欠けるため、フォントを丸ごと埋め込む（約2.7MB）
  const reg = await doc.embedFont(regBytes, { subset: false });
  const bold = await doc.embedFont(boldBytes, { subset: false });
  const glyphs = (fontkit as unknown as { create(b: Uint8Array): { hasGlyphForCodePoint(c: number): boolean } }).create(new Uint8Array(regBytes));

  // 絵文字などフォントにない文字は省く（豆腐文字を出さない）
  const clean = (s: string) => [...s].filter(ch => glyphs.hasGlyphForCodePoint(ch.codePointAt(0)!)).join('');

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, yy: number, size: number, font: PDFFont = reg, color = INK) =>
    page.drawText(clean(s), { x, y: yy, size, font, color });
  const right = (s: string, x: number, yy: number, size: number, font: PDFFont = reg, color = INK) => {
    const c = clean(s);
    page.drawText(c, { x: x - font.widthOfTextAtSize(c, size), y: yy, size, font, color });
  };
  const fit = (s: string, max: number, size: number) => {
    let c = clean(s);
    if (reg.widthOfTextAtSize(c, size) <= max) return c;
    while (c && reg.widthOfTextAtSize(`${c}…`, size) > max) c = c.slice(0, -1);
    return `${c}…`;
  };
  const rule = (yy: number, color = LINE, thickness = 0.6) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });
  const ensure = (needed: number) => {
    if (y - needed < M + 24) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  const total = totalJpy(expenses);
  const estimate = cardEstimate(expenses, trip.card_fee_pct);

  // 見出し
  page.drawRectangle({ x: 0, y: H - 170, width: W, height: 170, color: PAPER });
  // エアメール風のストライプ
  for (let x = 0; x < W; x += 24) {
    page.drawRectangle({ x, y: H - 8, width: 16, height: 8, color: Math.round(x / 24) % 2 ? ACCENT : STAMP });
  }
  text('旅行費用レポート', M, H - 46, 10, bold, ACCENT);
  text(trip.name, M, H - 72, 20, bold);
  const meta = [countryByCode(trip.country_code)?.name, periodLabel(trip)].filter(Boolean).join('　');
  text(meta, M, H - 90, 9.5, reg, MUTED);
  text(trip.group ? 'あなたの負担額（自分だけの出費＋割り勘の取り分）' : '使った金額の合計（記録時の相場で円換算）', M, H - 118, 9, reg, MUTED);
  text(yen(total), M, H - 150, 28, bold);
  right('カード手数料を含めた目安', W - M, H - 122, 8.5, reg, MUTED);
  right(yen(estimate), W - M, H - 142, 16, bold);
  right(`カード分に ${trip.card_fee_pct}% 上乗せ`, W - M, H - 156, 8, reg, MUTED);
  y = H - 196;

  // カテゴリ別
  text('カテゴリ別', M, y, 11, bold);
  y -= 8;
  rule(y, INK, 0.8);
  y -= 15;
  for (const c of byCategory(expenses)) {
    text(c.label, M, y, 10);
    page.drawRectangle({ x: M + 56, y: y - 1, width: Math.max(2, 270 * c.share), height: 8, color: ACCENT, opacity: 0.75 });
    right(`${Math.round(c.share * 100)}%`, W - M - 84, y, 9, reg, MUTED);
    right(yen(c.jpy), W - M, y, 10, bold);
    y -= 17;
  }
  y -= 12;

  // 明細
  const COL = { memo: M, local: 372, rate: 432, jpy: W - M };
  const head = () => {
    text('明細', M, y, 11, bold);
    right('現地金額', COL.local, y, 8, reg, MUTED);
    right('1単位の円', COL.rate, y, 8, reg, MUTED);
    right('日本円', COL.jpy, y, 8, reg, MUTED);
    y -= 8;
    rule(y, INK, 0.8);
    y -= 16;
  };
  ensure(60);
  head();

  for (const day of [...byDay(expenses)].reverse()) {
    ensure(44);
    if (y === H - M) head();
    text(dayLabel(day.date), M, y, 9.5, bold);
    right(yen(day.jpy), COL.jpy, y, 9.5, bold);
    y -= 15;
    for (const e of day.items) {
      ensure(18);
      if (y === H - M) head();
      const pay = e.payment === 'card' ? 'カード' : '現金';
      const label = e.title ? `${e.title}` : byCategory([e])[0].label;
      text(fit(label, 190, 9), COL.memo + 8, y, 9);
      text(pay, COL.memo + 206, y, 7.5, reg, MUTED);
      right(money(e.amount_local, e.currency), COL.local, y, 8.5);
      right(rateText(e.rate_to_jpy), COL.rate, y, 8.5, reg, MUTED);
      right(yen(e.amount_jpy), COL.jpy, y, 9);
      y -= 5;
      rule(y);
      y -= 12;
    }
    y -= 6;
  }

  // 注記とページ番号
  if (settle.length) {
    ensure(40 + settle.length * 15);
    text('割り勘の精算', M, y, 11, bold);
    y -= 8;
    rule(y, INK, 0.8);
    y -= 16;
    for (const line of settle) {
      text(line, M + 8, y, 10);
      y -= 15;
    }
    y -= 10;
  }

  ensure(40);
  const notes = [
    '円換算は記録したときの相場による目安です。実際の請求額はカード会社の換算レートや手数料により異なります。',
    `レポート作成: ${new Date().toLocaleDateString('ja-JP')}　${email}`,
  ];
  notes.forEach((n, i) => text(n, M, y - i * 12, 7.5, reg, MUTED));

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: W - M - reg.widthOfTextAtSize(label, 8), y: 24, size: 8, font: reg, color: MUTED });
  });

  return doc.save();
}
