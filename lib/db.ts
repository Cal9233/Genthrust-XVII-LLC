import mysql from 'mysql2/promise'

// Create connection pool
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'genthrust',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'genthrust',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }
  return pool
}

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const connectionPool = getPool()
  try {
    const [results] = await connectionPool.query(sql, params || [])
    return results as T
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}
