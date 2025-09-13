import { Kysely, SqliteDialect } from 'kysely';
import SQLite from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Database } from './types.js';

let db: Kysely<Database> | null = null;

export function initializeDatabase(dbPath?: string): Kysely<Database> {
  if (db) {
    return db;
  }

  const databasePath = dbPath || process.env.DATABASE_PATH || ':memory:';

  const dialect = new SqliteDialect({
    database: new SQLite.Database(databasePath),
  });

  db = new Kysely<Database>({
    dialect,
  });

  return db;
}

export async function setupDatabase(): Promise<void> {
  const database = getDatabase();

  // Read and execute schema
  const schemaPath = join(new URL(import.meta.url).pathname, '../schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Split and execute each statement
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (const statement of statements) {
    try {
      await database.executeQuery({
        sql: statement,
        parameters: [],
      });
    } catch (error) {
      // Ignore table already exists errors
      if (!error.message?.includes('already exists')) {
        console.error('Database setup error:', error);
        throw error;
      }
    }
  }
}

export function getDatabase(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}

// Helper function to convert snake_case to camelCase for database rows
export function toCamelCase<T>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(value);
    }
    return result;
  }

  return obj;
}

// Helper function to convert camelCase to snake_case for database queries
export function toSnakeCase<T>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(value);
    }
    return result;
  }

  return obj;
}