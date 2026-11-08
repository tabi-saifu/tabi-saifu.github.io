// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 画面の主要な流れを、デモ用データ層で通しで確認する
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const total = () => screen.getByTestId('total').textContent;

async function signUp(email: string) {
  fireEvent.click(await screen.findByRole('tab', { name: 'はじめて使う' }));
  fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('パスワード（8文字以上）', { selector: 'input' }), { target: { value: 'password-123' } });
  click('登録する');
}

async function record(amount: string, category: string, memo: string, payment?: string) {
  click('＋ 使った金額を記録');
  fireEvent.change(await screen.findByLabelText('現地通貨の金額'), { target: { value: amount } });
  click(new RegExp(category));
  if (payment) click(new RegExp(payment));
  fireEvent.change(screen.getByPlaceholderText('例：お土産のチョコ'), { target: { value: memo } });
  click('記録する');
  await waitFor(() => expect(screen.queryByLabelText('現地通貨の金額')).toBeNull());
}

beforeAll(() => {
  vi.stubEnv('VITE_DEMO', '1');
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.scrollTo = () => {};
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ result: 'success', time_last_update_unix: 1762387200, rates: { JPY: 1, EUR: 0.005, USD: 0.00625, KRW: 10 } }),
  }));
  localStorage.setItem('tabi-saifu.demo', JSON.stringify({ users: {}, session: null, trips: [], expenses: [] }));
});
afterAll(cleanup);

describe('利用の流れ', () => {
  it('登録 → 旅行作成 → 記録 → 修正 → 削除 → 別ユーザーからは見えない', async () => {
    const { App } = await import('../src/App');
    render(<App />);

    await signUp('hanako@example.com');
    await screen.findByText('最初の旅行を登録しましょう');

    // 都市名で国を探し、通貨が自動で決まる
    click('＋ 旅行を登録');
    fireEvent.change(await screen.findByPlaceholderText(/国名や都市名/), { target: { value: 'パリ' } });
    click(/フランス/);
    expect((await screen.findByText(/1EUR = 200円/))).toBeTruthy();
    click('この内容で登録');

    await screen.findByText('まだ記録がありません');
    expect(total()).toBe('¥0');

    // 入力中に円が見える（1EUR = 200円）
    click('＋ 使った金額を記録');
    fireEvent.change(await screen.findByLabelText('現地通貨の金額'), { target: { value: '24.50' } });
    expect(screen.getAllByText('¥4,900').length).toBeGreaterThan(0);
    click(/閉じる/);
    await waitFor(() => expect(total()).toBe('¥0')); // 閉じれば記録されない

    await record('24.50', '買い物', 'チョコ');
    expect(total()).toBe('¥4,900');
    await record('10', '食事', 'ランチ', '現金');
    expect(total()).toBe('¥6,900');
    expect(screen.getByText(/カード請求の目安/).textContent).toContain('¥6,998'); // カード分だけ2%

    // 不正な金額は保存せず案内する
    click('＋ 使った金額を記録');
    fireEvent.change(await screen.findByLabelText('現地通貨の金額'), { target: { value: 'abc' } });
    click('記録する');
    await screen.findByRole('alert');
    click(/閉じる/);

    // 修正
    click(/ランチ/);
    fireEvent.change(await screen.findByLabelText('現地通貨の金額'), { target: { value: '20' } });
    click('保存する');
    await waitFor(() => expect(total()).toBe('¥8,900'));

    // 削除は2回押し
    click(/ランチ/);
    click('削除');
    expect(screen.getByRole('button', { name: /ランチ/ })).toBeTruthy();
    click('本当に削除');
    await waitFor(() => expect(total()).toBe('¥4,900'));
    const tripHash = location.hash;
    expect(tripHash).toMatch(/^#\/trip\//);

    // 別ユーザー
    location.hash = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    click(await screen.findByRole('button', { name: 'ログアウト' }).then(b => b.textContent!));
    await signUp('jiro@example.com');
    await screen.findByText('最初の旅行を登録しましょう');
    location.hash = tripHash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByText('この旅行は見つかりませんでした。');
    expect(screen.queryByText('チョコ')).toBeNull();
  });

  it('みんなの旅行: 招待コードで参加し、割り勘と自分だけを分けて記録し、だれが多く払ったかが出る', async () => {
    const back = () => { location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); };
    const logout = async () => {
      back();
      click(await screen.findByRole('button', { name: 'ログアウト' }).then(b => b.textContent!));
      await screen.findByRole('tab', { name: 'はじめて使う' });
    };
    const login = async (email: string) => {
      fireEvent.click(screen.getByRole('tab', { name: 'ログイン' }));
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: email } });
      fireEvent.change(screen.getByLabelText('パスワード', { selector: 'input' }), { target: { value: 'password-123' } });
      fireEvent.click(screen.getAllByRole('button', { name: 'ログイン' }).at(-1)!);
      await screen.findByText(email);
    };

    // はなこ: みんなの旅行を作る
    await logout();
    await login('hanako@example.com');
    click('＋ 旅行を登録');
    fireEvent.change(await screen.findByPlaceholderText(/国名や都市名/), { target: { value: 'ソウル' } });
    click(/韓国/);
    click('みんなで（割り勘あり）');
    fireEvent.change(screen.getByLabelText('一緒に行く人に見えるあなたの名前'), { target: { value: 'はなこ' } });
    click('この内容で登録');
    await screen.findByRole('tab', { name: 'みんなの割り勘' });
    const groupHash = location.hash;
    click('招待・設定');
    const code = (await screen.findByLabelText(/^招待コード /)).textContent!;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    click(/閉じる/);

    // はなこ: 自分だけの出費（仲間には見えない）
    fireEvent.click(screen.getByRole('tab', { name: '自分だけ' }));
    await record('1000', '買い物', 'ひみつのお土産'); // 1 KRW = 0.1円
    expect(total()).toBe('¥100');

    // じろう: 招待コードで参加
    await logout();
    await login('jiro@example.com');
    click('招待コードで参加');
    fireEvent.change(await screen.findByPlaceholderText('例：K7QF3M'), { target: { value: code.toLowerCase() } });
    fireEvent.change(screen.getByLabelText('一緒に行く人に見えるあなたの名前'), { target: { value: 'じろう' } });
    click('参加する');
    await screen.findByRole('tab', { name: 'みんなの割り勘' });
    expect(location.hash).toBe(groupHash);
    expect(screen.queryByText('ひみつのお土産')).toBeNull();

    // じろう: 夕食 30000 KRW（1 KRW = 0.1円 → ¥3,000）を立て替えて2人で割る
    click('＋ 使った金額を記録');
    fireEvent.change(await screen.findByLabelText('現地通貨の金額'), { target: { value: '30000' } });
    click(/食事/);
    fireEvent.change(screen.getByPlaceholderText('例：お土産のチョコ'), { target: { value: '焼肉' } });
    click('記録する');
    await waitFor(() => expect(screen.queryByLabelText('現地通貨の金額')).toBeNull());
    expect(total()).toBe('¥1,500');
    expect((await screen.findByText(/^¥[\d,]+ 多く払っている$/)).textContent).toBe('¥1,500 多く払っている');
    expect(screen.getByText(/はなこ → じろう（あなた）/).textContent).toContain('¥1,500');

    // はなこ: 割り勘はじろうの分も見え、自分の負担は 100 円 + 1,500 円
    await logout();
    await login('hanako@example.com');
    location.hash = groupHash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByText('焼肉');
    expect(screen.getByText(/少ない/).textContent).toBe('¥1,500 少ない');
    expect(total()).toBe('¥1,600');
  });
});
