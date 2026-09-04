import { useEffect, useState } from 'react'

const API = 'https://api.petertecnet.com.br/api'
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

function findEmail(element) {
  return element?.textContent?.match(EMAIL_RE)?.[0] || ''
}

function makeButton(email, onSend) {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.resendUserEmail = email
  button.textContent = 'Reenviar e-mail'
  button.title = `Reenviar comunicação para ${email}`
  button.style.whiteSpace = 'nowrap'
  button.addEventListener('click', () => onSend(email, button))
  return button
}

export default function AdminUserEmailBridge() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let noticeTimer

    const showNotice = (message, type = 'success') => {
      setNotice({ message, type })
      window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => setNotice(null), 5000)
    }

    const resend = async (email, button) => {
      if (!email || button.disabled) return
      if (!window.confirm(`Reenviar o e-mail de acesso para ${email}?`)) return

      const previous = button.textContent
      button.disabled = true
      button.textContent = 'Enviando...'

      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API}/admin/ecosystem/users/resend-email`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ email }),
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Não foi possível reenviar o e-mail.')
        }

        button.textContent = 'E-mail enviado ✓'
        showNotice(data?.message || `E-mail reenviado para ${email}.`)
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = previous
        }, 3500)
      } catch (error) {
        button.textContent = previous
        showNotice(error.message, 'error')
      } finally {
        button.disabled = false
      }
    }

    const decorate = () => {
      document.querySelectorAll('.user-card').forEach(card => {
        if (card.querySelector('[data-resend-user-email]')) return
        const email = findEmail(card)
        if (!email) return
        const actions = card.querySelector('.user-head > div:last-child')
        if (!actions) return
        actions.insertBefore(makeButton(email, resend), actions.querySelector('.danger'))
      })

      const hero = document.querySelector('.user-hero')
      if (hero && !hero.querySelector('[data-resend-user-email]')) {
        const email = findEmail(hero)
        if (email) {
          const button = makeButton(email, resend)
          button.style.marginLeft = 'auto'
          button.style.alignSelf = 'center'
          hero.appendChild(button)
        }
      }
    }

    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    decorate()

    return () => {
      observer.disconnect()
      window.clearTimeout(noticeTimer)
    }
  }, [])

  if (!notice) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 99999,
        maxWidth: 420,
        padding: '14px 18px',
        borderRadius: 12,
        background: notice.type === 'error' ? '#501b24' : '#123d32',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0,0,0,.35)',
      }}
    >
      {notice.message}
    </div>
  )
}
