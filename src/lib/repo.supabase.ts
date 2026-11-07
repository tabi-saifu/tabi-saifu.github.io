import { createClient, type User as SbUser } from '@supabase/supabase-js';
import type { Expense, Trip } from './calc';
import type { Repo, TripWithItems, User } from './repo';

const toUser = (u: SbUser | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? '' } : null);
const redirectTo = () => location.origin + location.pathname;

function normalize(e: Expense): Expense {
  return { ...e, amount_local: Number(e.amount_local), rate_to_jpy: Number(e.rate_to_jpy), amount_jpy: Number(e.amount_jpy) };
}

// データの絞り込みは DB の Row Level Security が行う（user_id は DB 側で自動設定）
export function supabaseRepo(): Repo {
  const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  return {
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // コールバック内で Supabase を直接呼ぶとロックで固まるため非同期に逃がす
        setTimeout(() => cb({ user: toUser(session?.user), recovery: event === 'PASSWORD_RECOVERY' }), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
      return !data.session;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },

    async listTrips() {
      const { data, error } = await sb.from('trips').select('*, expenses(amount_jpy,payment)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as TripWithItems[]).map(t => ({ ...t, card_fee_pct: Number(t.card_fee_pct) }));
    },
    async createTrip(input) {
      const { data, error } = await sb.from('trips').insert(input).select().single();
      if (error) throw error;
      return { ...(data as Trip), card_fee_pct: Number(data.card_fee_pct) };
    },
    async updateTrip(id, input) {
      const { error } = await sb.from('trips').update(input).eq('id', id);
      if (error) throw error;
    },
    async deleteTrip(id) {
      const { error } = await sb.from('trips').delete().eq('id', id);
      if (error) throw error;
    },

    async listExpenses(tripId) {
      const { data, error } = await sb.from('expenses').select('*').eq('trip_id', tripId)
        .order('spent_on', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Expense[]).map(normalize);
    },
    async addExpense(input) {
      const { data, error } = await sb.from('expenses').insert(input).select().single();
      if (error) throw error;
      return normalize(data as Expense);
    },
    async updateExpense(id, input) {
      const { data, error } = await sb.from('expenses').update(input).eq('id', id).select().single();
      if (error) throw error;
      return normalize(data as Expense);
    },
    async deleteExpense(id) {
      const { error } = await sb.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
  };
}
