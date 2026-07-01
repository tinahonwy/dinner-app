import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, getDocs, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function addDay(tripId, date, title) {
  return addDoc(collection(db, "trips", tripId, "days"), { date, title });
}

export async function getDays(tripId) {
  const q = query(collection(db, "trips", tripId, "days"), orderBy("date"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function deleteDay(tripId, dayId) {
  return deleteDoc(doc(db, "trips", tripId, "days", dayId));
}

export function addItem(tripId, dayId, item) {
  // item: { time, title, note, link }
  return addDoc(collection(db, "trips", tripId, "days", dayId, "items"), item);
}

export async function getItems(tripId, dayId) {
  const q = query(collection(db, "trips", tripId, "days", dayId, "items"), orderBy("time"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function deleteItem(tripId, dayId, itemId) {
  return deleteDoc(doc(db, "trips", tripId, "days", dayId, "items", itemId));
}
