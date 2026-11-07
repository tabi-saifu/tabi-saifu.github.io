import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildReportPdf } from '../src/lib/pdf';
import type { Expense, Trip } from '../src/lib/calc';

const trip: Trip = {
  id: 't', name: 'パリ・ニース家族旅行', country_code: 'FR', currency: 'EUR',
  start_date: '2026-05-01', end_date: '2026-05-08', card_fee_pct: 2,
};

const CATS = ['food', 'shopping', 'transport', 'hotel', 'sightseeing', 'other'] as const;
const items: Expense[] = Array.from({ length: 62 }, (_, i) => ({
  id: String(i), trip_id: 't', spent_on: `2026-05-0${(i % 8) + 1}`,
  title: i === 3 ? '絵文字😀入りの、とても長いメモをここに書いて幅からはみ出さないことを確かめるための文章です' : `買い物 ${i + 1}`,
  category: CATS[i % 6], payment: i % 3 ? 'card' : 'cash',
  amount_local: 12.5 + i, currency: i % 7 ? 'EUR' : 'GBP', rate_to_jpy: 185.185185, rate_date: '2026-05-01',
  amount_jpy: Math.round((12.5 + i) * 185.185185),
}));

describe('PDFレポート', () => {
  it('日本語・複数ページ・絵文字入りでも作れる', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const name = url.split('fonts/')[1];
      const buf = readFileSync(`public/fonts/${name}`);
      return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    });
    const pdf = await buildReportPdf(trip, items, 'me@example.com');
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe('%PDF');
    expect(pdf.length).toBeLessThan(6_000_000);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  });
});
