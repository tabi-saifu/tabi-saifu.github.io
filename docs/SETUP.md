# 管理者向け 公開手順

所要時間の目安は30分です。A と B で公開でき、C は Gmail のワンタップ送信を使う場合だけ必要です。

## A. データベース（Supabase）

1. https://supabase.com でアカウントとプロジェクトを作ります。リージョンは Tokyo を選びます。
2. 左メニューの SQL Editor を開き、`supabase/migrations/001_init.sql` の中身を貼り付けて Run を押します。
3. Authentication > URL Configuration の Site URL と Redirect URLs に、公開URL（B の 4 で確定）を入れます。
4. Project Settings > API から Project URL と anon public key を控えます。どちらも公開前提の値で、service_role key は使いません。

## B. サイト公開（GitHub Pages）

1. GitHub に新規リポジトリを作り、このフォルダを push します。
2. Settings > Secrets and variables > Actions > Variables に次を登録します。
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Settings > Pages の Source を GitHub Actions にします。
4. Actions の deploy を実行します。完了すると公開URL（`https://<ユーザー名>.github.io/<リポジトリ名>/`）が出ます。

無料の GitHub アカウントで Pages を使うには、リポジトリを public にする必要があります。コードに秘密情報は含まれません。

## C. Gmail ワンタップ送信（任意）

未設定でも「メールアプリで自分に送る」は使えます。

1. https://console.cloud.google.com でプロジェクトを作り、Gmail API を有効にします。
2. OAuth 同意画面を作り、スコープに `gmail.send` と `userinfo.email` を追加します。
3. 認証情報で OAuth クライアント ID（ウェブアプリ）を作り、承認済み JavaScript 生成元に `https://<ユーザー名>.github.io` を入れます。
4. クライアント ID を GitHub の Variables に `VITE_GOOGLE_CLIENT_ID` で登録し、deploy を再実行します。

Google の審査が済むまでは、テストユーザーに登録した人（最大100人）だけが使え、確認画面に警告が出ます。一般公開するには Google の審査が必要です。

## 運用上の注意

- Supabase 無料プランは7日間アクセスがないと休止します。`keepalive` ワークフローが3日ごとにアクセスして防ぎますが、GitHub はリポジトリの更新が60日ないと定期実行を止めるので、ときどき Actions の画面で確認してください。
- 登録時の確認メールやパスワード再設定メールは Supabase の標準送信を使います。標準送信は1時間あたりの通数が少ないため、同時に多くの人が登録すると一時的に届かないことがあります。
- Supabase の管理画面に入れる人（プロジェクト管理者）は、仕組み上 DB の中身を見ることができます。管理者アカウントには必ず強いパスワードと二段階認証を設定してください。
