import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './style.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('GoalRush crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          color: '#fff',
          fontFamily: 'Outfit, sans-serif',
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px' }}>⚽</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#e2ff4a' }}>GoalRush</h1>
          <p style={{ color: '#aaa', maxWidth: '480px', margin: '8px 0 0 0' }}>
            Something went wrong loading the app. This is usually a temporary network issue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #e2ff4a, #00ffaa)',
              color: '#0a0a1a',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
          <details style={{ color: '#555', fontSize: '12px', maxWidth: '600px', wordBreak: 'break-all' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>Error details</summary>
            <pre style={{ textAlign: 'left', marginTop: '8px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
