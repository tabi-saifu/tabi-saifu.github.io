import { useEffect, useState } from 'react';
import { totalJpy, yen, type Expense, type Trip } from '../lib/calc';
import { downloadPdf, gmailAvailable, looksLikeGmail, MailError, preloadGoogle, sendViaGmail, sendViaMailApp, type MailContent } from '../lib/mail';
import type { User } from '../lib/repo';
import { ErrorNote, Sheet, type ToastFn } from './ui';

type Busy = 'gmail' | 'app' | 'save' | null;

export function ReportSheet({ trip, expenses, user, onClose, toast }: {
  trip: Trip; expenses: Expense[]; user: User; onClose: () => void; toast: ToastFn;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [appHint, setAppHint] = useState(false);

  useEffect(() => {
    if (gmailAvailable) preloadGoogle().catch(() => {});
  }, []);

  const total = totalJpy(expenses);
  const gmailFirst = gmailAvailable && looksLikeGmail(user.email);

  async function content(): Promise<MailContent> {
    // PDF 部品は重いので、旅先の通信量を増やさないよう必要になってから読み込む
    const { buildReportPdf, reportFilename } = await import('../lib/pdf');
    const pdf = await buildReportPdf(trip, expenses, user.email);
    return {
      to: user.email,
      subject: `【たびさいふ】${trip.name} の旅行費用レポート（合計 ${yen(total)}）`,
      body: `${trip.name} の旅行費用レポートです。\n合計: ${yen(total)}（${expenses.length}件）\n\n詳しくは添付のPDFをご覧ください。\n実際の請求額はカード会社の換算レートや手数料により異なります。`,
      filename: reportFilename(trip),
      pdf,
    };
  }

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setDone(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof MailError ? err.message : 'うまくいきませんでした。電波の良い場所でもう一度お試しください。');
    } finally {
      setBusy(null);
    }
  }

  const gmail = () => run('gmail', async () => {
    await sendViaGmail(await content());
    setDone(`${user.email} に送信しました。受信トレイを確認してください。`);
    toast('メールを送信しました');
  });
  const mailApp = () => run('app', async () => {
    const result = await sendViaMailApp(await content());
    if (result !== 'cancelled') setAppHint(true);
  });
  const save = () => run('save', async () => {
    const c = await content();
    downloadPdf(c.pdf, c.filename);
    toast('PDFを保存しました');
  });

  const gmailBtn = (
    <button className={gmailFirst ? 'primary' : 'ghost'} onClick={gmail} disabled={!!busy}>
      {busy === 'gmail' ? '送信中…' : 'Gmailから自分に送る'}
    </button>
  );
  const appBtn = (
    <button className={gmailFirst ? 'ghost' : 'primary'} onClick={mailApp} disabled={!!busy}>
      {busy === 'app' ? '準備中…' : 'メールアプリで自分に送る'}
    </button>
  );

  return (
    <Sheet title="レポートを受け取る" onClose={onClose}>
      <div className="stack">
        <div className="report-card">
          <small>{trip.name}（{expenses.length}件）</small>
          <strong className="num">{yen(total)}</strong>
          <small>送り先: <b>{user.email}</b></small>
          <small>送信元もあなた自身のメールです。ほかの宛先には送られません。</small>
        </div>

        {expenses.length === 0 && <p className="note">まだ記録がありません。記録するとレポートを作れます。</p>}
        <ErrorNote text={error} />
        {done && <p className="notice" role="status">{done}</p>}
        {appHint && (
          <div className="notice" role="status">
            <p>メールの宛先が空なら、下のアドレスを入れて送信してください。パソコンでは保存されたPDFをメールに添付してください。</p>
            <button className="link" onClick={() => navigator.clipboard?.writeText(user.email).then(() => toast('コピーしました'))}>
              {user.email} をコピー
            </button>
          </div>
        )}

        {expenses.length > 0 && (
          <>
            {gmailFirst ? <>{gmailBtn}{appBtn}</> : <>{appBtn}{gmailAvailable && gmailBtn}</>}
            <button className="link center" onClick={save} disabled={!!busy}>{busy === 'save' ? '作成中…' : 'メールせずPDFだけ保存する'}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
