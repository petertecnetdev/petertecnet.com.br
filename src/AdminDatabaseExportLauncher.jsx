import { useEffect, useState } from 'react'
import './AdminDatabaseExportLauncher.css'

const API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
const TOKEN_KEY = 'petertecnet_admin_token'

function filenameFrom(response) {
  const disposition = response.headers.get('Content-Disposition') || ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { /* use fallback below */ }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  if (plain) return plain
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `petertecnet-database-${stamp}.sql.gz`
}

async function errorMessage(response) {
  const payload = await response.json().catch(() => null)
  if (response.status === 429) return 'O limite de segurança foi atingido. Aguarde alguns minutos antes de gerar outro arquivo.'
  return payload?.message || payload?.error || 'Não foi possível gerar o SQL do banco.'
}

export default function AdminDatabaseExportLauncher() {
  const [visible, setVisible] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const update = () => {
      const authenticated = Boolean(localStorage.getItem(TOKEN_KEY))
      setVisible(authenticated)
      if (!authenticated) setOpen(false)
    }
    window.addEventListener('storage', update)
    window.addEventListener('admin-session-expired', update)
    const timer = window.setInterval(update, 1200)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('admin-session-expired', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape' && !busy) setOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, busy])

  async function download() {
    if (busy) return
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setError('Sua sessão administrativa expirou. Entre novamente.')
      setVisible(false)
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${API}/admin/ecosystem/database/export`, {
        method: 'POST',
        headers: {
          Accept: 'application/gzip, application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY)
        window.dispatchEvent(new Event('admin-session-expired'))
      }
      if (!response.ok) throw new Error(await errorMessage(response))

      const blob = await response.blob()
      if (!blob.size) throw new Error('A API retornou um arquivo vazio. O download foi cancelado por segurança.')

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filenameFrom(response)
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      setSuccess(`Backup pronto: ${anchor.download}. Guarde este arquivo em um local privado.`)
    } catch (err) {
      setError(err?.message || 'Não foi possível gerar o SQL do banco.')
    } finally {
      setBusy(false)
    }
  }

  if (!visible || window.location.pathname.replace(/\/+$/, '') === '/support') return null

  return <>
    <button className="admin-db-export-launcher" type="button" onClick={() => { setOpen(true); setError(''); setSuccess('') }} aria-label="Baixar backup SQL do banco">
      <span aria-hidden="true">⇩</span><b>Backup SQL</b>
    </button>

    {open && <div className="admin-db-export-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false) }}>
      <section className="admin-db-export-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-db-export-title">
        <button className="admin-db-export-close" type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Fechar">×</button>
        <div className="admin-db-export-icon" aria-hidden="true">DB</div>
        <p className="admin-db-export-eyebrow">RECOVERY / MANUAL EXPORT</p>
        <h2 id="admin-db-export-title">Baixar SQL do banco</h2>
        <p>Gera uma cópia consistente do banco de produção e inicia o download para este computador em <strong>.sql.gz</strong>.</p>

        <div className="admin-db-export-security">
          <div><b>Privado</b><span>somente sua sessão de super administrador</span></div>
          <div><b>Temporário</b><span>o arquivo da VPS é removido após o envio</span></div>
          <div><b>Validado</b><span>a integridade do arquivo é verificada antes do download</span></div>
        </div>

        <div className="admin-db-export-warning"><strong>Dados reais de produção.</strong> O arquivo baixado contém informações sensíveis. Não envie por mensageiros, não coloque em Git e mantenha-o em armazenamento protegido.</div>

        {error && <div className="admin-db-export-message error" role="alert">{error}</div>}
        {success && <div className="admin-db-export-message success" role="status">{success}</div>}

        <div className="admin-db-export-actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="primary" disabled={busy} onClick={download} aria-busy={busy}>
            {busy ? <><i className="admin-db-export-spinner"/> Gerando e validando…</> : <>⇩ Gerar e baixar SQL</>}
          </button>
        </div>
      </section>
    </div>}
  </>
}
