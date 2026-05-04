import mysql from 'mysql2/promise';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Conecta no banco da AWS
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 3306,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Cria o banco de dados (se não existir)
        await connection.query(`CREATE DATABASE IF NOT EXISTS cruddungeon;`);

        // 2. Entra no banco de dados
        await connection.query(`USE cruddungeon;`);

        // 3. Cria a tabela do jogo
        await connection.query(`
      CREATE TABLE IF NOT EXISTS game_objects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50),
        status VARCHAR(50),
        pos_x INT,
        pos_y INT
      );
    `);

        await connection.end();

        return NextResponse.json({ message: "Banco de dados e tabela criados com sucesso na AWS!" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}