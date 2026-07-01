import { auth } from "./firebase-config.js";
import { registerUser, loginUser, logoutUser, watchAuthState, friendlyAuthError } from "./auth.js";
import { createTrip, joinTrip, getMyTrips, getTrip, getTripMembers } from "./trips.js";
import { addDay, getDays, deleteDay, addItem, getItems, deleteItem } from "./itinerary.js";
import { addExpense, getExpenses, deleteExpense, calculateBalances, simplifyDebts } from "./expenses.js";
import {
  addPersonalRecord, getMyRecords, getPublicRecordsOfMember,
  togglePublic, deletePersonalRecord
} from "./personal.js";

// ------------------------------------------------------------------
// 全域狀態
// ------------------------------------------------------------------
let currentUser = null;
let currentTrip = null;
let currentMembers = [];
let currentTab = "itinerary";

// ------------------------------------------------------------------
// DOM 參照
// ------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const authView = $("#authView");
const tripsView = $("#tripsView");
const tripDetailView = $("#tripDetailView");
const topBar = $("#topBar");
const topBarUserEmail = $("#topBarUserEmail");

// ------------------------------------------------------------------
// 共用小工具
// ------------------------------------------------------------------
function showView(view) {
  [authView, tripsView, tripDetailView].forEach(v => v.classList.add("hidden"));
  view.classList.remove("hidden");
}

function nameOf(uid) {
  const m = currentMembers.find(m => m.uid === uid);
  return m ? m.displayName : "未知成員";
}

function isMe(uid) {
  return currentUser && uid === currentUser.uid;
}

function fmt(n) {
  return Number(n).toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function showMessage(container, text, type = "error") {
  const el = document.createElement("div");
  el.className = `message ${type}`;
  el.textContent = text;
  container.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ==================================================================
// 認證畫面
// ==================================================================
let authMode = "login"; // 'login' | 'register'

function renderAuthView() {
  authView.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <h1>日本旅遊計畫</h1>
        <p class="subtitle">${authMode === "login" ? "登入你的帳號" : "建立新帳號"}</p>
        <div id="authMsgBox"></div>
        <form id="authForm">
          ${authMode === "register" ? `
          <div class="field">
            <label>暱稱</label>
            <input type="text" id="displayName" placeholder="大家會看到的名字" required />
          </div>` : ""}
          <div class="field">
            <label>Email</label>
            <input type="email" id="email" placeholder="you@example.com" required />
          </div>
          <div class="field">
            <label>密碼</label>
            <input type="password" id="password" placeholder="至少 6 個字元" minlength="6" required />
          </div>
          <button type="submit" class="btn btn-accent btn-block">
            ${authMode === "login" ? "登入" : "註冊"}
          </button>
        </form>
        <p class="auth-toggle">
          ${authMode === "login"
            ? `還沒有帳號？<a id="switchAuth">立即註冊</a>`
            : `已經有帳號了？<a id="switchAuth">前往登入</a>`}
        </p>
      </div>
    </div>
  `;

  $("#switchAuth").addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    renderAuthView();
  });

  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    try {
      if (authMode === "register") {
        const displayName = $("#displayName").value.trim();
        await registerUser(email, password, displayName);
      } else {
        await loginUser(email, password);
      }
      // onAuthStateChanged 會接手後續畫面切換
    } catch (err) {
      showMessage($("#authMsgBox"), friendlyAuthError(err));
    }
  });
}

// ==================================================================
// 行程列表畫面
// ==================================================================
async function renderTripsView() {
  showView(tripsView);
  tripsView.innerHTML = `
    <div class="container">
      <div id="tripsMsgBox"></div>
      <span class="eyebrow">Trip Planner</span>
      <h1>我的旅行</h1>
      <p class="subtitle">選一個行程繼續規劃，或建立新的旅行</p>

      <div class="card">
        <h2>建立新行程</h2>
        <form id="createTripForm">
          <div class="field">
            <label>行程名稱</label>
            <input type="text" id="tripName" placeholder="例如：2026 關西賞楓" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label>出發日</label>
              <input type="date" id="tripStart" required />
            </div>
            <div class="field">
              <label>回程日</label>
              <input type="date" id="tripEnd" required />
            </div>
          </div>
          <button type="submit" class="btn btn-accent btn-block">建立行程</button>
        </form>
      </div>

      <div class="card">
        <h2>加入朋友的行程</h2>
        <p class="subtitle" style="margin-bottom:12px">請朋友把行程代碼傳給你，貼在下面</p>
        <form id="joinTripForm" style="display:flex; gap:8px;">
          <input type="text" id="joinCode" placeholder="貼上行程代碼" style="flex:1; padding:10px 12px; border:1px solid var(--border); border-radius:8px;" required />
          <button type="submit" class="btn btn-outline">加入</button>
        </form>
      </div>

      <div class="wave-divider" style="margin: 24px 0;"></div>

      <h2>行程清單</h2>
      <div id="tripList"></div>
    </div>
  `;

  $("#createTripForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#tripName").value.trim();
    const start = $("#tripStart").value;
    const end = $("#tripEnd").value;
    try {
      const tripId = await createTrip(name, start, end);
      await openTrip(tripId);
    } catch (err) {
      showMessage($("#tripsMsgBox"), "建立失敗：" + err.message);
    }
  });

  $("#joinTripForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("#joinCode").value.trim();
    try {
      await joinTrip(code);
      await openTrip(code);
    } catch (err) {
      showMessage($("#tripsMsgBox"), err.message);
    }
  });

  const trips = await getMyTrips();
  const listEl = $("#tripList");
  if (trips.length === 0) {
    listEl.innerHTML = `<div class="empty-state">還沒有任何行程，建立一個開始規劃吧</div>`;
    return;
  }
  listEl.innerHTML = trips.map(t => `
    <div class="card card-row" style="cursor:pointer" data-trip-id="${t.id}">
      <div>
        <h2 style="margin-bottom:2px">${escapeHtml(t.name)}</h2>
        <p class="subtitle" style="margin:0">${t.startDate} → ${t.endDate} · ${t.members.length} 位成員</p>
      </div>
      <span class="btn btn-outline" style="pointer-events:none">查看</span>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-trip-id]").forEach(card => {
    card.addEventListener("click", () => openTrip(card.dataset.tripId));
  });
}

async function openTrip(tripId) {
  currentTrip = await getTrip(tripId);
  if (!currentTrip) return;
  currentMembers = await getTripMembers(currentTrip);
  currentTab = "itinerary";
  await renderTripDetailView();
}

// ==================================================================
// 行程詳細畫面（Tabs：行程 / 分帳 / 我的記帳 / 團員）
// ==================================================================
async function renderTripDetailView() {
  showView(tripDetailView);
  tripDetailView.innerHTML = `
    <div class="container">
      <button id="backBtn" class="btn btn-outline" style="margin-bottom:16px">← 回到我的旅行</button>
      <span class="eyebrow">${currentTrip.startDate} → ${currentTrip.endDate}</span>
      <h1>${escapeHtml(currentTrip.name)}</h1>
      <div class="trip-code" style="margin-bottom:20px">
        行程代碼：<strong>${currentTrip.id}</strong>
        <button id="copyCodeBtn" class="btn-danger" style="color:var(--ink-soft)">複製</button>
      </div>

      <div class="tabs">
        <button class="tab-btn" data-tab="itinerary">行程規劃</button>
        <button class="tab-btn" data-tab="expenses">一起出錢</button>
        <button class="tab-btn" data-tab="personal">我的記帳</button>
        <button class="tab-btn" data-tab="members">團員</button>
      </div>

      <div id="tabContent"></div>
    </div>
  `;

  $("#backBtn").addEventListener("click", renderTripsView);
  $("#copyCodeBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(currentTrip.id);
    $("#copyCodeBtn").textContent = "已複製！";
    setTimeout(() => ($("#copyCodeBtn").textContent = "複製"), 1500);
  });

  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      updateTabUI();
      renderTabContent();
    });
  });

  updateTabUI();
  await renderTabContent();
}

function updateTabUI() {
  $$(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
  });
}

async function renderTabContent() {
  const el = $("#tabContent");
  el.innerHTML = `<div class="empty-state">載入中…</div>`;
  if (currentTab === "itinerary") return renderItineraryTab(el);
  if (currentTab === "expenses") return renderExpensesTab(el);
  if (currentTab === "personal") return renderPersonalTab(el);
  if (currentTab === "members") return renderMembersTab(el);
}

// ---------------- 行程規劃 ----------------
async function renderItineraryTab(el) {
  const days = await getDays(currentTrip.id);

  el.innerHTML = `
    <div class="card">
      <h2>新增一天</h2>
      <form id="addDayForm" class="field-row" style="align-items:flex-end">
        <div class="field">
          <label>日期</label>
          <input type="date" id="dayDate" required />
        </div>
        <div class="field" style="flex:2">
          <label>標題</label>
          <input type="text" id="dayTitle" placeholder="例如：第一天・大阪" required />
        </div>
        <button type="submit" class="btn btn-accent">新增</button>
      </form>
    </div>
    <div id="daysList"></div>
  `;

  $("#addDayForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDay(currentTrip.id, $("#dayDate").value, $("#dayTitle").value.trim());
    renderItineraryTab(el);
  });

  const daysListEl = $("#daysList");
  if (days.length === 0) {
    daysListEl.innerHTML = `<div class="empty-state">還沒有安排任何一天，先從新增一天開始</div>`;
    return;
  }

  daysListEl.innerHTML = days.map(d => `
    <div class="card day-block" data-day-id="${d.id}">
      <div class="day-header">
        <div><span class="date-tag">${d.date}</span><strong>${escapeHtml(d.title)}</strong></div>
        <button class="btn-danger" data-del-day="${d.id}">刪除整天</button>
      </div>
      <div class="items-container" data-items-for="${d.id}"><div class="empty-state">載入中…</div></div>
      <form class="add-item-form" data-add-item-for="${d.id}" style="margin-top:12px; display:flex; gap:8px;">
        <input type="time" class="i-time" style="width:110px; padding:8px; border:1px solid var(--border); border-radius:8px;" required />
        <input type="text" class="i-title" placeholder="要去哪裡 / 做什麼" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:8px;" required />
        <button type="submit" class="btn btn-outline">加入</button>
      </form>
      <div class="field" style="margin-top:8px">
        <input type="text" class="i-note" placeholder="備註（選填）" style="padding:8px; border:1px solid var(--border); border-radius:8px; width:48%; margin-right:4%;" />
        <input type="url" class="i-link" placeholder="連結（Google Maps／訂位頁面…選填）" style="padding:8px; border:1px solid var(--border); border-radius:8px; width:48%;" />
      </div>
    </div>
  `).join("");

  daysListEl.querySelectorAll("[data-del-day]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("確定要刪除這一天嗎？")) return;
      await deleteDay(currentTrip.id, btn.dataset.delDay);
      renderItineraryTab(el);
    });
  });

  daysListEl.querySelectorAll(".add-item-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dayId = form.dataset.addItemFor;
      const card = form.closest(".day-block");
      const item = {
        time: card.querySelector(".i-time").value,
        title: card.querySelector(".i-title").value.trim(),
        note: card.querySelector(".i-note").value.trim(),
        link: card.querySelector(".i-link").value.trim()
      };
      await addItem(currentTrip.id, dayId, item);
      form.reset();
      renderItemsFor(dayId);
    });
  });

  for (const d of days) {
    renderItemsFor(d.id);
  }
}

async function renderItemsFor(dayId) {
  const container = $(`[data-items-for="${dayId}"]`);
  if (!container) return;
  const items = await getItems(currentTrip.id, dayId);
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:16px 0">這天還沒有排行程</div>`;
    return;
  }
  container.innerHTML = items.map(it => `
    <div class="item-row">
      <div class="item-time">${it.time || ""}</div>
      <div class="item-body">
        <div class="item-title">${escapeHtml(it.title)}</div>
        ${it.note ? `<div class="item-note">${escapeHtml(it.note)}</div>` : ""}
        ${it.link ? `<a class="item-link" href="${escapeHtml(it.link)}" target="_blank" rel="noopener">相關連結 ↗</a>` : ""}
      </div>
      <button class="btn-danger" data-del-item="${it.id}">刪除</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-del-item]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteItem(currentTrip.id, dayId, btn.dataset.delItem);
      renderItemsFor(dayId);
    });
  });
}

// ---------------- 一起出錢（共同分帳） ----------------
async function renderExpensesTab(el) {
  const expenses = await getExpenses(currentTrip.id);
  const balance = calculateBalances(expenses, currentMembers);
  const settlements = simplifyDebts(balance);

  const memberOptions = currentMembers
    .map(m => `<option value="${m.uid}">${escapeHtml(m.displayName)}${isMe(m.uid) ? "（我）" : ""}</option>`)
    .join("");

  const memberCheckboxes = currentMembers
    .map(m => `
      <label class="checkbox-row">
        <input type="checkbox" class="split-with" value="${m.uid}" checked />
        ${escapeHtml(m.displayName)}${isMe(m.uid) ? "（我）" : ""}
      </label>
    `).join("");

  el.innerHTML = `
    <div class="card">
      <h2>新增一筆花費</h2>
      <form id="addExpenseForm">
        <div class="field-row">
          <div class="field" style="flex:2">
            <label>項目</label>
            <input type="text" id="expTitle" placeholder="例如：京都住宿" required />
          </div>
          <div class="field">
            <label>金額（日圓）</label>
            <input type="number" id="expAmount" min="1" required />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>誰先付的</label>
            <select id="expPayer">${memberOptions}</select>
          </div>
          <div class="field">
            <label>日期</label>
            <input type="date" id="expDate" required />
          </div>
        </div>
        <div class="field">
          <label>這筆錢由誰分攤（均分）</label>
          ${memberCheckboxes}
        </div>
        <button type="submit" class="btn btn-accent btn-block">新增花費</button>
      </form>
    </div>

    <div class="card">
      <h2>結算</h2>
      ${settlements.length === 0
        ? `<div class="empty-state">目前帳務已結清 🎉</div>`
        : `<div class="settle-row" style="flex-direction:column; align-items:stretch;">
            ${settlements.map(s => `
              <div class="settle-row">
                <strong>${escapeHtml(nameOf(s.from))}${isMe(s.from) ? "（我）" : ""}</strong>
                <span class="settle-arrow">應付給</span>
                <strong>${escapeHtml(nameOf(s.to))}${isMe(s.to) ? "（我）" : ""}</strong>
                <span class="amount-negative" style="margin-left:auto">¥${fmt(s.amount)}</span>
              </div>
            `).join("")}
          </div>`
      }
      <div class="wave-divider" style="margin:16px 0"></div>
      <h2 style="font-size:15px">每人淨額</h2>
      <ul class="balance-list">
        ${currentMembers.map(m => {
          const v = Math.round((balance[m.uid] || 0) * 100) / 100;
          const cls = v > 0.5 ? "amount-positive" : v < -0.5 ? "amount-negative" : "amount-neutral";
          const label = v > 0.5 ? `該收回 ¥${fmt(v)}` : v < -0.5 ? `該付出 ¥${fmt(-v)}` : "已結清";
          return `<li><span>${escapeHtml(m.displayName)}${isMe(m.uid) ? "（我）" : ""}</span><span class="${cls}">${label}</span></li>`;
        }).join("")}
      </ul>
    </div>

    <div class="card">
      <h2>花費紀錄</h2>
      <div id="expenseList">
        ${expenses.length === 0 ? `<div class="empty-state">還沒有任何花費紀錄</div>` : expenses.map(exp => `
          <div class="expense-row">
            <div>
              <div>${escapeHtml(exp.title)}</div>
              <div class="expense-meta">
                ${escapeHtml(nameOf(exp.payerId))} 先付 · ${exp.splitWith.length} 人分攤 · ${exp.date}
              </div>
            </div>
            <div style="text-align:right">
              <div class="expense-amount">¥${fmt(exp.amount)}</div>
              <button class="btn-danger" data-del-expense="${exp.id}">刪除</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  $("#expDate").value = new Date().toISOString().slice(0, 10);

  $("#addExpenseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const splitWith = [...el.querySelectorAll(".split-with:checked")].map(cb => cb.value);
    if (splitWith.length === 0) {
      alert("至少要選一個人分攤這筆花費");
      return;
    }
    await addExpense(currentTrip.id, {
      title: $("#expTitle").value.trim(),
      amount: Number($("#expAmount").value),
      payerId: $("#expPayer").value,
      date: $("#expDate").value,
      splitWith,
      splitType: "equal"
    });
    renderExpensesTab(el);
  });

  el.querySelectorAll("[data-del-expense]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteExpense(currentTrip.id, btn.dataset.delExpense);
      renderExpensesTab(el);
    });
  });
}

// ---------------- 我的記帳（個人，可選公開） ----------------
async function renderPersonalTab(el) {
  const myRecords = await getMyRecords(currentTrip.id);

  el.innerHTML = `
    <div class="card">
      <h2>新增一筆記帳</h2>
      <form id="addRecordForm">
        <div class="field-row">
          <div class="field" style="flex:2">
            <label>項目</label>
            <input type="text" id="recTitle" placeholder="例如：藥妝戰利品" required />
          </div>
          <div class="field">
            <label>金額（日圓）</label>
            <input type="number" id="recAmount" min="1" required />
          </div>
        </div>
        <div class="field">
          <label>日期</label>
          <input type="date" id="recDate" required />
        </div>
        <label class="checkbox-row" style="margin-bottom:14px">
          <input type="checkbox" id="recPublic" />
          公開這筆給其他團員看到
        </label>
        <button type="submit" class="btn btn-accent btn-block">新增記錄</button>
      </form>
    </div>

    <div class="card">
      <h2>我的記帳明細</h2>
      <p class="subtitle">總支出：¥${fmt(myRecords.reduce((s, r) => s + r.amount, 0))}</p>
      <div id="myRecordList">
        ${myRecords.length === 0 ? `<div class="empty-state">還沒有任何記帳</div>` : myRecords.map(r => `
          <div class="record-row">
            <div>
              <div>${escapeHtml(r.title)}
                <span class="visibility-badge ${r.isPublic ? "public" : "private"}">${r.isPublic ? "公開" : "只有我看得到"}</span>
              </div>
              <div class="record-meta">${r.date}</div>
            </div>
            <div style="text-align:right">
              <div class="expense-amount">¥${fmt(r.amount)}</div>
              <button class="btn-danger" data-toggle-record="${r.id}" data-public="${r.isPublic}">
                ${r.isPublic ? "設為不公開" : "設為公開"}
              </button>
              <button class="btn-danger" data-del-record="${r.id}">刪除</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h2>其他團員公開的記帳</h2>
      <div id="othersRecordList"><div class="empty-state">載入中…</div></div>
    </div>
  `;

  $("#recDate").value = new Date().toISOString().slice(0, 10);

  $("#addRecordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addPersonalRecord(currentTrip.id, {
      title: $("#recTitle").value.trim(),
      amount: Number($("#recAmount").value),
      date: $("#recDate").value,
      isPublic: $("#recPublic").checked
    });
    renderPersonalTab(el);
  });

  el.querySelectorAll("[data-toggle-record]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const willBePublic = btn.dataset.public !== "true";
      await togglePublic(currentTrip.id, btn.dataset.toggleRecord, willBePublic);
      renderPersonalTab(el);
    });
  });

  el.querySelectorAll("[data-del-record]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deletePersonalRecord(currentTrip.id, btn.dataset.delRecord);
      renderPersonalTab(el);
    });
  });

  // 載入其他團員公開的記帳
  const othersEl = $("#othersRecordList");
  const others = currentMembers.filter(m => !isMe(m.uid));
  let html = "";
  for (const m of others) {
    const records = await getPublicRecordsOfMember(currentTrip.id, m.uid);
    if (records.length === 0) continue;
    html += `<h3 style="font-size:14px; margin-top:16px;">${escapeHtml(m.displayName)}</h3>`;
    html += records.map(r => `
      <div class="record-row">
        <div>
          <div>${escapeHtml(r.title)}</div>
          <div class="record-meta">${r.date}</div>
        </div>
        <div class="expense-amount">¥${fmt(r.amount)}</div>
      </div>
    `).join("");
  }
  othersEl.innerHTML = html || `<div class="empty-state">目前沒有其他人公開記帳</div>`;
}

// ---------------- 團員 ----------------
async function renderMembersTab(el) {
  el.innerHTML = `
    <div class="card">
      <h2>團員名單</h2>
      <ul class="balance-list">
        ${currentMembers.map(m => `
          <li>
            <span>${escapeHtml(m.displayName)}${isMe(m.uid) ? "（我）" : ""}${m.uid === currentTrip.ownerId ? " · 發起人" : ""}</span>
            <span class="amount-neutral">${escapeHtml(m.email || "")}</span>
          </li>
        `).join("")}
      </ul>
      <p class="subtitle" style="margin-top:16px">把行程代碼「<strong>${currentTrip.id}</strong>」分享給朋友，他們就可以加入這趟旅行。</p>
    </div>
  `;
}

// ==================================================================
// XSS 防護小工具
// ==================================================================
function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==================================================================
// 啟動流程：監聽登入狀態
// ==================================================================
watchAuthState(async (user) => {
  currentUser = user;
  if (user) {
    topBar.classList.remove("hidden");
    topBarUserEmail.textContent = user.email;
    await renderTripsView();
  } else {
    topBar.classList.add("hidden");
    authMode = "login";
    renderAuthView();
    showView(authView);
  }
});

$("#logoutBtn").addEventListener("click", () => logoutUser());
