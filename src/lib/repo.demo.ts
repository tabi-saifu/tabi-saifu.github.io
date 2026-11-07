import { toJpy, type Expense, type Trip } from './calc';
import type { AuthEvent, Repo, TripWithItems, User } from './repo';

// 動作確認・マニュアル撮影専用。VITE_DEMO=1 のときだけ読み込まれ、本番には入らない。
interface Store {
  users: Record<string, string>;
  session: string | null;
  trips: (Trip & { owner: string })[];
  expenses: (Expense & { owner: string })[];
}

const KEY = 'tabi-saifu.demo';
const DEMO_USER = 'demo@example.com';

function seed(): Store {
  const trip = { id: 'sample-paris', owner: DEMO_USER, name: 'パリ旅行（サンプル）', country_code: 'FR', currency: 'EUR', start_date: '2026-05-01', end_date: '2026-05-06', card_fee_pct: 2 };
  const rows: [string, string, Expense['category'], Expense['payment'], number][] = [
    ['2026-05-02', 'ホテル1泊', 'hotel', 'card', 129],
    ['2026-05-02', 'オルセー美術館', 'sightseeing', 'cash', 16],
    ['2026-05-01', 'ビストロの夕食', 'food', 'card', 68],
    ['2026-05-01', 'お土産のチョコ', 'shopping', 'card', 24.5],
    ['2026-05-01', '空港からの電車', 'transport', 'card', 11.8],
  ];
  return {
    users: { [DEMO_USER]: 'demo-password' },
    session: DEMO_USER,
    trips: [trip],
    expenses: rows.map(([spent_on, title, category, payment, amount_local], i) => ({
      id: `sample-${i}`, owner: DEMO_USER, trip_id: trip.id, spent_on, title, category, payment, amount_local,
      currency: 'EUR', rate_to_jpy: 185.19, rate_date: '2026-05-01', amount_jpy: toJpy(amount_local, 185.19),
    })),
  };
}
let memory: Store | null = null;
const load = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ストレージが使えない環境ではメモリだけで動かす
  }
  return memory ?? seed();
};
const save = (s: Store) => {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 同上
  }
};
const asUser = (email: string | null): User | null => (email ? { id: email, email } : null);

const listeners = new Set<(e: AuthEvent) => void>();
const emit = (email: string | null) => listeners.forEach(l => l({ user: asUser(email) }));

function owner() {
  const s = load();
  if (!s.session) throw new Error('not signed in');
  return s.session;
}

export const demoRepo: Repo = {
  async currentUser() {
    return asUser(load().session);
  },
  onAuth(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async signIn(email, password) {
    const s = load();
    if (s.users[email] !== password) throw new Error('Invalid login credentials');
    s.session = email;
    save(s);
    emit(email);
  },
  async signUp(email, password) {
    const s = load();
    if (s.users[email]) throw new Error('User already registered');
    s.users[email] = password;
    s.session = email;
    save(s);
    emit(email);
    return false;
  },
  async signOut() {
    const s = load();
    s.session = null;
    save(s);
    emit(null);
  },
  async sendPasswordReset() {},
  async updatePassword() {},

  async listTrips() {
    const s = load();
    const me = owner();
    return s.trips.filter(t => t.owner === me).reverse().map(t => ({
      ...t,
      expenses: s.expenses.filter(e => e.trip_id === t.id && e.owner === me),
    })) as TripWithItems[];
  },
  async createTrip(input) {
    const s = load();
    const trip = { ...input, id: crypto.randomUUID(), owner: owner() };
    s.trips.push(trip);
    save(s);
    return trip;
  },
  async updateTrip(id, input) {
    const s = load();
    const me = owner();
    s.trips = s.trips.map(t => (t.id === id && t.owner === me ? { ...t, ...input } : t));
    save(s);
  },
  async deleteTrip(id) {
    const s = load();
    const me = owner();
    s.trips = s.trips.filter(t => !(t.id === id && t.owner === me));
    s.expenses = s.expenses.filter(e => !(e.trip_id === id && e.owner === me));
    save(s);
  },

  async listExpenses(tripId) {
    const me = owner();
    return load().expenses.filter(e => e.trip_id === tripId && e.owner === me)
      .sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  },
  async addExpense(input) {
    const s = load();
    const e = { ...input, id: crypto.randomUUID(), owner: owner(), amount_jpy: toJpy(input.amount_local, input.rate_to_jpy) };
    s.expenses.unshift(e);
    save(s);
    return e;
  },
  async updateExpense(id, input) {
    const s = load();
    const me = owner();
    let out: Expense | undefined;
    s.expenses = s.expenses.map(e => {
      if (e.id !== id || e.owner !== me) return e;
      const next = { ...e, ...input, amount_jpy: toJpy(input.amount_local, input.rate_to_jpy) };
      out = next;
      return next;
    });
    save(s);
    if (!out) throw new Error('not found');
    return out;
  },
  async deleteExpense(id) {
    const s = load();
    const me = owner();
    s.expenses = s.expenses.filter(e => !(e.id === id && e.owner === me));
    save(s);
  },
};
