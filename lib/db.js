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

  // Modo inseguro só pra dev: ignora validação. Não usar em prod.
  if (process.env.DB_SSL_INSECURE === 'true') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[db] DB_SSL_INSECURE=true em produção — risco de MITM!');
    }
    return { rejectUnauthorized: false };
  }

  const caPath = process.env.DB_SSL_CA || path.join(process.cwd(), 'certs', 'rds-global-bundle.pem');
  try {
    const ca = fs.readFileSync(caPath);
    return { ca, rejectUnauthorized: true };
  } catch {
    // CA bundle não encontrado: ainda tenta com truststore default do Node.
    return { rejectUnauthorized: true };
  }
}

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: buildSslOptions(),
    // Anti SQL injection: força prepared statements
    namedPlaceholders: true,
  });
}

export const pool = globalForPool.__mysqlPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForPool.__mysqlPool = pool;
}

/**
 * Wrapper seguro. SEMPRE usa prepared statement.
 * Nunca concatene SQL com string. Use placeholders.
 */
export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
