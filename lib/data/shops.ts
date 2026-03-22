/**
 * Shop data access functions
 * Ported from Genthrust_Repairs_v.2
 */

import { db } from "@/lib/db/index";
import { shops } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * Looks up a shop's email address by business name
 */
export async function getShopEmailByName(
  shopName: string | null | undefined
): Promise<string | null> {
  if (!shopName || shopName.trim() === "") {
    console.warn("[getShopEmailByName] Empty shop name provided");
    return null;
  }

  const trimmedName = shopName.trim();

  try {
    const result = await db
      .select({
        email: shops.email,
        businessName: shops.businessName,
      })
      .from(shops)
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`)
      .limit(1);

    if (result.length > 0) {
      const email = result[0].email;
      if (email && email.trim() !== "") {
        return email.trim();
      }
      return null;
    }

    // Fallback: fuzzy match
    const fuzzyResult = await db
      .select({
        email: shops.email,
        businessName: shops.businessName,
      })
      .from(shops)
      .where(
        sql`UPPER(TRIM(${shops.businessName})) LIKE UPPER(${`%${trimmedName}%`})`
      )
      .limit(1);

    if (fuzzyResult.length > 0) {
      const email = fuzzyResult[0].email;
      if (email && email.trim() !== "") {
        return email.trim();
      }
      return null;
    }

    return null;
  } catch (error) {
    console.error(
      `[getShopEmailByName] Database error looking up shop "${trimmedName}":`,
      error
    );
    return null;
  }
}

/**
 * Gets full shop details by business name
 */
export async function getShopByName(shopName: string | null | undefined) {
  if (!shopName || shopName.trim() === "") {
    return null;
  }

  const trimmedName = shopName.trim();

  try {
    const result = await db
      .select()
      .from(shops)
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`)
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error(
      `[getShopByName] Database error looking up shop "${trimmedName}":`,
      error
    );
    return null;
  }
}

/**
 * Updates a shop's email address by business name
 */
export async function updateShopEmail(
  shopName: string | null | undefined,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (!shopName || shopName.trim() === "") {
    return { success: false, error: "Shop name is required" };
  }

  if (!newEmail || newEmail.trim() === "") {
    return { success: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail.trim())) {
    return { success: false, error: "Invalid email format" };
  }

  const trimmedName = shopName.trim();
  const trimmedEmail = newEmail.trim();

  try {
    const existingShop = await db
      .select({ id: shops.id, businessName: shops.businessName })
      .from(shops)
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`)
      .limit(1);

    if (existingShop.length === 0) {
      return { success: false, error: "Shop not found" };
    }

    await db
      .update(shops)
      .set({ email: trimmedEmail })
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`);

    return { success: true };
  } catch (error) {
    console.error(
      `[updateShopEmail] Database error updating shop "${trimmedName}":`,
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}
