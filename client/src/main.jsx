import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', background: '#1a1a1a', color: '#fff', fontSize: '14px' },
          success: { style: { background: '#1A6B1A' } },
          error: { style: { background: '#dc2626' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
