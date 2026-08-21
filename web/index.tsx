
import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; 
import App from './App';

if (typeof window !== 'undefined') {
  // Prevent "Cannot set property fetch of #<Window> which has only a getter" error
  // Some third-party scripts or polyfills try to overwrite window.fetch
  const originalFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    value: originalFetch,
    writable: true,
    configurable: true
  });

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

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error(error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-600 bg-black h-screen font-sans">
          <h1 className="text-2xl font-bold">Something went wrong.</h1>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-red-600 text-white rounded">Refresh</button>
          <pre className="mt-6 p-4 border border-gray-800 text-xs overflow-auto">{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
}
