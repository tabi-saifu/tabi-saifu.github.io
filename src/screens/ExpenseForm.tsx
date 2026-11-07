import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, parseAmount, rateText, toJpy, todayIso, yen, type Category, type Expense, type Payment, type Trip } from '../lib/calc';
import { allCurrencies, currencyLabel } from '../lib/countries';
import { getRates, type RateTable } from '../lib/rates';
import { friendlyError, type Repo } from '../lib/repo';
import { ConfirmButton, ErrorNote, Sheet, type ToastFn } from './ui';

export function ExpenseForm({ repo, trip, expense, rates, lastCurrency, onClose, onSaved, onDeleted, toast }: {
  repo: Repo;
  trip: Trip;
  expense?: Expense;
  rates: RateTable | null;
  lastCurrency: string;
  onClose: () => void;
  onSaved: (e: Expense, isNew: boolean) => void;
  onDeleted: (id: string) => void;
  toast: ToastFn;
}) {
  const [amountText, setAmountText] = useState(expense ? String(expense.amount_local) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? lastCurrency);
  const [category, setCategory] = useState<Category>(expense?.category ?? 'shopping');
  const [title, setTitle] = useState(expense?.title ?? '');
  const [payment, setPayment] = useState<Payment>(expense?.payment ?? 'card');
  const [date, setDate] = useState(expense?.spent_on ?? todayIso());
  const [table, setTable] = useState(rates);
  // 編集時は記録時の相場を守る。通貨を変えたときだけ最新相場に切り替える
  const [rateOverride, setRateOverride] = useState(expense ? String(expense.rate_to_jpy) : '');
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!expense) amountRef.current?.focus();
    if (!table) getRates().then(setTable).catch(() => setMoreOpen(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = parseAmount(amountText);
  const liveRate = table?.toJpy[currency];
  const manualRate = rateOverride ? Number(rateOverride) : null;
  const rate = manualRate && manualRate > 0 ? manualRate : liveRate ?? null;
  const jpy = amount && rate ? toJpy(amount, rate) : null;
  const usingLive = !manualRate && Boolean(liveRate);
  const noRate = !rate;

  async function save(keepOpen: boolean) {
    setError(null);
    if (!amount) {
      setError('金額を数字で入力してください（例：24.50）。');
      amountRef.current?.focus();
      return;
    }
    if (!rate) {
      setMoreOpen(true);
      setError('相場を取得できませんでした。下の「1通貨あたりの円」を入力してください。');
      return;
    }
    setBusy(true);
    const input = {
      trip_id: trip.id,
      spent_on: date || todayIso(),
      title: title.trim(),
      category,
      payment,
      amount_local: amount,
      currency,
      rate_to_jpy: rate,
      rate_date: usingLive ? table?.date ?? null : expense?.rate_date ?? null,
    };
    try {
      const saved = expense ? await repo.updateExpense(expense.id, input) : await repo.addExpense(input);
      onSaved(saved, !expense);
      if (keepOpen) {
        toast(`${yen(saved.amount_jpy)} を記録しました`);
        setAmountText('');
        setTitle('');
        amountRef.current?.focus();
      } else {
        toast(expense ? '変更しました' : `${yen(saved.amount_jpy)} を記録しました`);
        onClose();
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!expense) return;
    setBusy(true);
    try {
      await repo.deleteExpense(expense.trip_id, expense.id);
      onDeleted(expense.id);
      toast('削除しました');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const currencies = [...new Set([trip.currency, currency, ...allCurrencies()])];

  return (
    <Sheet title={expense ? '記録を直す' : 'いくら使いましたか？'} onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); save(false); }}>
        <div className="amount-box">
          <div className="amount-line">
            <input
              ref={amountRef}
              className="amount-input num"
              inputMode="decimal"
              aria-label="現地通貨の金額"
              placeholder="0"
              value={amountText}
              onChange={e => setAmountText(e.target.value)}
              enterKeyHint="done"
            />
            <select className="currency-select" aria-label="通貨" value={currency}
              onChange={e => { setCurrency(e.target.value); setRateOverride(''); }}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <output className="amount-jpy num" aria-live="polite">
            <span>日本円で</span>
            <strong>{jpy !== null ? yen(jpy) : '¥ ---'}</strong>
          </output>
          <p className="rate-line">
            {rate ? `1${currency}（${currencyLabel(currency)}）= ${rateText(rate)}円` : '相場を取得できていません'}
            {usingLive && table && `・${table.date.slice(5).replace('-', '/')}時点`}
            {usingLive && table?.stale && '（圏外のため前回の相場）'}
            {!usingLive && rate && (expense ? '・記録時の相場' : '・手入力')}
          </p>
        </div>

        <fieldset className="field">
          <legend>何に使いましたか？</legend>
          <div className="cat-grid">
            {CATEGORIES.map(c => (
              <button type="button" key={c.id} className={`cat ${category === c.id ? 'on' : ''}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                <span aria-hidden="true">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="segmented" role="group" aria-label="支払い方法">
          <button type="button" className={payment === 'card' ? 'on' : ''} aria-pressed={payment === 'card'} onClick={() => setPayment('card')}>💳 カード</button>
          <button type="button" className={payment === 'cash' ? 'on' : ''} aria-pressed={payment === 'cash'} onClick={() => setPayment('cash')}>💵 現金</button>
        </div>

        <label className="field">
          <span>メモ（任意）</span>
          <input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="例：お土産のチョコ" />
        </label>

        <details className="more" open={moreOpen || undefined} onToggle={e => setMoreOpen(e.currentTarget.open)}>
          <summary>日付・相場を変える</summary>
          <div className="row">
            <label className="field"><span>使った日</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="field">
              <span>1{currency}あたりの円</span>
              <input inputMode="decimal" value={rateOverride} onChange={e => setRateOverride(e.target.value)}
                placeholder={liveRate ? rateText(liveRate) : '例：180'} />
            </label>
          </div>
          {expense && liveRate && rateOverride && (
            <button type="button" className="link" onClick={() => setRateOverride('')}>今の相場（{rateText(liveRate)}円）に直す</button>
          )}
        </details>

        <ErrorNote text={error} />
        {noRate && !error && <p className="note">圏外などで相場を取得できないときは、上の「日付・相場を変える」で円を入力できます。</p>}

        <div className="sheet-actions">
          {expense ? (
            <>
              <ConfirmButton label="削除" confirmLabel="本当に削除" onConfirm={remove} disabled={busy} />
              <button className="primary" disabled={busy}>{busy ? '保存中…' : '保存する'}</button>
            </>
          ) : (
            <>
              <button type="button" className="ghost" onClick={() => save(true)} disabled={busy}>続けて記録</button>
              <button className="primary" disabled={busy}>{busy ? '保存中…' : '記録する'}</button>
            </>
          )}
        </div>
      </form>
    </Sheet>
  );
}
