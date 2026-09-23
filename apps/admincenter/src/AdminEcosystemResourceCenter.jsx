import { useEffect, useMemo, useRef, useState } from 'react'
import AdminProcessingIndicator from './AdminProcessingIndicator.jsx'
import './AdminEcosystemResourceCenter.css'

const PER_PAGE = 50

const RESOURCE_CONFIG = Object.freeze({
  profiles: {
    kicker: 'ACESSO',
    title: 'Perfis e permissões',
    description: 'Perfis compartilhados do ecossistema, quantidade de usuários e permissões atribuídas.',
    scope: 'Global',
    endpoint: '/admin/ecosystem/profiles',
    searchMode: 'client',
    applicationFilter: false,
    extract: payload => payload?.profiles || [],
    columns: [
      ['Usuários', row => row.users_count ?? 0],
      ['Permissões', row => permissionCount(row.permissions)],
      ['Escopo', () => 'Ecossistema'],
    ],
    primary: row => row.name || `Perfil #${row.id}`,
    secondary: row => row.description || `ID ${row.id}`,
  },
  events: {
    kicker: 'CONTEÚDO',
    title: 'Eventos',
    description: 'Eventos de todas as aplicações, preservando o vínculo com aplicação, produção e estabelecimento.',
    scope: 'Por aplicação',
    endpoint: '/admin/ecosystem/events',
    searchMode: 'server',
    applicationFilter: true,
    extract: payload => payload?.events || payload?.data || [],
    columns: [
      ['Aplicação', row => row.application?.name || row.application_name || row.app_slug || '—'],
      ['Local', row => row.establishment_name || row.venue || row.city || '—'],
      ['Data', row => dateTime(row.start_date)],
      ['Status', row => eventStatus(row)],
    ],
    primary: row => row.title || row.name || `Evento #${row.id}`,
    secondary: row => row.production?.name || row.production_name || row.slug || `ID ${row.id}`,
  },
  orders: {
    kicker: 'COMÉRCIO',
    title: 'Pedidos',
    description: 'Pedidos de todo o ecossistema com filtro por aplicação e busca por cliente ou referência.',
    scope: 'Por aplicação',
    endpoint: '/admin/ecosystem/financial/orders',
    searchMode: 'server',
    applicationFilter: true,
    applicationParam: 'app_slug',
    extract: payload => payload?.data || [],
    paginator: true,
    columns: [
      ['Aplicação', row => row.application_name || row.app_slug || '—'],
      ['Cliente', row => row.customer_name || row.customer_email || userLabel(row) || '—'],
      ['Status', row => row.status || row.payment_status || '—'],
      ['Criado', row => dateTime(row.created_at)],
    ],
    primary: row => row.order_number || row.reference || row.public_id || `Pedido #${row.id}`,
    secondary: row => row.customer_email || row.customer_phone || `ID ${row.id}`,
  },
  payments: {
    kicker: 'FINANCEIRO',
    title: 'Pagamentos',
    description: 'Transações financeiras consolidadas, separadas por aplicação, método, provedor e status.',
    scope: 'Por aplicação',
    endpoint: '/admin/ecosystem/financial/transactions',
    searchMode: 'client',
    applicationFilter: true,
    applicationParam: 'app_slug',
    extract: payload => payload?.data || [],
    paginator: true,
    columns: [
      ['Aplicação', row => row.application_name || row.app_slug || '—'],
      ['Valor', row => currency(row.gross_amount ?? row.amount)],
      ['Método', row => row.method || row.payment_method || '—'],
      ['Status', row => row.status || '—'],
      ['Criado', row => dateTime(row.created_at)],
    ],
    primary: row => row.reference || row.provider_payment_id || row.external_id || `Pagamento #${row.id}`,
    secondary: row => [row.provider, row.customer_email || row.payer_email].filter(Boolean).join(' · ') || `ID ${row.id}`,
  },
  files: {
    kicker: 'ARQUIVOS',
    title: 'Arquivos',
    description: 'Inventário de arquivos e mídias usados pelas aplicações e entidades do ecossistema.',
    scope: 'Compartilhado',
    endpoint: '/admin/ecosystem/files',
    searchMode: 'server',
    applicationFilter: true,
    applicationParam: 'app',
    extract: payload => firstArray(payload, ['files', 'data', 'items', 'rows', 'registered_files', 'registered']),
    columns: [
      ['Aplicação', row => row.application_name || row.app_name || row.app_slug || row.app || '—'],
      ['Tipo', row => row.kind || row.type || row.mime_type || '—'],
      ['Tamanho', row => fileSize(row.size ?? row.bytes ?? row.file_size)],
      ['Estado', row => row.state || row.status || (row.protected ? 'Protegido' : 'Ativo')],
    ],
    primary: row => row.name || row.filename || row.original_name || row.path || `Arquivo #${row.id}`,
    secondary: row => row.path || row.public_url || row.url || `ID ${row.id}`,
  },
  audit: {
    kicker: 'GOVERNANÇA',
    title: 'Auditoria',
    description: 'Alterações administrativas registradas com usuário, entidade, origem e momento da ação.',
    scope: 'Global',
    endpoint: '/admin/ecosystem/audit',
    searchMode: 'server',
    applicationFilter: false,
    extract: payload => payload?.logs || [],
    columns: [
      ['Usuário', row => userLabel(row.user) || row.user_email || 'Sistema'],
      ['Entidade', row => entityLabel(row)],
      ['IP', row => row.ip || '—'],
      ['Quando', row => dateTime(row.created_at)],
    ],
    primary: row => humanAction(row.action),
    secondary: row => row.action || `Registro #${row.id}`,
  },
})

function firstArray(payload, keys) {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key]
  return Array.isArray(payload) ? payload : []
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function permissionCount(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean).length
  if (typeof value === 'string') {
    try { return permissionCount(JSON.parse(value)) } catch { return value.trim() ? 1 : 0 }
  }
  return 0
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number(value))
}

function fileSize(value) {
  const bytes = number(value)
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function userLabel(user) {
  if (!user) return ''
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.email || user.user_name || ''
}

function entityLabel(row) {
  const type = String(row.entity_type || '').split('\\').pop()
  return [type || 'Entidade', row.entity_id ? `#${row.entity_id}` : ''].filter(Boolean).join(' ')
}

function humanAction(value) {
  const action = String(value || 'alteração administrativa')
  return action.replaceAll('.', ' · ').replaceAll('_', ' ')
}

function eventStatus(row) {
  if (row.is_cancelled) return 'Cancelado'
  if (!row.is_published) return 'Rascunho'
  if (row.temporal_status === 'past') return 'Encerrado'
  if (row.temporal_status === 'ongoing') return 'Em andamento'
  return row.is_approved === false ? 'Aguardando aprovação' : 'Publicado'
}

function searchableText(row) {
  try { return JSON.stringify(row).toLocaleLowerCase('pt-BR') } catch { return '' }
}

function normalizePagination(payload, rows, requestedPage) {
  return {
    current_page: number(payload?.current_page || payload?.pagination?.current_page || requestedPage || 1),
    last_page: Math.max(1, number(payload?.last_page || payload?.pagination?.last_page || 1)),
    total: number(payload?.total || payload?.pagination?.total || rows.length),
  }
}

export default function AdminEcosystemResourceCenter({ resource, apiRequest, applications = [] }) {
  const config = RESOURCE_CONFIG[resource]
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [application, setApplication] = useState('')
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sequenceRef = useRef(0)
  const loadedOnceRef = useRef(false)

  async function load(page = 1, { quiet = false, searchTerm = appliedSearch, appValue = application } = {}) {
    if (!config) return
    const sequence = ++sequenceRef.current
    if (!quiet) setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (config.paginator) {
        params.set('page', String(page))
        params.set('per_page', String(PER_PAGE))
      } else if (resource === 'files') {
        params.set('page', String(page))
        params.set('per_page', String(PER_PAGE))
      }
      if (config.searchMode === 'server' && String(searchTerm || '').trim()) params.set('search', String(searchTerm).trim())
      if (config.applicationFilter && appValue) params.set(config.applicationParam || 'app_id', String(appValue))

      const payload = await apiRequest(`${config.endpoint}${params.size ? `?${params.toString()}` : ''}`)
      if (sequence !== sequenceRef.current) return
      const extracted = config.extract(payload)
      setRows(extracted)
      setPagination(normalizePagination(payload, extracted, page))
    } catch (loadError) {
      if (sequence === sequenceRef.current) setError(loadError?.message || `Não foi possível carregar ${config.title.toLocaleLowerCase('pt-BR')}.`)
    } finally {
      if (sequence === sequenceRef.current) {
        loadedOnceRef.current = true
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    setSearch('')
    setAppliedSearch('')
    setApplication('')
    setRows([])
    setPagination({ current_page: 1, last_page: 1, total: 0 })
    void load(1, { searchTerm: '', appValue: '' })
  }, [resource])

  const visibleRows = useMemo(() => {
    if (config?.searchMode !== 'client' || !appliedSearch) return rows
    const needle = appliedSearch.toLocaleLowerCase('pt-BR')
    return rows.filter(row => searchableText(row).includes(needle))
  }, [rows, appliedSearch, config])

  if (!config) return <div className="aec-notice aec-notice--danger">Módulo administrativo desconhecido.</div>

  function submitSearch(event) {
    event.preventDefault()
    const normalized = String(search || '').trim()
    setAppliedSearch(normalized)
    if (config.searchMode === 'server') void load(1, { searchTerm: normalized })
  }

  function clearSearch() {
    setSearch('')
    setAppliedSearch('')
    if (config.searchMode === 'server') void load(1, { searchTerm: '' })
  }

  function changeApplication(event) {
    const value = event.target.value
    setApplication(value)
    void load(1, { appValue: value })
  }

  const count = config.searchMode === 'client' && appliedSearch ? visibleRows.length : (pagination.total || visibleRows.length)

  return <div className="aec-root">
    {error && <div className="aec-notice aec-notice--danger" role="alert">{error}</div>}

    <section className="aec-card">
      <header className="aec-head">
        <div>
          <span>{config.kicker}</span>
          <h3>{config.title}</h3>
          <p>{count} registro(s) · <b>{config.scope}</b></p>
        </div>
        <div className="aec-scope" title={config.description}>{config.scope}</div>
      </header>

      <form className="aec-filter-bar" role="search" onSubmit={submitSearch}>
        <label className="aec-field aec-field--search">
          <span>Buscar</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Buscar em ${config.title.toLocaleLowerCase('pt-BR')}`} autoComplete="off"/>
        </label>
        {config.applicationFilter && <label className="aec-field">
          <span>Aplicação</span>
          <select value={application} onChange={changeApplication} disabled={loading}>
            <option value="">Todas as aplicações</option>
            {applications.map(app => <option key={app.id || app.slug} value={config.applicationParam === 'app_id' ? app.id : app.slug}>{app.name}</option>)}
          </select>
        </label>}
        <button type="submit" className="aec-secondary" disabled={loading}>Buscar</button>
        {(search || appliedSearch) && <button type="button" className="aec-secondary" disabled={loading} onClick={clearSearch}>Limpar</button>}
      </form>

      <p className="aec-description">{config.description}</p>

      {loading ? <AdminProcessingIndicator
        title={loadedOnceRef.current ? `Atualizando ${config.title.toLocaleLowerCase('pt-BR')}` : `Carregando ${config.title.toLocaleLowerCase('pt-BR')}`}
        messages={`Consultando ${config.title.toLocaleLowerCase('pt-BR')}…|Relacionando aplicações, usuários e estabelecimentos…|Organizando a lista administrativa…`}
        detail={application ? 'Filtro de aplicação ativo.' : 'Aguarde enquanto os dados do ecossistema são carregados.'}
      /> : visibleRows.length ? <div className="aec-list">
        {visibleRows.map((row, index) => <article className="aec-row" key={row.id || row.uuid || row.path || `${resource}-${index}`}>
          <div className="aec-identity">
            <span className="aec-avatar">{String(config.primary(row) || '?').slice(0, 2).toUpperCase()}</span>
            <span><strong>{config.primary(row)}</strong><small>{config.secondary(row)}</small></span>
          </div>
          <div className="aec-meta-grid">
            {config.columns.map(([label, formatter]) => <span className="aec-meta" key={label}><small>{label}</small><strong>{formatter(row)}</strong></span>)}
          </div>
        </article>)}
      </div> : <div className="aec-empty"><strong>Nenhum registro encontrado.</strong><span>Altere a busca ou os filtros para ampliar o resultado.</span></div>}

      {pagination.last_page > 1 && <footer className="aec-pagination">
        <span>Página {pagination.current_page} de {pagination.last_page}</span>
        <div>
          <button className="aec-secondary" disabled={pagination.current_page <= 1 || loading} onClick={() => load(pagination.current_page - 1)}>← Anterior</button>
          <button className="aec-secondary" disabled={pagination.current_page >= pagination.last_page || loading} onClick={() => load(pagination.current_page + 1)}>Próxima →</button>
        </div>
      </footer>}
    </section>
  </div>
}
