import mysql from 'mysql2/promise'

// Cache pool in globalThis to survive module re-evaluation in Next.js
// (serverless / edge runtimes can re-import modules per request)
const globalForRawDb = globalThis as unknown as {
  rawMysqlPool: mysql.Pool | undefined
}

globalForRawDb.rawMysqlPool ??= mysql.createPool({
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || '3306'),
  user: process.env.DB_USER || process.env.DATABASE_USER || 'genthrust',
  password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'genthrust',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,
  connectTimeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
})

const pool = globalForRawDb.rawMysqlPool

export function getPool(): mysql.Pool {
  return pool
}

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  try {
    const [results] = await pool.query(sql, params || [])
    return results as T
  } catch (error) {
    console.error('Database query error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

// H-6: MySQL advisory lock helpers for single-instance job guards
export async function acquireLock(lockName: string, timeoutSec: number = 30): Promise<boolean> {
  const rows = await query<{ acquired: number }[]>(
    'SELECT GET_LOCK(?, ?) as acquired',
    [lockName, timeoutSec]
  )
  return rows[0]?.acquired === 1
}

export async function releaseLock(lockName: string): Promise<void> {
  await query('SELECT RELEASE_LOCK(?)', [lockName])
}

// Graceful shutdown — drain pool on process exit
if (typeof process !== 'undefined') {
  const shutdown = () => {
    pool.end().catch(() => {})
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
