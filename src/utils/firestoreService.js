import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── helpers ────────────────────────────────────────────────
export const toDate = (v) =>
  v instanceof Timestamp ? v.toDate() : v ? new Date(v) : null;

const col = (path) => collection(db, path);

// ─── TEA PLANTATION ─────────────────────────────────────────
export const teaService = {
  async getTransactions(year) {
    const q = year
      ? query(col('tea_transactions'), where('year', '==', year), orderBy('date', 'desc'))
      : query(col('tea_transactions'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const d = new Date(data.date);
    return addDoc(col('tea_transactions'), {
      ...data,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      createdAt: Timestamp.now(),
    });
  },
  async update(id, data) {
    const d = new Date(data.date);
    return updateDoc(doc(db, 'tea_transactions', id), {
      ...data,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  },
  async delete(id) { return deleteDoc(doc(db, 'tea_transactions', id)); },
};

// ─── PROPERTIES ─────────────────────────────────────────────
export const propertyService = {
  async getAll() {
    const snap = await getDocs(col('properties'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data)       { return addDoc(col('properties'), { ...data, createdAt: Timestamp.now() }); },
  async update(id, data){ return updateDoc(doc(db, 'properties', id), data); },
  async delete(id)      { return deleteDoc(doc(db, 'properties', id)); },
};

// ─── TENANTS ────────────────────────────────────────────────
export const tenantService = {
  async getAll() {
    const snap = await getDocs(col('tenants'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByProperty(propertyId) {
    const q = query(col('tenants'), where('propertyId', '==', propertyId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data)       { return addDoc(col('tenants'), { ...data, createdAt: Timestamp.now() }); },
  async update(id, data){ return updateDoc(doc(db, 'tenants', id), data); },
  async delete(id)      { return deleteDoc(doc(db, 'tenants', id)); },
};

// ─── LEASES ─────────────────────────────────────────────────
export const leaseService = {
  async getAll() {
    const snap = await getDocs(col('leases'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data)       { return addDoc(col('leases'), { ...data, createdAt: Timestamp.now() }); },
  async update(id, data){ return updateDoc(doc(db, 'leases', id), data); },
  async delete(id)      { return deleteDoc(doc(db, 'leases', id)); },
};

// ─── RENTAL TRANSACTIONS (income / expense) ──────────────────
export const rentalService = {
  async getTransactions(year) {
    const q = year
      ? query(col('rental_transactions'), where('year', '==', year), orderBy('date', 'desc'))
      : query(col('rental_transactions'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const d = new Date(data.date);
    return addDoc(col('rental_transactions'), {
      ...data,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      createdAt: Timestamp.now(),
    });
  },
  async update(id, data) {
    const d = new Date(data.date);
    return updateDoc(doc(db, 'rental_transactions', id), {
      ...data,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  },
  async delete(id) { return deleteDoc(doc(db, 'rental_transactions', id)); },
};
