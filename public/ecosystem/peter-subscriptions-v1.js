(() => {
  'use strict'

  const VERSION = '1.0.0'
  const ELEMENT_NAME = 'peter-subscription-gate'
  const TOKEN_KEYS = ['petertecnet_admin_token', 'petertecnet_token', 'token', 'access_token', 'auth_token']
  const API_FALLBACK = 'https://api.petertecnet.com.br/api'
  const SYNC_MS = 3000

  if (window.PeterTecnetSubscriptions?.version === VERSION && customElements.get(ELEMENT_NAME)) return

  const getToken = () => TOKEN_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || null
  const cleanSlug = value => String(value || '').trim().toLowerCase()
  const messageOf = (payload, fallback) => payload?.message || payload?.error || fallback

  class PeterSubscriptionGate extends HTMLElement {
    static get observedAttributes() { return ['api-base', 'app-slug'] }

    constructor() {
      super()
      this.attachShadow({ mode: 'open' })
      this.api = API_FALLBACK
      this.slug = ''
      this.token = null
      this.access = null
      this.catalog = null
      this.open = false
      this.loading = false
      this.checkoutPlan = ''
      this.error = ''
      this.interval = null
      this.boundSync = () => this.sync()
      this.boundFocus = () => this.sync(true)
    }

    connectedCallback() {
      this.configure()
      this.start()
      this.sync(true)
    }

    disconnectedCallback() {
      this.stop()
    }

    attributeChangedCallback() {
      if (!this.isConnected) return
      this.configure()
      this.sync(true)
    }

    configure() {
      this.api = String(this.getAttribute('api-base') || API_FALLBACK).replace(/\/+$/, '')
      this.slug = cleanSlug(this.getAttribute('app-slug'))
    }

    start() {
      window.addEventListener('storage', this.boundSync)
      window.addEventListener('authChanged', this.boundSync)
      window.addEventListener('peter:auth-changed', this.boundSync)
      window.addEventListener('focus', this.boundFocus)
      this.interval = window.setInterval(this.boundSync, SYNC_MS)
    }

    stop() {
      window.removeEventListener('storage', this.boundSync)
      window.removeEventListener('authChanged', this.boundSync)
      window.removeEventListener('peter:auth-changed', this.boundSync)
      window.removeEventListener('focus', this.boundFocus)
      if (this.interval) window.clearInterval(this.interval)
    }

    async sync(force = false) {
      const token = getToken()
      if (!force && token === this.token && this.access) return
      this.token = token
      this.error = ''

      if (!this.token || !this.slug) {
        this.access = null
        this.render()
        return
      }

      this.loading = true
      this.render()
      try {
        const headers = { Accept: 'application/json', Authorization: `Bearer ${this.token}`, 'X-Peter-App': this.slug }
        const [accessResponse, catalogResponse] = await Promise.all([
          fetch(`${this.api}/subscriptions/access/${encodeURIComponent(this.slug)}`, { cache: 'no-store', headers }),
          fetch(`${this.api}/subscriptions/catalog`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
        ])
        const accessPayload = await accessResponse.json().catch(() => ({}))
        const catalogPayload = await catalogResponse.json().catch(() => ({}))

        if (!accessResponse.ok) {
          if (accessResponse.status === 404) {
            this.access = { billing: 'free', has_access: true, access_mode: 'free' }
            this.catalog = catalogPayload
            this.render()
            return
          }
          throw new Error(messageOf(accessPayload, 'Não foi possível verificar sua assinatura.'))
        }

        this.access = accessPayload
        this.catalog = catalogResponse.ok ? catalogPayload : this.catalog
      } catch (error) {
        this.error = error?.message || 'Não foi possível verificar sua assinatura.'
      } finally {
        this.loading = false
        this.render()
      }
    }

    plans() {
      return Array.isArray(this.catalog?.plans) ? this.catalog.plans : []
    }

    async checkout(planKey) {
      if (!this.token || this.checkoutPlan) return
      this.checkoutPlan = planKey
      this.error = ''
      this.render()

      try {
        const back = new URL(window.location.href)
        back.searchParams.delete('peter_sso')
        back.searchParams.delete('peter_from')
        back.searchParams.set('subscription_return', '1')

        const response = await fetch(`${this.api}/subscriptions/checkout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
            'X-Peter-App': this.slug,
          },
          body: JSON.stringify({
            application: this.slug,
            plan: planKey,
            return_url: back.toString(),
          }),
        })

        const payload = await response.json().catch(() => ({}))

        if (response.status === 409) {
          await this.sync(true)
          this.open = false
          this.render()
          return
        }

        if (!response.ok || !payload?.checkout_url) {
          throw new Error(messageOf(payload, 'Não foi possível abrir o checkout do Mercado Pago.'))
        }

        window.location.assign(payload.checkout_url)
      } catch (error) {
        this.error = error?.message || 'Não foi possível iniciar a assinatura.'
        this.checkoutPlan = ''
        this.render()
      }
    }

    formatMoney(value) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    }

    bind() {
      const root = this.shadowRoot
      root.querySelector('.premium-pill')?.addEventListener('click', () => {
        this.open = true
        this.render()
      })
      root.querySelector('.close')?.addEventListener('click', () => {
        if (this.access?.access_mode === 'optional') {
          this.open = false
          this.render()
        }
      })
      root.querySelectorAll('[data-plan]').forEach(button => {
        button.addEventListener('click', () => this.checkout(button.dataset.plan))
      })
      root.querySelector('.retry')?.addEventListener('click', () => this.sync(true))
    }

    render() {
      if (!this.shadowRoot) return

      if (!this.token || !this.slug || this.access?.billing !== 'subscription') {
        this.shadowRoot.innerHTML = ''
        return
      }

      const optional = this.access?.access_mode === 'optional'
      const hasAccess = this.access?.has_access === true
      const hasSubscription = Boolean(this.access?.subscription)
      const shouldShowPlans = optional ? (this.open && !hasSubscription) : !hasAccess

      if ((!optional && hasAccess) || (optional && hasSubscription)) {
        this.shadowRoot.innerHTML = ''
        return
      }

      const plans = this.plans()
      const annual = plans.find(plan => plan.key === 'annual')
      const monthly = plans.find(plan => plan.key === 'monthly')
      const semiannual = plans.find(plan => plan.key === 'semiannual')
      const ordered = [monthly, semiannual, annual].filter(Boolean)

      this.shadowRoot.innerHTML = `${this.styles()}
        ${optional && !hasSubscription && !this.open ? '<button class="premium-pill" type="button">Conhecer Premium</button>' : ''}
        ${shouldShowPlans ? `<div class="backdrop ${optional ? 'optional' : 'required'}">
          <section class="card" role="dialog" aria-modal="${optional ? 'false' : 'true'}" aria-label="Planos Peter Tecnet">
            ${optional ? '<button class="close" type="button" aria-label="Fechar">×</button>' : ''}
            <div class="brand">PETER TECNET</div>
            <h2>${optional ? 'Desbloqueie recursos Premium' : 'Escolha seu plano para continuar'}</h2>
            <p class="lead">Pagamento seguro pelo Mercado Pago com Pix ou cartão.</p>
            ${this.error ? `<div class="error">${this.escape(this.error)} <button class="retry" type="button">Tentar novamente</button></div>` : ''}
            ${this.loading && !plans.length ? '<div class="loading">Carregando planos…</div>' : ''}
            <div class="plans">
              ${ordered.map(plan => {
                const isAnnual = plan.key === 'annual'
                const perMonth = isAnnual ? Number(plan.amount) / 12 : plan.key === 'semiannual' ? Number(plan.amount) / 6 : Number(plan.amount)
                return `<article class="plan ${isAnnual ? 'featured' : ''}">
                  ${isAnnual ? '<span class="badge">1º mês grátis</span>' : ''}
                  <h3>${this.escape(plan.name)}</h3>
                  <strong>${this.escape(this.formatMoney(plan.amount))}</strong>
                  <small>${plan.key === 'monthly' ? 'por mês' : `${this.escape(this.formatMoney(perMonth))}/mês equivalente`}</small>
                  <button data-plan="${this.escape(plan.key)}" type="button" ${this.checkoutPlan ? 'disabled' : ''}>${this.checkoutPlan === plan.key ? 'Abrindo checkout…' : isAnnual ? 'Começar grátis' : 'Assinar'}</button>
                </article>`
              }).join('')}
            </div>
            <p class="foot">Cancele quando quiser. A cobrança recorrente e as tentativas automáticas são processadas pelo Mercado Pago.</p>
          </section>
        </div>` : ''}`
      this.bind()
    }

    escape(value) {
      return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
    }

    styles() {
      return `<style>
        :host{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0b1830}
        *{box-sizing:border-box}.premium-pill{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));z-index:2147482500;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:11px 16px;font-weight:800;box-shadow:0 12px 30px rgba(2,12,27,.24);cursor:pointer}.backdrop{position:fixed;inset:0;z-index:2147482400;display:grid;place-items:center;padding:22px;background:rgba(2,8,23,.78);backdrop-filter:blur(10px)}.backdrop.optional{background:rgba(2,8,23,.58)}.card{width:min(920px,100%);max-height:calc(100vh - 44px);overflow:auto;background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid rgba(255,255,255,.75);border-radius:28px;padding:30px;box-shadow:0 30px 90px rgba(2,8,23,.4);position:relative}.close{position:absolute;right:18px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:#eef3f8;font-size:26px;cursor:pointer}.brand{font-size:11px;letter-spacing:.18em;font-weight:900;color:#2563eb}.card h2{margin:8px 0 6px;font-size:clamp(25px,4vw,38px);line-height:1.05}.lead{margin:0 0 22px;color:#64748b}.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.plan{border:1px solid #dbe5f0;background:#fff;border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:8px;position:relative}.plan.featured{border-color:#2563eb;box-shadow:0 14px 34px rgba(37,99,235,.14)}.badge{position:absolute;right:14px;top:14px;background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900}.plan h3{margin:0;font-size:16px}.plan strong{font-size:29px;line-height:1}.plan small{color:#64748b;min-height:28px}.plan button{margin-top:10px;border:0;border-radius:12px;background:#0f172a;color:#fff;min-height:44px;font-weight:800;cursor:pointer}.plan.featured button{background:#2563eb}.plan button:disabled{opacity:.62;cursor:wait}.error{margin:0 0 16px;border-radius:12px;padding:11px 12px;background:#fff1f2;color:#9f1239;font-size:12px}.error button{border:0;background:transparent;color:inherit;font-weight:900;cursor:pointer}.loading{padding:24px;text-align:center;color:#64748b}.foot{margin:18px 0 0;color:#64748b;font-size:11px;text-align:center}
        @media(max-width:760px){.backdrop{align-items:end;padding:0}.card{width:100%;max-height:88vh;border-radius:26px 26px 0 0;padding:24px 18px calc(22px + env(safe-area-inset-bottom))}.plans{grid-template-columns:1fr}.plan{padding:17px}.plan strong{font-size:25px}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
      </style>`
    }
  }

  if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, PeterSubscriptionGate)
  window.PeterTecnetSubscriptions = Object.freeze({ version: VERSION, element: ELEMENT_NAME })
})()
