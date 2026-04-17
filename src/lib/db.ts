import duckdb from 'duckdb';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'study.duckdb');

class Database {
  private db: duckdb.Database;

  constructor() {
    this.db = new duckdb.Database(DB_PATH);
    this.init();
  }

  private init() {
    this.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR PRIMARY KEY,
        fileName VARCHAR,
        content TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.run(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        contextText TEXT,
        documentId VARCHAR,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR PRIMARY KEY,
        role VARCHAR,
        content TEXT,
        chatId VARCHAR,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, ...params, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, ...params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, ...params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
  }
}

const db = new Database();
export default db;
