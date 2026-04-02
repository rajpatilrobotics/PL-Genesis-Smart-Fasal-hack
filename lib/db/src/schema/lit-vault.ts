import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const litVaultTable = pgTable("lit_vault_records", {
  id: serial("id").primaryKey(),
  farmerWallet: text("farmer_wallet").notNull(),
  dataType: text("data_type").notNull(),
  dataPreview: text("data_preview").notNull(),
  encryptedBlob: text("encrypted_blob").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  aesKeyHex: text("aes_key_hex").notNull(),
  filecoinCid: text("filecoin_cid"),
  filecoinUrl: text("filecoin_url"),
  allowedWallets: text("allowed_wallets").notNull().default("[]"),
  granteeLabels: text("grantee_labels").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LitVaultRecord = typeof litVaultTable.$inferSelect;
