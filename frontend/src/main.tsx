import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/query-client';
import { App } from './app/App';
import './styles.css';
import { startPwa } from './pwa/client';

const root = document.getElementById('root');
if (!root) throw new Error('Le point de montage de l’application est introuvable.');
void startPwa();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
