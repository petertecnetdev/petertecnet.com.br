(() => {
  const TAG = 'pt-processing-indicator'
  if (customElements.get(TAG)) return

  const DEFAULT_MESSAGES = [
    'Conectando as soluções do ecossistema Peter Tecnet…',
    'Organizando produtos, serviços e experiências para você…',
    'Sincronizando informações com a API central…',
    'Preparando uma experiência mais rápida e inteligente…',
    'Quase lá — alinhando os últimos detalhes da página…',
  ]

  class PeterProcessingIndicator extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === 'true') return
      this.dataset.ready = 'true'
      this._index = 0
      this._messages = (this.getAttribute('messages') || '')
        .split('|')
        .map(value => value.trim())
        .filter(Boolean)
      if (!this._messages.length) this._messages = DEFAULT_MESSAGES

      const screen = this.hasAttribute('screen')
      const compact = this.hasAttribute('compact')
      const title = this.getAttribute('title') || 'Preparando a Peter Tecnet'
      const eyebrow = this.getAttribute('eyebrow') || 'PETER TECNET · PROCESSANDO'

      this.innerHTML = `
        <div class="pt-processing${screen ? ' pt-processing--screen' : ''}${compact ? ' pt-processing--compact' : ''}" role="status" aria-live="polite" aria-busy="true">
          ${screen ? '<div class="pt-processing__grid" aria-hidden="true"></div>' : ''}
          <div class="pt-processing__card">
            <div class="pt-processing__visual" aria-hidden="true">
              <span class="pt-processing__orbit"></span>
              <span class="pt-processing__pulse"></span>
              <img class="pt-processing__logo" src="/petertecnetlogo.png" alt="" decoding="async" fetchpriority="high" />
            </div>
            <p class="pt-processing__eyebrow">${this._escape(eyebrow)}</p>
            <strong class="pt-processing__title">${this._escape(title)}</strong>
            <p class="pt-processing__message">${this._escape(this._messages[0])}</p>
            <div class="pt-processing__bar" aria-hidden="true"></div>
            <div class="pt-processing__status"><span class="pt-processing__dot"></span><span>experiência em preparação</span></div>
          </div>
        </div>`

      this._messageNode = this.querySelector('.pt-processing__message')
      if (this._messages.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this._timer = window.setInterval(() => this._nextMessage(), 2100)
      }
    }

    disconnectedCallback() {
      if (this._timer) window.clearInterval(this._timer)
      this._timer = null
    }

    _nextMessage() {
      if (!this._messageNode || !this.isConnected) return
      this._messageNode.classList.add('is-changing')
      window.setTimeout(() => {
        if (!this._messageNode || !this.isConnected) return
        this._index = (this._index + 1) % this._messages.length
        this._messageNode.textContent = this._messages[this._index]
        this._messageNode.classList.remove('is-changing')
      }, 220)
    }

    _escape(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
    }
  }

  customElements.define(TAG, PeterProcessingIndicator)

  const upgradeLegacyStates = () => {
    document.querySelectorAll('.mkt-state:not([data-pt-processing-upgraded])').forEach(node => {
      const text = node.textContent?.trim() || ''
      if (!/carregando|consultando|buscando|preparando/i.test(text)) return
      node.dataset.ptProcessingUpgraded = 'true'
      const indicator = document.createElement(TAG)
      indicator.setAttribute('compact', '')
      indicator.setAttribute('title', 'Carregando conteúdo')
      indicator.setAttribute('messages', `${text}|Conectando os dados da Peter Tecnet…|Só mais um instante — estamos organizando tudo para você…`)
      node.replaceChildren(indicator)
    })
  }

  const observer = new MutationObserver(upgradeLegacyStates)
  const start = () => {
    upgradeLegacyStates()
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
