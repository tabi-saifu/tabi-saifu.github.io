import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, reload, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User as FbUser,
} from 'firebase/auth';
import { get, getDatabase, push, ref, serverTimestamp, update } from 'firebase/database';
import { myBurden, toJpy, type Expense, type Member, type Trip } from './calc';
import { DEFAULT_PROFILE, newInviteCode, normalizeCode, type ExpenseInput, type Repo, type TripInput, type TripWithItems, type User } from './repo';

const env = import.meta.env;
const continueUrl = () => ({ url: location.origin + location.pathname });

/** 公開先のドメインが Firebase にまだ登録されていなくても、戻り先なしでメールを送る */
async function withContinueUrl(send: (settings?: { url: string }) => Promise<void>) {
  try {
    await send(continueUrl());
  } catch (err) {
    if (!/continue-uri|unauthorized-domain/.test((err as { code?: string }).code ?? '')) throw err;
    await send();
  }
}
const toUser = (u: FbUser | null): User | null => (u ? { id: u.uid, email: u.email ?? '', verified: u.emailVerified } : null);

type StoredTrip = Omit<Trip, 'id' | 'group'> & { created_at?: number };
type StoredExpense = Omit<Expense, 'id' | 'trip_id' | 'shared'> & { shared?: { paid_by: string; split: Record<string, true> } };
type StoredGroup = {
  meta: StoredTrip;
  code: string;
  members?: Record<string, { name: string }>;
  expenses?: Record<string, StoredExpense>;
};

function asTrip(id: string, t: StoredTrip, group: Trip['group'] = null): Trip {
  return {
    id, name: t.name, country_code: t.country_code, currency: t.currency,
    start_date: t.start_date ?? null, end_date: t.end_date ?? null, card_fee_pct: Number(t.card_fee_pct), group,
  };
}

function asExpense(id: string, tripId: string, e: StoredExpense): Expense {
  return {
    ...e, id, trip_id: tripId, title: e.title ?? '', rate_date: e.rate_date ?? null,
    amount_local: Number(e.amount_local), rate_to_jpy: Number(e.rate_to_jpy), amount_jpy: Number(e.amount_jpy),
    shared: e.shared ? { paid_by: e.shared.paid_by, split: Object.keys(e.shared.split ?? {}) } : null,
  };
}

const entries = <T>(map: Record<string, T> | null | undefined) => Object.entries(map ?? {});
const byNewest = (a: Expense, b: Expense) => b.spent_on.localeCompare(a.spent_on);

// データは tabi_saifu/ の下にだけ置き、読み書きの可否は database.rules.json が判定する。
//   users/{uid}/trips, expenses         ひとり旅とその明細（本人だけ）
//   users/{uid}/groups, gexpenses       参加しているみんなの旅行と、そこでの自分だけの出費（本人だけ）
//   groups/{gid}                        みんなの旅行。割り勘の明細を含め、参加者だけが読める
//   invites/{code}                      招待コードから旅行を探すための索引
export function firebaseRepo(): Repo {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  auth.languageCode = 'ja';
  const db = getDatabase(app);

  const uid = () => {
    if (!auth.currentUser) throw new Error('not signed in');
    return auth.currentUser.uid;
  };
  const at = (path = '') => ref(db, `tabi_saifu${path}`);

  function tripRecord(input: TripInput) {
    // Realtime Database は null を保存しないので、空の日付は項目ごと消す
    return { ...input, start_date: input.start_date ?? null, end_date: input.end_date ?? null };
  }

  function expenseRecord(input: ExpenseInput) {
    const { trip_id: _trip, shared, ...rest } = input;
    return {
      ...rest,
      rate_date: rest.rate_date ?? null,
      amount_jpy: toJpy(input.amount_local, input.rate_to_jpy),
      shared: shared ? { paid_by: shared.paid_by, split: Object.fromEntries(shared.split.map(m => [m, true as const])) } : null,
    };
  }

  /** 明細の置き場所。割り勘はみんなの場所、それ以外は自分の場所 */
  function expensePath(trip: Trip, shared: boolean) {
    if (shared && trip.group) return `groups/${trip.id}/expenses`;
    return trip.group ? `users/${uid()}/gexpenses/${trip.id}` : `users/${uid()}/expenses/${trip.id}`;
  }

  async function loadGroup(gid: string) {
    const snap = await get(at(`/groups/${gid}`));
    if (!snap.exists()) return null;
    const g = snap.val() as StoredGroup;
    const members: Member[] = entries(g.members).map(([id, m]) => ({ uid: id, name: m.name }));
    return {
      trip: asTrip(gid, g.meta, { code: g.code, members }),
      created: Number(g.meta.created_at ?? 0),
      shared: entries(g.expenses).map(([id, e]) => asExpense(id, gid, e)),
    };
  }

  async function personalOf(gid: string) {
    const snap = await get(at(`/users/${uid()}/gexpenses/${gid}`));
    return entries(snap.val() as Record<string, StoredExpense> | null).map(([id, e]) => asExpense(id, gid, e));
  }

  return {
    async currentUser() {
      await auth.authStateReady();
      return toUser(auth.currentUser);
    },
    onAuth(cb) {
      return onAuthStateChanged(auth, u => cb({ user: toUser(u) }));
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signUp(email, password) {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await withContinueUrl(settings => sendEmailVerification(user, settings));
      return true;
    },
    async signOut() {
      await signOut(auth);
    },
    async sendPasswordReset(email) {
      try {
        await withContinueUrl(settings => sendPasswordResetEmail(auth, email, settings));
      } catch (err) {
        // 登録の有無を外部に知らせない
        if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
      }
    },
    async resendVerification() {
      const user = auth.currentUser;
      if (user) await withContinueUrl(settings => sendEmailVerification(user, settings));
    },
    async refreshUser() {
      if (!auth.currentUser) return null;
      await reload(auth.currentUser);
      // 確認済みの状態をデータベース側の判定にも反映させる
      await auth.currentUser.getIdToken(true);
      return toUser(auth.currentUser);
    },

    async getProfile() {
      const snap = await get(at(`/users/${uid()}/profile`));
      return { ...DEFAULT_PROFILE, ...(snap.val() ?? {}) };
    },
    async saveProfile(profile) {
      await update(at(`/users/${uid()}/profile`), { home_country: profile.home_country });
    },

    async listTrips() {
      const me = uid();
      const snap = await get(at(`/users/${me}`));
      const mine = (snap.val() ?? {}) as {
        trips?: Record<string, StoredTrip>;
        expenses?: Record<string, Record<string, StoredExpense>>;
        groups?: Record<string, true>;
        gexpenses?: Record<string, Record<string, StoredExpense>>;
      };
      const solo = entries(mine.trips).map(([id, t]) => ({
        created: Number(t.created_at ?? 0),
        trip: asTrip(id, t),
        items: entries(mine.expenses?.[id]).map(([eid, e]) => asExpense(eid, id, e)),
      }));
      const groups = await Promise.all(Object.keys(mine.groups ?? {}).map(async gid => {
        // 抜けた旅行や読めなくなった旅行は一覧から外す
        const g = await loadGroup(gid).catch(() => null);
        if (!g) return null;
        const own = entries(mine.gexpenses?.[gid]).map(([eid, e]) => asExpense(eid, gid, e));
        return { created: g.created, trip: g.trip, items: [...g.shared, ...own] };
      }));
      return [...solo, ...groups.filter(g => g !== null)]
        .sort((a, b) => b.created - a.created)
        .map(({ trip, items }): TripWithItems => ({
          ...trip,
          expenses: myBurden(items, me).map(e => ({ amount_jpy: e.amount_jpy, payment: e.payment })),
        }));
    },
    async createTrip(input, group) {
      const me = uid();
      if (!group) {
        const node = push(at(`/users/${me}/trips`));
        await update(node, { ...tripRecord(input), created_at: serverTimestamp() });
        return asTrip(node.key!, input);
      }
      const gid = push(at('/groups')).key!;
      // 招待コードがたまたま使用中なら、ルールで拒否されるので作り直す
      for (let attempt = 0; ; attempt += 1) {
        const code = newInviteCode();
        try {
          await update(at(), {
            [`groups/${gid}/meta`]: { ...tripRecord(input), owner: me, created_at: serverTimestamp() },
            [`groups/${gid}/code`]: code,
            [`groups/${gid}/members/${me}`]: { name: group.name, code, joined_at: serverTimestamp() },
            [`invites/${code}`]: { gid },
            [`users/${me}/groups/${gid}`]: true,
          });
          return asTrip(gid, input, { code, members: [{ uid: me, name: group.name }] });
        } catch (err) {
          if (attempt >= 2) throw err;
        }
      }
    },
    async updateTrip(trip, input) {
      const path = trip.group ? `/groups/${trip.id}/meta` : `/users/${uid()}/trips/${trip.id}`;
      await update(at(path), tripRecord(input));
    },
    async deleteTrip(trip) {
      const me = uid();
      if (trip.group) {
        // みんなの記録は残し、自分だけ抜ける
        await update(at(), {
          [`groups/${trip.id}/members/${me}`]: null,
          [`users/${me}/groups/${trip.id}`]: null,
          [`users/${me}/gexpenses/${trip.id}`]: null,
        });
        return;
      }
      // 旅行と明細を1回の書き込みでまとめて消す
      await update(at(`/users/${me}`), { [`trips/${trip.id}`]: null, [`expenses/${trip.id}`]: null });
    },
    async joinGroup(rawCode, name) {
      const me = uid();
      const code = normalizeCode(rawCode);
      const snap = await get(at(`/invites/${code}`)).catch(() => null);
      const gid = snap?.val()?.gid as string | undefined;
      if (!gid) throw new Error('invite-not-found');
      await update(at(), {
        [`groups/${gid}/members/${me}`]: { name, code, joined_at: serverTimestamp() },
        [`users/${me}/groups/${gid}`]: true,
      });
      return gid;
    },

    async listExpenses(trip) {
      if (!trip.group) {
        const snap = await get(at(`/users/${uid()}/expenses/${trip.id}`));
        return entries(snap.val() as Record<string, StoredExpense> | null).map(([id, e]) => asExpense(id, trip.id, e)).sort(byNewest);
      }
      const [g, own] = await Promise.all([loadGroup(trip.id), personalOf(trip.id)]);
      return [...(g?.shared ?? []), ...own].sort(byNewest);
    },
    async addExpense(trip, input) {
      const node = push(at(`/${expensePath(trip, Boolean(input.shared))}`));
      const record = expenseRecord(input);
      await update(node, { ...record, created_at: serverTimestamp() });
      return asExpense(node.key!, trip.id, { ...record, shared: input.shared ? record.shared! : undefined });
    },
    async updateExpense(trip, before, input) {
      const record = expenseRecord(input);
      const from = `${expensePath(trip, Boolean(before.shared))}/${before.id}`;
      const to = `${expensePath(trip, Boolean(input.shared))}/${before.id}`;
      if (from === to) {
        await update(at(`/${to}`), record);
      } else {
        // 割り勘と自分だけを切り替えたら、置き場所ごと移す
        await update(at(), { [from]: null, [to]: { ...record, created_at: serverTimestamp() } });
      }
      return asExpense(before.id, trip.id, { ...record, shared: input.shared ? record.shared! : undefined });
    },
    async deleteExpense(trip, expense) {
      await update(at(), { [`${expensePath(trip, Boolean(expense.shared))}/${expense.id}`]: null });
    },
  };
}
