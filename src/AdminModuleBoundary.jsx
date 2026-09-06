import { Component } from 'react'

export default class AdminModuleBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[Admin Center] Falha no módulo ${this.props.name || 'desconhecido'}`, error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div className="admin-module-error" role="alert">
      <div><small>MÓDULO ISOLADO</small><h3>{this.props.name || 'Este módulo'} encontrou um erro.</h3><p>O restante do Admin Center continua disponível.</p></div>
      <button type="button" onClick={() => this.setState({ error: null })}>Tentar renderizar novamente ↻</button>
    </div>
  }
}
