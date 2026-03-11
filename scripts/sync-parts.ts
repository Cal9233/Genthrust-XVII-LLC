import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getPartsList, type ErpPartItem } from '../lib/erp-aero'
import { query, getPool } from '../lib/db'

const PAGE_SIZE = 100
const BATCH_SIZE = 100

function toMysqlDatetime(iso: string | null): string | null {
  if (!iso) return null
  return iso.replace('T', ' ').replace('.000Z', '').replace('Z', '')
}

function mapPartToRow(item: ErpPartItem) {
  const b = item.body
  return [
    b.productid,
    b.productname || '',
    b.description || null,
    b.full_description || null,
    b.nsnnumber || null,
    b.cage_code || null,
    b.mfr_part_no || null,
    b.serial_no || null,
    b.hazmat ? 1 : 0,
    b.hazmatclass || null,
    b.is_portal_item ? 1 : 0,
    b.manufacturer?.vendornameOEM || null,
    b.warehouse?.title || null,
    b.productcategory || null,
    toMysqlDatetime(b.createdtime),
    toMysqlDatetime(b.modified_time),
  ]
}

const UPSERT_SQL = `
  INSERT INTO parts (
    erp_product_id, product_name, description, full_description,
    nsn_number, cage_code, mfr_part_no, serial_no,
    hazmat, hazmat_class, is_portal_item,
    manufacturer_name, warehouse_title, product_category,
    erp_created_at, erp_modified_at
  ) VALUES ?
  ON DUPLICATE KEY UPDATE
    product_name = VALUES(product_name),
    description = VALUES(description),
    full_description = VALUES(full_description),
    nsn_number = VALUES(nsn_number),
    cage_code = VALUES(cage_code),
    mfr_part_no = VALUES(mfr_part_no),
    serial_no = VALUES(serial_no),
    hazmat = VALUES(hazmat),
    hazmat_class = VALUES(hazmat_class),
    is_portal_item = VALUES(is_portal_item),
    manufacturer_name = VALUES(manufacturer_name),
    warehouse_title = VALUES(warehouse_title),
    product_category = VALUES(product_category),
    erp_created_at = VALUES(erp_created_at),
    erp_modified_at = VALUES(erp_modified_at)
`

async function upsertBatch(rows: any[][]) {
  if (rows.length === 0) return
  const pool = getPool()
  await pool.query(UPSERT_SQL, [rows])
}

async function syncParts(fullSync = false) {
  console.log(`Starting ${fullSync ? 'full' : 'incremental'} parts sync...`)

  let lastSyncedTime: string | null = null
  if (!fullSync) {
    const [row] = await query<any[]>(
      'SELECT MAX(erp_modified_at) as last_modified FROM parts'
    )
    lastSyncedTime = row?.last_modified || null
    if (lastSyncedTime) {
      console.log(`Incremental sync from: ${lastSyncedTime}`)
    } else {
      console.log('No existing data found, doing full sync')
    }
  }

  let page = 1
  let totalSynced = 0
  let totalPages = 1
  let batch: any[][] = []

  while (page <= totalPages) {
    try {
      const response = await getPartsList(page, PAGE_SIZE)
      const { list, total } = response.data
      totalPages = Math.ceil(total / PAGE_SIZE)

      if (page === 1) {
        console.log(`Total parts in ERP: ${total} (${totalPages} pages)`)
      }

      for (const item of list) {
        // For incremental sync, stop if we've reached already-synced data
        if (!fullSync && lastSyncedTime && item.body.modified_time) {
          if (new Date(item.body.modified_time) <= new Date(lastSyncedTime)) {
            console.log(`Reached already-synced data at page ${page}, stopping`)
            // Flush remaining batch
            if (batch.length > 0) {
              await upsertBatch(batch)
              totalSynced += batch.length
            }
            console.log(`Sync complete. ${totalSynced} parts synced.`)
            return totalSynced
          }
        }

        batch.push(mapPartToRow(item))

        if (batch.length >= BATCH_SIZE) {
          await upsertBatch(batch)
          totalSynced += batch.length
          batch = []
        }
      }

      if (page % 10 === 0 || page === totalPages) {
        console.log(`Progress: page ${page}/${totalPages} (${totalSynced} parts synced)`)
      }

      page++
    } catch (error) {
      console.error(`Error on page ${page}:`, error)
      throw error
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    await upsertBatch(batch)
    totalSynced += batch.length
  }

  console.log(`Sync complete. ${totalSynced} parts synced.`)
  return totalSynced
}

// Export for use by API route
export { syncParts }

// CLI entry point
if (require.main === module) {
  const fullSync = process.argv.includes('--full')
  syncParts(fullSync)
    .then((count) => {
      console.log(`Done. ${count} parts synced.`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('Sync failed:', err)
      process.exit(1)
    })
}
