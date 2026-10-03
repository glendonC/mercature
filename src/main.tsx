import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import {prepareOffline} from './offline';
void prepareOffline().catch(()=>{/* The workspace remains usable if offline provisioning is unavailable. */});
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
