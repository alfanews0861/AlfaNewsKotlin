
import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

// --- DOM PATCH TO PREVENT reCAPTCHA / REACT CRASHES ---
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  (Node.prototype as any).removeChild = function(child: Node) {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('Blocked an unauthorized removeChild call from 3rd party script (e.g. reCAPTCHA).');
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any);
  };
}



import './index.css'; 
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error boundary catch:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', backgroundColor: 'black', height: '100vh', overflow: 'auto', fontFamily: 'sans-serif', zIndex: 9999, position: 'relative' }}>
          <h1 style={{fontSize: '24px'}}>Something went wrong.</h1>
          <p>Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{marginTop: '10px', padding: '10px 20px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}
          >
            Refresh Page
          </button>
          <pre style={{ color: '#666', marginTop: '20px', whiteSpace: 'pre-wrap', fontSize: '11px', border: '1px solid #333', padding: '10px' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e: any) {
    console.error("Render error:", e);
    rootElement.innerHTML = `<div style="color:white; background:black; padding:20px;">Critical Failure: ${e.message}</div>`;
  }
};

// Start rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}
