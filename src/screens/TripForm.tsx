import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { rateText, type Trip } from '../lib/calc';
import { COUNTRIES, POPULAR, countryByCode, currencyLabel, flag, searchCountries, type Country } from '../lib/countries';
import { getRates, type RateTable } from '../lib/rates';
import { friendlyError, type Repo, type User } from '../lib/repo';
import { ConfirmButton, ErrorNote, Sheet, type ToastFn } from './ui';

export const defaultNickname = (user: User) => user.email.split('@')[0].slice(0, 20);

/** 招待コードと参加者。みんなの旅行の設定画面に出す */
function InviteBox({ trip, toast }: { trip: Trip; toast: ToastFn }) {
  if (!trip.group) return null;
  const copy = () => navigator.clipboard?.writeText(trip.group!.code).then(() => toast('招待コードをコピーしました')).catch(() => {});
  return (
    <div className="invite">
      <p className="invite-label">招待コード</p>
      <p className="invite-code num" aria-label={`招待コード ${trip.group.code.split('').join(' ')}`}>{trip.group.code}</p>
      <p className="note">一緒に行く人に伝えると、その人が自分のアプリで「招待コードで参加」から加われます。</p>
      <button type="button" className="link" onClick={copy}>コードをコピー</button>
      <p className="invite-label">参加している人（{trip.group.members.length}人）</p>
      <ul className="member-chips">
        {trip.group.members.map(m => <li key={m.uid}>{m.name}</li>)}
      </ul>
    </div>
  );
}

export function TripForm({ repo, user, trip, onClose, onSaved, onDeleted, toast }: {
  repo: Repo; user: User; trip?: Trip; onClose: () => void; onSaved: (t: Trip) => void; onDeleted?: () => void; toast: ToastFn;
}) {
  const [country, setCountry] = useState<Country | null>(trip ? countryByCode(trip.country_code) ?? null : null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(trip?.name ?? '');
  const [nameEdited, setNameEdited] = useState(Boolean(trip));
  const [start, setStart] = useState(trip?.start_date ?? '');
  const [end, setEnd] = useState(trip?.end_date ?? '');
  const [fee, setFee] = useState(String(trip?.card_fee_pct ?? 2));
  const [together, setTogether] = useState(false);
  const [nickname, setNickname] = useState(defaultNickname(user));
  const [rates, setRates] = useState<RateTable | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getRates().then(setRates).catch(() => setRates(null)); }, []);

  const results = useMemo(() => searchCountries(query), [query]);
  const popular = useMemo(() => POPULAR.map(code => COUNTRIES.find(c => c.code === code)!), []);

  function pick(c: Country) {
    setCountry(c);
    setQuery('');
    if (!nameEdited) setName(`${c.name}旅行`);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!country) return;
    const feeNum = Number(fee);
    if (!(feeNum >= 0 && feeNum <= 20)) return setError('手数料は0〜20の数字で入力してください。');
    if (start && end && end < start) return setError('帰る日が出発日より前になっています。');
    if (!trip && together && !nickname.trim()) return setError('一緒に行く人に見える名前を入力してください。');
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim() || `${country.name}旅行`,
      country_code: country.code,
      currency: country.currency,
      start_date: start || null,
      end_date: end || null,
      card_fee_pct: feeNum,
    };
    try {
      if (trip) {
        await repo.updateTrip(trip, input);
        onSaved({ ...trip, ...input });
      } else {
        onSaved(await repo.createTrip(input, together ? { name: nickname.trim().slice(0, 20) } : undefined));
      }
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!trip) return;
    setBusy(true);
    try {
      await repo.deleteTrip(trip);
      onDeleted?.();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title={trip ? '旅行の設定' : '新しい旅行'} onClose={onClose}>
      {!country ? (
        <div className="stack">
          <label className="field">
            <span>どの国へ行きますか？</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="国名や都市名で検索（例：ハワイ）" />
          </label>
          {!query && (
            <div className="chips">
              {popular.map(c => (
                <button type="button" key={c.code} className="chip" onClick={() => pick(c)}>{flag(c.code)} {c.name}</button>
              ))}
            </div>
          )}
          <ul className="country-list">
            {results.map(c => (
              <li key={c.code}>
                <button type="button" onClick={() => pick(c)}>
                  <span aria-hidden="true">{flag(c.code)}</span> {c.name}
                  <small>{currencyLabel(c.currency)}</small>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="note">見つかりませんでした。別の書き方でお試しください。</li>}
          </ul>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          {trip && <InviteBox trip={trip} toast={toast} />}
          <button type="button" className="picked" onClick={() => setCountry(null)}>
            <span className="ticket-flag" aria-hidden="true">{flag(country.code)}</span>
            <span>
              <strong>{country.name}</strong>
              <small>
                {currencyLabel(country.currency)}
                {rates?.toJpy[country.currency] && ` ・1${country.currency} = ${rateText(rates.toJpy[country.currency])}円`}
              </small>
            </span>
            <span className="link">変更</span>
          </button>
          {!trip && (
            <fieldset className="field">
              <legend>だれと行きますか？</legend>
              <div className="segmented" role="group" aria-label="だれと行くか">
                <button type="button" className={!together ? 'on' : ''} aria-pressed={!together} onClick={() => setTogether(false)}>ひとりで</button>
                <button type="button" className={together ? 'on' : ''} aria-pressed={together} onClick={() => setTogether(true)}>みんなで（割り勘あり）</button>
              </div>
              {together && <small className="hint">登録後に出る招待コードを一緒に行く人に伝えます。割り勘の記録はみんなで、自分だけの記録は自分だけが見られます。</small>}
            </fieldset>
          )}
          {!trip && together && (
            <label className="field">
              <span>一緒に行く人に見えるあなたの名前</span>
              <input value={nickname} maxLength={20} onChange={e => setNickname(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>旅行の名前</span>
            <input value={name} maxLength={60} onChange={e => { setName(e.target.value); setNameEdited(true); }} />
          </label>
          <div className="row">
            <label className="field"><span>出発日（任意）</span><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
            <label className="field"><span>帰国日（任意）</span><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
          </div>
          <label className="field">
            <span>カードの海外手数料の目安（%）</span>
            <input inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} />
            <small className="hint">カード会社が相場に上乗せする分です。わからなければ 2 のままで大丈夫です。</small>
          </label>
          <ErrorNote text={error} />
          <button className="primary" disabled={busy}>{busy ? '保存中…' : trip ? '保存する' : 'この内容で登録'}</button>
          {trip && !trip.group && <ConfirmButton label="この旅行を削除" confirmLabel="記録もすべて消えます。もう一度押すと削除" onConfirm={remove} disabled={busy} />}
          {trip?.group && <ConfirmButton label="この旅行から抜ける" confirmLabel="自分だけの記録は消えます。もう一度押すと抜ける" onConfirm={remove} disabled={busy} />}
        </form>
      )}
    </Sheet>
  );
}

/** 招待コードを入れて、だれかのみんなの旅行に参加する */
export function JoinForm({ repo, user, onClose, onJoined }: {
  repo: Repo; user: User; onClose: () => void; onJoined: (tripId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(defaultNickname(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!nickname.trim()) return setError('一緒に行く人に見える名前を入力してください。');
    setBusy(true);
    setError(null);
    try {
      onJoined(await repo.joinGroup(code, nickname.trim().slice(0, 20)));
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="招待コードで参加" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>招待コード（6文字）</span>
          <input className="code-input num" value={code} maxLength={8} autoCapitalize="characters" autoComplete="off"
            onChange={e => setCode(e.target.value)} placeholder="例：K7QF3M" required />
        </label>
        <label className="field">
          <span>一緒に行く人に見えるあなたの名前</span>
          <input value={nickname} maxLength={20} onChange={e => setNickname(e.target.value)} />
        </label>
        <ErrorNote text={error} />
        <button className="primary" disabled={busy}>{busy ? '参加中…' : '参加する'}</button>
      </form>
    </Sheet>
  );
}
