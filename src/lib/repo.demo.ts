import { myBurden, toJpy, type Expense, type Trip } from './calc';
import { newInviteCode, normalizeCode, type AuthEvent, type Repo, type TripInput, type TripWithItems, type User } from './repo';

// 動作確認・マニュアル撮影専用。VITE_DEMO=1 のときだけ読み込まれ、本番には入らない。
// 本番の Realtime Database と同じく「本人の場所」と「参加者だけの場所」を分けて持つ。
type SoloTrip = TripInput & { id: string; owner: string };
type Owned<T> = T & { owner: string };
interface DemoGroup {
  id: string;
  meta: TripInput;
  code: string;
  members: Record<string, string>;
  expenses: Expense[];
}
interface Store {
  users: Record<string, string>;
  session: string | null;
  trips: SoloTrip[];
  expenses: Owned<Expense>[];
  groups: DemoGroup[];
  /** 参加しているみんなの旅行での、自分だけの出費 */
  gexpenses: Owned<Expense>[];
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
      currency: 'EUR', rate_to_jpy: 185.19, rate_date: '2026-05-01', amount_jpy: toJpy(amount_local, 185.19), shared: null,
    })),
    groups: [sampleGroup()],
    gexpenses: [{
      id: 'sample-g-mine', owner: DEMO_USER, trip_id: 'sample-seoul', spent_on: '2026-06-11', title: '自分用のコスメ', category: 'shopping',
      payment: 'card', amount_local: 32000, currency: 'KRW', rate_to_jpy: 0.11, rate_date: '2026-06-10', amount_jpy: toJpy(32000, 0.11), shared: null,
    }],
  };
}

function sampleGroup(): DemoGroup {
  const FRIEND = 'friend@example.com';
  const rows: [string, string, Expense['category'], number, string][] = [
    ['2026-06-11', '焼肉の夕食', 'food', 96000, DEMO_USER],
    ['2026-06-11', 'タクシー', 'transport', 18000, FRIEND],
    ['2026-06-10', 'ホテル2泊', 'hotel', 240000, DEMO_USER],
    ['2026-06-10', '空港鉄道', 'transport', 19000, FRIEND],
  ];
  return {
    id: 'sample-seoul',
    meta: { name: 'ソウル旅行（サンプル）', country_code: 'KR', currency: 'KRW', start_date: '2026-06-10', end_date: '2026-06-12', card_fee_pct: 2 },
    code: 'K7QF3M',
    members: { [DEMO_USER]: 'はなこ', [FRIEND]: 'ともだち' },
    expenses: rows.map(([spent_on, title, category, amount_local, paid_by], i) => ({
      id: `sample-g-${i}`, trip_id: 'sample-seoul', spent_on, title, category, payment: 'card', amount_local, currency: 'KRW',
      rate_to_jpy: 0.11, rate_date: '2026-06-10', amount_jpy: toJpy(amount_local, 0.11), shared: { paid_by, split: [DEMO_USER, FRIEND] },
    })),
  };
}

let memory: Store | null = null;
const load = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { groups: [], gexpenses: [], ...JSON.parse(raw) };
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
const asUser = (email: string | null): User | null => (email ? { id: email, email, verified: true } : null);

const listeners = new Set<(e: AuthEvent) => void>();
const emit = (email: string | null) => listeners.forEach(l => l({ user: asUser(email) }));

function owner() {
  const s = load();
  if (!s.session) throw new Error('not signed in');
  return s.session;
}

const groupTrip = (g: DemoGroup): Trip => ({
  ...g.meta, id: g.id, group: { code: g.code, members: Object.entries(g.members).map(([uid, name]) => ({ uid, name })) },
});

/** 参加者でなければ読めない（本番のルールと同じ振る舞い） */
function memberGroup(s: Store, id: string, me: string) {
  const g = s.groups.find(x => x.id === id);
  if (!g || !g.members[me]) throw new Error('PERMISSION_DENIED');
  return g;
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
  async resendVerification() {},
  async refreshUser() {
    return asUser(load().session);
  },

  async listTrips() {
    const s = load();
    const me = owner();
    const solo = s.trips.filter(t => t.owner === me).map(({ owner: _o, ...t }) => ({
      ...t, group: null, items: s.expenses.filter(e => e.trip_id === t.id && e.owner === me) as Expense[],
    }));
    const groups = s.groups.filter(g => g.members[me]).map(g => ({
      ...groupTrip(g), items: [...g.expenses, ...s.gexpenses.filter(e => e.trip_id === g.id && e.owner === me)],
    }));
    return [...solo, ...groups].reverse().map(({ items, ...t }): TripWithItems => ({
      ...t, expenses: myBurden(items, me).map(e => ({ amount_jpy: e.amount_jpy, payment: e.payment })),
    }));
  },
  async createTrip(input, group) {
    const s = load();
    const me = owner();
    const id = crypto.randomUUID();
    if (group) {
      const g: DemoGroup = { id, meta: input, code: newInviteCode(), members: { [me]: group.name }, expenses: [] };
      s.groups.push(g);
      save(s);
      return groupTrip(g);
    }
    s.trips.push({ ...input, id, owner: me });
    save(s);
    return { ...input, id, group: null };
  },
  async updateTrip(trip, input) {
    const s = load();
    const me = owner();
    if (trip.group) memberGroup(s, trip.id, me).meta = input;
    else s.trips = s.trips.map(t => (t.id === trip.id && t.owner === me ? { ...t, ...input } : t));
    save(s);
  },
  async deleteTrip(trip) {
    const s = load();
    const me = owner();
    if (trip.group) {
      delete memberGroup(s, trip.id, me).members[me];
      s.gexpenses = s.gexpenses.filter(e => !(e.trip_id === trip.id && e.owner === me));
    } else {
      s.trips = s.trips.filter(t => !(t.id === trip.id && t.owner === me));
      s.expenses = s.expenses.filter(e => !(e.trip_id === trip.id && e.owner === me));
    }
    save(s);
  },
  async joinGroup(code, name) {
    const s = load();
    const g = s.groups.find(x => x.code === normalizeCode(code));
    if (!g) throw new Error('invite-not-found');
    g.members[owner()] = name;
    save(s);
    return g.id;
  },

  async listExpenses(trip) {
    const s = load();
    const me = owner();
    const items = trip.group
      ? [...memberGroup(s, trip.id, me).expenses, ...s.gexpenses.filter(e => e.trip_id === trip.id && e.owner === me)]
      : s.expenses.filter(e => e.trip_id === trip.id && e.owner === me);
    return items.map(e => ({ ...e })).sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  },
  async addExpense(trip, input) {
    const s = load();
    const me = owner();
    const e: Expense = { ...input, id: crypto.randomUUID(), amount_jpy: toJpy(input.amount_local, input.rate_to_jpy) };
    if (input.shared) memberGroup(s, trip.id, me).expenses.unshift(e);
    else (trip.group ? s.gexpenses : s.expenses).unshift({ ...e, owner: me });
    save(s);
    return e;
  },
  async updateExpense(trip, before, input) {
    await demoRepo.deleteExpense(trip, before);
    const s = load();
    const me = owner();
    const e: Expense = { ...input, id: before.id, amount_jpy: toJpy(input.amount_local, input.rate_to_jpy) };
    if (input.shared) memberGroup(s, trip.id, me).expenses.unshift(e);
    else (trip.group ? s.gexpenses : s.expenses).unshift({ ...e, owner: me });
    save(s);
    return e;
  },
  async deleteExpense(trip, expense) {
    const s = load();
    const me = owner();
    if (expense.shared) {
      const g = memberGroup(s, trip.id, me);
      g.expenses = g.expenses.filter(e => e.id !== expense.id);
    } else if (trip.group) {
      s.gexpenses = s.gexpenses.filter(e => !(e.id === expense.id && e.owner === me));
    } else {
      s.expenses = s.expenses.filter(e => !(e.id === expense.id && e.owner === me));
    }
    save(s);
  },
};
