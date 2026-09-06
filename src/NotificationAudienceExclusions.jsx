import { useEffect, useRef, useState } from 'react'
import './NotificationAudienceExclusions.css'

const fields = [
  { value: 'email', label: 'E-mail', kind: 'text', placeholder: '@empresa.com' },
  { value: 'user_name', label: 'Username', kind: 'text', placeholder: 'username' },
  { value: 'city', label: 'Cidade', kind: 'text', placeholder: 'São Paulo' },
  { value: 'uf', label: 'Estado (UF)', kind: 'uf', placeholder: 'SP' },
  { value: 'application_role', label: 'Papel na aplicação', kind: 'text', placeholder: 'manager' },
  { value: 'profile_id', label: 'ID do perfil', kind: 'number', placeholder: 'Ex.: 3' },
  { value: 'is_producer', label: 'É produtor', kind: 'boolean' },
  { value: 'is_participant', label: 'É participante', kind: 'boolean' },
  { value: 'is_promoter', label: 'É promoter', kind: 'boolean' },
  { value: 'is_partner', label: 'É parceiro', kind: 'boolean' },
  { value: 'newsletter_subscription', label: 'Assina newsletter', kind: 'boolean' },
  { value: 'email_verified', label: 'E-mail verificado', kind: 'boolean' },
]

const textOperators = [
  ['equals', 'é exatamente'],
  ['contains', 'contém'],
  ['starts_with', 'começa com'],
  ['ends_with', 'termina com'],
]

const booleanOperators = [
  ['is_true', 'sim'],
  ['is_false', 'não'],
]

function definition(field) {
  return fields.find(option => option.value === field) || fields[0]
}

function operators(field) {
  const item = definition(field)
  if (item.kind === 'boolean') return booleanOperators
  if (item.kind === 'uf' || item.kind === 'number') return [['equals', 'é exatamente']]
  return textOperators
}

function defaultOperator(field) {
  const item = definition(field)
  if (item.kind === 'boolean') return 'is_true'
  if (item.kind === 'text') return 'contains'
  return 'equals'
}

function needsValue(field) {
  return definition(field).kind !== 'boolean'
}

function nameOf(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_name || user?.email || `Usuário #${user?.id}`
}

export default function NotificationAudienceExclusions({ request, onChange }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [excludedUsers, setExcludedUsers] = useState([])
  const [rules, setRules] = useState([])
  const [match, setMatch] = useState('any')
  const searchTimer = useRef(null)
  const sequence = useRef(0)

  useEffect(() => {
    const invalid = rules.some(rule => needsValue(rule.field) && String(rule.value ?? '').trim() === '')
      || rules.some(rule => definition(rule.field).kind === 'number' && Number(rule.value) <= 0)

    onChange({
      exclude_user_ids: excludedUsers.map(user => Number(user.id)),
      exclusion_match: match,
      exclusion_rules: rules.map(rule => ({
        field: rule.field,
        operator: rule.operator,
        value: needsValue(rule.field)
          ? (definition(rule.field).kind === 'number' ? Number(rule.value) : String(rule.value || '').trim())
          : null,
      })),
      count: excludedUsers.length + rules.length,
      invalid,
    })
  }, [excludedUsers, rules, match, onChange])

  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    const term = search.trim()
    if (term.length < 2) return undefined

    searchTimer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const payload = await request(`/admin/ecosystem/users?search=${encodeURIComponent(term)}`)
        setResults((payload?.users || []).slice(0, 12))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 260)

    return () => window.clearTimeout(searchTimer.current)
  }, [search, request])

  function changeSearch(value) {
    setSearch(value)
    if (value.trim().length < 2) {
      setResults([])
      setSearching(false)
    }
  }

  function toggleUser(user) {
    setExcludedUsers(current => current.some(item => Number(item.id) === Number(user.id))
      ? current.filter(item => Number(item.id) !== Number(user.id))
      : [...current, user])
  }

  function addRule() {
    sequence.current += 1
    setRules(current => [...current, { id: sequence.current, field: 'email', operator: 'contains', value: '' }])
  }

  function updateRule(id, property, value) {
    setRules(current => current.map(rule => {
      if (rule.id !== id) return rule
      if (property === 'field') {
        return { ...rule, field: value, operator: defaultOperator(value), value: '' }
      }
      return { ...rule, [property]: value }
    }))
  }

  function removeRule(id) {
    setRules(current => current.filter(rule => rule.id !== id))
  }

  const count = excludedUsers.length + rules.length

  return <section className="notification-exclusions" aria-label="Exclusões do público">
    <header className="notification-exclusions-head">
      <div><span>MENOS PARA</span><b>Quem não deve receber?</b><small>Exclua pessoas específicas ou usuários que atendam a condições.</small></div>
      <i>{count ? `${count} ativa${count === 1 ? '' : 's'}` : 'opcional'}</i>
    </header>

    <div className="notification-exclusion-user-search">
      <label className="notification-field"><span>Excluir usuário específico <small>busque por nome, e-mail, username ou ID</small></span><input value={search} onChange={event => changeSearch(event.target.value)} placeholder="Pesquisar usuário para excluir"/></label>
      {excludedUsers.length > 0 && <div className="notification-excluded-users">{excludedUsers.map(user => <button key={user.id} type="button" onClick={() => toggleUser(user)} title="Remover da exclusão"><span>− {nameOf(user)}</span><i>×</i></button>)}</div>}
      {(searching || results.length > 0) && <div className="notification-exclusion-results">
        {searching ? <div className="notification-exclusion-searching">Buscando usuários…</div> : results.map(user => {
          const excluded = excludedUsers.some(item => Number(item.id) === Number(user.id))
          return <button type="button" key={user.id} className={excluded ? 'selected' : ''} onClick={() => toggleUser(user)}>
            <span className="notification-exclusion-avatar">{nameOf(user).slice(0, 2).toUpperCase()}</span><span><b>{nameOf(user)}</b><small>{user.email}</small></span><i>{excluded ? '−' : '+'}</i>
          </button>
        })}
      </div>}
    </div>

    <div className="notification-exclusion-rule-head">
      <div><b>Menos para o usuário que…</b><small>Crie condições combináveis e validadas pela API.</small></div>
      <button type="button" onClick={addRule}>+ Adicionar condição</button>
    </div>

    {rules.length > 1 && <label className="notification-exclusion-match"><span>Excluir quando</span><select value={match} onChange={event => setMatch(event.target.value)}><option value="any">qualquer condição corresponder</option><option value="all">todas as condições corresponderem</option></select></label>}

    {rules.length > 0 && <div className="notification-exclusion-rules">{rules.map((rule, index) => {
      const item = definition(rule.field)
      return <div className="notification-exclusion-rule" key={rule.id}>
        <span className="notification-exclusion-rule-index">{index + 1}</span>
        <select aria-label={`Campo da condição ${index + 1}`} value={rule.field} onChange={event => updateRule(rule.id, 'field', event.target.value)}>{fields.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select aria-label={`Operador da condição ${index + 1}`} value={rule.operator} onChange={event => updateRule(rule.id, 'operator', event.target.value)}>{operators(rule.field).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {needsValue(rule.field) ? <input aria-label={`Valor da condição ${index + 1}`} type={item.kind === 'number' ? 'number' : 'text'} min={item.kind === 'number' ? '1' : undefined} maxLength={item.kind === 'number' ? undefined : 180} value={rule.value} onChange={event => updateRule(rule.id, 'value', event.target.value)} placeholder={item.placeholder}/> : <span className="notification-exclusion-boolean">sem valor adicional</span>}
        <button className="notification-exclusion-remove" type="button" onClick={() => removeRule(rule.id)} aria-label={`Remover condição ${index + 1}`}>×</button>
      </div>
    })}</div>}
  </section>
}
