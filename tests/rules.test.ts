import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Realtime Database のルールは上の階層で許可すると下で取り消せない。
// たびさいふ配下で「本人以外に許可する経路」が無いことを構造で確かめる。
type Node = { [key: string]: Node | string | boolean };
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules as Node;
const OWNER = "auth != null && auth.uid === $uid && auth.token.email_verified === true";

function grants(node: Node, path: string[] = []): { path: string; kind: string; rule: unknown }[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === '.read' || key === '.write') return [{ path: path.join('/'), kind: key, rule: value }];
    return typeof value === 'object' ? grants(value as Node, [...path, key]) : [];
  });
}

describe('データベースのルール', () => {
  it('読み書きの許可は users/$uid の1か所だけで、本人かつメール確認済みに限る', () => {
    expect(grants(rules)).toEqual([
      { path: 'tabi_saifu/users/$uid', kind: '.read', rule: OWNER },
      { path: 'tabi_saifu/users/$uid', kind: '.write', rule: OWNER },
    ]);
  });
  it('想定外の項目は書き込めない', () => {
    const user = (rules.tabi_saifu as Node).users as Node;
    const me = user.$uid as Node;
    expect((me.$other as Node)['.validate']).toBe(false);
    expect((((me.trips as Node).$tripId as Node).$other as Node)['.validate']).toBe(false);
  });
});
