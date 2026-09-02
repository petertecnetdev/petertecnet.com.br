import { useCallback, useEffect, useMemo, useState } from 'react';
import './LaoraAdminCenter.css';

const API = 'https://api.petertecnet.com.br/api';
const token = () => localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token');

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
  if (!response.ok) throw new Error(data?.message || data?.error || Object.values(data?.errors || {}).flat()?.[0] || 'Falha na operação.');
  return data;
}

const fmt = (v) => v ? new Date(v).toLocaleString('pt-BR') : '—';
const reasonLabel = (v) => ({ fake_profile:'Perfil falso', harassment:'Assédio', spam:'Spam', sexual_content:'Conteúdo sexual', underage:'Possível menor', violence:'Violência/ameaça', scam:'Golpe/fraude', other:'Outro' }[v] || v);

export default function LaoraAdminCenter() {
  const [tab, setTab] = useState('reports'); const [stats, setStats] = useState({}); const [reports, setReports] = useState([]); const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('open'); const [photoStatus, setPhotoStatus] = useState('pending'); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!token()) { window.location.href = '/login'; return; }
    setLoading(true); setError('');
    try {
      const [dashboard, reportRows, photoRows] = await Promise.all([
        request('/laora/admin/dashboard'),
        request(`/laora/admin/reports?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
        request(`/laora/admin/photos?status=${encodeURIComponent(photoStatus)}`),
      ]);
      setStats(dashboard.data || {}); setReports(reportRows.data || []); setPhotos(photoRows.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [status, photoStatus, search]);

  useEffect(() => { load(); }, [load]);

  const act = async (report, action) => {
    const defaultReason = action === 'dismiss' ? 'Denúncia analisada e arquivada.' : action === 'warn' ? 'Conduta incompatível com as diretrizes da comunidade.' : action === 'suspend' ? 'Suspensão preventiva após análise da denúncia.' : 'Violação grave das regras do Laora.';
    const reason = window.prompt('Motivo da decisão:', defaultReason); if (!reason) return;
    const duration = action === 'suspend' ? Number(window.prompt('Duração da suspensão em horas:', '72') || 72) : undefined;
    setLoading(true); setError('');
    try { await request(`/laora/admin/reports/${report.id}/action`, { method: 'POST', body: JSON.stringify({ action, reason, duration_hours: duration }) }); setMessage('Ação registrada na trilha de auditoria.'); await load(); }
    catch (e) { setError(e.message); setLoading(false); }
  };

  const moderatePhoto = async (photo, nextStatus) => {
    const reason = nextStatus === 'rejected' ? window.prompt('Motivo da rejeição:', 'Foto incompatível com as diretrizes da comunidade.') : 'Foto revisada e aprovada.';
    if (nextStatus === 'rejected' && !reason) return;
    setLoading(true); setError('');
    try { await request(`/laora/admin/photos/${photo.id}/moderate`, { method: 'POST', body: JSON.stringify({ status: nextStatus, reason }) }); setMessage(nextStatus === 'approved' ? 'Foto aprovada.' : 'Foto rejeitada.'); await load(); }
    catch (e) { setError(e.message); setLoading(false); }
  };

  const openUser = async (userId) => { setLoading(true); try { const data = await request(`/laora/admin/users/${userId}`); setDetail(data.data); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const cards = useMemo(() => [['Perfis',stats.profiles],['Descobertos',stats.discoverable_profiles],['Matches ativos',stats.matches_active],['Matches 30d',stats.matches_30d],['Mensagens 30d',stats.messages_30d],['Denúncias abertas',stats.open_reports],['Fotos pendentes',stats.pending_photos],['Suspensos',stats.suspended_users],['Banidos',stats.banned_users]], [stats]);

  return <main className="la-admin"><aside><a className="la-admin-brand" href="/admin"><img src="/petertecnetlogo.png" alt=""/><span><b>Peter Tecnet</b><small>Laora Safety Center</small></span></a><nav><button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}>Denúncias <b>{stats.open_reports||0}</b></button><button className={tab==='photos'?'active':''} onClick={()=>setTab('photos')}>Fotos <b>{stats.pending_photos||0}</b></button><button className={tab==='metrics'?'active':''} onClick={()=>setTab('metrics')}>Indicadores</button></nav><a href="/admin">← Admin Center</a></aside><section className="la-admin-main"><header><div><p>Peter Tecnet · Governança</p><h1>Laora Safety Center</h1><span>Moderação, risco e integridade da plataforma.</span></div><button onClick={load}>Atualizar</button></header>{error&&<div className="la-notice error">{error}</div>}{message&&<div className="la-notice ok">{message}</div>}{loading&&<div className="la-loading">Atualizando dados de segurança…</div>}
    <div className="la-metrics">{cards.map(([label,value])=><article key={label}><span>{label}</span><strong>{value??'—'}</strong></article>)}</div>
    {detail ? <UserDetail data={detail} close={()=>setDetail(null)} /> : <>{tab==='reports'&&<section className="la-panel"><div className="la-panel-head"><div><h2>Fila de denúncias</h2><p>Decisões ficam registradas com moderador, motivo e validade.</p></div><div className="la-filters"><input placeholder="Pesquisar usuário, e-mail, motivo…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="open">Abertas</option><option value="resolved">Resolvidas</option><option value="dismissed">Arquivadas</option><option value="all">Todas</option></select></div></div><div className="la-list">{reports.length===0?<p className="la-empty">Nenhuma denúncia no filtro atual.</p>:reports.map(report=><article className="la-report" key={report.id}><div className="la-report-top"><div><b>#{report.id} · {reasonLabel(report.reason)}</b><span>{fmt(report.created_at)}</span></div><button onClick={()=>openUser(report.reported_user_id)}>Abrir usuário</button></div><div className="la-people"><span>Denunciado: <b>{report.reported_first_name||'Usuário'} · {report.reported_email}</b></span><span>Denunciante: {report.reporter_first_name||'Usuário'} · {report.reporter_email}</span></div>{report.details&&<blockquote>{report.details}</blockquote>}{report.status==='open'&&<div className="la-actions"><button onClick={()=>act(report,'dismiss')}>Arquivar</button><button onClick={()=>act(report,'warn')}>Advertir</button><button className="warn" onClick={()=>act(report,'suspend')}>Suspender</button><button className="danger" onClick={()=>act(report,'ban')}>Banir</button></div>}</article>)}</div></section>}
    {tab==='photos'&&<section className="la-panel"><div className="la-panel-head"><div><h2>Moderação de fotos</h2><p>Fotos novas só entram na descoberta após aprovação.</p></div><select value={photoStatus} onChange={e=>setPhotoStatus(e.target.value)}><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Rejeitadas</option><option value="all">Todas</option></select></div><div className="la-photo-grid">{photos.length===0?<p className="la-empty">Nenhuma foto neste filtro.</p>:photos.map(photo=><article key={photo.id}><img src={photo.url} alt="Foto aguardando moderação"/><div><b>{photo.display_name}</b><small>{photo.email}</small><span className={`status ${photo.moderation_status}`}>{photo.moderation_status}</span></div><footer><button onClick={()=>openUser(photo.user_id)}>Usuário</button>{photo.moderation_status!=='approved'&&<button className="ok" onClick={()=>moderatePhoto(photo,'approved')}>Aprovar</button>}{photo.moderation_status!=='rejected'&&<button className="danger" onClick={()=>moderatePhoto(photo,'rejected')}>Rejeitar</button>}</footer></article>)}</div></section>}
    {tab==='metrics'&&<section className="la-panel"><h2>Saúde operacional</h2><div className="la-health"><p><b>Denúncias abertas:</b> {stats.open_reports||0}</p><p><b>Fotos aguardando revisão:</b> {stats.pending_photos||0}</p><p><b>Contas suspensas:</b> {stats.suspended_users||0}</p><p><b>Contas banidas:</b> {stats.banned_users||0}</p><p><b>Mensagens em 30 dias:</b> {stats.messages_30d||0}</p><p><b>Matches em 30 dias:</b> {stats.matches_30d||0}</p></div></section>}</>}</section></main>;
}

function UserDetail({data,close}) { const u=data.user||{}, p=data.profile||{}; return <section className="la-panel"><div className="la-panel-head"><div><button onClick={close}>← Voltar</button><h2>{p.display_name||u.first_name||'Usuário'} <small>#{u.id}</small></h2><p>{u.email}</p></div><div><b>{data.reports_received?.length||0}</b> denúncias recebidas</div></div><div className="la-user-grid"><div><h3>Perfil</h3><p>Gênero: {p.gender||'—'}</p><p>Orientação: {p.orientation||'—'}</p><p>Cidade: {[p.city,p.uf].filter(Boolean).join('/')||'—'}</p><p>Descoberta: {p.discovery_enabled?'ativa':'pausada'}</p><p>Completo: {p.is_complete?'sim':'não'}</p><p>Matches: {data.matches_count||0}</p><p>Mensagens: {data.messages_count||0}</p><p>Bloqueios feitos: {data.blocks_count||0}</p></div><div><h3>Fotos</h3><div className="la-mini-photos">{data.photos?.map(photo=><img src={photo.url} alt="" key={photo.id}/>)}</div></div></div><h3>Histórico de moderação</h3><div className="la-history">{data.moderation_actions?.length?data.moderation_actions.map(a=><div key={a.id}><b>{a.action}</b><span>{a.reason||'—'}</span><small>{fmt(a.created_at)}{a.expires_at?` · expira ${fmt(a.expires_at)}`:''}</small></div>):<p className="la-empty">Sem ações registradas.</p>}</div></section> }
