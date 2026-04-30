/**
 * homeService.js
 * Firestore service for Home Maintenance & Maintenance tracking.
 * Collections:
 *   home_properties  — each house/property being renovated
 *   home_expenses    — individual expense entries per property
 */
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const col = (name) => collection(db, name);
const snap2arr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

export const HOME_CATEGORIES = [
  'Renovation', 'Structural Repair', 'Plumbing', 'Electrical',
  'Painting', 'Flooring', 'Roofing', 'Kitchen', 'Bathroom',
  'Furniture', 'Landscaping', 'Cleaning', 'Pest Control', 'Other',
];

// ── Properties ───────────────────────────────────────────────────────────────
export const homePropertyService = {
  async getAll() {
    const snap = await getDocs(col('home_properties'));
    return snap2arr(snap);
  },
  async add(data) {
    return addDoc(col('home_properties'), { ...data, createdAt: Timestamp.now() });
  },
  async update(id, data) {
    return updateDoc(doc(db, 'home_properties', id), data);
  },
  async delete(id) {
    return deleteDoc(doc(db, 'home_properties', id));
  },
};

// ── Expenses ─────────────────────────────────────────────────────────────────
export const homeExpenseService = {
  async getAll() {
    const snap = await getDocs(col('home_expenses'));
    return snap2arr(snap).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },
  async getAll() {
    const snap = await getDocs(col('home_expenses'));
    return snap2arr(snap).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },
  async getByYear(year) {
    const snap = await getDocs(
      query(col('home_expenses'), where('year', '==', year))
    );
    // sort in JS — avoids composite index requirement
    return snap2arr(snap).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },
  async add(data) {
    const d = new Date(data.date);
    return addDoc(col('home_expenses'), {
      ...data,
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      createdAt: Timestamp.now(),
    });
  },
  async update(id, data) {
    const d = new Date(data.date);
    return updateDoc(doc(db, 'home_expenses', id), {
      ...data,
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
    });
  },
  async delete(id) {
    return deleteDoc(doc(db, 'home_expenses', id));
  },
};
