export interface InventoryItem {
  id: number
  part_number: string
  serial_number: string | null
  description: string | null
  quantity: number
  location: string | null
  bin: string | null
  condition: string | null
  cost: number
  sell_price: number
  source_file: string | null
}
