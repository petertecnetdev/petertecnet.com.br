import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmAction, confirmTypedAction } from './utils/uiDialog.js'
import './AdminFilesManager.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

const STATE_LABELS = {
  tracked: 'Registrado',
  referenced: 'Referenciado',
  orphan: 'Órfão',
  missing: 'Ausente',
  external: 'Externo',
}

const KIND_LABELS = {
  event: 'Evento',
  avatar: 'Avatar',
  managed_file: 'Arquivo gerenciado',
  blog: 'Blog',
  item: 'Item',
  branding: 'Branding',
  optimized: 'Otimizado',
  image: 'Imagem',
  file: 'Arquivo',
  media: 'Mídia',
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const payload = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('admin-session-expired'))
  }
  if (!response.ok) {
    const validation = Object.values(payload?.errors || {}).flat()?.[0]
    throw new Error(validation || payload?.message || payload?.error || 'Não foi possível concluir a operação.')
  }
  return payload
}

function bytes(value) {
  const amount = Number(value) || 0
  if (amount < 1024) return `${amount} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let current = amount / 1024
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current >= 100 ? current.toFixed(0) : current >= 10 ? current.toFixed(1) : current.toFixed(2)} ${units[index]}`
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function percent(used, total) {
  const totalNumber = Number(total) || 0
  if (!totalNumber) return 0
  return Math.min(100, Math.max(0, Math.round((Number(used || 0) / totalNumber) * 100)))
}

function Metric({ label, value, detail, tone = 'neutral' }) {
  return <article className={`fm-metric ${tone}`}>
    <span>{label}</span>
    <b>{value}</b>
    <small>{detail}</small>
  </article>
}

function Badge({ tone = 'neutral', children }) {
  return <span className={`fm-badge ${tone}`}><i />{children}</span>
}

function FilePreview({ row }) {
  if (!row.is_image || !row.public_url || row.state === 'missing') {
    return <div className="fm-file-icon">{row.kind === 'avatar' ? '◎' : row.kind === 'event' ? '◫' : '▣'}</div>
  }

  return <div className="fm-thumb"><img src={row.public_url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} /></div>
}

function stateTone(row) {
  if (row.protected) return 'protected'
  if (row.cleanup_candidate) return 'danger'
  if (row.state === 'missing') return 'warning'
  if (row.state === 'orphan') return 'warning'
  if (row.state === 'referenced' || row.state === 'tracked') return 'success'
  return 'neutral'
}

export default function AdminFilesManager() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [filters, setFilters] = useState({ search: '', state: '', kind: '', app: '', cleanup_candidate: false, protected: false, page: 1 })

  const load = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams()
      if (filters.search.trim()) query.set('search', filters.search.trim())
      if (filters.state) query.set('state', filters.state)
      if (filters.kind) query.set('kind', filters.kind)
      if (filters.app) query.set('app', filters.app)
      if (filters.cleanup_candidate) query.set('cleanup_candidate', '1')
      if (filters.protected) query.set('protected', '1')
      query.set('page', String(filters.page || 1))
      query.set('per_page', '80')
      const data = await apiRequest(`/admin/ecosystem/files?${query}`)
      setPayload(data)
      setSelected(current => {
        const available = new Set((data.files || []).filter(row => row.cleanup_candidate).map(row => row.path))
        return new Set([...current].filter(path => available.has(path)))
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), filters.search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const summary = payload?.summary || {}
  const rows = payload?.files || []
  const pagination = payload?.pagination || {}
  const diskUsedPercent = percent(summary.disk_used_bytes, summary.disk_total_bytes)
  const candidateRows = useMemo(() => rows.filter(row => row.cleanup_candidate), [rows])
  const allCandidatesSelected = candidateRows.length > 0 && candidateRows.every(row => selected.has(row.path))
  const selectedBytes = rows.filter(row => selected.has(row.path)).reduce((sum, row) => sum + Number(row.file_size || 0), 0)

  function updateFilter(key, value) {
    setFilters(current => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }))
  }

  function toggleRow(row) {
    if (!row.cleanup_candidate) return
    setSelected(current => {
      const next = new Set(current)
      next.has(row.path) ? next.delete(row.path) : next.add(row.path)
      return next
    })
  }

  function toggleAllCandidates() {
    setSelected(current => {
      const next = new Set(current)
      if (allCandidatesSelected) candidateRows.forEach(row => next.delete(row.path))
      else candidateRows.forEach(row => next.add(row.path))
      return next
    })
  }

  async function cleanupSelected(allCandidates = false) {
    const count = allCandidates ? Number(summary.cleanup_candidates || 0) : selected.size
    if (!count) return
    const message = allCandidates
      ? `Remover todos os ${count} arquivos classificados como candidatos seguros à limpeza? Blogs, itens, branding e arquivos referenciados continuarão protegidos.`
      : `Remover ${count} arquivo(s) selecionado(s), liberando aproximadamente ${bytes(selectedBytes)}?`
    const confirmed = allCandidates
      ? await confirmTypedAction({
          tone: 'danger',
          title: 'Limpar todos os candidatos seguros',
          message,
          requiredText: 'LIMPAR ARQUIVOS',
          requiredTextLabel: 'Digite a confirmação para continuar',
          confirmLabel: 'Excluir candidatos',
        })
      : await confirmAction({
          tone: 'danger',
          title: 'Excluir arquivos selecionados',
          message,
          confirmLabel: 'Excluir selecionados',
        })
    if (!confirmed) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest('/admin/ecosystem/files/cleanup', {
        method: 'POST',
        body: JSON.stringify({ all_candidates: allCandidates, paths: allCandidates ? [] : [...selected] }),
      })
      setNotice(`${result.deleted_count || 0} arquivo(s) removido(s). Espaço liberado: ${bytes(result.freed_bytes)}.`)
      setSelected(new Set())
      await load({ quiet: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteRegistered(row) {
    if (!row.id || !row.can_delete_registered) return
    const confirmed = await confirmAction({
      tone: 'danger',
      title: 'Excluir arquivo registrado',
      message: `Excluir definitivamente o arquivo registrado “${row.original_name}”? O backend bloqueará a operação se detectar vínculo ativo ou categoria protegida.`,
      confirmLabel: 'Excluir arquivo',
    })
    if (!confirmed) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/admin/ecosystem/files/${row.id}`, { method: 'DELETE' })
      setNotice(`${result.message} Espaço liberado: ${bytes(result.freed_bytes)}.`)
      await load({ quiet: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="fm-shell">
    <header className="fm-hero">
      <div>
        <p className="eyebrow">ARQUIVOS / STORAGE CONTROL</p>
        <h2>Gestão de arquivos</h2>
        <p>Inventário físico + registros da API, referências ativas, resíduos e limpeza segura do armazenamento.</p>
      </div>
      <div className="fm-hero-actions">
        <button className="fm-button secondary" onClick={() => load({ quiet: true })} disabled={refreshing || busy}>{refreshing ? 'Atualizando…' : '↻ Atualizar inventário'}</button>
        <button className="fm-button danger" onClick={() => cleanupSelected(true)} disabled={busy || !summary.cleanup_candidates}>Limpar candidatos seguros</button>
      </div>
    </header>

    {error && <div className="fm-alert error"><b>Não foi possível concluir a operação.</b><span>{error}</span></div>}
    {notice && <div className="fm-alert success"><b>Operação concluída.</b><span>{notice}</span></div>}

    <section className="fm-disk-card">
      <div className="fm-disk-top">
        <div><span>VPS / disco principal</span><b>{bytes(summary.disk_used_bytes)} usados de {bytes(summary.disk_total_bytes)}</b></div>
        <strong>{diskUsedPercent}%</strong>
      </div>
      <div className="fm-disk-bar"><i style={{ width: `${diskUsedPercent}%` }} /></div>
      <div className="fm-disk-foot"><span>{bytes(summary.disk_free_bytes)} livres</span><span>{bytes(summary.storage_public_bytes)} em storage público gerenciado</span></div>
    </section>

    <section className="fm-metrics">
      <Metric label="Arquivos físicos" value={summary.physical_files || 0} detail={`${bytes(summary.storage_public_bytes)} no storage público`} />
      <Metric label="Candidatos seguros" value={summary.cleanup_candidates || 0} detail={`${bytes(summary.cleanup_candidate_bytes)} podem ser liberados`} tone="danger" />
      <Metric label="Órfãos encontrados" value={summary.orphan_files || 0} detail={`${bytes(summary.orphan_bytes)} sem referência detectada`} tone="warning" />
      <Metric label="Protegidos" value={summary.protected_files || 0} detail={`${bytes(summary.protected_bytes)} preservados por política`} tone="success" />
      <Metric label="Registros ausentes" value={summary.missing_registered_files || 0} detail="Registro existe, arquivo físico não" tone={summary.missing_registered_files ? 'warning' : 'neutral'} />
    </section>

    <section className="fm-policy">
      <div className="fm-policy-icon">◆</div>
      <div><b>Proteção permanente ativa</b><span>Blogs, itens e branding nunca entram na limpeza automática. Arquivos referenciados por usuários, eventos, estabelecimentos e aplicações também são preservados.</span></div>
      <Badge tone="protected">Proteção backend</Badge>
    </section>

    <section className="fm-toolbar">
      <div className="fm-search"><span>⌕</span><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Buscar nome, caminho, entidade ou aplicação…" /></div>
      <select value={filters.state} onChange={event => updateFilter('state', event.target.value)}><option value="">Todos os estados</option>{(payload?.filters?.states || []).map(state => <option key={state} value={state}>{STATE_LABELS[state] || state}</option>)}</select>
      <select value={filters.kind} onChange={event => updateFilter('kind', event.target.value)}><option value="">Todos os tipos</option>{(payload?.filters?.kinds || []).map(kind => <option key={kind} value={kind}>{KIND_LABELS[kind] || kind}</option>)}</select>
      <select value={filters.app} onChange={event => updateFilter('app', event.target.value)}><option value="">Todas as aplicações</option>{(payload?.filters?.apps || []).map(app => <option key={app.value} value={app.value}>{app.name}</option>)}</select>
      <label className="fm-check-filter"><input type="checkbox" checked={filters.cleanup_candidate} onChange={event => updateFilter('cleanup_candidate', event.target.checked)} />Só candidatos</label>
      <label className="fm-check-filter"><input type="checkbox" checked={filters.protected} onChange={event => updateFilter('protected', event.target.checked)} />Só protegidos</label>
    </section>

    <section className="fm-selection-bar">
      <div>
        <label><input type="checkbox" checked={allCandidatesSelected} onChange={toggleAllCandidates} disabled={!candidateRows.length} />Selecionar candidatos desta página</label>
        <span>{selected.size} selecionado(s) · {bytes(selectedBytes)}</span>
      </div>
      <button className="fm-button danger subtle" onClick={() => cleanupSelected(false)} disabled={busy || !selected.size}>Excluir selecionados</button>
    </section>

    <div className="fm-table-wrap">
      {loading ? <div className="fm-loading">Mapeando arquivos, referências e espaço em disco…</div> : rows.length ? <table className="fm-table">
        <thead><tr><th className="fm-select-col" /><th>Arquivo</th><th>Contexto</th><th>Estado</th><th>Tamanho</th><th>Modificado</th><th>Ações</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.key} className={row.cleanup_candidate ? 'candidate' : row.protected ? 'protected' : ''}>
          <td className="fm-select-col"><input type="checkbox" checked={selected.has(row.path)} disabled={!row.cleanup_candidate} onChange={() => toggleRow(row)} aria-label={`Selecionar ${row.original_name}`} /></td>
          <td>
            <div className="fm-file-cell"><FilePreview row={row}/><div><b>{row.original_name}</b><code title={row.path}>{row.path}</code><div className="fm-mini-badges"><Badge>{KIND_LABELS[row.kind] || row.kind}</Badge>{row.app_name && <Badge>{row.app_name}</Badge>}</div></div></div>
          </td>
          <td><div className="fm-context"><b>{row.entity_name ? `${row.entity_name}${row.entity_id ? ` #${row.entity_id}` : ''}` : 'Arquivo físico'}</b><span>{row.reference_labels?.[0] || (row.tracked ? 'Registrado no FileController' : 'Sem vínculo registrado')}</span>{row.reference_count > 1 && <small>+{row.reference_count - 1} referência(s)</small>}</div></td>
          <td><div className="fm-state-stack"><Badge tone={stateTone(row)}>{row.protected ? 'Protegido' : row.cleanup_candidate ? 'Candidato' : STATE_LABELS[row.state] || row.state}</Badge>{row.protection_reason && <small>{row.protection_reason}</small>}{row.cleanup_candidate && <small>Sem referência ativa</small>}</div></td>
          <td><b className="fm-size">{bytes(row.file_size)}</b></td>
          <td><span className="fm-date">{dateTime(row.modified_at)}</span></td>
          <td><div className="fm-row-actions">{row.public_url && row.is_image && row.exists && <a href={row.public_url} target="_blank" rel="noreferrer">Ver</a>}{row.can_delete_registered && <button type="button" onClick={() => deleteRegistered(row)} disabled={busy}>Excluir</button>}{!row.can_delete_registered && !row.cleanup_candidate && <span>—</span>}</div></td>
        </tr>)}</tbody>
      </table> : <div className="fm-empty"><b>Nenhum arquivo encontrado.</b><span>Ajuste os filtros ou atualize o inventário.</span></div>}
    </div>

    <footer className="fm-pagination">
      <span>{pagination.total || 0} arquivo(s) encontrados</span>
      <div><button onClick={() => updateFilter('page', Math.max(1, Number(pagination.page || 1) - 1))} disabled={(pagination.page || 1) <= 1}>← Anterior</button><b>Página {pagination.page || 1} de {pagination.last_page || 1}</b><button onClick={() => updateFilter('page', Math.min(Number(pagination.last_page || 1), Number(pagination.page || 1) + 1))} disabled={(pagination.page || 1) >= (pagination.last_page || 1)}>Próxima →</button></div>
    </footer>
  </section>
}
