import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import {prepareOffline} from './offline';
void prepareOffline().catch(()=>{/* The workspace remains usable if offline provisioning is unavailable. */});
/** ?ui=kit shows the shared primitives for review; it loads only when asked for. */
const Kit = lazy(() => import('./ui/Kit'));
const kit = new URLSearchParams(location.search).get('ui') === 'kit';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{kit ? <Suspense fallback={null}><Kit /></Suspense> : <App />}</React.StrictMode>);
