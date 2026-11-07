import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

// 本番と同じマイグレーションを本物の Postgres(WASM) に流し、ユーザー分離を検証する
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const db = new PGlite();

async function as<T>(uid: string | null, sql: string, params: unknown[] = []) {
  const role = uid ? 'authenticated' : 'anon';
  await db.exec(`set role ${role}; select set_config('test.uid','${uid ?? ''}',false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

let tripA: string;
let expenseA: string;

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(readFileSync('supabase/migrations/001_init.sql', 'utf8'));
  [{ id: tripA }] = await as<{ id: string }>(A,
    `insert into trips (name,country_code,currency) values ('Aのパリ','FR','EUR') returning id`);
  [{ id: expenseA }] = await as<{ id: string }>(A,
    `insert into expenses (trip_id,amount_local,currency,rate_to_jpy) values ($1,10,'EUR',180) returning id`, [tripA]);
});

describe('ユーザー分離', () => {
  it('本人は自分の記録を読め、円額が計算される', async () => {
    const rows = await as<{ amount_jpy: string }>(A, 'select amount_jpy from expenses');
    expect(rows.map(r => Number(r.amount_jpy))).toEqual([1800]);
  });
  it('他人には旅行も明細も0件', async () => {
    expect(await as(B, 'select * from trips')).toHaveLength(0);
    expect(await as(B, 'select * from expenses')).toHaveLength(0);
  });
  it('未ログインは権限エラー', async () => {
    await expect(as(null, 'select * from trips')).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select * from expenses')).rejects.toThrow(/permission denied/);
  });
  it('他人は更新も削除もできない（0件）', async () => {
    expect(await as(B, `update expenses set title='x' where id=$1 returning id`, [expenseA])).toHaveLength(0);
    expect(await as(B, `delete from expenses where id=$1 returning id`, [expenseA])).toHaveLength(0);
    expect(await as(B, `delete from trips where id=$1 returning id`, [tripA])).toHaveLength(0);
  });
  it('他人名義でのデータ作成は拒否', async () => {
    await expect(as(B, `insert into trips (user_id,name,country_code,currency) values ($1,'x','FR','EUR')`, [A]))
      .rejects.toThrow(/row-level security/);
  });
  it('他人の旅行に明細を追加できない', async () => {
    await expect(as(B, `insert into expenses (trip_id,amount_local,currency,rate_to_jpy) values ($1,1,'EUR',1)`, [tripA]))
      .rejects.toThrow();
    await expect(as(B, `insert into expenses (trip_id,user_id,amount_local,currency,rate_to_jpy) values ($1,$2,1,'EUR',1)`, [tripA, A]))
      .rejects.toThrow();
  });
  it('自分の記録の持ち主を他人に書き換えられない', async () => {
    await expect(as(A, `update trips set user_id=$1 where id=$2`, [B, tripA])).rejects.toThrow();
  });
});
