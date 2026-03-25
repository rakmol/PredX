import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#050A14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0D1526', border: '1px solid #EF4444', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%' }}>
            <h2 style={{ color: '#EF4444', margin: '0 0 12px', fontSize: '18px' }}>Something went wrong</h2>
            <pre style={{ color: '#CBD5E1', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
