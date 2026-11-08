import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  balances, byCategory, byDay, cardEstimate, categoryOf, dayLabel, money, myBurden, periodLabel, rateText, settlements,
  sharesOf, totalJpy, yen, type Expense, type Trip,
} from '../lib/calc';
import { flag } from '../lib/countries';
import { getRates, type RateTable } from '../lib/rates';
import { friendlyError, type Repo, type User } from '../lib/repo';
import { ExpenseForm } from './ExpenseForm';
import { ReportSheet } from './ReportSheet';
import { TripForm } from './TripForm';
import { ErrorNote, type ToastFn } from './ui';

type Tab = 'shared' | 'mine';

/** 割り勘で、だれがどれだけ多く払っているか */
function SettleCard({ trip, expenses, me }: { trip: Trip; expenses: Expense[]; me: string }) {
  const rows = balances(expenses, trip.group!.members);
  const transfers = settlements(rows);
  const nameOf = (uid: string, name: string) => (uid === me ? `${name}（あなた）` : name);
  if (!expenses.some(e => e.shared)) {
    return <p className="note settle-empty">割り勘の記録はまだありません。記録すると、だれがどれだけ多く払っているかがここに出ます。</p>;
  }
  return (
    <section className="settle" aria-label="割り勘の精算">
      <h3>だれが多く払っている？</h3>
      <ul className="settle-rows">
        {rows.map(r => (
          <li key={r.uid}>
            <span className="settle-name">{nameOf(r.uid, r.name)}</span>
            <span className="settle-detail num">払った {yen(r.paid)} ・ 負担 {yen(r.owed)}</span>
            <strong className={`settle-net num ${r.net > 0 ? 'plus' : r.net < 0 ? 'minus' : ''}`}>
              {r.net > 0 ? `${yen(r.net)} 多く払っている` : r.net < 0 ? `${yen(-r.net)} 少ない` : 'ちょうど'}
            </strong>
          </li>
        ))}
      </ul>
      {transfers.length > 0 ? (
        <div className="settle-plan">
          <p className="settle-plan-title">こうすると精算できます</p>
          {transfers.map((t, i) => (
            <p key={i} className="num">{nameOf(t.from.uid, t.from.name)} → {nameOf(t.to.uid, t.to.name)}　<b>{yen(t.amount)}</b></p>
          ))}
        </div>
      ) : (
        <p className="settle-plan-title">貸し借りはありません</p>
      )}
    </section>
  );
}

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
  const [tab, setTab] = useState<Tab>('shared');

  const load = useCallback(async () => {
    setError(null);
    try {
      const found = (await repo.listTrips()).find(t => t.id === tripId);
      // 他人の旅行の URL を開いても DB が返さないので、存在しないものとして扱う
      if (!found) return setNotFound(true);
      const { expenses: _summary, ...t } = found;
      setTrip(t);
      setExpenses(await repo.listExpenses(t));
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

  const burden = useMemo(() => myBurden(expenses, user.id), [expenses, user.id]);
  const shown = useMemo(
    () => (trip?.group ? expenses.filter(e => (tab === 'shared' ? e.shared : !e.shared)) : expenses),
    [expenses, trip, tab],
  );
  const days = useMemo(() => byDay(shown), [shown]);
  const cats = useMemo(() => byCategory(burden), [burden]);

  if (notFound) {
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

  const group = trip.group;
  const total = totalJpy(burden);
  const estimate = cardEstimate(burden, trip.card_fee_pct);
  const rate = rates?.toJpy[trip.currency];
  const nameOf = (uid: string) => (uid === user.id ? 'あなた' : group?.members.find(m => m.uid === uid)?.name ?? '抜けたメンバー');

  return (
    <main className="page has-dock">
      <header className="topbar">
        <button className="link" onClick={onBack}>‹ 旅行一覧</button>
        <div className="topbar-actions">
          <button className="link" onClick={() => setSettings(true)}>{group ? '招待・設定' : '設定'}</button>
        </div>
      </header>

      <section className="hero">
        <p className="hero-trip"><span aria-hidden="true">{flag(trip.country_code)}</span> {trip.name}{periodLabel(trip) && <small>{periodLabel(trip)}</small>}</p>
        <p className="hero-label">{group ? 'あなたが負担する金額（自分だけ＋割り勘の取り分）' : 'ここまでに使った金額'}</p>
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

      {group && (
        <div className="segmented tabs" role="tablist" aria-label="表示する記録">
          <button role="tab" aria-selected={tab === 'shared'} className={tab === 'shared' ? 'on' : ''} onClick={() => setTab('shared')}>
            みんなの割り勘
          </button>
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
            自分だけ
          </button>
        </div>
      )}
      {group && tab === 'shared' && <SettleCard trip={trip} expenses={expenses} me={user.id} />}
      {group && tab === 'mine' && <p className="note tab-note">ここに入れた記録は、一緒に行く人には見えません。</p>}

      <ErrorNote text={error} />

      {shown.length === 0 ? (
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
                  const myShare = e.shared ? sharesOf(e).get(user.id) ?? 0 : null;
                  return (
                    <li key={e.id}>
                      <button className="item" onClick={() => setEditing(e)}>
                        <span className="item-icon" aria-hidden="true">{c.icon}</span>
                        <span className="item-main">
                          <strong>{e.title || c.label}</strong>
                          <small className="num">
                            {money(e.amount_local, e.currency)}・
                            {e.shared ? `${nameOf(e.shared.paid_by)}が立て替え・${e.shared.split.length}人で割り勘` : e.payment === 'card' ? 'カード' : '現金'}
                          </small>
                        </span>
                        <span className="item-jpy num">
                          {yen(e.amount_jpy)}
                          {myShare !== null && <small>あなたの負担 {yen(myShare)}</small>}
                        </span>
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
          me={user.id}
          defaultShared={Boolean(group) && tab === 'shared'}
          expense={editing === 'new' ? undefined : editing}
          rates={rates}
          lastCurrency={lastCurrency ?? trip.currency}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={(saved, before) => {
            setLastCurrency(saved.currency);
            setExpenses(list => (before ? list.map(x => (x.id === before.id ? saved : x)) : [saved, ...list]));
            if (group) setTab(saved.shared ? 'shared' : 'mine');
          }}
          onDeleted={id => setExpenses(list => list.filter(x => x.id !== id))}
        />
      )}
      {settings && (
        <TripForm repo={repo} user={user} trip={trip} toast={toast} onClose={() => setSettings(false)}
          onSaved={t => { setTrip(t); setSettings(false); toast('保存しました'); }}
          onDeleted={() => { toast(group ? '旅行から抜けました' : '削除しました'); onBack(); }} />
      )}
      {report && <ReportSheet trip={trip} expenses={expenses} user={user} toast={toast} onClose={() => setReport(false)} />}
    </main>
  );
}
