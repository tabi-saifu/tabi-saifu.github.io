import { useCallback, useEffect, useState } from 'react';
import { cardEstimate, periodLabel, totalJpy, yen } from '../lib/calc';
import { countryByCode, currencyLabel, flag } from '../lib/countries';
import { friendlyError, type Repo, type TripWithItems, type User } from '../lib/repo';
import { JoinForm, TripForm } from './TripForm';
import { ErrorNote, type ToastFn } from './ui';

export function TripsScreen({ repo, user, onOpen, toast }: {
  repo: Repo; user: User; onOpen: (id: string) => void; toast: ToastFn;
}) {
  const [trips, setTrips] = useState<TripWithItems[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(() => {
    setError(null);
    repo.listTrips().then(setTrips).catch(err => setError(friendlyError(err)));
  }, [repo]);
  useEffect(load, [load]);

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="brand small">たびさいふ</h1>
        <div className="topbar-actions">
          <a className="link" href="./manual.html" target="_blank" rel="noreferrer">使い方</a>
          <button className="link" onClick={() => repo.signOut()}>ログアウト</button>
        </div>
      </header>
      <p className="whoami">{user.email}</p>

      <ErrorNote text={error} />
      {error && <button className="ghost" onClick={load}>もう一度読み込む</button>}
      {!trips && !error && <div className="spinner" aria-label="読み込み中" />}

      {trips?.length === 0 && (
        <section className="empty">
          <div className="stamp" aria-hidden="true">✈</div>
          <h2>最初の旅行を登録しましょう</h2>
          <p>行き先を選ぶと、その国の通貨の円相場を自動で取得します。<br />友だちや家族の旅行に加わるときは「招待コードで参加」から。</p>
        </section>
      )}

      <ul className="tickets">
        {trips?.map(t => {
          const total = totalJpy(t.expenses);
          return (
            <li key={t.id}>
              <button className="ticket" onClick={() => onOpen(t.id)}>
                <div className="ticket-main">
                  <span className="ticket-flag" aria-hidden="true">{flag(t.country_code)}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <small>{[countryByCode(t.country_code)?.name, currencyLabel(t.currency)].filter(Boolean).join('・')}</small>
                    {periodLabel(t) && <small>{periodLabel(t)}</small>}
                    {t.group && <small className="badge">みんなで {t.group.members.length}人</small>}
                  </div>
                </div>
                <div className="ticket-stub">
                  <small>{t.group ? 'あなたの負担' : `${t.expenses.length}件`}</small>
                  <strong className="num">{yen(total)}</strong>
                  {total > 0 && <small className="num">請求目安 {yen(cardEstimate(t.expenses, t.card_fee_pct))}</small>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="dock two">
        <button className="ghost" onClick={() => setJoining(true)}>招待コードで参加</button>
        <button className="primary" onClick={() => setCreating(true)}>＋ 新しい旅行を登録</button>
      </div>

      {creating && (
        <TripForm repo={repo} user={user} toast={toast} onClose={() => setCreating(false)} onSaved={trip => {
          toast(trip.group ? '旅行を登録しました。設定から招待コードを確認できます' : '旅行を登録しました');
          onOpen(trip.id);
        }} />
      )}
      {joining && (
        <JoinForm repo={repo} user={user} onClose={() => setJoining(false)} onJoined={id => {
          toast('旅行に参加しました');
          onOpen(id);
        }} />
      )}
    </main>
  );
}
