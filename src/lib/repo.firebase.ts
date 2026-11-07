import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, reload, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User as FbUser,
} from 'firebase/auth';
import { get, getDatabase, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { toJpy, type Expense, type Trip } from './calc';
import type { ExpenseInput, Repo, TripInput, TripWithItems, User } from './repo';

const env = import.meta.env;
const continueUrl = () => ({ url: location.origin + location.pathname });
const toUser = (u: FbUser | null): User | null => (u ? { id: u.uid, email: u.email ?? '', verified: u.emailVerified } : null);

type Stored<T> = Record<string, Omit<T, 'id'>> | null;

function asTrip(id: string, t: Omit<Trip, 'id'>): Trip {
  return {
    id, name: t.name, country_code: t.country_code, currency: t.currency,
    start_date: t.start_date ?? null, end_date: t.end_date ?? null, card_fee_pct: Number(t.card_fee_pct),
  };
}

function asExpense(id: string, tripId: string, e: Omit<Expense, 'id' | 'trip_id'>): Expense {
  return { ...e, id, trip_id: tripId, title: e.title ?? '', rate_date: e.rate_date ?? null };
}

const byNewest = (a: Expense, b: Expense) => b.spent_on.localeCompare(a.spent_on);

// データは users/{uid} の下にだけ置き、読み書きの可否は database.rules.json が判定する
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
  const mine = (path = '') => ref(db, `tabi_saifu/users/${uid()}${path}`);

  function tripRecord(input: TripInput) {
    // Realtime Database は null を保存しないので、空の日付は項目ごと消す
    return { ...input, start_date: input.start_date ?? null, end_date: input.end_date ?? null };
  }

  function expenseRecord(input: ExpenseInput) {
    const { trip_id: _trip, ...rest } = input;
    return { ...rest, amount_jpy: toJpy(input.amount_local, input.rate_to_jpy) };
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
      await sendEmailVerification(user, continueUrl());
      return true;
    },
    async signOut() {
      await signOut(auth);
    },
    async sendPasswordReset(email) {
      try {
        await sendPasswordResetEmail(auth, email, continueUrl());
      } catch (err) {
        // 登録の有無を外部に知らせない
        if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
      }
    },
    async resendVerification() {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser, continueUrl());
    },
    async refreshUser() {
      if (!auth.currentUser) return null;
      await reload(auth.currentUser);
      // 確認済みの状態をデータベース側の判定にも反映させる
      await auth.currentUser.getIdToken(true);
      return toUser(auth.currentUser);
    },

    async listTrips() {
      const [trips, expenses] = await Promise.all([get(mine('/trips')), get(mine('/expenses'))]);
      const tripMap = (trips.val() as Stored<Trip>) ?? {};
      const expMap = (expenses.val() as Record<string, Stored<Expense>> | null) ?? {};
      return Object.entries(tripMap)
        .sort(([, a], [, b]) => Number((b as { created_at?: number }).created_at ?? 0) - Number((a as { created_at?: number }).created_at ?? 0))
        .map(([id, t]): TripWithItems => ({
          ...asTrip(id, t),
          expenses: Object.values(expMap[id] ?? {}).map(e => ({ amount_jpy: Number(e.amount_jpy), payment: e.payment })),
        }));
    },
    async createTrip(input) {
      const node = push(mine('/trips'));
      await set(node, { ...tripRecord(input), created_at: serverTimestamp() });
      return asTrip(node.key!, input);
    },
    async updateTrip(id, input) {
      await update(mine(`/trips/${id}`), tripRecord(input));
    },
    async deleteTrip(id) {
      // 旅行と明細を1回の書き込みでまとめて消す
      await update(mine(), { [`trips/${id}`]: null, [`expenses/${id}`]: null });
    },

    async listExpenses(tripId) {
      const snap = await get(mine(`/expenses/${tripId}`));
      const map = (snap.val() as Stored<Expense>) ?? {};
      return Object.entries(map).map(([id, e]) => asExpense(id, tripId, e)).sort(byNewest);
    },
    async addExpense(input) {
      const node = push(mine(`/expenses/${input.trip_id}`));
      const record = expenseRecord(input);
      await set(node, { ...record, created_at: serverTimestamp() });
      return asExpense(node.key!, input.trip_id, record);
    },
    async updateExpense(id, input) {
      const record = expenseRecord(input);
      await update(mine(`/expenses/${input.trip_id}/${id}`), { ...record, rate_date: record.rate_date ?? null });
      return asExpense(id, input.trip_id, record);
    },
    async deleteExpense(tripId, id) {
      await set(mine(`/expenses/${tripId}/${id}`), null);
    },
  };
}
