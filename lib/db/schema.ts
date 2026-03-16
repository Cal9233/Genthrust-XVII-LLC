/**
 * Drizzle ORM Schema for Genthrust Dashboard
 * Ported from Genthrust_Repairs_v.2 with curentStatus -> currentStatus fix
 */

import {
  mysqlTable,
  varchar,
  text,
  int,
  bigint,
  double,
  timestamp,
  datetime,
  primaryKey,
  boolean,
  index,
  json,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";
import type {
  NotificationType,
  NotificationStatus,
  NotificationPayload,
} from "@/lib/types/notification";

// ==========================================
// REPAIR ORDER TABLES
// ==========================================

export const active = mysqlTable(
  "active",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: varchar("DATE_MADE", { length: 500 }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: double("FINAL_COST"),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    // FIX: curentStatus -> currentStatus (DB column name stays CURENT_STATUS for backwards compat)
    currentStatus: varchar("CURENT_STATUS", { length: 500 }),
    currentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    // ERP.aero sync columns
    erpPoId: varchar("erp_po_id", { length: 50 }),
    erpLastSyncAt: varchar("erp_last_sync_at", { length: 50 }),
    erpSyncStatus: varchar("erp_sync_status", { length: 20 }).default(
      "LOCAL_ONLY"
    ),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "active_id" })]
);

export const net = mysqlTable(
  "net",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: datetime("DATE_MADE", { mode: "string" }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: double("FINAL_COST"),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    currentStatus: varchar("CURENT_STATUS", { length: 500 }),
    currentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "net_id" })]
);

export const paid = mysqlTable(
  "paid",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: datetime("DATE_MADE", { mode: "string" }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: varchar("FINAL_COST", { length: 500 }),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    currentStatus: varchar("CURENT_STATUS", { length: 500 }),
    currentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "paid_id" })]
);

export const returns = mysqlTable(
  "returns",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: varchar("DATE_MADE", { length: 500 }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: varchar("FINAL_COST", { length: 500 }),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    currentStatus: varchar("CURENT_STATUS", { length: 500 }),
    currentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "returns_id" })]
);

// ==========================================
// INVENTORY & SHOP TABLES
// ==========================================

export const inventoryindex = mysqlTable(
  "inventoryindex",
  {
    indexId: int("IndexId").autoincrement().notNull(),
    partNumber: varchar("PartNumber", { length: 255 }),
    tableName: varchar("TableName", { length: 100 }),
    rowId: int("RowId"),
    qty: int("Qty"),
    serialNumber: varchar("SerialNumber", { length: 255 }),
    condition: varchar("Condition", { length: 50 }),
    location: varchar("Location", { length: 255 }),
    description: text("Description"),
    lastSeen: datetime("LastSeen", { mode: "string" }).default(
      sql`(CURRENT_TIMESTAMP)`
    ),
  },
  (table) => [
    index("idx_partnumber").on(table.partNumber),
    index("idx_qty").on(table.qty),
    primaryKey({ columns: [table.indexId], name: "inventoryindex_IndexId" }),
  ]
);

export const shops = mysqlTable(
  "shops",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    customer: bigint("Customer", { mode: "number" }),
    businessName: varchar("Business_Name", { length: 500 }),
    addressLine1: varchar("Address_Line_1", { length: 500 }),
    addressLine2: varchar("Address_Line_2", { length: 500 }),
    addressLine3: varchar("Address_Line_3", { length: 500 }),
    addressLine4: varchar("Address_Line_4", { length: 500 }),
    city: varchar("City", { length: 500 }),
    state: varchar("State", { length: 500 }),
    zip: varchar("ZIP", { length: 500 }),
    country: varchar("Country", { length: 500 }),
    phone: varchar("Phone", { length: 500 }),
    tollFree: varchar("Toll_Free", { length: 500 }),
    fax: varchar("Fax", { length: 500 }),
    email: varchar("Email", { length: 500 }),
    website: varchar("Website", { length: 500 }),
    contact: varchar("Contact", { length: 500 }),
    paymentTerms: varchar("Payment_Terms", { length: 500 }),
    ilsCode: varchar("ILS_Code", { length: 500 }),
    lastSaleDate: varchar("Last_Sale_Date", { length: 500 }),
    ytdSales: double("YTD_Sales"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "shops_id" })]
);

// ==========================================
// AUTH.JS TABLES
// ==========================================

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", fsp: 3 }),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
});

export const accounts = mysqlTable(
  "accounts",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 })
      .$type<"email" | "oauth" | "oidc" | "webauthn">()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  ]
);

export const sessions = mysqlTable("sessions", {
  sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = mysqlTable(
  "verificationTokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
    }),
  ]
);

export const authenticators = mysqlTable(
  "authenticators",
  {
    credentialID: varchar("credentialID", { length: 255 }).notNull().unique(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: varchar("providerAccountId", {
      length: 255,
    }).notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: int("counter").notNull(),
    credentialDeviceType: varchar("credentialDeviceType", {
      length: 255,
    }).notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: varchar("transports", { length: 255 }),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.credentialID],
    }),
  ]
);

// ==========================================
// AUTH.JS RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  authenticators: many(authenticators),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const authenticatorsRelations = relations(
  authenticators,
  ({ one }) => ({
    user: one(users, {
      fields: [authenticators.userId],
      references: [users.id],
    }),
  })
);

// ==========================================
// TYPE EXPORTS
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// ==========================================
// NOTIFICATION QUEUE TABLE
// ==========================================

export const notificationQueue = mysqlTable(
  "notification_queue",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    repairOrderId: bigint("repair_order_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).$type<NotificationType>().notNull(),
    status: varchar("status", { length: 20 })
      .$type<NotificationStatus>()
      .default("PENDING_APPROVAL")
      .notNull(),
    payload: json("payload").$type<NotificationPayload>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    scheduledFor: timestamp("scheduled_for", { mode: "date" }).notNull(),
    outlookMessageId: varchar("outlook_message_id", { length: 255 }),
    outlookConversationId: varchar("outlook_conversation_id", { length: 255 }),
  },
  (table) => [
    index("idx_notification_status").on(table.status),
    index("idx_notification_user").on(table.userId),
    index("idx_notification_outlook_message").on(table.outlookMessageId),
  ]
);

export const notificationQueueRelations = relations(
  notificationQueue,
  ({ one }) => ({
    repairOrder: one(active, {
      fields: [notificationQueue.repairOrderId],
      references: [active.id],
    }),
    user: one(users, {
      fields: [notificationQueue.userId],
      references: [users.id],
    }),
  })
);

export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type NewNotificationQueueItem = typeof notificationQueue.$inferInsert;

// ==========================================
// RO STATUS HISTORY TABLE
// ==========================================

export const roStatusHistory = mysqlTable(
  "ro_status_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    repairOrderId: bigint("repair_order_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 100 }).notNull(),
    previousStatus: varchar("previous_status", { length: 100 }),
    changedBy: varchar("changed_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    changedAt: timestamp("changed_at", { mode: "date" }).defaultNow().notNull(),
    notes: text("notes"),
  },
  (table) => [
    index("idx_status_history_ro").on(table.repairOrderId),
    index("idx_status_history_date").on(table.changedAt),
  ]
);

export const roStatusHistoryRelations = relations(
  roStatusHistory,
  ({ one }) => ({
    repairOrder: one(active, {
      fields: [roStatusHistory.repairOrderId],
      references: [active.id],
    }),
    user: one(users, {
      fields: [roStatusHistory.changedBy],
      references: [users.id],
    }),
  })
);

export type RoStatusHistory = typeof roStatusHistory.$inferSelect;
export type NewRoStatusHistory = typeof roStatusHistory.$inferInsert;

// ==========================================
// RO ACTIVITY LOG TABLE
// ==========================================

export const roActivityLog = mysqlTable(
  "ro_activity_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    repairOrderId: bigint("repair_order_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    field: varchar("field", { length: 100 }),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_activity_log_ro").on(table.repairOrderId),
    index("idx_activity_log_date").on(table.createdAt),
  ]
);

export const roActivityLogRelations = relations(roActivityLog, ({ one }) => ({
  repairOrder: one(active, {
    fields: [roActivityLog.repairOrderId],
    references: [active.id],
  }),
  user: one(users, {
    fields: [roActivityLog.userId],
    references: [users.id],
  }),
}));

export type RoActivityLog = typeof roActivityLog.$inferSelect;
export type NewRoActivityLog = typeof roActivityLog.$inferInsert;

// ==========================================
// RO RELATIONS TABLE
// ==========================================

export const roRelationsTable = mysqlTable(
  "ro_relations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    sourceRoId: bigint("source_ro_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    targetRoId: bigint("target_ro_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    relationType: varchar("relation_type", { length: 50 }).notNull(),
    createdBy: varchar("created_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ro_relations_source").on(table.sourceRoId),
    index("idx_ro_relations_target").on(table.targetRoId),
  ]
);

export type RoRelation = typeof roRelationsTable.$inferSelect;
export type NewRoRelation = typeof roRelationsTable.$inferInsert;

// ==========================================
// FILES UPLOAD TABLE
// ==========================================

export const filesUpload = mysqlTable(
  "files_upload",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    repairOrderId: bigint("repair_order_id", { mode: "number" })
      .notNull()
      .references(() => active.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileExtension: varchar("file_extension", { length: 20 }),
    fileSize: bigint("file_size", { mode: "number" }),
    sharePointFileId: varchar("sharepoint_file_id", { length: 255 }),
    sharePointWebUrl: text("sharepoint_web_url"),
    uploadedBy: varchar("uploaded_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    uploadedAt: timestamp("uploaded_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    index("idx_files_upload_ro").on(table.repairOrderId),
    index("idx_files_upload_user").on(table.uploadedBy),
    index("idx_files_upload_sharepoint").on(table.sharePointFileId),
  ]
);

export type FilesUpload = typeof filesUpload.$inferSelect;
export type NewFilesUpload = typeof filesUpload.$inferInsert;
