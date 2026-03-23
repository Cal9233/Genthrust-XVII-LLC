'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, Wrench, ShoppingCart, FileText, Search, DollarSign, ReceiptText, Activity, ClipboardList } from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable } from '@/components/internal/DataTable'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { ChartCard } from '@/components/internal/ChartCard'
import DetailDrawer, { DrawerMetaGrid, DrawerLineItems } from '@/components/internal/DetailDrawer'

type SubTab = 'ro' | 'so' | 'inv'

interface RepairOrder { id: number; ro_number: string; vendor_name: string | null; contact_name: string | null; status: string | null; priority: string | null; due_date: string | null; total: number | null; erp_created_at: string | null; erp_modified_at: string | null; line_count: number }
interface SalesOrder { id: number; so_number: string; customer_name: string | null; customer_po: string | null; contact_name: string | null; status: string | null; priority: string | null; due_date: string | null; total: number | null; track_no: string | null; erp_created_at: string | null; erp_modified_at: string | null; line_count: number }
interface Invoice { id: number; invoice_no: string; account_name: string | null; contact_name: string | null; so_number: string | null; customer_po: string | null; status: string | null; due_date: string | null; invoice_date: string | null; total: number | null; open_balance: number | null; erp_created_at: string | null; erp_modified_at: string | null; line_count: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DetailState { open: boolean; loading: boolean; error: string | null; order: any | null; lines: any[]; type: SubTab | null }

const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtCurrency = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

const RO_STATUSES = ['Active', 'Net', 'Paid', 'Returns', 'Cancelled']
const SO_STATUSES = ['Open', 'Active', 'Shipped', 'Completed', 'Cancelled']
const INV_STATUSES = ['Open', 'Paid', 'Overdue', 'Partial', 'Cancelled']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priceCol = (key: string, label: string) => ({ key, label, align: 'right' as const, render: (r: any) => fmtCurrency(r[key]) })
const lineItemCols = [
  { key: 'line_number', label: '#', align: 'center' as const },
  { key: 'part_number', label: 'Part No.' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Qty', align: 'right' as const },
  priceCol('unit_price', 'Unit Price'),
  priceCol('extended_price', 'Extended'),
]

export default function ErpPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('ro')
  const [visible, setVisible] = useState(false)
  const [ros, setRos] = useState<RepairOrder[]>([])
  const [sos, setSos] = useState<SalesOrder[]>([])
  const [invs, setInvs] = useState<Invoice[]>([])
  const [roLoading, setRoLoading] = useState(true)
  const [soLoading, setSoLoading] = useState(true)
  const [invLoading, setInvLoading] = useState(true)
  const [roError, setRoError] = useState<string | null>(null)
  const [soError, setSoError] = useState<string | null>(null)
  const [invError, setInvError] = useState<string | null>(null)
  const [roSearch, setRoSearch] = useState(''); const [roStatus, setRoStatus] = useState('')
  const [soSearch, setSoSearch] = useState(''); const [soStatus, setSoStatus] = useState('')
  const [invSearch, setInvSearch] = useState(''); const [invStatus, setInvStatus] = useState('')
  const [detail, setDetail] = useState<DetailState>({ open: false, loading: false, error: null, order: null, lines: [], type: null })

  const loadRos = useCallback(async (search: string, status: string) => {
    setRoLoading(true); setRoError(null)
    try {
      const res = await fetch(`/api/internal/repair-orders?${new URLSearchParams({ search, status, limit: '50' })}`)
      if (!res.ok) throw new Error('Failed to load repair orders')
      setRos((await res.json()).data ?? [])
    } catch (e) { setRoError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setRoLoading(false) }
  }, [])

  const loadSos = useCallback(async (search: string, status: string) => {
    setSoLoading(true); setSoError(null)
    try {
      const res = await fetch(`/api/internal/sales-orders?${new URLSearchParams({ search, status, limit: '50' })}`)
      if (!res.ok) throw new Error('Failed to load sales orders')
      setSos((await res.json()).data ?? [])
    } catch (e) { setSoError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setSoLoading(false) }
  }, [])

  const loadInvs = useCallback(async (search: string, status: string) => {
    setInvLoading(true); setInvError(null)
    try {
      const res = await fetch(`/api/internal/invoices?${new URLSearchParams({ search, status, limit: '50' })}`)
      if (!res.ok) throw new Error('Failed to load invoices')
      setInvs((await res.json()).data ?? [])
    } catch (e) { setInvError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setInvLoading(false) }
  }, [])

  // Initial load
  useEffect(() => { loadRos('', ''); loadSos('', ''); loadInvs('', '') }, [loadRos, loadSos, loadInvs])
  // Re-fetch on filter changes
  useEffect(() => { loadRos(roSearch, roStatus) }, [loadRos, roSearch, roStatus])
  useEffect(() => { loadSos(soSearch, soStatus) }, [loadSos, soSearch, soStatus])
  useEffect(() => { loadInvs(invSearch, invStatus) }, [loadInvs, invSearch, invStatus])

  const isLoading = roLoading || soLoading || invLoading
  useEffect(() => {
    if (!isLoading) { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }
    setVisible(false)
  }, [isLoading])

  async function openDetail(id: number, type: SubTab) {
    setDetail({ open: true, loading: true, error: null, order: null, lines: [], type })
    try {
      const endpoint = type === 'ro' ? `/api/internal/repair-orders/${id}` : type === 'so' ? `/api/internal/sales-orders/${id}` : `/api/internal/invoices/${id}`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Failed to load detail')
      const json = await res.json()
      setDetail({ open: true, loading: false, error: null, order: json.order ?? json.invoice ?? null, lines: json.lines ?? [], type })
    } catch (e) { setDetail(p => ({ ...p, loading: false, error: e instanceof Error ? e.message : 'Failed to load' })) }
  }

  const activeRos = ros.filter(r => r.status && ['Active', 'Open', 'In Progress'].includes(r.status)).length
  const openSos = sos.filter(s => s.status && ['Open', 'Active'].includes(s.status)).length
  const unpaidInvs = invs.filter(i => i.status && ['Open', 'Overdue', 'Partial'].includes(i.status)).length
  const totalBalance = invs.reduce((sum, i) => sum + (i.open_balance ?? 0), 0)

  const roColumns = [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: RepairOrder) => <span className="font-mono font-semibold text-[#f0f6fc] text-xs">{r.ro_number || '—'}</span> },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (r: RepairOrder) => <span className="text-[#8b949e] text-xs">{r.vendor_name || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: RepairOrder) => <StatusBadge status={r.status} /> },
    { key: 'due_date', label: 'Due', sortable: true, render: (r: RepairOrder) => <span className="text-[#8b949e] text-xs">{fmtDate(r.due_date)}</span> },
    { key: 'total', label: 'Total', sortable: true, align: 'right' as const, render: (r: RepairOrder) => <span className="font-mono text-xs text-[#f0f6fc]">{fmtCurrency(r.total)}</span> },
    { key: 'line_count', label: 'Lines', sortable: true, align: 'center' as const, render: (r: RepairOrder) => <span className="text-[#8b949e] text-xs">{r.line_count}</span> },
  ]

  const soColumns = [
    { key: 'so_number', label: 'SO #', sortable: true, render: (r: SalesOrder) => <span className="font-mono font-semibold text-[#f0f6fc] text-xs">{r.so_number || '—'}</span> },
    { key: 'customer_name', label: 'Customer', sortable: true, render: (r: SalesOrder) => <div><span className="text-[#f0f6fc] text-xs">{r.customer_name || '—'}</span>{r.customer_po && <p className="text-[10px] text-[#484f58]">PO: {r.customer_po}</p>}</div> },
    { key: 'status', label: 'Status', sortable: true, render: (r: SalesOrder) => <StatusBadge status={r.status} /> },
    { key: 'due_date', label: 'Due', sortable: true, render: (r: SalesOrder) => <span className="text-[#8b949e] text-xs">{fmtDate(r.due_date)}</span> },
    { key: 'total', label: 'Total', sortable: true, align: 'right' as const, render: (r: SalesOrder) => <span className="font-mono text-xs text-[#f0f6fc]">{fmtCurrency(r.total)}</span> },
    { key: 'line_count', label: 'Lines', sortable: true, align: 'center' as const, render: (r: SalesOrder) => <span className="text-[#8b949e] text-xs">{r.line_count}</span> },
  ]

  const invColumns = [
    { key: 'invoice_no', label: 'Invoice #', sortable: true, render: (r: Invoice) => <span className="font-mono font-semibold text-[#f0f6fc] text-xs">{r.invoice_no || '—'}</span> },
    { key: 'account_name', label: 'Account', sortable: true, render: (r: Invoice) => <div><span className="text-[#f0f6fc] text-xs">{r.account_name || '—'}</span>{r.so_number && <p className="text-[10px] text-[#484f58]">SO: {r.so_number}</p>}</div> },
    { key: 'status', label: 'Status', sortable: true, render: (r: Invoice) => <StatusBadge status={r.status} /> },
    { key: 'due_date', label: 'Due', sortable: true, render: (r: Invoice) => <span className="text-[#8b949e] text-xs">{fmtDate(r.due_date)}</span> },
    { key: 'open_balance', label: 'Balance', sortable: true, align: 'right' as const, render: (r: Invoice) => <span className={`font-mono text-xs ${(r.open_balance ?? 0) > 0 ? 'text-[#d29922]' : 'text-[#8b949e]'}`}>{fmtCurrency(r.open_balance)}</span> },
    { key: 'total', label: 'Total', sortable: true, align: 'right' as const, render: (r: Invoice) => <span className="font-mono text-xs text-[#f0f6fc]">{fmtCurrency(r.total)}</span> },
  ]

  function drawerMeta() {
    const o = detail.order; if (!o) return []
    if (detail.type === 'ro') return [
      { label: 'Status', value: <StatusBadge status={o.status} /> }, { label: 'Priority', value: o.priority || '—' },
      { label: 'Vendor', value: o.vendor_name || '—' }, { label: 'Contact', value: o.contact_name || '—' },
      { label: 'Due Date', value: fmtDate(o.due_date) }, { label: 'Total', value: fmtCurrency(o.total) },
      { label: 'Created', value: fmtDate(o.erp_created_at) }, { label: 'Modified', value: fmtDate(o.erp_modified_at) },
    ]
    if (detail.type === 'so') return [
      { label: 'Status', value: <StatusBadge status={o.status} /> }, { label: 'Priority', value: o.priority || '—' },
      { label: 'Customer', value: o.customer_name || '—' }, { label: 'Customer PO', value: o.customer_po || '—' },
      { label: 'Tracking', value: o.track_no || '—' }, { label: 'Due Date', value: fmtDate(o.due_date) },
      { label: 'Total', value: fmtCurrency(o.total) }, { label: 'Modified', value: fmtDate(o.erp_modified_at) },
    ]
    return [
      { label: 'Status', value: <StatusBadge status={o.status} /> }, { label: 'Invoice Date', value: fmtDate(o.invoice_date) },
      { label: 'Due Date', value: fmtDate(o.due_date) }, { label: 'Account', value: o.account_name || '—' },
      { label: 'SO #', value: o.so_number || '—' }, { label: 'Customer PO', value: o.customer_po || '—' },
      { label: 'Total', value: fmtCurrency(o.total) }, { label: 'Open Balance', value: fmtCurrency(o.open_balance) },
    ]
  }

  const tabs = [
    { key: 'ro' as SubTab, label: 'Repair Orders', icon: Wrench, count: ros.length },
    { key: 'so' as SubTab, label: 'Sales Orders', icon: ShoppingCart, count: sos.length },
    { key: 'inv' as SubTab, label: 'Invoices', icon: FileText, count: invs.length },
  ]

  const curSearch = activeTab === 'ro' ? roSearch : activeTab === 'so' ? soSearch : invSearch
  const setSearch = (v: string) => { if (activeTab === 'ro') setRoSearch(v); else if (activeTab === 'so') setSoSearch(v); else setInvSearch(v) }
  const curStatus = activeTab === 'ro' ? roStatus : activeTab === 'so' ? soStatus : invStatus
  const setStatus = (v: string) => { if (activeTab === 'ro') setRoStatus(v); else if (activeTab === 'so') setSoStatus(v); else setInvStatus(v) }
  const curError = activeTab === 'ro' ? roError : activeTab === 'so' ? soError : invError
  const retryLoad = () => { if (activeTab === 'ro') loadRos(roSearch, roStatus); else if (activeTab === 'so') loadSos(soSearch, soStatus); else loadInvs(invSearch, invStatus) }
  const drawerTitle = detail.order ? (detail.type === 'ro' ? `Repair Order — ${detail.order.ro_number}` : detail.type === 'so' ? `Sales Order — ${detail.order.so_number}` : `Invoice — ${detail.order.invoice_no}`) : 'Detail'
  const drawerSubtitle = detail.order ? (detail.type === 'ro' ? detail.order.vendor_name : detail.type === 'so' ? detail.order.customer_name : detail.order.account_name) ?? undefined : undefined
  const statusOptions = activeTab === 'ro' ? RO_STATUSES : activeTab === 'so' ? SO_STATUSES : INV_STATUSES
  const fade = `transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`

  return (
    <div className="space-y-6" style={{ animation: 'fadeInUp 0.2s ease-out both' }}>
      {/* Header */}
      <div className={`flex items-center justify-between transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div>
          <h1 className="text-2xl font-bold text-[#f0f6fc]">ERP Management</h1>
          <p className="text-[#8b949e] mt-0.5 text-sm">
            {isLoading ? 'Loading…' : `${(ros.length + sos.length + invs.length).toLocaleString()} records across repair orders, sales orders, and invoices`}
          </p>
        </div>
        <button onClick={() => { loadRos(roSearch, roStatus); loadSos(soSearch, soStatus); loadInvs(invSearch, invStatus) }} disabled={isLoading} aria-label="Refresh ERP data" className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-150 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 delay-100 ${fade}`}>
        <StatCard icon={Wrench} label="Active ROs" value={activeRos} color="blue" subtitle="In progress" loading={roLoading} onClick={() => setActiveTab('ro')} />
        <StatCard icon={ShoppingCart} label="Open SOs" value={openSos} color="green" subtitle="Awaiting fulfillment" loading={soLoading} onClick={() => setActiveTab('so')} />
        <StatCard icon={ReceiptText} label="Unpaid Invoices" value={unpaidInvs} color="orange" subtitle="Open balance" loading={invLoading} onClick={() => setActiveTab('inv')} />
        <StatCard icon={DollarSign} label="Total Balance" value={fmtCurrency(totalBalance)} color="indigo" subtitle="Across all invoices" loading={invLoading} />
      </div>

      {/* Table card */}
      <div className={`delay-200 ${fade}`}>
        <ChartCard
          title={tabs.find(t => t.key === activeTab)!.label}
          icon={activeTab === 'ro' ? Wrench : activeTab === 'so' ? ShoppingCart : FileText}
          subtitle={`${activeTab === 'ro' ? ros.length : activeTab === 'so' ? sos.length : invs.length} records`}
          action={
            <div className="inline-flex items-center bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
              {tabs.map(tab => { const Icon = tab.icon; return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${activeTab === tab.key ? 'bg-[#1f6feb] text-white shadow-sm' : 'text-[#8b949e] hover:text-[#f0f6fc]'}`}>
                  <Icon className="w-3 h-3" />{tab.label}
                  <span className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-[#484f58]'}`}>{tab.count}</span>
                </button>
              )})}
            </div>
          }
        >
          {/* Search + filter row */}
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484f58] pointer-events-none" />
              <input type="text" placeholder={activeTab === 'ro' ? 'Search RO #, vendor…' : activeTab === 'so' ? 'Search SO #, customer…' : 'Search invoice #, account…'} value={curSearch} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs border border-white/[0.08] rounded-lg bg-[#0b0f14] focus:outline-none focus:border-[#1f6feb] placeholder:text-[#484f58] text-[#f0f6fc] transition-colors" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {statusOptions.map(s => (
                <button key={s} onClick={() => setStatus(curStatus === s ? '' : s)} className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all duration-150 ${curStatus === s ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/40' : 'text-[#8b949e] border-white/[0.08] hover:text-[#f0f6fc] hover:border-white/20'}`}>{s}</button>
              ))}
              {curStatus && <button onClick={() => setStatus('')} className="px-2 py-1 text-[10px] font-medium text-[#f85149] hover:text-[#ff7b72] transition-colors">Clear</button>}
            </div>
          </div>

          {/* Error banner */}
          {curError && (
            <div className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20">
              <AlertCircle className="w-4 h-4 text-[#f85149] flex-shrink-0" />
              <p className="text-sm font-medium text-[#f85149] flex-1">{curError}</p>
              <button onClick={retryLoad} className="inline-flex items-center gap-1.5 text-xs text-[#f85149] hover:text-[#ff7b72] font-medium"><RefreshCw className="w-3 h-3" /> Retry</button>
            </div>
          )}

          {activeTab === 'ro' && <DataTable<RepairOrder> columns={roColumns} data={ros} loading={roLoading} onRowClick={r => openDetail(r.id, 'ro')} emptyMessage="No repair orders found" emptyIcon={<ClipboardList className="w-10 h-10 text-[#484f58]" />} />}
          {activeTab === 'so' && <DataTable<SalesOrder> columns={soColumns} data={sos} loading={soLoading} onRowClick={r => openDetail(r.id, 'so')} emptyMessage="No sales orders found" emptyIcon={<ShoppingCart className="w-10 h-10 text-[#484f58]" />} />}
          {activeTab === 'inv' && <DataTable<Invoice> columns={invColumns} data={invs} loading={invLoading} onRowClick={r => openDetail(r.id, 'inv')} emptyMessage="No invoices found" emptyIcon={<FileText className="w-10 h-10 text-[#484f58]" />} />}
        </ChartCard>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer open={detail.open} onClose={() => setDetail(p => ({ ...p, open: false }))} title={drawerTitle} subtitle={drawerSubtitle}>
        {detail.loading && (
          <div className="animate-pulse space-y-3">
            <div className="grid grid-cols-2 gap-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-white/[0.04] rounded-md" />)}</div>
            <div className="h-40 bg-white/[0.04] rounded-md mt-4" />
          </div>
        )}
        {detail.error && !detail.loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="w-8 h-8 text-[#f85149]" />
            <p className="text-sm text-[#f85149] font-medium">{detail.error}</p>
            <button onClick={() => detail.order && openDetail(detail.order.id, detail.type!)} className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#f0f6fc] transition-colors"><RefreshCw className="w-3 h-3" /> Retry</button>
          </div>
        )}
        {!detail.loading && !detail.error && detail.order && (
          <div className="space-y-5">
            <DrawerMetaGrid fields={drawerMeta()} />
            {detail.lines.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-[#484f58]" />
                  <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Line Items ({detail.lines.length})</p>
                </div>
                <DrawerLineItems columns={lineItemCols} rows={detail.lines} />
              </div>
            )}
            {detail.lines.length === 0 && <p className="text-xs text-[#484f58] text-center py-4">No line items on this record</p>}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
