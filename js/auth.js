import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function registerUser(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    email,
    displayName: displayName || email.split("@")[0],
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password).then(cred => cred.user);
}

export function logoutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// 把 Firebase 的英文錯誤代碼轉成中文，比較好懂
export function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "這個 email 已經被註冊過了",
    "auth/invalid-email": "email 格式不正確",
    "auth/weak-password": "密碼至少需要 6 個字元",
    "auth/user-not-found": "找不到這個帳號",
    "auth/wrong-password": "密碼錯誤",
    "auth/invalid-credential": "email 或密碼錯誤",
    "auth/too-many-requests": "嘗試太多次了，請稍後再試"
  };
  return map[err.code] || err.message;
}
