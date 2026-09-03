import { useEffect, useMemo, useState } from 'react'
import './ReportCenter.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

const FILTERS = {
  overview: ['period', 'app_id'],
  activity: ['period', 'app_id', 'search', 'type', 'outcome'],
  financial: ['period', 'app_id', 'provider', 'method', 'financial_status'],
  applications: ['period', 'search', 'application_status'],
  users: ['period', 'app_id', 'profile_id', 'search'],
  establishments: ['period', 'app_id', 'search', 'establishment_status', 'city', 'uf'],
  items: ['period', 'app_id', 'search', 'item_type', 'item_status'],
  audit: ['period', 'search', 'action'],
}

const emptyFilters = { from: '', to: '', app_id: '', profile_id: '', search: '', type: '', outcome: '', provider: '', method: '', status: '', city: '', uf: '', action: '' }

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.location.href = '/login'
    throw new Error('Sessão expirada.')
  }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
  return data
}

function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function period(days) {
  if (days === 'all') return { from: '2000-01-01', to: isoDate(new Date()) }
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (Number(days) - 1))
  return { from: isoDate(from), to: isoDate(to) }
}

function fmt(value) { return value ? new Date(value).toLocaleString('pt-BR') : '—' }
function labelStatus(value) { return ({ queued: 'Na fila', processing: 'Gerando', ready: 'Pronto', failed: 'Falhou', expired: 'Expirado' }[value] || value || '—') }

async function authenticatedDownload(path, fallback) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.message || 'Não foi possível baixar o relatório.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fallback
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

export default function ReportCenter({ initialReport = 'overview' }) {
  const [view, setView] = useState('generate')
  const [meta, setMeta] = useState(null)
  const [reportKey, setReportKey] = useState(initialReport)
  const [format, setFormat] = useState('pdf')
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...period(30) }))
  const [exports, setExports] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [scheduleForm, setScheduleForm] = useState({ name: '', report_key: initialReport, format: 'pdf', cadence: 'monthly', day_of_week: 1, day_of_month: 1, hour: 8, minute: 0, timezone: 'America/Sao_Paulo' })

  const report = useMemo(() => meta?.reports?.find(item => item.key === reportKey), [meta, reportKey])
  const activeFilters = new Set(FILTERS[reportKey] || ['period'])

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [metadata, history, scheduleData] = await Promise.all([
        api('/admin/ecosystem/reports'),
        api('/admin/ecosystem/report-exports?per_page=50'),
        api('/admin/ecosystem/report-schedules'),
      ])
      setMeta(metadata)
      setExports(history?.data || [])
      setSchedules(scheduleData?.schedules || [])
      if (!metadata?.reports?.some(item => item.key === reportKey)) setReportKey(metadata?.reports?.[0]?.key || 'overview')
    } catch (err) {
      setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!exports.some(item => ['queued', 'processing'].includes(item.status))) return undefined
    const timer = setInterval(() => loadAll(true), 3000)
    return () => clearInterval(timer)
  }, [exports])

  function setPreset(days) { setFilters(current => ({ ...current, ...period(days) })) }
  function changeReport(key) {
    setReportKey(key)
    setScheduleForm(current => ({ ...current, report_key: key }))
    setFilters({ ...emptyFilters, ...period(30) })
  }

  function cleanFilters() {
    const allowed = new Set(FILTERS[reportKey] || [])
    const result = {}
    Object.entries(filters).forEach(([key, value]) => {
      const canonical = key === 'from' || key === 'to' ? 'period' : key
      if (allowed.has(canonical) && String(value ?? '').trim() !== '') result[key] = String(value).trim()
    })
    return result
  }

  async function generate(event) {
    event.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const data = await api('/admin/ecosystem/report-exports', { method: 'POST', body: JSON.stringify({ report_key: reportKey, format, filters: cleanFilters() }) })
      setExports(current => [data.export, ...current.filter(item => item.uuid !== data.export.uuid)])
      setMessage('Relatório enviado para geração. Ele aparecerá como pronto no histórico assim que a fila terminar.')
      setView('history')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function download(item) {
    setError('')
    try { await authenticatedDownload(`/admin/ecosystem/report-exports/${item.uuid}/download`, item.filename || `relatorio.${item.format}`) }
    catch (err) { setError(err.message) }
  }

  async function createSchedule(event) {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      const payload = { ...scheduleForm, filters: cleanFilters() }
      if (payload.cadence !== 'weekly') delete payload.day_of_week
      if (payload.cadence !== 'monthly') delete payload.day_of_month
      await api('/admin/ecosystem/report-schedules', { method: 'POST', body: JSON.stringify(payload) })
      setMessage('Agendamento criado com sucesso.')
      await loadAll(true)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function toggleSchedule(item) {
    setLoading(true); setError('')
    try {
      await api(`/admin/ecosystem/report-schedules/${item.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !item.is_active }) })
      await loadAll(true)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function removeSchedule(item) {
    if (!window.confirm(`Excluir o agendamento “${item.name}”?`)) return
    setLoading(true); setError('')
    try {
      await api(`/admin/ecosystem/report-schedules/${item.id}`, { method: 'DELETE' })
      await loadAll(true)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const reports = meta?.reports || []
  const formats = meta?.formats || [{ key: 'pdf', label: 'PDF' }, { key: 'csv', label: 'CSV' }, { key: 'xlsx', label: 'Excel (XLSX)' }]

  return <div className="report-center">
    <section className="report-hero"><div><p>REPORTING CONTROL</p><h2>Central de relatórios</h2><span>Geração segura, histórico, exportações analíticas e agendamentos para todo o ecossistema Peter Tecnet.</span></div><div className="report-hero-actions"><button onClick={() => loadAll()} disabled={loading}>Atualizar</button></div></section>
    <nav className="report-tabs"><button className={view === 'generate' ? 'active' : ''} onClick={() => setView('generate')}>Gerar</button><button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>Histórico</button><button className={view === 'schedules' ? 'active' : ''} onClick={() => setView('schedules')}>Agendamentos</button></nav>
    {error && <div className="report-notice error">{error}</div>}{message && <div className="report-notice success">{message}</div>}

    {view === 'generate' && <form className="report-panel report-generate" onSubmit={generate}>
      <header><div><b>Novo relatório</b><small>{report?.description || 'Selecione os dados que deseja exportar.'}</small></div></header>
      <div className="report-form-grid">
        <label>Relatório<select value={reportKey} onChange={e => changeReport(e.target.value)}>{reports.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label>Formato<select value={format} onChange={e => setFormat(e.target.value)}>{formats.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      </div>
      {activeFilters.has('period') && <><div className="report-presets"><button type="button" onClick={() => setPreset(7)}>7 dias</button><button type="button" onClick={() => setPreset(30)}>30 dias</button><button type="button" onClick={() => setPreset(90)}>90 dias</button><button type="button" onClick={() => setPreset('all')}>Todo período</button></div><div className="report-form-grid"><Field label="De" type="date" value={filters.from} onChange={v => setFilters({ ...filters, from: v })}/><Field label="Até" type="date" value={filters.to} onChange={v => setFilters({ ...filters, to: v })}/></div></>}
      <div className="report-form-grid">
        {activeFilters.has('app_id') && <Select label="Aplicação" value={filters.app_id} onChange={v => setFilters({ ...filters, app_id: v })} rows={meta?.applications}/>} 
        {activeFilters.has('profile_id') && <Select label="Perfil" value={filters.profile_id} onChange={v => setFilters({ ...filters, profile_id: v })} rows={meta?.profiles}/>} 
        {activeFilters.has('search') && <Field label="Busca" value={filters.search} onChange={v => setFilters({ ...filters, search: v })}/>} 
        {activeFilters.has('type') && <Select label="Tipo de atividade" value={filters.type} onChange={v => setFilters({ ...filters, type: v })} rows={(meta?.activity_types || []).map(x => ({ id: x, name: x.replaceAll('_', ' ') }))}/>} 
        {activeFilters.has('outcome') && <Select label="Resultado" value={filters.outcome} onChange={v => setFilters({ ...filters, outcome: v })} rows={[{ id: 'success', name: 'Sucesso' }, { id: 'denied', name: 'Negado' }, { id: 'error', name: 'Erro' }]}/>} 
        {activeFilters.has('provider') && <Field label="Gateway" value={filters.provider} onChange={v => setFilters({ ...filters, provider: v })}/>} 
        {activeFilters.has('method') && <Select label="Método" value={filters.method} onChange={v => setFilters({ ...filters, method: v })} rows={[{ id: 'pix', name: 'PIX' }, { id: 'card', name: 'Cartão' }]}/>} 
        {activeFilters.has('financial_status') && <Select label="Status financeiro" value={filters.status} onChange={v => setFilters({ ...filters, status: v })} rows={['paid','pending','in_process','failed','rejected','cancelled','refunded','charged_back'].map(x => ({ id: x, name: x }))}/>} 
        {activeFilters.has('application_status') && <Select label="Status" value={filters.status} onChange={v => setFilters({ ...filters, status: v })} rows={[{ id: 'active', name: 'Ativas' }, { id: 'inactive', name: 'Inativas' }]}/>} 
        {activeFilters.has('establishment_status') && <Select label="Estado" value={filters.status} onChange={v => setFilters({ ...filters, status: v })} rows={[{ id: 'approved', name: 'Aprovados' }, { id: 'pending', name: 'Pendentes' }, { id: 'published', name: 'Publicados' }, { id: 'hidden', name: 'Ocultos' }]}/>} 
        {activeFilters.has('city') && <Field label="Cidade" value={filters.city} onChange={v => setFilters({ ...filters, city: v })}/>} 
        {activeFilters.has('uf') && <Field label="UF" value={filters.uf} onChange={v => setFilters({ ...filters, uf: v.toUpperCase().slice(0, 2) })}/>} 
        {activeFilters.has('item_type') && <Select label="Tipo de item" value={filters.type} onChange={v => setFilters({ ...filters, type: v })} rows={(meta?.item_types || []).map(x => ({ id: x, name: x }))}/>} 
        {activeFilters.has('item_status') && <Select label="Status" value={filters.status} onChange={v => setFilters({ ...filters, status: v })} rows={[{ id: 'active', name: 'Ativos' }, { id: 'archived', name: 'Arquivados' }]}/>} 
        {activeFilters.has('action') && <Select label="Ação administrativa" value={filters.action} onChange={v => setFilters({ ...filters, action: v })} rows={(meta?.audit_actions || []).map(x => ({ id: x, name: x.replaceAll('.', ' ') }))}/>} 
      </div>
      <footer><span>{format === 'pdf' ? 'PDF otimizado para leitura executiva.' : 'CSV/XLSX usa geração em fila para volumes maiores.'}</span><button className="report-primary" disabled={loading || !reportKey}>{loading ? 'Enviando...' : `Gerar ${format.toUpperCase()}`}</button></footer>
    </form>}

    {view === 'history' && <section className="report-panel"><header><div><b>Histórico de exportações</b><small>Arquivos privados expiram automaticamente após o período de retenção.</small></div></header><div className="report-table-wrap"><table><thead><tr><th>Solicitado</th><th>Relatório</th><th>Formato</th><th>Status</th><th>Linhas</th><th>Gerado por</th><th>Ação</th></tr></thead><tbody>{exports.length ? exports.map(item => <tr key={item.uuid}><td>{fmt(item.requested_at || item.created_at)}</td><td>{reports.find(r => r.key === item.report_key)?.label || item.report_key}</td><td>{item.format?.toUpperCase()}</td><td><span className={`report-status ${item.status}`}>{labelStatus(item.status)}</span></td><td>{item.row_count ?? '—'}</td><td>{item.user?.email || '—'}</td><td>{item.download_ready ? <button onClick={() => download(item)}>Baixar</button> : item.status === 'failed' ? <small title={item.error_message}>{item.error_message || 'Falha'}</small> : '—'}</td></tr>) : <tr><td colSpan="7">Nenhuma exportação gerada ainda.</td></tr>}</tbody></table></div></section>}

    {view === 'schedules' && <div className="report-schedule-grid"><form className="report-panel" onSubmit={createSchedule}><header><div><b>Novo agendamento</b><small>Automatize relatórios recorrentes usando os filtros atuais.</small></div></header><div className="report-form-grid"><Field label="Nome" value={scheduleForm.name} onChange={v => setScheduleForm({ ...scheduleForm, name: v })}/><Select label="Relatório" value={scheduleForm.report_key} onChange={v => { setScheduleForm({ ...scheduleForm, report_key: v }); changeReport(v) }} rows={reports.map(x => ({ id: x.key, name: x.label }))}/><Select label="Formato" value={scheduleForm.format} onChange={v => setScheduleForm({ ...scheduleForm, format: v })} rows={formats.map(x => ({ id: x.key, name: x.label }))}/><Select label="Frequência" value={scheduleForm.cadence} onChange={v => setScheduleForm({ ...scheduleForm, cadence: v })} rows={[{ id: 'daily', name: 'Diário' }, { id: 'weekly', name: 'Semanal' }, { id: 'monthly', name: 'Mensal' }]}/>{scheduleForm.cadence === 'weekly' && <Select label="Dia da semana" value={scheduleForm.day_of_week} onChange={v => setScheduleForm({ ...scheduleForm, day_of_week: Number(v) })} rows={['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((name, id) => ({ id, name }))}/>} {scheduleForm.cadence === 'monthly' && <Field label="Dia do mês (1–28)" type="number" value={scheduleForm.day_of_month} onChange={v => setScheduleForm({ ...scheduleForm, day_of_month: Number(v) })}/>}<Field label="Hora" type="number" value={scheduleForm.hour} onChange={v => setScheduleForm({ ...scheduleForm, hour: Number(v) })}/><Field label="Minuto" type="number" value={scheduleForm.minute} onChange={v => setScheduleForm({ ...scheduleForm, minute: Number(v) })}/></div><footer><span>Fuso: America/Sao_Paulo</span><button className="report-primary" disabled={loading}>Criar agendamento</button></footer></form><section className="report-panel"><header><div><b>Agendamentos ativos</b><small>Você pode pausar ou remover rotinas sem perder o histórico.</small></div></header><div className="report-schedule-list">{schedules.length ? schedules.map(item => <article key={item.id}><div><b>{item.name}</b><small>{item.report_key} · {item.format.toUpperCase()} · {item.cadence} · próxima execução {fmt(item.next_run_at)}</small></div><div><button onClick={() => toggleSchedule(item)}>{item.is_active ? 'Pausar' : 'Ativar'}</button><button className="danger" onClick={() => removeSchedule(item)}>Excluir</button></div></article>) : <p>Nenhum relatório agendado.</p>}</div></section></div>}
  </div>
}

function Field({ label, value, onChange, type = 'text' }) { return <label>{label}<input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} /></label> }
function Select({ label, value, onChange, rows = [] }) { return <label>{label}<select value={value ?? ''} onChange={e => onChange(e.target.value)}><option value="">Todos</option>{rows.map(row => <option key={String(row.id)} value={row.id}>{row.name}</option>)}</select></label> }
