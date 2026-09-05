import { Component } from 'react'

export default class AdminRouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
    this.retry = this.retry.bind(this)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[Peter Tecnet Admin Route]', error, info)
  }

  retry() {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="admin-stack" role="alert" aria-live="assertive">
        <section className="panel" style={{ maxWidth: 760 }}>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>
            ADMIN CENTER
          </p>
          <h2 style={{ marginBottom: 10 }}>Este módulo encontrou um problema temporário.</h2>
          <p style={{ marginTop: 0, opacity: 0.78 }}>
            O restante do painel continua disponível. Você pode tentar carregar este módulo novamente ou voltar ao início do Admin Center.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={this.retry}>
              Tentar novamente
            </button>
            <a className="btn btn-outline-secondary" href="/admin">
              Voltar ao início
            </a>
          </div>
        </section>
      </div>
    )
  }
}
