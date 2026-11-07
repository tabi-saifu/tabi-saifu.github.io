// レポートの自分宛て送信。送信用アドレスやサーバーは使わず、利用者本人のメールから本人へ送る。

export interface MailContent {
  to: string;
  subject: string;
  body: string;
  filename: string;
  pdf: Uint8Array;
}

function b64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64Text = (s: string) => b64(new TextEncoder().encode(s));
const wrap = (s: string) => s.replace(/.{1,76}/g, '$&\r\n');

/** 宛先・差出人を同じアドレスにした MIME メッセージを作る */
export function buildMime({ to, subject, body, filename, pdf }: MailContent) {
  const boundary = `tabi_${crypto.randomUUID()}`;
  const encodedName = encodeURIComponent(filename);
  return [
    `From: ${to}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64Text(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64Text(body)),
    `--${boundary}`,
    'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename*=UTF-8''${encodedName}`,
    '',
    wrap(b64(pdf)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

const base64Url = (s: string) => b64(new TextEncoder().encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Gmail は「.」の有無と googlemail.com を同一視する */
export function sameMailbox(a: string, b: string) {
  const norm = (m: string) => {
    const [local, domain] = m.trim().toLowerCase().split('@');
    return /^(gmail|googlemail)\.com$/.test(domain ?? '') ? `${local.split('+')[0].replace(/\./g, '')}@gmail.com` : `${local}@${domain}`;
  };
  return norm(a) === norm(b);
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const gmailAvailable = Boolean(CLIENT_ID);
export const looksLikeGmail = (email: string) => /@(gmail|googlemail)\.com$/i.test(email.trim());

interface TokenResponse { access_token?: string; error?: string }
interface TokenClient { requestAccessToken(): void }
interface GoogleGlobal {
  accounts: { oauth2: { initTokenClient(cfg: {
    client_id: string; scope: string; hint?: string; login_hint?: string;
    callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void;
  }): TokenClient } };
}

let gis: Promise<GoogleGlobal> | undefined;

/** ポップアップがブロックされないよう、画面を開いた時点で読み込んでおく */
export function preloadGoogle() {
  if (!CLIENT_ID) return Promise.reject(new Error('no client id'));
  gis ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve((window as unknown as { google: GoogleGlobal }).google);
    s.onerror = () => {
      gis = undefined;
      reject(new Error('network'));
    };
    document.head.appendChild(s);
  });
  return gis;
}

export class MailError extends Error {}

/**
 * 本人の Gmail から本人宛に送る。アクセストークンはこの関数の中でだけ使い、保存しない。
 * PDF はブラウザから Google に直接送られ、たびさいふのサーバーを通らない。
 */
export async function sendViaGmail(content: MailContent) {
  const google = await preloadGoogle();
  const token = await new Promise<string>((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
      login_hint: content.to,
      callback: r => (r.access_token ? resolve(r.access_token) : reject(new MailError('Googleの許可が得られませんでした。'))),
      error_callback: () => reject(new MailError('Googleの画面が閉じられました。もう一度お試しください。')),
    }).requestAccessToken();
  });
  const headers = { Authorization: `Bearer ${token}` };

  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
  const { email } = (await info.json()) as { email?: string };
  if (!email || !sameMailbox(email, content.to)) {
    throw new MailError(`選ばれたGoogleアカウント（${email ?? '不明'}）がログイン中のメールアドレスと違うため、送信を止めました。`);
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64Url(buildMime(content)) }),
  });
  if (!res.ok) throw new MailError('Gmailからの送信に失敗しました。時間をおいてもう一度お試しください。');
}

export function downloadPdf(pdf: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Gmail 以外の人向け。端末のメールアプリで本人が送る。
 * 'shared': 共有シートを開いた / 'mailto': PDF を保存してメール作成画面を開いた
 */
export async function sendViaMailApp({ to, subject, body, filename, pdf }: MailContent): Promise<'shared' | 'mailto' | 'cancelled'> {
  const file = new File([pdf as BlobPart], filename, { type: 'application/pdf' });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: subject, text: body });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  downloadPdf(pdf, filename);
  const mailBody = `${body}\n\n（保存されたPDF「${filename}」をこのメールに添付して送信してください）`;
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
  return 'mailto';
}
