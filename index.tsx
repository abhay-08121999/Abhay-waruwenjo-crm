import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './lib/auth.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import './index.css';

console.log('Application starting...');

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('FATAL: Could not find root element');
  throw new Error("Could not find root element to mount to");
}

try {
  console.log('Creating React Root...');
  const root = ReactDOM.createRoot(rootElement);
  console.log('Rendering App...');
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
  console.log('Render command issued');
} catch (error) {
  console.error('FATAL: Error during render:', error);
}