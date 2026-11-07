# 管理者向け 公開手順

Firebase プロジェクト `tabi-saifu` を使います。A と B で公開でき、C は Gmail のワンタップ送信を使う場合だけ必要です。

## A. Firebase の設定

1. **ログイン方法:** Authentication > Sign-in method で「メール / パスワード」を有効にします。
2. **ウェブアプリの登録:** プロジェクトの設定 > マイアプリ で「ウェブ」を追加します（Hosting は不要）。表示された `firebaseConfig` の値を `.env.production` に書きます（書式は `.env.example`）。どれも公開前提の値です。
3. **ルール:** Realtime Database > ルール に `database.rules.json` の `tabi_saifu` 部分を追加して公開します。
   - 同じデータベースを別のアプリでも使っている場合は、既存のルールを消さずに `tabi_saifu` の項目だけを足してください。
   - ルートに `".read": true` のような全体許可が残っていると、下の階層で制限しても他人から読めてしまいます。必ず外してください。
4. **許可するドメイン:** Authentication > 設定 > 承認済みドメイン に `<GitHubのユーザー名>.github.io` を追加します。確認メールやパスワード再設定メールのリンクに必要です。

## B. サイト公開（GitHub Pages）

1. GitHub に public の新規リポジトリを作り、このフォルダを push します。
2. Settings > Pages の Source を GitHub Actions にします。
3. Actions の deploy を実行します。完了すると公開URL（`https://<ユーザー名>.github.io/<リポジトリ名>/`）が出ます。

## C. Gmail ワンタップ送信（任意）

未設定でも「メールアプリで自分に送る」は使えます。

1. Google Cloud コンソールで同じプロジェクト（tabi-saifu）を開き、Gmail API を有効にします。
2. OAuth 同意画面を作り、スコープに `gmail.send` と `userinfo.email` を追加します。
3. 認証情報で OAuth クライアント ID（ウェブアプリ）を作り、承認済み JavaScript 生成元に `https://<ユーザー名>.github.io` を入れます。
4. クライアント ID を `.env.production` の `VITE_GOOGLE_CLIENT_ID` に書いて push します。

Google の審査が済むまでは、テストユーザーに登録した人（最大100人）だけが使え、確認画面に警告が出ます。

## 運用上の注意

- 登録確認とパスワード再設定のメールは Firebase の送信機能（noreply@tabi-saifu.firebaseapp.com）から届きます。迷惑メールに入ることがあります。
- Firebase コンソールに入れる人（プロジェクト管理者）は、仕組み上データの中身を見ることができます。管理者の Google アカウントには二段階認証を設定してください。
- Realtime Database の無料枠（Spark プラン）は保存1GB・同時接続100です。旅行の記録程度なら十分ですが、利用者が大きく増えたら使用量の画面を確認してください。
