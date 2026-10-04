import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import {prepareOffline} from './offline';
import { reloadForUpdate } from './language/reload';
// A page that outlived its build asks for code files the server no longer has; loading it again gets the current build, once.
window.addEventListener('vite:preloadError', event => { if (reloadForUpdate()) event.preventDefault(); });
void prepareOffline().catch(()=>{/* The workspace remains usable if offline provisioning is unavailable. */});
/** ?ui=kit shows the shared primitives for review and ?ui=photo the labelled photo; each loads only when asked for. */
const Kit = lazy(() => import('./ui/Kit'));
const PhotoDemo = lazy(() => import('./photo/PhotoDemo'));
const ui = new URLSearchParams(location.search).get('ui');
createRoot(document.getElementById('root')!).render(<React.StrictMode>{ui === 'kit' ? <Suspense fallback={null}><Kit /></Suspense> : ui === 'photo' ? <Suspense fallback={null}><PhotoDemo /></Suspense> : <App />}</React.StrictMode>);
