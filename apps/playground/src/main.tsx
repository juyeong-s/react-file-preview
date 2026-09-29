import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ruby-s/react-file-preview/styles.css';
import { App } from './App';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
