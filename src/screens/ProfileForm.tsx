import { useMemo, useState } from 'react';
import { countryByCode, currencyLabel, flag, searchCountries } from '../lib/countries';
import { friendlyError, type Profile, type Repo } from '../lib/repo';
import { ErrorNote, Sheet, type ToastFn } from './ui';

/** あなたの国の設定。割り勘の金額を、現地通貨に加えてこの国の通貨でも表示する */
export function ProfileForm({ repo, profile, onClose, onSaved, toast }: {
  repo: Repo; profile: Profile; onClose: () => void; onSaved: (p: Profile) => void; toast: ToastFn;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = useMemo(() => searchCountries(query), [query]);
  const current = countryByCode(profile.home_country);

  async function pick(code: string) {
    setBusy(true);
    setError(null);
    const next = { ...profile, home_country: code };
    try {
      await repo.saveProfile(next);
      onSaved(next);
      toast('あなたの国を変更しました');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="あなたの国" onClose={onClose}>
      <div className="stack">
        <p className="note">割り勘の金額を、旅行先の通貨に加えて、ここで選んだ国の通貨でも表示します。</p>
        {current && (
          <div className="picked">
            <span className="ticket-flag" aria-hidden="true">{flag(current.code)}</span>
            <span><strong>{current.name}</strong><small>{currencyLabel(current.currency)}（{current.currency}）</small></span>
            <span className="badge">いまの設定</span>
          </div>
        )}
        <label className="field">
          <span>国を変える</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="国名で検索（例：韓国）" />
        </label>
        <ErrorNote text={error} />
        <ul className="country-list">
          {results.map(c => (
            <li key={c.code}>
              <button type="button" onClick={() => pick(c.code)} disabled={busy} aria-pressed={c.code === profile.home_country}>
                <span aria-hidden="true">{flag(c.code)}</span> {c.name}
                <small>{currencyLabel(c.currency)}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
