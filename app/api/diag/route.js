// app/api/diag/route.js
// EDUCATIONAL: rota de diagnóstico. Tenta uma SELECT simples direto via createConnection
// (sem pool, sem lib/db.js) pra isolar se o problema está no banco ou na minha camada.
// Apaga essa rota quando estiver tudo ok.
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export const runtime = 'nodejs';

export async function GET() {
  const env = {
    DB_HOST: process.env.DB_HOST ? `${process.env.DB_HOST.slice(0, 20)}...` : '(missing)',
    DB_PORT: process.env.DB_PORT || '(missing)',
    DB_USER: process.env.DB_USER || '(missing)',
    DB_PASSWORD: process.env.DB_PASSWORD ? `set (len=${process.env.DB_PASSWORD.length})` : '(missing)',
    DB_NAME: process.env.DB_NAME || '(missing)',
    DB_SSL: process.env.DB_SSL || '(missing)',
    DB_SSL_INSECURE: process.env.DB_SSL_INSECURE || '(missing)',
    NODE_ENV: process.env.NODE_ENV || '(missing)',
  };

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 8000,
    });
    const [rows] = await conn.query('SELECT COUNT(*) AS total FROM game_objects');
    return NextResponse.json({ ok: true, env, rows });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      env,
      error: {
        name: e?.name,
        code: e?.code,
        errno: e?.errno,
        msg: e?.message || '(empty)',
        sqlState: e?.sqlState,
        sqlMessage: e?.sqlMessage,
      },
    }, { status: 500 });
  } finally {
    try { await conn?.end(); } catch { }
  }
}
