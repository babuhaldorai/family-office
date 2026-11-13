import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { register } from './serviceWorkerRegistration';

// REACT_APP_DEMO=1 runs the new screens on made-up data held in memory, for
// local testing. It never loads Firebase. Normal builds load the real app.
const Root = process.env.REACT_APP_DEMO === '1'
  ? lazy(() => import('./v2/DemoRoot'))
  : lazy(() => import('./App'));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><Suspense fallback={null}><Root /></Suspense></React.StrictMode>);

// Lets the app open with no signal once it has been opened online.
if (process.env.REACT_APP_DEMO !== '1') register();
