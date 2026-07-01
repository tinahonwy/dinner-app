import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, getDocs, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// expense: { payerId, amount, title, date, splitWith: [uid...], splitType: 'equal'|'custom', customSplits: {uid: amount} }
export function addExpense(tripId, expense) {
  return addDoc(collection(db, "trips", tripId, "expenses"), expense);
}

export async function getExpenses(tripId) {
  const q = query(collection(db, "trips", tripId, "expenses"), orderBy("date"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function deleteExpense(tripId, expenseId) {
  return deleteDoc(doc(db, "trips", tripId, "expenses", expenseId));
}

// 計算每個人的「淨餘額」：正值代表別人要付給他，負值代表他要付給別人
export function calculateBalances(expenses, members) {
  const balance = {};
  members.forEach(m => (balance[m.uid] = 0));

  expenses.forEach(exp => {
    const { payerId, amount, splitWith, splitType, customSplits } = exp;
    balance[payerId] = (balance[payerId] || 0) + amount;

    if (splitType === "custom" && customSplits) {
      Object.entries(customSplits).forEach(([uid, share]) => {
        balance[uid] = (balance[uid] || 0) - Number(share);
      });
    } else {
      const share = amount / splitWith.length;
      splitWith.forEach(uid => {
        balance[uid] = (balance[uid] || 0) - share;
      });
    }
  });
  return balance;
}

// 把淨餘額簡化成「誰要付給誰多少錢」的最少交易清單
export function simplifyDebts(balance) {
  const creditors = [];
  const debtors = [];
  Object.entries(balance).forEach(([uid, amt]) => {
    const rounded = Math.round(amt * 100) / 100;
    if (rounded > 0.5) creditors.push({ uid, amt: rounded });
    else if (rounded < -0.5) debtors.push({ uid, amt: -rounded });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transactions.push({ from: debtors[i].uid, to: creditors[j].uid, amount: Math.round(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.5) i++;
    if (creditors[j].amt < 0.5) j++;
  }
  return transactions;
}
