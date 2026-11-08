export type Category = 'food' | 'shopping' | 'transport' | 'hotel' | 'sightseeing' | 'other';
export type Payment = 'card' | 'cash';

export interface Member {
  uid: string;
  name: string;
}

export interface GroupInfo {
  /** 参加用の招待コード */
  code: string;
  members: Member[];
}

export interface Trip {
  id: string;
  name: string;
  country_code: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  card_fee_pct: number;
  /** みんなで行く旅行なら参加者の情報。ひとり旅なら null */
  group: GroupInfo | null;
}

export interface SharedInfo {
  /** 立て替えた人 */
  paid_by: string;
  /** 均等に割る人 */
  split: string[];
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
  /** 割り勘の出費なら立て替えた人と割る人。自分だけの出費なら null */
  shared: SharedInfo | null;
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

/** 割り勘1件の各人の負担額。1円未満の端数は uid 順に1円ずつ配る */
export function sharesOf(e: Pick<Expense, 'amount_jpy' | 'shared'>) {
  const shares = new Map<string, number>();
  const split = [...(e.shared?.split ?? [])].sort();
  if (!split.length) return shares;
  const amount = Number(e.amount_jpy);
  const base = Math.floor(amount / split.length);
  let rest = amount - base * split.length;
  for (const uid of split) {
    shares.set(uid, base + (rest > 0 ? 1 : 0));
    rest -= 1;
  }
  return shares;
}

/** 自分が実際に負担する分だけに直した明細（自分だけの出費＋割り勘の自分の取り分） */
export function myBurden(items: Expense[], uid: string): Expense[] {
  return items
    .map(e => (e.shared ? { ...e, amount_jpy: sharesOf(e).get(uid) ?? 0 } : e))
    .filter(e => e.amount_jpy > 0);
}

export interface Balance extends Member {
  /** 立て替えた合計 */
  paid: number;
  /** 本来の負担の合計 */
  owed: number;
  /** 多く払っている額（マイナスなら払い足りない） */
  net: number;
}

/** 割り勘の出費について、誰がどれだけ多く払っているか */
export function balances(items: Expense[], members: Member[]): Balance[] {
  const rows = new Map<string, Balance>(members.map(m => [m.uid, { ...m, paid: 0, owed: 0, net: 0 }]));
  const row = (uid: string) => {
    if (!rows.has(uid)) rows.set(uid, { uid, name: '抜けたメンバー', paid: 0, owed: 0, net: 0 });
    return rows.get(uid)!;
  };
  for (const e of items) {
    if (!e.shared) continue;
    row(e.shared.paid_by).paid += Number(e.amount_jpy);
    for (const [uid, share] of sharesOf(e)) row(uid).owed += share;
  }
  return [...rows.values()].map(r => ({ ...r, net: r.paid - r.owed }));
}

export interface Transfer {
  from: Member;
  to: Member;
  amount: number;
}

/** 精算に必要な支払い。払い足りない人から多く払った人へ、回数が少なくなるように組む */
export function settlements(rows: Balance[]): Transfer[] {
  const debtors = rows.filter(r => r.net < 0).map(r => ({ ...r, left: -r.net })).sort((a, b) => b.left - a.left);
  const creditors = rows.filter(r => r.net > 0).map(r => ({ ...r, left: r.net })).sort((a, b) => b.left - a.left);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) out.push({ from: debtors[i], to: creditors[j], amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i += 1;
    if (creditors[j].left === 0) j += 1;
  }
  return out;
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

export function money(n: number, currency: string) {
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })} ${currency}`;
}

/** 通貨ごとの小数の桁数（円・ウォンは0、ユーロ・ドルは2 など） */
export function fractionDigits(currency: string) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** 金額をその通貨の書き方で。円は「¥1,234」、それ以外は「12.50 EUR」 */
export function formatMoney(amount: number, currency: string) {
  if (currency === 'JPY') return yen(amount);
  const d = fractionDigits(currency);
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ${currency}`;
}

/**
 * 旅行の割り勘で使う「1現地通貨あたりの円」。
 * その通貨で記録した割り勘の実際の相場の平均を使い、記録がなければ最新の相場を使う。
 */
export function tripRate(items: Expense[], currency: string, live?: number | null) {
  if (currency === 'JPY') return 1;
  const same = items.filter(e => e.shared && e.currency === currency);
  const local = same.reduce((s, e) => s + Number(e.amount_local), 0);
  if (local > 0) return same.reduce((s, e) => s + Number(e.amount_jpy), 0) / local;
  return live ?? null;
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
