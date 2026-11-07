import { useCallback, useEffect, useMemo, useState } from 'react';
import { byCategory, byDay, cardEstimate, categoryOf, dayLabel, money, periodLabel, rateText, totalJpy, yen, type Expense, type Trip } from '../lib/calc';
import { flag } from '../lib/countries';
import { getRates, type RateTable } from '../lib/rates';
import { friendlyError, type Repo, type User } from '../lib/repo';
import { ExpenseForm } from './ExpenseForm';
import { ReportSheet } from './ReportSheet';
import { TripForm } from './TripForm';
import { ErrorNote, type ToastFn } from './ui';

export function TripScreen({ repo, user, tripId, onBack, toast }: {
  repo: Repo; user: User; tripId: string; onBack: () => void; toast: ToastFn;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rates, setRates] = useState<RateTable | null>(null);
  const [rateError, setRateError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [settings, setSettings] = useState(false);
  const [report, setReport] = useState(false);
  const [lastCurrency, setLastCurrency] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [trips, items] = await Promise.all([repo.listTrips(), repo.listExpenses(tripId)]);
      const found = trips.find(t => t.id === tripId);
      if (!found) return setNotFound(true);
      setTrip(found);
      setExpenses(items);
    } catch (err) {
      setError(friendlyError(err));
    }
  }, [repo, tripId]);

  const refreshRates = useCallback(async (force: boolean) => {
    setRefreshing(true);
    try {
      setRates(await getRates(force));
      setRateError(false);
    } catch {
      setRateError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); refreshRates(false); }, [load, refreshRates]);

  const total = totalJpy(expenses);
  const days = useMemo(() => byDay(expenses), [expenses]);
  const cats = useMemo(() => byCategory(expenses), [expenses]);

  if (notFound) {
    // 他人の旅行 URL を開いても DB が返さないので、存在しないものとして扱う
    return (
      <main className="centered">
        <p className="note">この旅行は見つかりませんでした。</p>
        <button className="ghost" onClick={onBack}>一覧に戻る</button>
      </main>
    );
  }
  if (!trip) {
    return (
      <main className="centered">
        {error ? <><ErrorNote text={error} /><button className="ghost" onClick={load}>もう一度読み込む</button></> : <div className="spinner" aria-label="読み込み中" />}
      </main>
    );
  }

  const rate = rates?.toJpy[trip.currency];
  const estimate = cardEstimate(expenses, trip.card_fee_pct);

  return (
    <main className="page has-dock">
      <header className="topbar">
        <button className="link" onClick={onBack}>‹ 旅行一覧</button>
        <div className="topbar-actions">
          <button className="link" onClick={() => setSettings(true)}>設定</button>
        </div>
      </header>

      <section className="hero">
        <p className="hero-trip"><span aria-hidden="true">{flag(trip.country_code)}</span> {trip.name}{periodLabel(trip) && <small>{periodLabel(trip)}</small>}</p>
        <p className="hero-label">ここまでに使った金額</p>
        <p className="hero-total num" data-testid="total">{yen(total)}</p>
        {total > 0 && estimate !== total && (
          <p className="hero-sub num">カード請求の目安 <b>{yen(estimate)}</b><small>（カード分に手数料 {trip.card_fee_pct}%）</small></p>
        )}
        {cats.length > 0 && (
          <>
            <div className="catbar" role="img" aria-label={cats.map(c => `${c.label} ${Math.round(c.share * 100)}%`).join('、')}>
              {cats.map(c => <span key={c.id} style={{ width: `${c.share * 100}%`, background: c.color }} />)}
            </div>
            <ul className="catlegend">
              {cats.map(c => (
                <li key={c.id}><i style={{ background: c.color }} />{c.label}<b className="num">{yen(c.jpy)}</b></li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="rate-strip">
        {rate ? (
          <span className="num">1{trip.currency} = <b>{rateText(rate)}円</b>
            <small>{rates!.date.slice(5).replace('-', '/')}時点{rates!.stale && '（圏外のため前回の相場）'}</small>
          </span>
        ) : (
          <span>{rateError ? '相場を取得できませんでした' : '相場を取得中…'}</span>
        )}
        <button className="link" onClick={() => refreshRates(true)} disabled={refreshing}>{refreshing ? '更新中…' : '更新'}</button>
      </div>

      <ErrorNote text={error} />

      {expenses.length === 0 ? (
        <section className="empty">
          <h2>まだ記録がありません</h2>
          <p>買い物をしたら、下のボタンから金額を入れるだけ。日本円にして合計します。<br />買う前に「いくらだろう？」と確かめる電卓としても使えます。</p>
        </section>
      ) : (
        <>
          {days.map(day => (
            <section key={day.date} className="day">
              <h3><span>{dayLabel(day.date)}</span><span className="num">{yen(day.jpy)}</span></h3>
              <ul>
                {day.items.map(e => {
                  const c = categoryOf(e.category);
                  return (
                    <li key={e.id}>
                      <button className="item" onClick={() => setEditing(e)}>
                        <span className="item-icon" aria-hidden="true">{c.icon}</span>
                        <span className="item-main">
                          <strong>{e.title || c.label}</strong>
                          <small className="num">{money(e.amount_local, e.currency)}・{e.payment === 'card' ? 'カード' : '現金'}</small>
                        </span>
                        <span className="item-jpy num">{yen(e.amount_jpy)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="disclaimer">円換算は記録したときの相場による目安です。実際の請求額はカード会社のレートや手数料で変わります。<br />
            相場: <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a></p>
        </>
      )}

      <div className="dock two">
        <button className="ghost" onClick={() => setReport(true)}>レポート</button>
        <button className="primary" onClick={() => setEditing('new')}>＋ 使った金額を記録</button>
      </div>

      {editing && (
        <ExpenseForm
          key={editing === 'new' ? 'new' : editing.id}
          repo={repo}
          trip={trip}
          expense={editing === 'new' ? undefined : editing}
          rates={rates}
          lastCurrency={lastCurrency ?? trip.currency}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setLastCurrency(saved.currency);
            setExpenses(list => (isNew ? [saved, ...list] : list.map(x => (x.id === saved.id ? saved : x))));
          }}
          onDeleted={id => setExpenses(list => list.filter(x => x.id !== id))}
        />
      )}
      {settings && (
        <TripForm repo={repo} trip={trip} onClose={() => setSettings(false)}
          onSaved={t => { setTrip(t); setSettings(false); toast('保存しました'); }}
          onDeleted={() => { toast('削除しました'); onBack(); }} />
      )}
      {report && <ReportSheet trip={trip} expenses={expenses} user={user} toast={toast} onClose={() => setReport(false)} />}
    </main>
  );
}
