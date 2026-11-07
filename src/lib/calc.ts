export type Category = 'food' | 'shopping' | 'transport' | 'hotel' | 'sightseeing' | 'other';
export type Payment = 'card' | 'cash';

export interface Trip {
  id: string;
  name: string;
  country_code: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  card_fee_pct: number;
}

export interface Expense {
  id: string;
  trip_id: string;
  spent_on: string;
  title: string;
  category: Category;
  payment: Payment;
  amount_local: number;
  currency: string;
  rate_to_jpy: number;
  rate_date: string | null;
  amount_jpy: number;
}

export const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'food', label: '食事', icon: '🍽', color: 'var(--c-food)' },
  { id: 'shopping', label: '買い物', icon: '🛍', color: 'var(--c-shopping)' },
  { id: 'transport', label: '交通', icon: '🚆', color: 'var(--c-transport)' },
  { id: 'hotel', label: '宿泊', icon: '🏨', color: 'var(--c-hotel)' },
  { id: 'sightseeing', label: '観光', icon: '🎟', color: 'var(--c-sightseeing)' },
  { id: 'other', label: 'その他', icon: '📎', color: 'var(--c-other)' },
];

export const categoryOf = (id: Category) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[5];

/** 全角数字・カンマ小数・桁区切りを吸収して金額にする。不正なら null */
export function parseAmount(input: string): number | null {
  let s = input.trim()
    .replace(/[０-９．，]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s/g, '');
  if (!s) return null;
  // 「1,234.50」は桁区切り、「12,50」は小数として扱う
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 1e12 ? n : null;
}

export const toJpy = (amount: number, rate: number) => Math.round(amount * rate);

type Summable = Pick<Expense, 'amount_jpy' | 'payment'>;

export const totalJpy = (items: Summable[]) => items.reduce((sum, e) => sum + Number(e.amount_jpy), 0);

/** カード分にだけ海外事務手数料の目安を上乗せした金額 */
export function cardEstimate(items: Summable[], feePct: number) {
  return items.reduce(
    (sum, e) => sum + (e.payment === 'card' ? Math.round(Number(e.amount_jpy) * (1 + feePct / 100)) : Number(e.amount_jpy)),
    0,
  );
}

export function byCategory(items: Expense[]) {
  const total = totalJpy(items);
  return CATEGORIES
    .map(c => {
      const jpy = totalJpy(items.filter(e => e.category === c.id));
      return { ...c, jpy, share: total ? jpy / total : 0 };
    })
    .filter(c => c.jpy > 0)
    .sort((a, b) => b.jpy - a.jpy);
}

export function byDay(items: Expense[]) {
  const days = new Map<string, Expense[]>();
  for (const e of items) days.set(e.spent_on, [...(days.get(e.spent_on) ?? []), e]);
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, items: list, jpy: totalJpy(list) }));
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

export function money(n: number, currency: string) {
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })} ${currency}`;
}

export function rateText(rate: number) {
  const digits = rate >= 100 ? 2 : rate >= 1 ? 3 : 4;
  return rate.toLocaleString('ja-JP', { maximumFractionDigits: digits });
}

export function dayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}月${d}日（${WEEK[new Date(y, m - 1, d).getDay()]}）`;
}

export function shortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

export function periodLabel(trip: Pick<Trip, 'start_date' | 'end_date'>) {
  if (trip.start_date && trip.end_date) return `${trip.start_date.replaceAll('-', '/')} - ${shortDate(trip.end_date)}`;
  return (trip.start_date ?? trip.end_date ?? '').replaceAll('-', '/');
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
