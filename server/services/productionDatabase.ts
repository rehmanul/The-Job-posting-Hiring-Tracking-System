import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../shared/schema';

export class ProductionDatabase {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;
  private static instance: ProductionDatabase;

  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.db = drizzle(this.pool, { schema });

    this.pool.on('connect', () => {
      console.log('✅ Database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });
  }

  public static getInstance(): ProductionDatabase {
    if (!ProductionDatabase.instance) {
      ProductionDatabase.instance = new ProductionDatabase();
    }
    return ProductionDatabase.instance;
  }

  public getDatabase() {
    return this.db;
  }

  public getPool() {
    return this.pool;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export const productionDb = ProductionDatabase.getInstance();
