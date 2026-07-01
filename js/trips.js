import { db, auth } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function createTrip(name, startDate, endDate) {
  const uid = auth.currentUser.uid;
  const ref = await addDoc(collection(db, "trips"), {
    name,
    startDate,
    endDate,
    ownerId: uid,
    members: [uid],
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function joinTrip(tripId) {
  const uid = auth.currentUser.uid;
  const tripRef = doc(db, "trips", tripId.trim());
  const snap = await getDoc(tripRef);
  if (!snap.exists()) throw new Error("找不到這個行程代碼，請確認代碼是否正確");
  if (snap.data().members.includes(uid)) return snap.data();
  await updateDoc(tripRef, { members: arrayUnion(uid) });
  return snap.data();
}

export async function getMyTrips() {
  const uid = auth.currentUser.uid;
  const q = query(collection(db, "trips"), where("members", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTrip(tripId) {
  const snap = await getDoc(doc(db, "trips", tripId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTripMembers(trip) {
  const results = [];
  for (const uid of trip.members) {
    const snap = await getDoc(doc(db, "users", uid));
    results.push({
      uid,
      ...(snap.exists() ? snap.data() : { displayName: "未知使用者" })
    });
  }
  return results;
}
