import { useEffect, useMemo, useState } from 'react'
import './AdminVisibilityPage.css'

const API = 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'token'

const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || '—'

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = response.status === 204 ? null : await response.json().catch(() => ({}))

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
      throw new Error('Sessão expirada.')
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || Object.values(data?.errors || {})?.flat()?.[0] || 'Não foi possível concluir a operação.')
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function VisibilityBadge({ status, label }) {
  return <span className={`visibility-badge visibility-badge--${status || 'unknown'}`}><i />{label || status || '—'}</span>
}

function Metric({ label, value, detail }) {
  return <article className="visibility-metric"><span>{label}</span><strong>{value ?? '—'}</strong><small>{detail}</small></article>
}

function AdminModuleNav({ active = 'visibility' }) {
  return <nav className="admin-module-nav" aria-label="Módulos administrativos">
    <a className={active === 'mission' ? 'active' : ''} href="/admin">Mission Control</a>
    <a className={active === 'visibility' ? 'active' : ''} href="/admin/visibility">Visibilidade e publicação</a>
  </nav>
}

export { AdminModuleNav }

export default function AdminVisibilityPage() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', app_id: '' })

  async function load(custom = filters) {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams(Object.entries(custom).filter(([, value]) => value))
      const result = await request(`/admin/ecosystem/visibility${qs.toString() ? `?${qs}` : ''}`)
      setPayload(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = '/login'
      return
    }
    load({ search: '', status: '', app_id: '' })
  }, [])

  const applications = useMemo(() => {
    const map = new Map()
    ;(payload?.establishments || []).forEach(row => {
      if (row?.source_app?.id) map.set(String(row.source_app.id), row.source_app)
      ;(row?.applications || []).forEach(app => { if (app?.id) map.set(String(app.id), app) })
    })
    return [...map.values()].sort((a, b) => String(a.name || a.slug || '').localeCompare(String(b.name || b.slug || ''), 'pt-BR'))
  }, [payload])

  async function apply(event) {
    event?.preventDefault()
    await load(filters)
  }

  async function changeVisibility(establishment, patch, successMessage) {
    setSavingId(establishment.id)
    setError('')
    setMessage('')
    try {
      await request(`/admin/ecosystem/establishments/${establishment.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      setMessage(successMessage)
      await load(filters)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const summary = payload?.summary || {}
  const rows = payload?.establishments || []
  const attempts = payload?.recent_restricted_access || []

  return <div className="visibility-admin-shell">
    <AdminModuleNav active="visibility" />
    <header className="visibility-admin-hero">
      <div>
        <p className="visibility-kicker">Peter Tecnet · Governança do ecossistema</p>
        <h1>Visibilidade e publicação</h1>
        <p>Controle o que está público, oculto, aguardando aprovação ou desativado e acompanhe tentativas de acesso a conteúdos restritos.</p>
      </div>
      <button type="button" className="visibility-refresh" onClick={() => load(filters)} disabled={loading}>Atualizar dados</button>
    </header>

    {error && <div className="visibility-notice visibility-notice--error" role="alert">{error}</div>}
    {message && <div className="visibility-notice visibility-notice--success" role="status">{message}</div>}

    <section className="visibility-metrics" aria-label="Resumo de visibilidade">
      <Metric label="Estabelecimentos" value={summary.total} detail="total no ecossistema" />
      <Metric label="Públicos" value={summary.public} detail="indexáveis e disponíveis" />
      <Metric label="Ocultos" value={summary.hidden} detail="fora da experiência pública" />
      <Metric label="Aguardando" value={summary.pending_approval} detail="publicação pendente" />
      <Metric label="Desativados" value={summary.disabled} detail="indisponíveis" />
      <Metric label="Tentativas 30d" value={summary.restricted_access_attempts_30d} detail="acessos bloqueados" />
    </section>

    <section className="visibility-panel">
      <div className="visibility-panel__head"><div><span>Gestão operacional</span><h2>Estabelecimentos</h2></div><small>{rows.length} resultado(s)</small></div>
      <form className="visibility-filters" onSubmit={apply}>
        <label>Busca<input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Nome, slug, cidade ou responsável" /></label>
        <label>Status<select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="">Todos</option><option value="public">Público</option><option value="hidden">Oculto</option><option value="pending_approval">Aguardando aprovação</option><option value="disabled">Desativado</option></select></label>
        <label>Aplicação<select value={filters.app_id} onChange={event => setFilters(current => ({ ...current, app_id: event.target.value }))}><option value="">Todas</option>{applications.map(app => <option key={app.id} value={app.id}>{app.name || app.slug}</option>)}</select></label>
        <button className="visibility-primary" disabled={loading}>{loading ? 'Consultando…' : 'Aplicar filtros'}</button>
      </form>

      {loading && !payload && <div className="visibility-loading"><span /><p>Consultando visibilidade no ecossistema…</p></div>}
      {!loading && rows.length === 0 && <div className="visibility-empty"><strong>Nenhum estabelecimento encontrado.</strong><span>Ajuste os filtros ou atualize os dados.</span></div>}

      <div className="visibility-table-wrap">
        <table className="visibility-table">
          <thead><tr><th>Estabelecimento</th><th>Visibilidade</th><th>Aplicações</th><th>Itens</th><th>Acessos restritos</th><th>Ações</th></tr></thead>
          <tbody>{rows.map(row => {
            const status = row.visibility?.status
            const linkedApps = row.applications?.length ? row.applications : row.source_app ? [row.source_app] : []
            const saving = Number(savingId) === Number(row.id)
            return <tr key={row.id}>
              <td><div className="visibility-entity"><strong>{row.name}</strong><span>{row.slug}</span><small>{[row.city, row.uf].filter(Boolean).join(' - ') || 'Localização não informada'} · {fullName(row.owner)}</small></div></td>
              <td><VisibilityBadge status={status} label={row.visibility?.label} /></td>
              <td><div className="visibility-apps">{linkedApps.slice(0, 3).map(app => <span key={app.id}>{app.name || app.slug}</span>)}{linkedApps.length > 3 && <small>+{linkedApps.length - 3}</small>}</div></td>
              <td><strong>{row.items_count ?? 0}</strong></td>
              <td><div className="visibility-attempts"><strong>{row.restricted_access_attempts_30d ?? 0}<small> / 30d</small></strong><span>{row.restricted_access_attempts ?? 0} no total</span><small>Último: {fmt(row.restricted_access_last_at)}</small></div></td>
              <td><div className="visibility-actions">
                {status === 'public' && <button disabled={saving} onClick={() => changeVisibility(row, { is_published: false }, `${row.name} foi ocultado da experiência pública.`)}>Ocultar</button>}
                {status === 'hidden' && <button className="primary" disabled={saving} onClick={() => changeVisibility(row, { is_published: true }, `${row.name} foi enviado para publicação.`)}>Publicar</button>}
                {status === 'pending_approval' && <button className="primary" disabled={saving} onClick={() => changeVisibility(row, { is_approved: true }, `${row.name} foi aprovado para publicação.`)}>Aprovar</button>}
                {status === 'disabled' && <button className="primary" disabled={saving} onClick={() => changeVisibility(row, { is_cancelled: false }, `${row.name} foi reativado.`)}>Reativar</button>}
                {saving && <span className="saving">Salvando…</span>}
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </section>

    <section className="visibility-panel">
      <div className="visibility-panel__head"><div><span>Sinal de demanda</span><h2>Tentativas recentes de acesso restrito</h2></div><small>Últimos {attempts.length}</small></div>
      {attempts.length === 0 ? <div className="visibility-empty"><strong>Nenhuma tentativa recente.</strong><span>Quando alguém acessar um recurso oculto, o evento aparecerá aqui.</span></div> : <div className="visibility-timeline">{attempts.map(attempt => <article key={attempt.id}><i /><div><strong>Estabelecimento #{attempt.establishment_id}</strong><span>{attempt.resource || 'recurso'} · {attempt.reason || 'restrito'}</span><small>{attempt.application?.name || attempt.application?.slug || 'Aplicação não identificada'} · {fullName(attempt.user)} · {fmt(attempt.created_at)}</small></div></article>)}</div>}
    </section>
  </div>
}
