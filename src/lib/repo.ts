import type { Expense, Payment, Trip } from './calc';

export interface User {
  id: string;
  email: string;
}

export type TripWithItems = Trip & { expenses: { amount_jpy: number; payment: Payment }[] };
export type TripInput = Omit<Trip, 'id'>;
export type ExpenseInput = Omit<Expense, 'id' | 'amount_jpy'>;
export type AuthEvent = { user: User | null; recovery?: boolean };

export interface Repo {
  currentUser(): Promise<User | null>;
  onAuth(cb: (e: AuthEvent) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** 確認メールの確認待ちなら true */
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;

  listTrips(): Promise<TripWithItems[]>;
  createTrip(input: TripInput): Promise<Trip>;
  updateTrip(id: string, input: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;

  listExpenses(tripId: string): Promise<Expense[]>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
}

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'メールアドレスまたはパスワードが違います。'],
  [/email not confirmed/i, 'メールの確認がまだです。届いた確認メールのリンクを押してください。'],
  [/already registered/i, 'このメールアドレスは登録済みです。ログインしてください。'],
  [/rate limit|too many/i, '操作が集中しています。しばらく待ってからもう一度お試しください。'],
  [/password should be|weak/i, 'パスワードは8文字以上で、推測されにくいものにしてください。'],
  [/invalid.*email|email.*invalid/i, 'メールアドレスの形式を確認してください。'],
  [/same password|different from the old/i, '今までと違うパスワードを入力してください。'],
  [/failed to fetch|network|load failed/i, '通信できませんでした。電波の良い場所でもう一度お試しください。入力内容は残っています。'],
];

export function friendlyError(err: unknown) {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  return MESSAGES.find(([re]) => re.test(message))?.[1] ?? 'うまくいきませんでした。もう一度お試しください。';
}

export const hasBackend = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const isDemo = import.meta.env.VITE_DEMO === '1';

let repo: Repo | undefined;

export async function loadRepo(): Promise<Repo> {
  if (repo) return repo;
  // デモ用コードは本番の配布物に含めない
  if (import.meta.env.VITE_DEMO === '1') {
    repo = (await import('./repo.demo')).demoRepo;
  } else {
    repo = (await import('./repo.supabase')).supabaseRepo();
  }
  return repo;
}
