import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './AgentChatPanel.css'

const TARGETS = [
  ['@todos', 'Todos os agentes'],
  ['@api', 'API'],
  ['@cutinapp', 'Cutinapp'],
  ['@nexus', 'Nexus'],
  ['@plat', 'Plat'],
  ['@rasoio', 'Rasoio'],
  ['@locaio', 'Locaio'],
  ['@kryvion', 'Kryvion'],
  ['@payflow', 'Payflow'],
  ['@laora', 'Laora'],
]

function tone(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'DONE') return 'done'
  if (value === 'BLOCKED') return 'blocked'
  if (value === 'REVIEW') return 'review'
  if (value === 'START') return 'start'
  if (value === 'QUESTION') return 'question'
  return 'info'
}

function adminMessage(message) {
  const author = String(message?.author || '').toLowerCase()
  return author.includes('pedro') || author.includes('peter tecnet admin')
}

export default function AgentChatPanel({ request }) {
  const [messages, setMessages] = useState([])
  const [target, setTarget] = useState('@todos')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [writeEnabled, setWriteEnabled] = useState(true)
  const [sourceUrl, setSourceUrl] = useState('')
  const [syncedAt, setSyncedAt] = useState('')
  const endRef = useRef(null)
  const mountedRef = useRef(true)

  const visibleMessages = useMemo(() => messages.slice(-200), [messages])

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)

    try {
      const payload = await request('/admin/ecosystem/agents/chat', { timeout: 15000 })
      if (!mountedRef.current) return
      setMessages(Array.isArray(payload?.messages) ? payload.messages : [])
      setWriteEnabled(payload?.write_enabled !== false)
      setSourceUrl(payload?.source_url || '')
      setSyncedAt(payload?.synced_at || '')
      setError('')
    } catch (loadError) {
      if (mountedRef.current && !quiet) {
        setError(loadError?.message || 'Não foi possível carregar a conversa dos agentes.')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [request])

  useEffect(() => {
    mountedRef.current = true
    void load()

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ quiet: true })
    }, 12000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load({ quiet: true })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mountedRef.current = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' })
  }, [visibleMessages.length, loading])

  async function send() {
    const message = text.trim()
    if (!message || sending || !writeEnabled) return

    setSending(true)
    setError('')

    try {
      const payload = await request('/admin/ecosystem/agents/chat', {
        method: 'POST',
        timeout: 20000,
        body: JSON.stringify({
          message,
          to: target,
          type: 'REQUEST',
        }),
      })

      setText('')
      if (payload?.message) {
        setMessages(current => {
          if (current.some(item => item.id === payload.message.id)) return current
          return [...current, payload.message]
        })
      } else {
        await load({ quiet: true })
      }
      setWriteEnabled(payload?.write_enabled !== false)
    } catch (sendError) {
      if (sendError?.status === 503) setWriteEnabled(false)
      setError(sendError?.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return <article className="agent-chat">
    <header className="agent-chat-head">
      <div className="agent-chat-title">
        <span className="agent-chat-live"><i/>CENTRAL COMPARTILHADA</span>
        <h3>Conversa dos agentes</h3>
        <p>As mensagens são sincronizadas com o repositório e ficam disponíveis para todos os agentes nas próximas execuções.</p>
      </div>
      <div className="agent-chat-actions">
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Ver no GitHub ↗</a>}
        <button type="button" onClick={() => load({ quiet: true })} disabled={refreshing} aria-label="Atualizar conversa">
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </header>

    {!writeEnabled && <div className="agent-chat-warning">
      <strong>Envio indisponível.</strong>
      <span>A leitura está ativa, mas o backend ainda não possui a credencial de escrita do GitHub.</span>
    </div>}

    {error && <div className="agent-chat-error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={() => { setError(''); void load() }}>Tentar novamente</button>
    </div>}

    <div className="agent-chat-body" aria-live="polite">
      {loading ? <div className="agent-chat-loading">
        <span/><span/><span/>
        <p>Sincronizando conversa…</p>
      </div> : visibleMessages.length ? visibleMessages.map(message => {
        const mine = adminMessage(message)
        return <div className={`agent-chat-row ${mine ? 'mine' : ''}`} key={message.id}>
          <div className="agent-chat-avatar">{String(message.author || 'A').slice(0, 2).toUpperCase()}</div>
          <div className={`agent-chat-bubble tone-${tone(message.status || message.type)}`}>
            <div className="agent-chat-meta">
              <b>{message.author || 'Agente'}</b>
              <span>{message.to || '@todos'}</span>
              <i>{message.status || message.type || 'INFO'}</i>
            </div>
            {message.subject && message.subject !== 'Mensagem do Admin Center' && <strong className="agent-chat-subject">{message.subject}</strong>}
            <p>{message.message}</p>
            <div className="agent-chat-foot">
              <time>{message.timestamp}</time>
              {message.commit && message.commit !== 'n/a' && <span>Commit/PR: {message.commit}</span>}
            </div>
          </div>
        </div>
      }) : <div className="agent-chat-empty">
        <b>Nenhuma mensagem encontrada.</b>
        <span>Envie uma ordem para iniciar a conversa compartilhada.</span>
      </div>}
      <div ref={endRef}/>
    </div>

    <footer className="agent-chat-composer">
      <div className="agent-chat-target">
        <label htmlFor="agent-chat-target">Enviar para</label>
        <select id="agent-chat-target" value={target} onChange={event => setTarget(event.target.value)}>
          {TARGETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="agent-chat-input">
        <textarea
          value={text}
          onChange={event => setText(event.target.value.slice(0, 5000))}
          onKeyDown={onKeyDown}
          placeholder={writeEnabled ? 'Digite uma ordem, pergunta ou mensagem para os agentes…' : 'Envio aguardando credencial do GitHub no backend.'}
          disabled={!writeEnabled || sending}
          rows="3"
          aria-label="Mensagem para os agentes"
        />
        <div>
          <small>{text.length}/5000 · Enter envia · Shift+Enter quebra linha</small>
          <button type="button" className="agent-chat-send" onClick={() => void send()} disabled={!text.trim() || sending || !writeEnabled}>
            {sending ? 'Enviando…' : 'Enviar'} <span>↗</span>
          </button>
        </div>
      </div>
    </footer>

    <div className="agent-chat-sync">
      <span><i/> GitHub é a fonte de continuidade</span>
      {syncedAt && <small>Última sincronização: {new Date(syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>}
    </div>
  </article>
}
