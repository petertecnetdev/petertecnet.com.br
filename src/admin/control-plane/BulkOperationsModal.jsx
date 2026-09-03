import { useMemo, useState } from 'react'
import { controlApi } from './api.js'

const ACTIONS = {
  user: [['set_access', 'Alterar acesso a aplicação']],
  establishment: [['approve', 'Aprovar'], ['unapprove', 'Remover aprovação'], ['publish', 'Publicar'], ['unpublish', 'Despublicar']],
  item: [['activate', 'Ativar'], ['deactivate', 'Desativar']],
  application: [['activate', 'Ativar'], ['deactivate', 'Desativar']],
}

export default function BulkOperationsModal({ open, onClose, onDone }) {
  const [entityType, setEntityType] = useState('establishment')
  const [idsText, setIdsText] = useState('')
  const [action, setAction] = useState('approve')
  const [applicationId, setApplicationId] = useState('')
  const [status, setStatus] = useState('active')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const ids = useMemo(() => [...new Set(idsText.split(/[\s,;]+/).map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0))], [idsText])

  if (!open) return null

  function changeType(next) {
    setEntityType(next)
    setAction(ACTIONS[next][0][0])
    setResult(null); setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!ids.length) { setError('Informe pelo menos um ID válido.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await controlApi('/admin/ecosystem/control-plane/bulk', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityType,
          ids,
          action,
          reason: reason.trim(),
          confirm,
          ...(entityType === 'user' ? { application_id: Number(applicationId), status } : {}),
        }),
      })
      setResult(data)
      setConfirm(false)
      onDone?.()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <div className="cp-overlay" role="dialog" aria-modal="true" aria-label="Operações em lote" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="cp-modal cp-bulk-modal">
      <header className="cp-drawer-header"><div><p>OPERAÇÃO AUDITADA</p><h2>Ações em lote</h2><span>Até 100 entidades por operação, sempre com motivo e registro before/after.</span></div><button type="button" onClick={onClose}>×</button></header>
      <form onSubmit={submit}>
        <div className="cp-form-grid">
          <label>Entidade<select value={entityType} onChange={event => changeType(event.target.value)}><option value="establishment">Estabelecimentos</option><option value="item">Itens</option><option value="application">Aplicações</option><option value="user">Usuários</option></select></label>
          <label>Ação<select value={action} onChange={event => setAction(event.target.value)}>{ACTIONS[entityType].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide">IDs<textarea rows="3" value={idsText} onChange={event => setIdsText(event.target.value)} placeholder="12, 18, 34" /><small>{ids.length} ID(s) válido(s)</small></label>
          {entityType === 'user' && <><label>Application ID<input type="number" min="1" value={applicationId} onChange={event => setApplicationId(event.target.value)} required /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="active">Liberado</option><option value="blocked">Bloqueado</option></select></label></>}
          <label className="wide">Motivo da operação<textarea rows="3" value={reason} onChange={event => setReason(event.target.value)} minLength="3" maxLength="500" required placeholder="Explique por que esta alteração em lote é necessária." /></label>
        </div>
        <label className="cp-danger-confirm"><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} required /><span><b>Confirmo o impacto desta operação.</b><small>A ação será registrada na auditoria com usuário, IP, motivo, antes e depois.</small></span></label>
        {error && <div className="cp-error">{error}</div>}
        {result && <div className="cp-success">Operação concluída em {result.updated || 0} entidade(s).</div>}
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="danger" disabled={loading || !confirm || !reason.trim() || !ids.length}>{loading ? 'Executando…' : `Executar em ${ids.length} entidade(s)`}</button></footer>
      </form>
    </section>
  </div>
}
