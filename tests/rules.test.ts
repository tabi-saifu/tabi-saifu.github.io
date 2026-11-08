import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Realtime Database のルールは上の階層で許可すると下で取り消せない。
// どこで何を許可しているかを一覧にし、意図した場所・条件だけであることを確かめる。
type Node = { [key: string]: Node | string | boolean };
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules as Node;
const VERIFIED = 'auth != null && auth.token.email_verified === true';

function grants(node: Node, path: string[] = []): { path: string; kind: string; rule: string }[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === '.read' || key === '.write') return [{ path: path.join('/'), kind: key, rule: String(value) }];
    return typeof value === 'object' ? grants(value as Node, [...path, key]) : [];
  });
}

const all = grants(rules);
const at = (path: string, kind: string) => all.find(g => g.path === path && g.kind === kind)?.rule;

describe('データベースのルール', () => {
  it('許可はすべてメール確認済みのログイン利用者に限られ、無条件の許可はない', () => {
    for (const g of all) {
      expect(g.rule, `${g.path} ${g.kind}`).toContain(VERIFIED);
      expect(g.rule).not.toBe('true');
    }
  });

  it('許可しているのは決まった場所だけ（ルートや一覧取得は不可）', () => {
    expect(all.map(g => `${g.path} ${g.kind}`).sort()).toEqual([
      'tabi_saifu/groups/$gid .read',
      'tabi_saifu/groups/$gid/code .write',
      'tabi_saifu/groups/$gid/expenses/$eid .write',
      'tabi_saifu/groups/$gid/members/$m .write',
      'tabi_saifu/groups/$gid/meta .write',
      'tabi_saifu/invites/$code .read',
      'tabi_saifu/invites/$code .write',
      'tabi_saifu/users/$uid .read',
      'tabi_saifu/users/$uid .write',
    ]);
  });

  it('個人の場所は本人だけ', () => {
    expect(at('tabi_saifu/users/$uid', '.read')).toContain('auth.uid === $uid');
    expect(at('tabi_saifu/users/$uid', '.write')).toContain('auth.uid === $uid');
  });

  it('みんなの旅行は参加者だけが読め、割り勘の記録も参加者だけが書ける', () => {
    expect(at('tabi_saifu/groups/$gid', '.read')).toContain("data.child('members').child(auth.uid).exists()");
    expect(at('tabi_saifu/groups/$gid/expenses/$eid', '.write')).toContain("child('members').child(auth.uid).exists()");
  });

  it('参加できるのは自分自身だけで、正しい招待コードが必要', () => {
    const rule = at('tabi_saifu/groups/$gid/members/$m', '.write')!;
    expect(rule).toContain('auth.uid === $m');
    expect(rule).toContain("newData.child('code').val() === newData.parent().parent().child('code').val()");
  });

  it('招待コードは一覧できず、作った人しか登録できない', () => {
    expect(at('tabi_saifu/invites', '.read')).toBeUndefined();
    expect(at('tabi_saifu/invites/$code', '.write')).toContain("child('owner').val() === auth.uid");
  });

  it('想定外の項目は書き込めない', () => {
    const me = (rules.tabi_saifu as Node).users as Node;
    expect(((me.$uid as Node).$other as Node)['.validate']).toBe(false);
    const group = ((rules.tabi_saifu as Node).groups as Node).$gid as Node;
    expect((group.$other as Node)['.validate']).toBe(false);
  });
});
