import { useCallback, useEffect, useState } from 'react';
import { friendlyError, hasBackend, isDemo, loadRepo, type Repo, type User } from './lib/repo';
import { AuthScreen } from './screens/AuthScreen';
import { TripScreen } from './screens/TripScreen';
import { TripsScreen } from './screens/TripsScreen';
import { VerifyScreen } from './screens/VerifyScreen';
import { Toast, type ToastFn } from './screens/ui';

const tripFromHash = () => /^#\/trip\/([\w-]+)$/.exec(location.hash)?.[1] ?? null;

export function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tripId, setTripId] = useState(tripFromHash);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);

  const showToast: ToastFn = useCallback(text => setToast({ text, key: Date.now() }), []);

  useEffect(() => {
    const onHash = () => setTripId(tripFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!hasBackend && !isDemo) return;
    let off = () => {};
    loadRepo().then(r => {
      setRepo(r);
      off = r.onAuth(({ user: next }) => setUser(next));
      r.currentUser().then(setUser).catch(err => {
        showToast(friendlyError(err));
        setUser(null);
      });
    });
    return () => off();
  }, [showToast]);

  const go = useCallback((id: string | null) => {
    location.hash = id ? `#/trip/${id}` : '';
    window.scrollTo(0, 0);
  }, []);

  if (!hasBackend && !isDemo) {
    return (
      <main className="centered">
        <h1 className="brand">たびさいふ</h1>
        <p className="note">接続先のデータベースが設定されていません。管理者の方はセットアップ手順をご確認ください。</p>
      </main>
    );
  }
  if (!repo || user === undefined) return <main className="centered"><div className="spinner" aria-label="読み込み中" /></main>;

  let screen;
  if (!user) {
    screen = <AuthScreen repo={repo} />;
  } else if (!user.verified) {
    screen = <VerifyScreen repo={repo} user={user} onVerified={u => { setUser(u); showToast('メールの確認が済みました'); }} />;
  } else if (tripId) {
    // 利用者が変わったら画面の状態を持ち越さない
    screen = <TripScreen key={`${user.id}:${tripId}`} repo={repo} user={user} tripId={tripId} onBack={() => go(null)} toast={showToast} />;
  } else {
    screen = <TripsScreen key={user.id} repo={repo} user={user} onOpen={go} toast={showToast} />;
  }

  return (
    <>
      {isDemo && <div className="demo-banner">お試し版です。金額はサンプルで、データはこの端末の中だけに保存されます。</div>}
      {screen}
      {toast && <Toast key={toast.key} text={toast.text} onDone={() => setToast(null)} />}
    </>
  );
}
