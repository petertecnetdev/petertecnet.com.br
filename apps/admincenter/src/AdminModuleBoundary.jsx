import { Component } from 'react'

export default class AdminModuleBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, revision: 0 }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[Admin Center] Falha isolada no módulo ${this.props.name || 'administrativo'}`, error, info)
  }

  retry = () => {
    this.setState(state => ({ error: null, revision: state.revision + 1 }))
  }

  render() {
    if (this.state.error) {
      return <section className="admin-module-error" role="alert">
        <div className="admin-module-error-icon">!</div>
        <div>
          <small>MÓDULO ISOLADO</small>
          <h3>{this.props.name || 'Área administrativa'} encontrou um problema</h3>
          <p>O restante do Admin Center continua disponível. Tente carregar somente esta área novamente.</p>
          <button type="button" onClick={this.retry}>Tentar novamente</button>
        </div>
      </section>
    }

    return <div key={this.state.revision}>{this.props.children}</div>
  }
}
