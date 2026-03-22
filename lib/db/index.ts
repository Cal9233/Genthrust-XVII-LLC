/**
 * Drizzle ORM Database Connection
 * Reuses the shared mysql2 pool from lib/db.ts to avoid duplicate connections.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { getPool } from "../db";
import * as schema from "./schema";

export const pool = getPool();

export const db = drizzle(pool, { schema, mode: "default" });
