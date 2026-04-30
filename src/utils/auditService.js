/**
 * auditService.js — src/utils/auditService.js
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';

export async function logAudit(action, collectionName, summary) {
  try {
    const auth        = getAuth();
    const currentUser = auth.currentUser;
    const entry = {
      action,
      collection: collectionName,
      summary:    summary || '',
      userId:     currentUser?.uid   || 'unknown',
      userEmail:  currentUser?.email || 'unknown',
      timestamp:  serverTimestamp(),
    };
    await addDoc(collection(db, 'audit_log'), entry);
  } catch (e) {
    // Log to console so we can debug without breaking the UI
    console.error('[AuditLog] Failed to write:', action, collectionName, e.code, e.message);
  }
}
