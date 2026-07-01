import { db, auth } from "./firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, updateDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// record: { title, amount, date, isPublic }
export function addPersonalRecord(tripId, record) {
  const uid = auth.currentUser.uid;
  return addDoc(collection(db, "trips", tripId, "personalRecords"), {
    ...record,
    userId: uid
  });
}

export async function getMyRecords(tripId) {
  const uid = auth.currentUser.uid;
  const q = query(collection(db, "trips", tripId, "personalRecords"), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPublicRecordsOfMember(tripId, memberUid) {
  const q = query(
    collection(db, "trips", tripId, "personalRecords"),
    where("userId", "==", memberUid),
    where("isPublic", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function togglePublic(tripId, recordId, isPublic) {
  return updateDoc(doc(db, "trips", tripId, "personalRecords", recordId), { isPublic });
}

export function deletePersonalRecord(tripId, recordId) {
  return deleteDoc(doc(db, "trips", tripId, "personalRecords", recordId));
}
