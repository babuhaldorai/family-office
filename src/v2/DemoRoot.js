// The app running on made-up data held in memory. Used for local testing and
// for trying the screens safely; it never touches Firebase.
import React, { useMemo } from 'react';
import V2App from './App2';
import { createMemoryStore } from './data/memoryStore';
import { sampleData, SAMPLE_TODAY } from './core/sample';

export default function DemoRoot() {
  const empty = /[?&]empty=1/.test(window.location.search);
  const role = (window.location.search.match(/[?&]role=(\w+)/) || [])[1] || 'admin';
  const store = useMemo(() => createMemoryStore(empty ? {} : sampleData(), { by: 'you@example.com' }), [empty]);
  return <V2App store={store} user={{ uid: 'demo', email: 'you@example.com', displayName: 'You' }} role={role} demo fixedToday={SAMPLE_TODAY} />;
}
