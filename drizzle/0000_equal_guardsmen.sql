CREATE TABLE `accounts` (
	`userId` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` varchar(255),
	`scope` varchar(255),
	`id_token` text,
	`session_state` varchar(255),
	CONSTRAINT `accounts_provider_providerAccountId_pk` PRIMARY KEY(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `active` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` varchar(500),
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` double,
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`erp_po_id` varchar(50),
	`erp_last_sync_at` varchar(50),
	`erp_sync_status` varchar(20) DEFAULT 'LOCAL_ONLY',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `active_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authenticators` (
	`credentialID` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`credentialPublicKey` text NOT NULL,
	`counter` int NOT NULL,
	`credentialDeviceType` varchar(255) NOT NULL,
	`credentialBackedUp` boolean NOT NULL,
	`transports` varchar(255),
	CONSTRAINT `authenticators_userId_credentialID_pk` PRIMARY KEY(`userId`,`credentialID`),
	CONSTRAINT `authenticators_credentialID_unique` UNIQUE(`credentialID`)
);
--> statement-breakpoint
CREATE TABLE `files_upload` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_extension` varchar(20),
	`file_size` bigint,
	`sharepoint_file_id` varchar(255),
	`sharepoint_web_url` text,
	`uploaded_by` varchar(255),
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `files_upload_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryindex` (
	`IndexId` int AUTO_INCREMENT NOT NULL,
	`PartNumber` varchar(255),
	`TableName` varchar(100),
	`RowId` int,
	`Qty` int,
	`SerialNumber` varchar(255),
	`Condition` varchar(50),
	`Location` varchar(255),
	`Description` text,
	`LastSeen` datetime DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `inventoryindex_IndexId` PRIMARY KEY(`IndexId`)
);
--> statement-breakpoint
CREATE TABLE `net` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` datetime,
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` double,
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `net_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_queue` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`type` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`scheduled_for` timestamp NOT NULL,
	`outlook_message_id` varchar(255),
	`outlook_conversation_id` varchar(255),
	CONSTRAINT `notification_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paid` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` datetime,
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` varchar(500),
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `paid_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` varchar(500),
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` varchar(500),
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ro_activity_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`action` varchar(50) NOT NULL,
	`field` varchar(100),
	`old_value` text,
	`new_value` text,
	`user_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ro_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ro_relations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source_ro_id` bigint NOT NULL,
	`target_ro_id` bigint NOT NULL,
	`relation_type` varchar(50) NOT NULL,
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ro_relations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ro_status_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`status` varchar(100) NOT NULL,
	`previous_status` varchar(100),
	`changed_by` varchar(255),
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `ro_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `sessions_sessionToken` PRIMARY KEY(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`Customer` bigint,
	`Business_Name` varchar(500),
	`Address_Line_1` varchar(500),
	`Address_Line_2` varchar(500),
	`Address_Line_3` varchar(500),
	`Address_Line_4` varchar(500),
	`City` varchar(500),
	`State` varchar(500),
	`ZIP` varchar(500),
	`Country` varchar(500),
	`Phone` varchar(500),
	`Toll_Free` varchar(500),
	`Fax` varchar(500),
	`Email` varchar(500),
	`Website` varchar(500),
	`Contact` varchar(500),
	`Payment_Terms` varchar(500),
	`ILS_Code` varchar(500),
	`Last_Sale_Date` varchar(500),
	`YTD_Sales` double,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(255),
	`emailVerified` timestamp(3),
	`image` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `verificationTokens_identifier_token_pk` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `authenticators` ADD CONSTRAINT `authenticators_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `files_upload` ADD CONSTRAINT `files_upload_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `files_upload` ADD CONSTRAINT `files_upload_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_queue` ADD CONSTRAINT `notification_queue_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_queue` ADD CONSTRAINT `notification_queue_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_activity_log` ADD CONSTRAINT `ro_activity_log_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_activity_log` ADD CONSTRAINT `ro_activity_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_source_ro_id_active_id_fk` FOREIGN KEY (`source_ro_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_target_ro_id_active_id_fk` FOREIGN KEY (`target_ro_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_status_history` ADD CONSTRAINT `ro_status_history_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_status_history` ADD CONSTRAINT `ro_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_active_status` ON `active` (`CURENT_STATUS`);--> statement-breakpoint
CREATE INDEX `idx_active_ro` ON `active` (`RO`);--> statement-breakpoint
CREATE INDEX `idx_active_shop_name` ON `active` (`SHOP_NAME`);--> statement-breakpoint
CREATE INDEX `idx_files_upload_ro` ON `files_upload` (`repair_order_id`);--> statement-breakpoint
CREATE INDEX `idx_files_upload_user` ON `files_upload` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `idx_files_upload_sharepoint` ON `files_upload` (`sharepoint_file_id`);--> statement-breakpoint
CREATE INDEX `idx_partnumber` ON `inventoryindex` (`PartNumber`);--> statement-breakpoint
CREATE INDEX `idx_qty` ON `inventoryindex` (`Qty`);--> statement-breakpoint
CREATE INDEX `idx_net_status` ON `net` (`CURENT_STATUS`);--> statement-breakpoint
CREATE INDEX `idx_net_ro` ON `net` (`RO`);--> statement-breakpoint
CREATE INDEX `idx_net_shop_name` ON `net` (`SHOP_NAME`);--> statement-breakpoint
CREATE INDEX `idx_notification_status` ON `notification_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_notification_user` ON `notification_queue` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_outlook_message` ON `notification_queue` (`outlook_message_id`);--> statement-breakpoint
CREATE INDEX `idx_paid_status` ON `paid` (`CURENT_STATUS`);--> statement-breakpoint
CREATE INDEX `idx_paid_ro` ON `paid` (`RO`);--> statement-breakpoint
CREATE INDEX `idx_paid_shop_name` ON `paid` (`SHOP_NAME`);--> statement-breakpoint
CREATE INDEX `idx_returns_status` ON `returns` (`CURENT_STATUS`);--> statement-breakpoint
CREATE INDEX `idx_returns_ro` ON `returns` (`RO`);--> statement-breakpoint
CREATE INDEX `idx_returns_shop_name` ON `returns` (`SHOP_NAME`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_ro` ON `ro_activity_log` (`repair_order_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_date` ON `ro_activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ro_relations_source` ON `ro_relations` (`source_ro_id`);--> statement-breakpoint
CREATE INDEX `idx_ro_relations_target` ON `ro_relations` (`target_ro_id`);--> statement-breakpoint
CREATE INDEX `idx_status_history_ro` ON `ro_status_history` (`repair_order_id`);--> statement-breakpoint
CREATE INDEX `idx_status_history_date` ON `ro_status_history` (`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_shops_email` ON `shops` (`Email`);