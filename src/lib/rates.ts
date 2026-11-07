export interface RateTable {
  /** 通貨コード → 1通貨あたりの円 */
  toJpy: Record<string, number>;
  /** 相場の基準日 (YYYY-MM-DD) */
  date: string;
  /** 取得時刻 (ms) */
  fetchedAt: number;
  /** 通信できず、前回の相場を使っているとき true */
  stale?: boolean;
}

const KEY = 'tabi-saifu.rates';
const FRESH_MS = 60 * 60 * 1000;

function invert(perJpy: Record<string, number>) {
  const toJpy: Record<string, number> = {};
  for (const [code, r] of Object.entries(perJpy)) {
    if (r > 0) toJpy[code] = Number((1 / r).toFixed(6));
  }
  toJpy.JPY = 1;
  return toJpy;
}

async function fromErApi(): Promise<RateTable> {
  const res = await fetch('https://open.er-api.com/v6/latest/JPY');
  if (!res.ok) throw new Error(`er-api ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success') throw new Error('er-api failed');
  return {
    toJpy: invert(json.rates),
    date: new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10),
    fetchedAt: Date.now(),
  };
}

// 予備。欧州中央銀行の公表値で、対応通貨は主要通貨のみ。
async function fromFrankfurter(): Promise<RateTable> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=JPY');
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const json = await res.json();
  return { toJpy: invert(json.rates), date: json.date, fetchedAt: Date.now() };
}

function readCache(): RateTable | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RateTable) : null;
  } catch {
    return null;
  }
}

/** 最新の円相場。圏外では前回の値（stale）を返し、一度も取れていなければ例外を投げる */
export async function getRates(force = false): Promise<RateTable> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;
  try {
    const table = await fromErApi().catch(fromFrankfurter);
    try {
      localStorage.setItem(KEY, JSON.stringify(table));
    } catch {
      // 保存できなくても今回の表示には影響しない
    }
    return table;
  } catch (err) {
    if (cached) return { ...cached, stale: true };
    if (import.meta.env.VITE_DEMO === '1') {
      return { toJpy: { EUR: 185.19, USD: 158.33, KRW: 0.11, GBP: 208.33, TWD: 4.9, THB: 4.6, JPY: 1 }, date: new Date().toISOString().slice(0, 10), fetchedAt: Date.now() };
    }
    throw err;
  }
}
