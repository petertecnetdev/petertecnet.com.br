import { useEffect, useRef, useState } from 'react'
import './Admin.css'
import './Login.css'
import { apiRequest, clearToken, getToken, saveToken, tokenFrom } from './admin/api'
import { connectEcosystemRealtime } from './admin/realtime'

const TABS = [
  ['dashboard', 'Visão geral'], ['activity', 'Atividade'], ['applications', 'Aplicações'], ['users', 'Usuários'],
  ['profiles', 'Perfis e permissões'], ['establishments', 'Estabelecimentos'], ['site', 'Site institucional'], ['audit', 'Auditoria'],
]
const MARKETING_TABS = [['dashboard', 'Visão geral'], ['activity', 'Atividade'], ['users', 'Clientes e convites']]
const emptyApp = { name: '', description: '', slug: '', url: '', logo: '', version: '', author: 'Peter Tecnet', release_date: '', is_active: true }
const emptyUser = { first_name: '', last_name: '', user_name: '', email: '', password: '', profile_id: '' }
const emptyEstablishment = { name: '', fantasy: '', slug: '', cnpj: '', type: '', category: '', phone: '', email: '', description: '', city: '', uf: '', cep: '', address: '', website_url: '', instagram_url: '', user_id: '', app_id: '', app_ids: [], is_published: false, is_approved: false, is_featured: false, is_cancelled: false }
const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const fullName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || 'Usuário'

function ProcessingIndicator({ message = 'Carregando...' }) {
  return <div className="peter-processing" role="status" aria-live="polite"><div className="peter-processing__visual"><i /><i /><img src="/petertecnetlogo.png" alt="" /></div><strong>{message}</strong></div>
}

export function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('')
    try { const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.username.trim(), password: form.password }) }); const token = tokenFrom(data); if (!token) throw new Error('A API não retornou um token de acesso.'); saveToken(token); window.location.href = '/admin' }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return <>{loading && <ProcessingIndicator message="Autenticando acesso..." />}<main className="login-page"><div className="login-effects"><i /><i /><span /></div><div className="login-layout"><aside className="login-hero"><div><a className="admin-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span>Peter Tecnet</span></a><p className="admin-kicker">Central de governança</p><h1>Controle todo o<br /><em>ecossistema digital.</em></h1><p>Aplicações, usuários, acessos, comportamento, segurança e auditoria em um único painel.</p></div><small>🔐 Acesso administrativo protegido pela API Peter Tecnet.</small></aside><section className="login-panel"><form className="login-card" onSubmit={submit}><div className="login-logo"><img src="/petertecnetlogo.png" alt="Peter Tecnet" /></div><h2>Acesso administrativo</h2><p>Entre para administrar o ecossistema Peter Tecnet.</p><label>Usuário ou e-mail<div className="login-input"><span>✉</span><input autoFocus autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div></label><label>Senha<div className="login-input"><span>🔒</span><input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={loading}>Entrar</button><a className="admin-back" href="/">← Voltar para o site</a></form></section></div></main></>
}

export function AdminPage() {
  const [tab, setTab] = useState('dashboard'); const [data, setData] = useState({}); const [processing, setProcessing] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [userDetail, setUserDetail] = useState(null); const [access, setAccess] = useState(null)
  const tabRef = useRef(tab); tabRef.current = tab
  const marketing = access?.mode === 'marketing'
  const visibleTabs = marketing ? MARKETING_TABS : TABS
  const paths = marketing
    ? { dashboard: '/admin/marketing/dashboard', activity: '/admin/marketing/activity', users: '/admin/marketing/users' }
    : { dashboard: '/admin/ecosystem/dashboard', activity: '/admin/ecosystem/activity', applications: '/admin/applications', users: '/admin/ecosystem/users', profiles: '/admin/ecosystem/profiles', establishments: '/admin/ecosystem/establishments', site: '/admin/ecosystem/settings', audit: '/admin/ecosystem/audit' }
  async function load(target = tab, customPath, options = {}) { const silent = options.silent === true; if (!silent) { setProcessing(true); setError('') } try { const result = await apiRequest(customPath || paths[target]); setData(prev => ({ ...prev, [target]: result })); return result } catch (err) { if (!silent) setError(err.message) } finally { if (!silent) setProcessing(false) } }
  async function openUser(user) { setProcessing(true); setError(''); try { setUserDetail(await apiRequest(`${marketing ? '/admin/marketing/users' : '/admin/ecosystem/users'}/${user.id}`)) } catch (err) { setError(err.message) } finally { setProcessing(false) } }
  useEffect(() => {
    if (!getToken()) { window.location.href = '/login'; return }
    async function bootstrap() {
      setProcessing(true); setError('')
      try {
        const context = await apiRequest('/admin/marketing/context')
        setAccess(context)
        const dashboardPath = context.mode === 'marketing' ? '/admin/marketing/dashboard' : '/admin/ecosystem/dashboard'
        const dashboard = await apiRequest(dashboardPath)
        setData({ dashboard, applications: { applications: context.applications || [] } })
      } catch (err) { setError(err.message) } finally { setProcessing(false) }
    }
    bootstrap()
  }, [])
  useEffect(() => { if (getToken() && access && !data[tab]) load(tab) }, [tab, access])
  useEffect(() => connectEcosystemRealtime(event => {
    const modules = Array.isArray(event?.modules) ? event.modules : []
    const current = tabRef.current
    setData(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !modules.includes(key) || key === current)))
    if (!modules.length || modules.includes(current)) load(current, undefined, { silent: true })
  }), [])
  async function mutate(path, options, success, reload = tab) { setProcessing(true); setError(''); setMessage(''); try { await apiRequest(path, options); setMessage(success); await load(reload); if (reload !== 'dashboard') setData(prev => ({ ...prev, dashboard: undefined })); if (userDetail?.user?.id) setUserDetail(await apiRequest(`/admin/ecosystem/users/${userDetail.user.id}`)) } catch (err) { setError(err.message); setProcessing(false) } }
  function logout() { clearToken(); window.location.href = '/login' }
  const counts = data.dashboard?.summary || {}
  return <>{processing && <ProcessingIndicator message="Atualizando ecossistema..." />}<main className="ecosystem-shell"><aside className="ecosystem-sidebar"><a className="admin-brand ecosystem-brand" href="/"><img src="/petertecnetlogo.png" alt="" /><span><b>Peter Tecnet</b><small>Governança</small></span></a><nav>{visibleTabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setUserDetail(null); setMessage(''); setError('') }}>{label}</button>)}</nav><div className="sidebar-foot"><a href="/" target="_blank">Abrir site ↗</a><button onClick={logout}>Sair</button></div></aside><section className="ecosystem-main"><header className="ecosystem-top"><div><p className="admin-kicker">Peter Tecnet Control Center</p><h1>{userDetail ? 'Detalhes do usuário' : visibleTabs.find(x => x[0] === tab)?.[1]}</h1></div><div className="top-actions">{userDetail && <button onClick={() => setUserDetail(null)}>← Voltar</button>}<button onClick={() => userDetail ? openUser(userDetail.user) : load(tab)}>Atualizar</button></div></header>{error && <div className="notice error">{error}</div>}{message && <div className="notice success">{message}</div>}{userDetail ? <UserDetail payload={userDetail} mutate={mutate} /> : <>{tab === 'dashboard' && <Dashboard summary={counts} payload={data.dashboard} onUser={openUser} />}{tab === 'activity' && <Activity payload={data.activity} applications={data.applications} users={data.users} load={load} setData={setData} activityBase={marketing ? '/admin/marketing/activity' : '/admin/ecosystem/activity'} />}{tab === 'applications' && <Applications payload={data.applications} mutate={mutate} />}{tab === 'users' && <Users payload={data.users} profiles={data.profiles} applications={data.applications} load={load} mutate={mutate} openUser={openUser} access={access} />}{tab === 'profiles' && <Profiles payload={data.profiles} mutate={mutate} />}{tab === 'establishments' && <Establishments payload={data.establishments} applications={data.applications} users={data.users} load={load} mutate={mutate} />}{tab === 'site' && <SiteSettings payload={data.site} mutate={mutate} />}{tab === 'audit' && <Audit payload={data.audit} />}</>}</section></main></>
}

function Dashboard({ summary, payload, onUser }) {
  const cards = [['Usuários ativos hoje', summary.active_users_today, `${summary.interactions_today || 0} interações`], ['Ativos em 7 dias', summary.active_users_7d, 'usuários únicos'], ['Ativos em 30 dias', summary.active_users_30d, `${summary.inactive_users_30d || 0} inativos`], ['Novos usuários', summary.new_users_30d, 'últimos 30 dias'], ['Aplicações', summary.applications, `${summary.active_applications || 0} ativas`], ['Usuários', summary.users, `${summary.access_links || 0} vínculos`], ['Estabelecimentos', summary.establishments, `${summary.approved_establishments || 0} aprovados`], ['Interações 30 dias', summary.interactions_30d, 'atividade registrada']]
  return <div className="admin-stack"><div className="metric-grid">{cards.map(([label, value, sub]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>{sub}</small></article>)}</div><Panel title="Interações em tempo real"><RealtimeInteractionChart rows={payload?.interaction_series || []} /></Panel><div className="admin-grid"><Panel title="Uso das aplicações"><div className="table-wrap"><table><thead><tr><th>Aplicação</th><th>Usuários</th><th>Ativos 30d</th><th>Interações 30d</th></tr></thead><tbody>{payload?.applications?.map(app => <tr key={app.id}><td><b>{app.name}</b></td><td>{app.users_count}</td><td>{app.active_users_30d || 0}</td><td>{app.activity_count_30d || 0}</td></tr>)}</tbody></table></div></Panel><Panel title="Tipos de atividade">{payload?.activity_types?.length ? payload.activity_types.map(item => <div className="stat-row" key={item.interaction_type}><span>{humanType(item.interaction_type)}</span><b>{item.total}</b></div>) : <Empty />}</Panel></div><div className="admin-grid"><Panel title="Atividade recente"><Timeline rows={payload?.recent_activity || []} compact /></Panel><Panel title="Usuários recentes">{payload?.recent_users?.map(user => <button className="person-row" key={user.id} onClick={() => onUser(user)}><span><b>{fullName(user)}</b><small>{user.email}</small></span><i>{fmt(user.created_at)}</i></button>)}</Panel></div></div>
}

function RealtimeInteractionChart({ rows }) {
  if (!rows.length) return <Empty text="Ainda não há dados suficientes para o gráfico." />
  const width = 760; const height = 230; const left = 38; const right = 14; const top = 18; const bottom = 34
  const chartWidth = width - left - right; const chartHeight = height - top - bottom
  const maximum = Math.max(1, ...rows.flatMap(row => [Number(row.total) || 0, Number(row.errors) || 0]))
  const point = (row, index, key) => [left + (index * chartWidth) / Math.max(rows.length - 1, 1), top + chartHeight - ((Number(row[key]) || 0) / maximum) * chartHeight]
  const path = key => rows.map((row, index) => point(row, index, key).join(',')).join(' ')
  const latest = rows.at(-1) || {}
  return <div className="realtime-chart"><div className="chart-head"><div className="chart-legend"><span className="total">Interações</span><span className="errors">Erros</span></div><div className="live-indicator"><i />Ao vivo · {latest.total || 0} nesta hora</div></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interações e erros nas últimas 24 horas">{[0, .25, .5, .75, 1].map(ratio => { const y = top + chartHeight - ratio * chartHeight; return <g key={ratio}><line x1={left} y1={y} x2={width - right} y2={y} className="chart-grid" /><text x={left - 8} y={y + 4} textAnchor="end">{Math.round(maximum * ratio)}</text></g> })}<polyline points={path('total')} className="chart-line chart-line-total" /><polyline points={path('errors')} className="chart-line chart-line-errors" />{rows.map((row, index) => index % 4 === 0 || index === rows.length - 1 ? <text key={row.timestamp} x={point(row, index, 'total')[0]} y={height - 10} textAnchor="middle">{row.label}</text> : null)}</svg></div>
}

function Activity({ payload, applications, users, load, setData, activityBase = '/admin/ecosystem/activity' }) {
  const [filters, setFilters] = useState({ user_id: '', app_id: '', type: '', from: '', to: '', search: '' })
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRef = useRef(null)
  useEffect(() => { if (!applications) load('applications'); if (!users) load('users') }, [])

  function activityPath(page = 1) {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    params.set('page', String(page)); params.set('per_page', '40')
    return `${activityBase}?${params}`
  }

  async function fetchPage(page, append = false) {
    if (loadingMore) return
    if (append) setLoadingMore(true)
    try {
      const result = await apiRequest(activityPath(page))
      setData(previous => {
        if (!append) return { ...previous, activity: result }
        const currentRows = previous.activity?.activity || []
        const incomingRows = result.activity || []
        const seen = new Set()
        const activity = [...currentRows, ...incomingRows].filter(row => !seen.has(row.id) && seen.add(row.id))
        return { ...previous, activity: { ...result, activity } }
      })
    } catch (err) {
      if (!append) await load('activity', activityPath(page))
    } finally {
      setLoadingMore(false)
    }
  }

  async function apply(event) {
    event?.preventDefault()
    await fetchPage(1, false)
  }

  useEffect(() => {
    const target = loadMoreRef.current
    const nextPage = payload?.pagination?.next_page
    if (!target || !nextPage || loadingMore) return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) fetchPage(nextPage, true)
    }, { rootMargin: '500px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [payload?.pagination?.next_page, loadingMore, filters])

  return <div className="admin-stack"><div className="metric-grid three"><Metric label="Interações" value={payload?.summary?.total} sub="em todo o histórico filtrado" /><Metric label="Usuários" value={payload?.summary?.users} sub="usuários únicos" /><Metric label="Aplicações" value={payload?.summary?.applications} sub="com atividade" /></div><Panel title="Filtros de atividade"><form className="filter-grid" onSubmit={apply}><Field label="Busca" value={filters.search} onChange={value => setFilters({ ...filters, search: value })} /><label>Aplicação<select value={filters.app_id} onChange={event => setFilters({ ...filters, app_id: event.target.value })}><option value="">Todas</option>{applications?.applications?.map(application => <option key={application.id} value={application.id}>{application.name}</option>)}</select></label><label>Usuário<select value={filters.user_id} onChange={event => setFilters({ ...filters, user_id: event.target.value })}><option value="">Todos</option>{users?.users?.map(user => <option key={user.id} value={user.id}>{fullName(user)} · {user.email}</option>)}</select></label><label>Ação<select value={filters.type} onChange={event => setFilters({ ...filters, type: event.target.value })}><option value="">Todas</option>{payload?.types?.map(type => <option key={type} value={type}>{humanType(type)}</option>)}</select></label><Field label="De" type="date" value={filters.from} onChange={value => setFilters({ ...filters, from: value })} /><Field label="Até" type="date" value={filters.to} onChange={value => setFilters({ ...filters, to: value })} /><button className="primary">Aplicar filtros</button></form></Panel><Panel title="Todas as interações"><Timeline rows={payload?.activity || []} /><div className="infinite-scroll-status" ref={loadMoreRef}>{loadingMore ? <><i />Carregando mais interações...</> : payload?.pagination?.has_more ? 'Continue rolando para carregar mais' : `Fim do histórico · ${payload?.activity?.length || 0} de ${payload?.pagination?.total || 0}`}</div></Panel></div>
}

function Users(props) {
  if (props.access?.mode === 'marketing') return <MarketingUsers {...props} />
  return <AdministratorUsers {...props} />
}

function AdministratorUsers({ payload, profiles, applications, load, mutate, openUser }) {
  const [form, setForm] = useState(emptyUser); const [editing, setEditing] = useState(null); const [search, setSearch] = useState('')
  const users = payload?.users || []
  useEffect(() => { if (!profiles) load('profiles'); if (!applications) load('applications') }, [])
  async function doSearch(e) { e.preventDefault(); await load('users', `/admin/ecosystem/users${search ? `?search=${encodeURIComponent(search)}` : ''}`) }
  function submit(e) { e.preventDefault(); const body = { ...form, profile_id: form.profile_id || null }; if (editing) delete body.password; mutate(`/admin/ecosystem/users${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) }, editing ? 'Usuário atualizado.' : 'Usuário criado.', 'users'); setEditing(null); setForm(emptyUser) }
  function edit(user) { setEditing(user.id); setForm({ first_name: user.first_name || '', last_name: user.last_name || '', user_name: user.user_name || '', email: user.email || '', password: '', profile_id: user.profile_id || '' }) }
  function access(user, app) { const current = user.applications?.find(a => a.id === app.id); const status = current?.pivot?.status === 'active' ? 'blocked' : 'active'; mutate(`/admin/ecosystem/users/${user.id}/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ status, role: current?.pivot?.role || 'member' }) }, `${app.name}: acesso ${status === 'active' ? 'liberado' : 'bloqueado'}.`, 'users') }
  return <div className="admin-stack"><div className="admin-grid"><Panel title={editing ? 'Editar usuário' : 'Novo usuário'}><form onSubmit={submit} className="form-grid"><Field label="Nome" value={form.first_name} onChange={v => setForm({ ...form, first_name: v })} required /><Field label="Sobrenome" value={form.last_name} onChange={v => setForm({ ...form, last_name: v })} /><Field label="Usuário" value={form.user_name} onChange={v => setForm({ ...form, user_name: v })} required /><Field label="E-mail" value={form.email} onChange={v => setForm({ ...form, email: v })} required /><label className="wide">Perfil<select value={form.profile_id} onChange={e => setForm({ ...form, profile_id: e.target.value })}><option value="">Sem perfil</option>{profiles?.profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{!editing && <Field label="Senha inicial" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} wide required />}<div className="form-actions wide"><button className="primary">Salvar usuário</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyUser) }}>Cancelar</button>}</div></form></Panel><Panel title="Pesquisar usuários"><form className="search-form" onSubmit={doSearch}><input placeholder="Nome, e-mail ou usuário" value={search} onChange={e => setSearch(e.target.value)} /><button className="primary">Buscar</button></form><p className="helper">Clique em “Detalhes” para abrir atividade, segurança, acessos e recursos do usuário.</p></Panel></div><Panel title={`Usuários (${users.length})`}><div className="user-list">{users.map(user => <article className="user-card" key={user.id}><div className="user-head"><div><b>{fullName(user)}</b><span>{user.email} · {user.profile?.name || 'Sem perfil'}</span><small>Última atividade: {fmt(user.last_activity_at)} · {user.interactions_count || 0} interações · {user.establishments_count || 0} estabelecimentos</small></div><div><button className="primary" onClick={() => openUser(user)}>Detalhes</button><button onClick={() => edit(user)}>Editar</button><button className="danger" onClick={() => window.confirm(`Excluir ${user.email}?`) && mutate(`/admin/ecosystem/users/${user.id}`, { method: 'DELETE' }, 'Usuário excluído.', 'users')}>Excluir</button></div></div><div className="access-grid">{applications?.applications?.map(app => { const link = user.applications?.find(a => a.id === app.id); const active = link?.pivot?.status === 'active'; return <button key={app.id} className={active ? 'access active' : 'access'} onClick={() => access(user, app)}><b>{app.name}</b><small>{link ? (active ? 'Permitido' : link.pivot.status) : 'Sem vínculo'}</small></button> })}</div></article>)}</div></Panel></div>
}


function MarketingUsers({ payload, applications, load, mutate, openUser }) {
  const [form, setForm] = useState({ first_name: '', email: '', app_id: '' })
  const [search, setSearch] = useState('')
  const users = payload?.users || []
  const apps = applications?.applications || []

  async function doSearch(event) {
    event.preventDefault()
    await load('users', `/admin/marketing/users${search ? `?search=${encodeURIComponent(search)}` : ''}`)
  }

  function invite(event) {
    event.preventDefault()
    mutate('/invite', {
      method: 'POST',
      body: JSON.stringify({ first_name: form.first_name, email: form.email, app_id: Number(form.app_id) }),
    }, 'Conta criada e convite enviado por e-mail.', 'users')
    setForm({ first_name: '', email: '', app_id: '' })
  }

  return <div className="admin-stack">
    <div className="admin-grid">
      <Panel title="Convidar novo cliente">
        <form className="form-grid" onSubmit={invite}>
          <Field label="Nome" value={form.first_name} onChange={value => setForm({ ...form, first_name: value })} required />
          <Field label="E-mail" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} required />
          <label className="wide">Aplicação
            <select value={form.app_id} onChange={event => setForm({ ...form, app_id: event.target.value })} required>
              <option value="">Selecione a aplicação</option>
              {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
            </select>
          </label>
          <p className="helper wide">O cliente receberá o endereço oficial da aplicação, um código temporário e um botão para criar a própria senha.</p>
          <button className="primary wide">Criar conta e enviar convite</button>
        </form>
      </Panel>
      <Panel title="Pesquisar clientes">
        <form className="search-form" onSubmit={doSearch}><input placeholder="Nome, e-mail ou usuário" value={search} onChange={event => setSearch(event.target.value)} /><button className="primary">Buscar</button></form>
        <p className="helper">Você visualiza somente clientes das aplicações atribuídas ao seu perfil.</p>
      </Panel>
    </div>
    <Panel title={`Clientes (${users.length})`}>
      <div className="user-list">{users.map(user => <article className="user-card" key={user.id}><div className="user-head"><div><b>{fullName(user)}</b><span>{user.email}</span><small>Última atividade: {fmt(user.last_activity_at)} · {user.interactions_count || 0} interações</small></div><div><button className="primary" onClick={() => openUser(user)}>Acompanhar</button></div></div><div className="application-tags">{user.applications?.map(app => <span key={app.id}>{app.name} · {app.pivot?.status || 'sem status'}</span>)}</div></article>)}</div>
    </Panel>
  </div>
}

function UserDetail({ payload, mutate }) {
  const user = payload?.user || {}; const summary = payload?.summary || {}; const security = payload?.security || {}; const resources = payload?.resources || {}
  return <div className="admin-stack"><section className="user-hero"><div className="avatar-large">{user.avatar ? <img src={user.avatar} alt="" /> : <span>{(user.first_name?.[0] || user.user_name?.[0] || 'U').toUpperCase()}</span>}</div><div><p className="admin-kicker">Usuário #{user.id}</p><h2>{fullName(user)}</h2><p>{user.email} · @{user.user_name || '—'} · {user.profile?.name || 'Sem perfil'}</p><small>Criado em {fmt(user.created_at)} · {user.city || 'Cidade não informada'}{user.uf ? `/${user.uf}` : ''}</small></div></section><div className="metric-grid"><Metric label="Interações" value={summary.total_interactions} sub={`${summary.interactions_30d || 0} em 30 dias`} /><Metric label="Logins 30 dias" value={summary.logins_30d} sub={`${summary.logins_7d || 0} em 7 dias`} /><Metric label="Aplicações" value={summary.applications} sub="vínculos existentes" /><Metric label="Estabelecimentos" value={summary.establishments} sub="recursos vinculados" /></div><div className="admin-grid"><Panel title="Resumo de atividade"><Info label="Última atividade" value={fmt(summary.last_activity_at)} /><Info label="Último login" value={fmt(summary.last_login_at)} /><Info label="Primeira atividade" value={fmt(summary.first_activity_at)} /><Info label="Logins 90 dias" value={summary.logins_90d ?? 0} />{payload?.activity_by_type?.map(item => <div className="stat-row" key={item.interaction_type}><span>{humanType(item.interaction_type)}</span><b>{item.total}</b></div>)}</Panel><Panel title="Aplicações e acessos"><div className="detail-apps">{user.applications?.map(app => <div className="detail-app" key={app.id}><div><b>{app.name}</b><small>{app.pivot?.role || 'member'} · {app.pivot?.status || 'sem status'}</small></div><button className={app.pivot?.status === 'active' ? 'danger' : 'primary'} onClick={() => mutate(`/admin/ecosystem/users/${user.id}/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ status: app.pivot?.status === 'active' ? 'blocked' : 'active', role: app.pivot?.role || 'member' }) }, 'Acesso atualizado.', 'users')}>{app.pivot?.status === 'active' ? 'Bloquear' : 'Liberar'}</button></div>)}{!user.applications?.length && <Empty />}</div><h3 className="subheading">Uso por aplicação</h3>{payload?.application_usage?.map(row => <div className="stat-row" key={row.application?.id || row.total}><span>{row.application?.name || 'Aplicação não identificada'}<small>Último uso: {fmt(row.last_activity_at)}</small></span><b>{row.total}</b></div>)}</Panel></div><div className="admin-grid"><Panel title="Segurança e acesso">{security.alerts?.map((a, i) => <div className={`security-alert ${a.level}`} key={i}>{a.message}</div>)}<h3 className="subheading">IPs recentes</h3>{security.ips?.map(x => <div className="stat-row" key={x.value}><span>{x.value}</span><b>{x.count}</b></div>)}<h3 className="subheading">Dispositivos</h3>{security.devices?.map(x => <div className="stat-row" key={x.value}><span>{x.value}</span><b>{x.count}</b></div>)}<h3 className="subheading">Localizações</h3>{security.locations?.map(x => <div className="stat-row" key={x.value}><span>{x.value}</span><b>{x.count}</b></div>)}</Panel><Panel title="Recursos do usuário"><Info label="Estabelecimentos" value={resources.establishments?.length || 0} />{Object.entries(resources).filter(([k]) => k.endsWith('_count')).map(([k, v]) => <Info key={k} label={k.replace('_count', '').replaceAll('_', ' ')} value={v} />)}{resources.establishments?.map(e => <div className="resource-row" key={e.id}><b>{e.name}</b><span>{e.application || 'Sem aplicação'}</span></div>)}</Panel></div><Panel title="Linha do tempo do usuário"><Timeline rows={payload?.timeline || []} /></Panel></div>
}

function Applications({ payload, mutate }) {
  const [form, setForm] = useState(emptyApp); const [editing, setEditing] = useState(null); const apps = payload?.applications || []
  function edit(app) { setEditing(app.id); setForm({ ...emptyApp, ...app, release_date: app.release_date?.slice(0, 10) || '' }) }
  function submit(e) { e.preventDefault(); mutate(`/admin/applications${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) }, editing ? 'Aplicação atualizada.' : 'Aplicação cadastrada.', 'applications'); setEditing(null); setForm(emptyApp) }
  return <div className="admin-grid"><Panel title={editing ? 'Editar aplicação' : 'Nova aplicação'}><form onSubmit={submit} className="form-grid"><Field label="Nome" value={form.name} onChange={v => setForm({ ...form, name: v })} required /><Field label="Slug" value={form.slug} onChange={v => setForm({ ...form, slug: v })} /><Field label="URL" value={form.url} onChange={v => setForm({ ...form, url: v })} wide required /><Field label="Logo" value={form.logo} onChange={v => setForm({ ...form, logo: v })} wide /><Field label="Versão" value={form.version} onChange={v => setForm({ ...form, version: v })} /><Field label="Autor" value={form.author} onChange={v => setForm({ ...form, author: v })} /><label className="wide">Descrição<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label className="check wide"><input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Aplicação ativa e visível</label><div className="form-actions wide"><button className="primary">Salvar</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyApp) }}>Cancelar</button>}</div></form></Panel><Panel title="Aplicações cadastradas">{apps.map(app => <div className="entity-row" key={app.id}><img src={app.logo || '/petertecnetlogo.png'} alt="" /><div><b>{app.name}</b><span>{app.url}</span></div><i className={app.is_active ? 'status on' : 'status'}>{app.is_active ? 'Ativa' : 'Oculta'}</i><button onClick={() => edit(app)}>Editar</button><button className="danger" onClick={() => window.confirm(`Excluir ${app.name}?`) && mutate(`/admin/applications/${app.id}`, { method: 'DELETE' }, 'Aplicação excluída.', 'applications')}>Excluir</button></div>)}</Panel></div>
}

function Profiles({ payload, mutate }) {
  const [selected, setSelected] = useState(null); const [name, setName] = useState(''); const [permissions, setPermissions] = useState([]); const profiles = payload?.profiles || []; const available = payload?.permissions || []
  function choose(p) { setSelected(p.id); setName(p.name); setPermissions(p.permissions || []) } function create() { setSelected('new'); setName(''); setPermissions([]) }
  function save(e) { e.preventDefault(); mutate(`/admin/ecosystem/profiles${selected && selected !== 'new' ? `/${selected}` : ''}`, { method: selected && selected !== 'new' ? 'PUT' : 'POST', body: JSON.stringify({ name, permissions }) }, 'Perfil salvo.', 'profiles') }
  return <div className="admin-grid"><Panel title="Perfis"><button className="primary compact" onClick={create}>+ Novo perfil</button>{profiles.map(p => <button className={`profile-row ${selected === p.id ? 'active' : ''}`} key={p.id} onClick={() => choose(p)}><span><b>{p.name}</b><small>{p.users_count} usuários</small></span><i>{p.permissions?.length || 0} permissões</i></button>)}</Panel><Panel title="Permissões do perfil">{selected ? <form onSubmit={save}><Field label="Nome do perfil" value={name} onChange={setName} required /><div className="permission-list">{available.map(p => <label key={p.key}><input type="checkbox" checked={permissions.includes(p.key)} onChange={e => setPermissions(e.target.checked ? [...permissions, p.key] : permissions.filter(x => x !== p.key))} /><span><b>{p.name}</b><small>{p.category} · {p.description}</small></span></label>)}</div><button className="primary">Salvar perfil e permissões</button></form> : <Empty text="Selecione ou crie um perfil." />}</Panel></div>
}

function Establishments({ payload, applications, users, load, mutate }) {
  const [form, setForm] = useState(emptyEstablishment)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const rows = payload?.establishments || []
  const appRows = applications?.applications || []
  const userRows = users?.users || []

  useEffect(() => {
    if (!applications) load('applications')
    if (!users) load('users')
  }, [])

  function reset() {
    setEditing(null)
    setForm(emptyEstablishment)
  }

  function edit(item) {
    const linkedIds = item.applications?.map(application => Number(application.id)) || []
    const appIds = [...new Set([...(item.app_id ? [Number(item.app_id)] : []), ...linkedIds])]
    setEditing(item.id)
    setForm({
      ...emptyEstablishment,
      ...item,
      user_id: item.user_id || '',
      app_id: item.app_id || appIds[0] || '',
      app_ids: appIds,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleApplication(applicationId) {
    const id = Number(applicationId)
    const selected = form.app_ids.includes(id)
      ? form.app_ids.filter(current => current !== id)
      : [...form.app_ids, id]
    setForm({
      ...form,
      app_ids: selected,
      app_id: selected.includes(Number(form.app_id)) ? form.app_id : (selected[0] || ''),
    })
  }

  function submit(event) {
    event.preventDefault()
    if (!form.app_ids.length) return
    const body = {
      ...form,
      user_id: Number(form.user_id),
      app_id: Number(form.app_id || form.app_ids[0]),
      app_ids: form.app_ids.map(Number),
      uf: form.uf?.toUpperCase(),
    }
    mutate(
      `/admin/ecosystem/establishments${editing ? `/${editing}` : ''}`,
      { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) },
      editing ? 'Empresa atualizada e vínculos sincronizados.' : 'Empresa cadastrada e vinculada ao usuário.',
      'establishments'
    )
    reset()
  }

  async function doSearch(event) {
    event.preventDefault()
    await load('establishments', `/admin/ecosystem/establishments${search ? `?search=${encodeURIComponent(search)}` : ''}`)
  }

  return <div className="admin-stack">
    <div className="admin-grid">
      <Panel title={editing ? `Editar empresa #${editing}` : 'Cadastrar empresa'}>
        <form onSubmit={submit} className="form-grid">
          <Field label="Razão social / nome" value={form.name} onChange={value => setForm({ ...form, name: value })} required />
          <Field label="Nome fantasia" value={form.fantasy} onChange={value => setForm({ ...form, fantasy: value })} />
          <Field label="CNPJ" value={form.cnpj} onChange={value => setForm({ ...form, cnpj: value })} />
          <Field label="Slug" value={form.slug} onChange={value => setForm({ ...form, slug: value })} />
          <Field label="Tipo" value={form.type} onChange={value => setForm({ ...form, type: value })} />
          <Field label="Categoria" value={form.category} onChange={value => setForm({ ...form, category: value })} />
          <Field label="Telefone" value={form.phone} onChange={value => setForm({ ...form, phone: value })} />
          <Field label="E-mail" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} />
          <Field label="Cidade" value={form.city} onChange={value => setForm({ ...form, city: value })} />
          <Field label="UF" value={form.uf} onChange={value => setForm({ ...form, uf: value.slice(0, 2) })} />
          <Field label="CEP" value={form.cep} onChange={value => setForm({ ...form, cep: value })} />
          <Field label="Endereço" value={form.address} onChange={value => setForm({ ...form, address: value })} />
          <label className="wide">Usuário responsável
            <select value={form.user_id} onChange={event => setForm({ ...form, user_id: event.target.value })} required>
              <option value="">Selecione o proprietário</option>
              {userRows.map(user => <option key={user.id} value={user.id}>{fullName(user)} · {user.email}</option>)}
            </select>
          </label>
          <fieldset className="application-picker wide">
            <legend>Aplicações vinculadas</legend>
            <p>Uma mesma empresa pode participar de várias plataformas. Cada aplicativo continuará exibindo apenas as empresas vinculadas a ele.</p>
            <div>{appRows.map(application => <label className="check" key={application.id}><input type="checkbox" checked={form.app_ids.includes(Number(application.id))} onChange={() => toggleApplication(application.id)} />{application.name}</label>)}</div>
          </fieldset>
          {form.app_ids.length > 1 && <label className="wide">Aplicação principal
            <select value={form.app_id} onChange={event => setForm({ ...form, app_id: event.target.value })} required>
              {appRows.filter(application => form.app_ids.includes(Number(application.id))).map(application => <option key={application.id} value={application.id}>{application.name}</option>)}
            </select>
          </label>}
          <label className="wide">Descrição<textarea rows="4" value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
          <Field label="Website" type="url" value={form.website_url} onChange={value => setForm({ ...form, website_url: value })} />
          <Field label="Instagram" type="url" value={form.instagram_url} onChange={value => setForm({ ...form, instagram_url: value })} />
          <div className="company-statuses wide">
            <label className="check"><input type="checkbox" checked={!!form.is_approved} onChange={event => setForm({ ...form, is_approved: event.target.checked })} />Aprovada</label>
            <label className="check"><input type="checkbox" checked={!!form.is_published} onChange={event => setForm({ ...form, is_published: event.target.checked })} />Publicada</label>
            <label className="check"><input type="checkbox" checked={!!form.is_featured} onChange={event => setForm({ ...form, is_featured: event.target.checked })} />Destaque</label>
          </div>
          <div className="form-actions wide"><button className="primary" disabled={!form.app_ids.length}>{editing ? 'Salvar alterações' : 'Cadastrar e vincular'}</button>{editing && <button type="button" onClick={reset}>Cancelar</button>}</div>
        </form>
      </Panel>
      <Panel title="Pesquisar empresas">
        <form className="search-form" onSubmit={doSearch}><input placeholder="Nome, fantasia ou CNPJ" value={search} onChange={event => setSearch(event.target.value)} /><button className="primary">Buscar</button></form>
        <p className="helper">O vínculo define em quais plataformas a empresa aparece. O usuário selecionado será o proprietário e receberá acesso ativo a essas aplicações.</p>
      </Panel>
    </div>
    <Panel title={`Empresas (${rows.length})`}>
      <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Aplicações</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {rows.map(item => {
          const linked = item.applications?.length ? item.applications : (item.app ? [item.app] : [])
          return <tr key={item.id}><td><b>{item.fantasy || item.name}</b><small>{item.cnpj || 'Sem CNPJ'} · {item.city || 'Cidade não informada'}{item.uf ? `/${item.uf}` : ''}</small></td><td><div className="application-tags">{linked.map(application => <span key={application.id}>{application.name}{Number(application.id) === Number(item.app_id) ? ' · principal' : ''}</span>)}</div></td><td>{item.user ? `${fullName(item.user)} · ${item.user.email}` : 'Sem responsável'}</td><td><span className={item.is_approved ? 'status on' : 'status'}>{item.is_approved ? 'Aprovada' : 'Pendente'}</span><small>{item.is_published ? 'Publicada' : 'Oculta'}</small></td><td className="row-actions"><button className="primary" onClick={() => edit(item)}>Editar</button><button onClick={() => mutate(`/admin/ecosystem/establishments/${item.id}`, { method: 'PUT', body: JSON.stringify({ is_approved: !item.is_approved }) }, 'Aprovação atualizada.', 'establishments')}>{item.is_approved ? 'Retirar aprovação' : 'Aprovar'}</button></td></tr>
        })}
      </tbody></table></div>
    </Panel>
  </div>
}

function SiteSettings({ payload, mutate }) {
  const [site, setSite] = useState(payload?.site || {}); useEffect(() => { if (payload?.site) setSite(payload.site) }, [payload]); const hero = site.hero || {}; const contact = site.contact || {}; const navigation = site.navigation || []
  function save(e) { e.preventDefault(); mutate('/admin/ecosystem/settings', { method: 'PUT', body: JSON.stringify({ site }) }, 'Site institucional atualizado.', 'site') }
  return <form onSubmit={save} className="admin-stack"><Panel title="Menu principal"><div className="menu-editor">{navigation.map((item, index) => <div key={index}><input value={item.label || ''} onChange={e => { const n = [...navigation]; n[index] = { ...item, label: e.target.value }; setSite({ ...site, navigation: n }) }} /><input value={item.href || ''} onChange={e => { const n = [...navigation]; n[index] = { ...item, href: e.target.value }; setSite({ ...site, navigation: n }) }} /><button type="button" className="danger" onClick={() => setSite({ ...site, navigation: navigation.filter((_, i) => i !== index) })}>×</button></div>)}<button type="button" onClick={() => setSite({ ...site, navigation: [...navigation, { label: 'Novo item', href: '#' }] })}>+ Adicionar item</button></div></Panel><div className="admin-grid"><Panel title="Hero / abertura"><div className="form-grid"><Field label="Chamada" value={hero.eyebrow || ''} onChange={v => setSite({ ...site, hero: { ...hero, eyebrow: v } })} wide /><Field label="Título" value={hero.title || ''} onChange={v => setSite({ ...site, hero: { ...hero, title: v } })} wide /><label className="wide">Descrição<textarea rows="4" value={hero.description || ''} onChange={e => setSite({ ...site, hero: { ...hero, description: e.target.value } })} /></label><Field label="Botão principal" value={hero.primary_label || ''} onChange={v => setSite({ ...site, hero: { ...hero, primary_label: v } })} /><Field label="Destino" value={hero.primary_href || ''} onChange={v => setSite({ ...site, hero: { ...hero, primary_href: v } })} /></div></Panel><Panel title="Contato"><div className="form-grid"><Field label="Chamada" value={contact.kicker || ''} onChange={v => setSite({ ...site, contact: { ...contact, kicker: v } })} wide /><Field label="Título" value={contact.title || ''} onChange={v => setSite({ ...site, contact: { ...contact, title: v } })} wide /><label className="wide">Descrição<textarea rows="4" value={contact.description || ''} onChange={e => setSite({ ...site, contact: { ...contact, description: e.target.value } })} /></label><Field label="E-mail" value={contact.email || ''} onChange={v => setSite({ ...site, contact: { ...contact, email: v } })} /><Field label="Instagram" value={contact.instagram || ''} onChange={v => setSite({ ...site, contact: { ...contact, instagram: v } })} /></div></Panel></div><button className="primary save-site">Publicar alterações do site</button></form>
}

function Audit({ payload }) { const logs = payload?.logs || []; return <Panel title={`Histórico administrativo (${logs.length})`}><div className="table-wrap"><table><thead><tr><th>Data</th><th>Administrador</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{fmt(log.created_at)}</td><td>{log.user?.email || 'Sistema'}</td><td><b>{log.action}</b></td><td>{log.entity_type?.split('\\').pop() || '—'} {log.entity_id || ''}</td></tr>)}</tbody></table></div></Panel> }
function Timeline({ rows, compact = false }) {
  if (!rows?.length) return <Empty />
  return <div className={`timeline ${compact ? 'compact' : ''}`}>{rows.map(row => {
    const context = row.content || {}; const entity = context.entity_snapshot || {}
    const location = context.location?.city ? `${context.location.city}${context.location.uf ? `/${context.location.uf}` : ''}` : null
    return <article className={`timeline-row ${row.outcome === 'error' || row.outcome === 'refused' || row.type === 'request_error' ? 'error' : ''}`} key={row.id}><span className="timeline-dot" /><div><div className="timeline-title"><b>{row.user ? fullName(row.user) : 'Visitante / sistema'} · {row.application?.name || 'Aplicação não identificada'}</b><em className={`outcome-badge ${row.outcome || 'success'}`}>{outcomeLabel(row.outcome)}</em><em className={`severity-badge ${row.severity || 'normal'}`}>{row.severity || 'normal'}</em>{context.status && <em className={`http-status ${context.status >= 400 ? 'failed' : ''}`}>HTTP {context.status}</em>}</div><p className="interaction-description">{row.name || `${humanType(row.type)} ${entity.name || ''}`}</p><small>{fmt(row.created_at)} · {context.duration_ms ?? '—'} ms{location ? ` · ${location}` : ''}{context.device ? ` · ${context.device}` : ''}</small><InteractionDetails row={row} rows={rows} /></div></article>
  })}</div>
}

function InteractionDetails({ row, rows }) {
  const context = row.content || {}; const entity = context.entity_snapshot || {}; const user = context.user_snapshot || row.user || {}
  const related = row.correlation_id ? rows.filter(item => item.id !== row.id && item.correlation_id === row.correlation_id) : []
  const changes = context.changes || {}; const fields = [...new Set([...Object.keys(changes.before || {}), ...Object.keys(changes.after || {})])]
  return <details className="interaction-detail"><summary>Ver detalhes completos</summary><div className="interaction-sheet"><AuditSection title="Identificação"><AuditValue label="ID" value={row.id} /><AuditValue label="Data e hora" value={fmt(row.created_at)} /><AuditValue label="Tipo" value={humanType(row.type)} /><AuditValue label="Descrição" value={row.name} /><AuditValue label="Aplicação de origem" value={row.application?.name} /><AuditValue label="Canal" value={context.source_channel} /><AuditValue label="Critério da aplicação" value={context.application_context} /><AuditValue label="Aplicação-alvo (ID)" value={context.target_app_id} /><AuditValue label="Ambiente" value={row.environment} /></AuditSection><AuditSection title="Usuário"><AuditValue label="Nome" value={user.name || fullName(row.user)} /><AuditValue label="E-mail" value={user.email || row.user?.email} /><AuditValue label="ID do usuário" value={user.id || row.user?.id} /><AuditValue label="Perfil" value={user.profile || row.user?.profile?.name} /><AuditValue label="Autenticação" value={row.user ? 'Autenticado' : 'Visitante'} /><AuditValue label="Estabelecimentos" value={user.establishments?.map(item => item.name).join(', ')} /><AuditValue label="Aplicações permitidas" value={user.applications?.map(item => item.name).join(', ')} /></AuditSection><AuditSection title="Objeto da ação"><AuditValue label="Entidade" value={entity.type || row.entity_type} /><AuditValue label="ID" value={entity.id || row.entity_id} /><AuditValue label="Nome" value={entity.name} /><AuditValue label="Estabelecimento" value={entity.establishment?.name} /><AuditValue label="Proprietário" value={entity.owner?.name || entity.owner?.email} /><AuditValue label="Página" value={context.frontend_page} /></AuditSection><AuditSection title="Contexto da navegação"><AuditValue label="Rota da API" value={context.route_name || row.route} /><AuditValue label="Método" value={row.method} /><AuditValue label="Página anterior" value={context.referer} /><AuditValue label="Origem" value={context.origin} /><AuditValue label="Dispositivo" value={context.device} /><AuditValue label="Navegador" value={context.browser} /><AuditValue label="Sistema operacional" value={context.operating_system} /><AuditValue label="IP" value={context.ip} /><AuditValue label="Localização" value={context.location?.city ? `${context.location.city}/${context.location.uf || ''}` : null} /><AuditValue label="Sessão" value={row.session_key} /></AuditSection><AuditSection title="Resultado"><AuditValue label="Resultado" value={outcomeLabel(row.outcome)} /><AuditValue label="Status HTTP" value={context.status} /><AuditValue label="Duração" value={context.duration_ms != null ? `${context.duration_ms} ms` : null} /><AuditValue label="Resposta" value={context.response_message} /><AuditValue label="Código do erro" value={context.error_code} /><AuditValue label="Motivo" value={context.error} /></AuditSection>{fields.length > 0 && <section className="audit-section audit-changes"><h4>Alterações realizadas</h4><div className="table-wrap"><table><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{fields.map(field => <tr key={field}><td>{field}</td><td>{auditText(changes.before?.[field])}</td><td>{auditText(changes.after?.[field])}</td></tr>)}</tbody></table></div></section>}<AuditSection title="Segurança"><AuditValue label="Classificação" value={row.severity} /><AuditValue label="Resultado" value={row.outcome} /><AuditValue label="Tentativa recusada" value={row.outcome === 'refused' ? 'Sim' : 'Não'} /><AuditValue label="Exceção" value={context.exception} /></AuditSection><AuditSection title="Relação entre eventos"><AuditValue label="Request ID" value={row.request_id} /><AuditValue label="Correlation ID" value={row.correlation_id} /><AuditValue label="Interação pai" value={row.parent_interaction_id} /><AuditValue label="Eventos relacionados" value={related.length ? related.map(item => `#${item.id} ${item.name || humanType(item.type)}`).join(' → ') : 'Nenhum evento relacionado nesta página'} /></AuditSection>{(context.parameters || context.query || context.input) && <section className="audit-section audit-technical"><h4>Dados técnicos seguros</h4><pre>{JSON.stringify({ parametros: context.parameters, filtros: context.query, dados: context.input }, null, 2)}</pre></section>}</div></details>
}

function AuditSection({ title, children }) { return <section className="audit-section"><h4>{title}</h4><div className="audit-grid">{children}</div></section> }
function AuditValue({ label, value }) { if (value === undefined || value === null || value === '') return null; return <div className="audit-value"><span>{label}</span><b>{auditText(value)}</b></div> }
function auditText(value) { if (typeof value === 'boolean') return value ? 'Sim' : 'Não'; if (typeof value === 'object') return JSON.stringify(value); return String(value) }
function outcomeLabel(outcome) { return { success: 'Sucesso', refused: 'Recusado', error: 'Erro' }[outcome] || 'Registrado' }

function humanType(type = '') { const map = { login: 'Login', login_google: 'Login Google', logout: 'Logout', register: 'Cadastro', view: 'Visualização', update: 'Atualização', like: 'Curtida', comment: 'Comentário', share: 'Compartilhamento', rating: 'Avaliação', me: 'Consulta de conta', verification: 'Verificação de e-mail', password_change: 'Alteração de senha', password_changed: 'Senha redefinida', password_reset_requested: 'Recuperação de senha', request_error: 'Tentativa com erro', create: 'Criação', delete: 'Exclusão', action: 'Ação' }; return map[type] || type.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase()) }
function Metric({ label, value, sub }) { return <article className="metric-card"><span>{label}</span><strong>{value ?? '—'}</strong><small>{sub}</small></article> }
function Info({ label, value }) { return <div className="info-row"><span>{label}</span><b>{value ?? '—'}</b></div> }
function Panel({ title, children }) { return <section className="admin-panel"><div className="panel-title"><h2>{title}</h2></div>{children}</section> }
function Field({ label, value, onChange, wide, type = 'text', required }) { return <label className={wide ? 'wide' : ''}>{label}<input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} /></label> }
function Empty({ text = 'Nenhum registro encontrado.' }) { return <p className="admin-empty">{text}</p> }
