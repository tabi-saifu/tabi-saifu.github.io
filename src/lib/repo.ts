import type { Expense, Payment, Trip } from './calc';

export interface User {
  id: string;
  email: string;
  /** メールアドレスの確認が済んでいるか。未確認の間はデータに触れない */
  verified: boolean;
}

export type TripWithItems = Trip & { expenses: { amount_jpy: number; payment: Payment }[] };
export type TripInput = Omit<Trip, 'id'>;
export type ExpenseInput = Omit<Expense, 'id' | 'amount_jpy'>;
export type AuthEvent = { user: User | null };

export interface Repo {
  currentUser(): Promise<User | null>;
  onAuth(cb: (e: AuthEvent) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** 確認メールの確認待ちなら true */
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  resendVerification(): Promise<void>;
  /** 確認メールのリンクを押した後に、最新の状態を取り直す */
  refreshUser(): Promise<User | null>;

  listTrips(): Promise<TripWithItems[]>;
  createTrip(input: TripInput): Promise<Trip>;
  updateTrip(id: string, input: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;

  listExpenses(tripId: string): Promise<Expense[]>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(tripId: string, id: string): Promise<void>;
}

const MESSAGES: [RegExp, string][] = [
  [/invalid-credential|wrong-password|user-not-found|invalid login/i, 'メールアドレスまたはパスワードが違います。'],
  [/email-already-in-use|already registered/i, 'このメールアドレスは登録済みです。ログインしてください。'],
  [/too-many-requests|rate limit/i, '操作が集中しています。しばらく待ってからもう一度お試しください。'],
  [/weak-password|password should be/i, 'パスワードは8文字以上で、推測されにくいものにしてください。'],
  [/invalid-email/i, 'メールアドレスの形式を確認してください。'],
  [/permission.denied/i, 'この操作はできません。メールの確認が済んでいるか確かめて、もう一度ログインしてください。'],
  [/network-request-failed|failed to fetch|network|offline/i, '通信できませんでした。電波の良い場所でもう一度お試しください。入力内容は残っています。'],
];

export function friendlyError(err: unknown) {
  const e = err as { code?: string; message?: string };
  const message = `${e?.code ?? ''} ${e?.message ?? String(err)}`;
  return MESSAGES.find(([re]) => re.test(message))?.[1] ?? 'うまくいきませんでした。もう一度お試しください。';
}

export const hasBackend = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_DATABASE_URL);
export const isDemo = import.meta.env.VITE_DEMO === '1';

let repo: Repo | undefined;

export async function loadRepo(): Promise<Repo> {
  if (repo) return repo;
  // デモ用コードは本番の配布物に含めない
  if (import.meta.env.VITE_DEMO === '1') {
    repo = (await import('./repo.demo')).demoRepo;
  } else {
    repo = (await import('./repo.firebase')).firebaseRepo();
  }
  return repo;
}
