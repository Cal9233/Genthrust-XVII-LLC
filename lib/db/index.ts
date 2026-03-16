/**
 * Drizzle ORM Database Connection
 * Uses the existing mysql2 pool from the dashboard project
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

globalForDb.mysqlPool ??= mysql.createPool({
  host: process.env.DB_HOST || process.env.DATABASE_HOST || "localhost",
  port: parseInt(
    process.env.DB_PORT || process.env.DATABASE_PORT || "3306"
  ),
  user: process.env.DB_USER || process.env.DATABASE_USER || "genthrust",
  password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || "",
  database: process.env.DB_NAME || process.env.DATABASE_NAME || "genthrust",
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export const pool = globalForDb.mysqlPool;

export const db = drizzle(pool, { schema, mode: "default" });
