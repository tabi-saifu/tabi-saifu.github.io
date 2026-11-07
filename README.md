# たびさいふ

海外旅行で使ったお金を、その場で日本円に換算して記録・合計する Web アプリです。

- 利用者向けの説明: [manual.html](manual.html)（アプリ内の「使い方」からも開けます）
- 管理者向けの公開手順: [docs/SETUP.md](docs/SETUP.md)
- 要件の確認手順: [docs/CHECKLIST.md](docs/CHECKLIST.md)

## 構成

| 役割 | 使うもの | メモ |
| --- | --- | --- |
| 画面 | React + Vite（静的サイト） | GitHub Pages で配信。サーバーを持たない |
| ログイン | Firebase Authentication | メールアドレスとパスワード。メール確認が済むまでデータに触れない |
| DB | Firebase Realtime Database | `tabi_saifu/users/{uid}` の下だけを使う |
| 利用者の分離 | `database.rules.json` | 本人の uid の場所しか読み書きできない |
| 相場 | open.er-api.com（予備: Frankfurter） | キー不要。1日1回更新の相場 |
| PDF | pdf-lib（ブラウザ内で生成） | 日本語フォントは `npm run assets` で生成 |
| 自分宛てメール | Gmail API（ブラウザから直接）/ 端末のメールアプリ | 送信用アドレスを持たない。トークンは保存しない |

## 開発

```bash
pip install fonttools pymupdf
npm install
npm run assets
npm test
VITE_DEMO=1 npm run dev
```

`VITE_DEMO=1` はサンプルデータで動くお試しモードです。本番ビルドには含まれません。
