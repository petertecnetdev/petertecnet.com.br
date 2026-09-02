import { useEffect, useMemo, useState } from 'react'
import './AccountAccessPage.css'

const API = 'https://api.petertecnet.com.br/api'

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validation = Object.values(data?.errors || {}).flat().filter(Boolean)
    throw new Error(validation[0] || data?.message || data?.error || 'Não foi possível concluir a operação.')
  }

  return data
}

function safeAppUrl(raw) {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:') return 'https://petertecnet.com.br'
    if (host === 'petertecnet.com.br' || host.endsWith('.petertecnet.com.br')) {
      return url.toString()
    }
  } catch {
    // fallback below
  }
  return 'https://petertecnet.com.br'
}

function AccountShell({ eyebrow, title, description, children }) {
  return (
    <main className="account-access-page">
      <section className="account-access-card">
        <header className="account-access-brand">
          <img src="/petertecnetlogo.png" alt="Peter Tecnet" />
          <div>
            <strong>Peter Tecnet</strong>
            <span>Conta do ecossistema</span>
          </div>
        </header>

        <div className="account-access-heading">
          <span className="account-access-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>

        {children}
      </section>
    </main>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="account-access-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function ActivationPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', [])
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [activatedApplication, setActivatedApplication] = useState(null)

  useEffect(() => {
    document.title = 'Ativar conta | Peter Tecnet'

    if (!token) {
      setError('Este link de ativação não possui um token válido. Solicite um novo convite.')
      setLoading(false)
      return
    }

    let active = true
    apiRequest(`/auth/invitations/${encodeURIComponent(token)}`)
      .then((data) => {
        if (active) setInvitation(data)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      const result = await apiRequest(`/auth/invitations/${encodeURIComponent(token)}/activate`, {
        method: 'POST',
        body: JSON.stringify({
          verification_code: code.trim().toUpperCase(),
          password,
          password_confirmation: confirmation,
        }),
      })
      setActivatedApplication(result.application)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (activatedApplication) {
    return (
      <AccountShell
        eyebrow="Acesso liberado"
        title="Conta ativada com sucesso"
        description="Seu e-mail foi validado e sua nova senha já está valendo."
      >
        <div className="account-access-success">
          <div className="account-access-success-icon">✓</div>
          <p>
            O acesso ao <strong>{activatedApplication.name}</strong> está pronto.
          </p>
          <a className="account-access-primary" href={safeAppUrl(activatedApplication.url)}>
            Acessar {activatedApplication.name}
          </a>
        </div>
      </AccountShell>
    )
  }

  return (
    <AccountShell
      eyebrow="Primeiro acesso"
      title="Ative sua conta"
      description={invitation?.application?.name
        ? `Valide seu e-mail e crie sua senha para acessar ${invitation.application.name}.`
        : 'Valide seu e-mail e crie sua senha para acessar o ecossistema Peter Tecnet.'}
    >
      {loading ? (
        <div className="account-access-status">Validando o convite...</div>
      ) : invitation ? (
        <form className="account-access-form" onSubmit={submit}>
          <Field label="E-mail">
            <input type="email" value={invitation.email || ''} readOnly />
          </Field>

          <Field label="Código de verificação" hint="Digite o código que foi enviado no mesmo e-mail do convite.">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="one-time-code"
              maxLength={12}
              required
              className="account-access-code"
              placeholder="Ex.: A7K9P2QX"
            />
          </Field>

          <Field label="Nova senha">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <Field
            label="Confirmar nova senha"
            hint="Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo."
          >
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          {error && <div className="account-access-error">{error}</div>}

          <button className="account-access-primary" type="submit" disabled={submitting}>
            {submitting ? 'Validando e salvando...' : 'Validar e criar minha senha'}
          </button>
        </form>
      ) : (
        <div className="account-access-error account-access-error-static">{error}</div>
      )}

      <div className="account-access-footer-link">
        Já possui uma conta? <a href="/account/password/reset">Redefinir minha senha</a>
      </div>
    </AccountShell>
  )
}

function PasswordResetPage() {
  const initialEmail = useMemo(() => new URLSearchParams(window.location.search).get('email') || '', [])
  const [email, setEmail] = useState(initialEmail)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Redefinir senha | Peter Tecnet'
  }, [])

  async function requestCode(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const result = await apiRequest('/auth/password-email', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setCodeSent(true)
      setMessage(result.message || 'Se o e-mail estiver cadastrado, o código foi enviado.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const result = await apiRequest('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          reset_password_code: code.trim().toUpperCase(),
          password,
        }),
      })
      setMessage(result.message || 'Senha redefinida com sucesso.')
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AccountShell
      eyebrow="Segurança da conta"
      title="Redefinir sua senha"
      description="Solicite um código no seu e-mail e escolha uma nova senha para sua conta Peter Tecnet."
    >
      {done ? (
        <div className="account-access-success">
          <div className="account-access-success-icon">✓</div>
          <p>{message}</p>
          <a className="account-access-primary" href="/">Voltar para Peter Tecnet</a>
        </div>
      ) : !codeSent ? (
        <form className="account-access-form" onSubmit={requestCode}>
          <Field label="E-mail da conta">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="voce@exemplo.com"
            />
          </Field>

          {error && <div className="account-access-error">{error}</div>}
          {message && <div className="account-access-info">{message}</div>}

          <button className="account-access-primary" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar código de redefinição'}
          </button>
        </form>
      ) : (
        <form className="account-access-form" onSubmit={resetPassword}>
          <Field label="E-mail">
            <input type="email" value={email} readOnly />
          </Field>

          <Field label="Código de redefinição">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="one-time-code"
              maxLength={16}
              required
              className="account-access-code"
            />
          </Field>

          <Field label="Nova senha">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <Field
            label="Confirmar nova senha"
            hint="Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo."
          >
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          {error && <div className="account-access-error">{error}</div>}
          {message && <div className="account-access-info">{message}</div>}

          <button className="account-access-primary" type="submit" disabled={loading}>
            {loading ? 'Alterando senha...' : 'Validar código e alterar senha'}
          </button>

          <button
            className="account-access-secondary"
            type="button"
            onClick={() => {
              setCodeSent(false)
              setCode('')
              setError('')
              setMessage('')
            }}
          >
            Usar outro e-mail
          </button>
        </form>
      )}

      <div className="account-access-footer-link">
        Recebeu um convite? Use o botão de ativação que chegou no seu e-mail.
      </div>
    </AccountShell>
  )
}

export default function AccountAccessPage() {
  if (window.location.pathname.replace(/\/+$/, '') === '/account/password/reset') {
    return <PasswordResetPage />
  }

  return <ActivationPage />
}
