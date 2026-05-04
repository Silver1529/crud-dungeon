// lib/db.js
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

const globalForPool = globalThis;

// EDUCATIONAL: AWS RDS usa CA própria. Para validar o cert TLS sem MITM,
// baixe o bundle (https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem)
// e aponte DB_SSL_CA pro arquivo. Default: ./certs/rds-global-bundle.pem se existir.
function buildSslOptions() {
  if (process.env.DB_SSL !== 'true') return undefined;

  if (process.env.DB_SSL_INSECURE === 'true') {
    return { rejectUnauthorized: false };
  }

  const caPath = process.env.DB_SSL_CA || path.join(process.cwd(), 'certs', 'rds-global-bundle.pem');
  try {
    const ca = fs.readFileSync(caPath);
    return { ca, rejectUnauthorized: true };
  } catch {
    return { rejectUnauthorized: true };
  }
}

function buildConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: buildSslOptions(),
    namedPlaceholders: true,
    connectTimeout: 10000,
  };
}

// EDUCATIONAL: cache do pool em globalThis.
// - Local (dev): reusa entre HMR pra não vazar conexões.
// - Vercel (prod serverless): cada função tem globalThis novo, então é uma instância nova.
function getPool() {
  if (!globalForPool.__mysqlPool) {
    globalForPool.__mysqlPool = mysql.createPool({
      ...buildConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return globalForPool.__mysqlPool;
}

/**
 * EDUCATIONAL: query via pool. Usamos `pool.query` (text protocol) em vez de
 * `pool.execute` (binary). Aurora 8.4 + mysql2 + caching_sha2_password tem
 * casos de borda com prepared statements em serverless cold start; o text
 * protocol é mais robusto e ainda usa parameter binding (anti-SQL-injection).
 */
export async function query(sql, params = {}) {
  const pool = getPool();
  const [rows] = await pool.query(sql, params);
  return rows;
}

// re-export legado (algum import direto pode existir)
export const pool = { query };
