import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { cloudinaryImageUrl } from './lib/cloudinaryAssets';
import './index.css';

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = cloudinaryImageUrl('brgy-san-andres-logo.avif');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
