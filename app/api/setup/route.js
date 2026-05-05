import mysql from 'mysql2/promise';
import { NextResponse } from 'next/server';

// EDUCATIONAL: idempotent migration runner. Cria DB+tabela, depois roda
// ALTER TABLE em modo "se a coluna não existir". Pode rodar quantas vezes quiser.
export async function GET() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 3306,
            ssl: { rejectUnauthorized: false }
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS cruddungeon;`);
        await connection.query(`USE cruddungeon;`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS game_objects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tipo VARCHAR(50),
                status VARCHAR(50),
                pos_x INT,
                pos_y INT,
                level INT NOT NULL DEFAULT 1
            );
        `);

        // Migration: adiciona level se a tabela já existia sem essa coluna.
        const [cols] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = 'cruddungeon' AND TABLE_NAME = 'game_objects'`
        );
        const colSet = new Set(cols.map((c) => c.COLUMN_NAME));
        if (!colSet.has('level')) {
            await connection.query(`ALTER TABLE game_objects ADD COLUMN level INT NOT NULL DEFAULT 1`);
            // backfill: status existente vira level (novo=1, ativo=2, upgrade=2, critico=3)
            await connection.query(`
                UPDATE game_objects SET level = CASE
                    WHEN status = 'critico' THEN 3
                    WHEN status IN ('ativo', 'upgrade') THEN 2
                    ELSE 1
                END
            `);
        }

        await connection.end();

        return NextResponse.json({
            message: "Banco e tabela prontos (com coluna level).",
            schema: "id, tipo, status, pos_x, pos_y, level"
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
