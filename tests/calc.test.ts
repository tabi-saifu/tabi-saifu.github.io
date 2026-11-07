import { describe, expect, it } from 'vitest';
import { byCategory, byDay, cardEstimate, parseAmount, toJpy, totalJpy, type Expense } from '../src/lib/calc';
import { buildMime, sameMailbox } from '../src/lib/mail';

const e = (over: Partial<Expense>): Expense => ({
  id: '1', trip_id: 't', spent_on: '2026-05-01', title: '', category: 'food', payment: 'card',
  amount_local: 10, currency: 'EUR', rate_to_jpy: 180, rate_date: null, amount_jpy: 1800, ...over,
});

describe('金額の入力', () => {
  it.each([
    ['24.5', 24.5], ['1,234.50', 1234.5], ['12,50', 12.5], ['１２００', 1200], ['1,000', 1000], [' 8 ', 8],
  ])('%s → %d', (input, want) => expect(parseAmount(input)).toBe(want));
  it.each(['', '0', '-5', 'abc', '1.234', '1.2.3'])('%s は無効', input => expect(parseAmount(input)).toBeNull());
});

describe('集計', () => {
  const items = [
    e({ amount_jpy: 1000, category: 'food', payment: 'card', spent_on: '2026-05-01' }),
    e({ amount_jpy: 3000, category: 'shopping', payment: 'cash', spent_on: '2026-05-02' }),
    e({ amount_jpy: 500, category: 'food', payment: 'card', spent_on: '2026-05-02' }),
  ];
  it('合計は明細の和', () => expect(totalJpy(items)).toBe(4500));
  it('手数料はカード分だけに乗る', () => expect(cardEstimate(items, 2)).toBe(1020 + 3000 + 510));
  it('日別は新しい順で小計が合う', () => {
    expect(byDay(items).map(d => [d.date, d.jpy])).toEqual([['2026-05-02', 3500], ['2026-05-01', 1000]]);
  });
  it('カテゴリ別は多い順で割合の合計が1', () => {
    const c = byCategory(items);
    expect(c.map(x => x.id)).toEqual(['shopping', 'food']);
    expect(c.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });
  it('円換算は四捨五入', () => expect(toJpy(24.5, 183.33)).toBe(4492));
});

describe('自分宛てメール', () => {
  it('差出人と宛先が同じになる', () => {
    const mime = buildMime({ to: 'me@example.com', subject: '件名', body: '本文', filename: 'レポート.pdf', pdf: new Uint8Array([1, 2, 3]) });
    expect(mime).toContain('From: me@example.com\r\nTo: me@example.com\r\n');
    expect(mime).toContain('application/pdf');
  });
  it('同じ Gmail の表記ゆれは同一扱い、別人は別扱い', () => {
    expect(sameMailbox('Ta.Ro@gmail.com', 'taro@googlemail.com')).toBe(true);
    expect(sameMailbox('taro@gmail.com', 'jiro@gmail.com')).toBe(false);
    expect(sameMailbox('a.b@example.com', 'ab@example.com')).toBe(false);
  });
});
