import { useState, type FormEvent } from 'react';
import { friendlyError, type Repo } from '../lib/repo';
import { ErrorNote } from './ui';

type Mode = 'login' | 'signup' | 'reset';

function PasswordField({ value, onChange, autoComplete, label = 'パスワード' }: {
  value: string; onChange: (v: string) => void; autoComplete: string; label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="with-action">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete} required minLength={8} />
        <button type="button" className="link" onClick={() => setShow(!show)}>{show ? '隠す' : '表示'}</button>
      </div>
    </label>
  );
}

export function AuthScreen({ repo }: { repo: Repo }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const change = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const address = email.trim();
    try {
      if (mode === 'login') await repo.signIn(address, password);
      if (mode === 'signup') await repo.signUp(address, password);
      if (mode === 'reset') {
        await repo.sendPasswordReset(address);
        setNotice('登録されているメールアドレスなら、再設定の案内が届きます。');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <div className="stamp" aria-hidden="true">¥</div>
        <h1 className="brand">たびさいふ</h1>
        <p>海外で使ったお金を、その場で日本円に。<br />帰ってからのカード請求に、もう驚かない。</p>
      </div>

      {mode !== 'reset' && (
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => change('login')}>ログイン</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => change('signup')}>はじめて使う</button>
        </div>
      )}
      {mode === 'reset' && <h2 className="auth-title">パスワードの再設定</h2>}

      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>メールアドレス</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
        </label>
        {mode !== 'reset' && (
          <PasswordField value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            label={mode === 'signup' ? 'パスワード（8文字以上）' : 'パスワード'} />
        )}
        <ErrorNote text={error} />
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="primary" disabled={busy}>
          {busy ? '処理中…' : mode === 'login' ? 'ログイン' : mode === 'signup' ? '登録する' : '再設定メールを送る'}
        </button>
      </form>

      {mode === 'login' && <button className="link center" onClick={() => change('reset')}>パスワードを忘れた</button>}
      {mode === 'reset' && <button className="link center" onClick={() => change('login')}>ログインに戻る</button>}
      <p className="auth-foot">記録はあなただけに見えます。ほかの利用者からは見えません。<br />
        <a href="./manual.html" target="_blank" rel="noreferrer">使い方を見る</a></p>
    </main>
  );
}
