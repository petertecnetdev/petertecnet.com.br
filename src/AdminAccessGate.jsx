import { useCallback, useEffect, useState } from 'react'

const API_BASE_URL = 'https://api.petertecnet.com.br/api'

function authToken() {
  return localStorage.getItem('token') || localStorage.getItem('petertecnet_admin_token') || ''
}

function GateScreen({ title, message, actionLabel, onAction }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#02090d', color: '#e9fbff' }}>
      <section style={{ width: 'min(560px, 100%)', padding: '32px', border: '1px solid rgba(135, 226, 255, .2)', borderRadius: '24px', background: 'rgba(5, 18, 27, .96)', boxShadow: '0 24px 80px rgba(0, 0, 0, .35)' }}>
        <img src="/petertecnetlogo.png" alt="Peter Tecnet" style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '20px' }} />
        <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '.16em', textTransform: 'uppercase', opacity: .65 }}>Admin Center · Segurança</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 6vw, 42px)', lineHeight: 1.05 }}>{title}</h1>
        <p style={{ margin: '0 0 24px', lineHeight: 1.6, opacity: .78 }}>{message}</p>
        <button type="button" onClick={onAction} style={{ minHeight: '46px', padding: '0 20px', border: 0, borderRadius: '14px', cursor: 'pointer', fontWeight: 800 }}>
          {actionLabel}
        </button>
      </section>
    </main>
  )
}

export default function AdminAccessGate({ children }) {
  const [status, setStatus] = useState('checking')

  const verify = useCallback(async () => {
    const token = authToken()

    if (!token) {
      window.location.replace('/login')
      return
    }

    setStatus('checking')

    try {
      const response = await fetch(`${API_BASE_URL}/admin/applications`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        localStorage.removeItem('petertecnet_admin_token')
        window.location.replace('/login')
        return
      }

      if (response.status === 403) {
        localStorage.removeItem('petertecnet_admin_token')
        setStatus('denied')
        return
      }

      if (!response.ok) {
        throw new Error(`Falha ao validar acesso administrativo (${response.status}).`)
      }

      setStatus('allowed')
    } catch (error) {
      console.error('[Admin Security] Falha ao validar autorização:', error)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    verify()
  }, [verify])

  if (status === 'allowed') return children

  if (status === 'denied') {
    return (
      <GateScreen
        title="Acesso não autorizado"
        message="Esta conta está autenticada no ecossistema, mas não possui autorização para o Admin Center. O acesso administrativo é restrito ao administrador principal e a usuários com perfil Super Admin."
        actionLabel="Voltar para Peter Tecnet"
        onAction={() => window.location.replace('/')}
      />
    )
  }

  if (status === 'error') {
    return (
      <GateScreen
        title="Validação indisponível"
        message="Por segurança, o Admin Center permanece bloqueado enquanto a autorização não puder ser confirmada pela API."
        actionLabel="Tentar novamente"
        onAction={verify}
      />
    )
  }

  return (
    <GateScreen
      title="Validando acesso"
      message="Confirmando sua autorização administrativa diretamente com a API Peter Tecnet."
      actionLabel="Voltar"
      onAction={() => window.location.replace('/')}
    />
  )
}
