import mysql from 'mysql2/promise'

// Cache pool in globalThis to survive module re-evaluation in Next.js
const globalForInventoryDb = globalThis as unknown as {
  inventoryMysqlPool: mysql.Pool | undefined
}

export function getInventoryPool(): mysql.Pool {
  if (!globalForInventoryDb.inventoryMysqlPool) {
    if (!process.env.BOT_DB_USER) {
      throw new Error(
        'BOT_DB_USER environment variable is required for inventory database connection. ' +
        'Set it in your .env file.'
      )
    }

    globalForInventoryDb.inventoryMysqlPool = mysql.createPool({
      host: process.env.BOT_DB_HOST || 'localhost',
      port: parseInt(process.env.BOT_DB_PORT || '3306'),
      user: process.env.BOT_DB_USER,
      password: process.env.BOT_DB_PASSWORD || '',
      database: process.env.BOT_DB_NAME || 'genthrust_inventory',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 50,
      connectTimeout: 5000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
  }
  return globalForInventoryDb.inventoryMysqlPool
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

// Graceful shutdown — drain pool on process exit
if (typeof process !== 'undefined') {
  const shutdown = () => {
    globalForInventoryDb.inventoryMysqlPool?.end().catch(() => {})
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
