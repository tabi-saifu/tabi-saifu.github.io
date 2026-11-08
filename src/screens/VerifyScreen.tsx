import { useState } from 'react';
import { friendlyError, type Repo, type User } from '../lib/repo';
import { AirmailArt } from './art';
import { ErrorNote } from './ui';

/** メールアドレスの確認が済むまで表示する。他人のアドレスでの登録を防ぐため */
export function VerifyScreen({ repo, user, onVerified }: { repo: Repo; user: User; onVerified: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await repo.refreshUser();
      if (next?.verified) onVerified(next);
      else setNotice('まだ確認が済んでいません。メール内のリンクを押してから、もう一度お試しください。');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await repo.resendVerification();
      setNotice('確認メールをもう一度送りました。');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <AirmailArt className="auth-art" />
        <h2 className="auth-title">メールを確認してください</h2>
        <p><b className="mail">{user.email}</b> に確認メールを送りました。メール内のリンクを押したら、下のボタンを押してください。</p>
      </div>
      <ErrorNote text={error} />
      {notice && <p className="notice" role="status">{notice}</p>}
      <button className="primary" onClick={check} disabled={busy}>{busy ? '確認中…' : '確認しました'}</button>
      <button className="ghost" onClick={resend} disabled={busy}>確認メールを再送する</button>
      <p className="auth-foot">メールが見当たらないときは迷惑メールフォルダも確認してください。<br />
        <button className="link" onClick={() => repo.signOut()}>別のアドレスでやり直す</button></p>
    </main>
  );
}
