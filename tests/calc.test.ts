import { describe, expect, it } from 'vitest';
import { balances, byCategory, byDay, cardEstimate, myBurden, parseAmount, settlements, sharesOf, toJpy, totalJpy, type Expense } from '../src/lib/calc';
import { buildMime, sameMailbox } from '../src/lib/mail';

const e = (over: Partial<Expense>): Expense => ({
  id: '1', trip_id: 't', spent_on: '2026-05-01', title: '', category: 'food', payment: 'card',
  amount_local: 10, currency: 'EUR', rate_to_jpy: 180, rate_date: null, amount_jpy: 1800, shared: null, ...over,
});

describe('割り勘', () => {
  const A = { uid: 'a', name: 'はなこ' };
  const B = { uid: 'b', name: 'じろう' };
  const C = { uid: 'c', name: 'さぶろう' };
  const split = (paid_by: string, members: string[], amount_jpy: number) => e({ amount_jpy, shared: { paid_by, split: members } });

  it('均等に割り、1円の端数も合計が元の金額に一致する', () => {
    const s = sharesOf(split('a', ['a', 'b', 'c'], 1000));
    expect([...s.values()].reduce((x, y) => x + y, 0)).toBe(1000);
    expect([...s.values()].sort()).toEqual([333, 333, 334]);
  });

  it('自分の負担は「自分だけの出費」と「割り勘の取り分」の合計', () => {
    const items = [e({ amount_jpy: 500 }), split('b', ['a', 'b'], 3000), split('a', ['b'], 800)];
    expect(totalJpy(myBurden(items, 'a'))).toBe(500 + 1500);
  });

  it('だれがどれだけ多く払っているかと、精算の支払い', () => {
    const items = [split('a', ['a', 'b', 'c'], 9000), split('b', ['a', 'b', 'c'], 3000), e({ amount_jpy: 99999 })];
    const rows = balances(items, [A, B, C]);
    expect(rows.map(r => [r.name, r.paid, r.owed, r.net])).toEqual([
      ['はなこ', 9000, 4000, 5000],
      ['じろう', 3000, 4000, -1000],
      ['さぶろう', 0, 4000, -4000],
    ]);
    expect(rows.reduce((s, r) => s + r.net, 0)).toBe(0);
    expect(settlements(rows).map(t => [t.from.name, t.to.name, t.amount])).toEqual([
      ['さぶろう', 'はなこ', 4000],
      ['じろう', 'はなこ', 1000],
    ]);
  });

  it('全員が同じだけ払っていれば精算はない', () => {
    const items = [split('a', ['a', 'b'], 2000), split('b', ['a', 'b'], 2000)];
    expect(settlements(balances(items, [A, B]))).toEqual([]);
  });
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
