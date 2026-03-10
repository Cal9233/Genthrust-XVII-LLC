import mysql from 'mysql2/promise'

// Second MySQL pool for bot inventory database (genthrust_inventory on port 3306)
let pool: mysql.Pool | null = null

export function getInventoryPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.BOT_DB_HOST || 'localhost',
      port: parseInt(process.env.BOT_DB_PORT || '3306'),
      user: process.env.BOT_DB_USER || 'root',
      password: process.env.BOT_DB_PASSWORD || '',
      database: process.env.BOT_DB_NAME || 'genthrust_inventory',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }
  return pool
}

export async function inventoryQuery<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const connectionPool = getInventoryPool()
  try {
    const [results] = await connectionPool.query(sql, params || [])
    return results as T
  } catch (error) {
    console.error('Inventory DB query error:', error)
    throw error
  }
}
