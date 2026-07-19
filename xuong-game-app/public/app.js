const API = "/api";
const CATEGORIES = ["Platformer", "Puzzle", "Roguelike", "Visual Novel", "Bắn súng"];
const COLORS = ["#6C63FF", "#F2B84B", "#4ADE80", "#E8637A", "#38BDF8"];

// ---------- Multi-account storage ----------
// Each entry: { token, user }. Lets the person add & switch between several logins,
// similar to how Discord/Slack let you juggle multiple accounts in one browser.
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem("xg_accounts") || "[]"); } catch { return []; }
}
function saveAccounts(list) { localStorage.setItem("xg_accounts", JSON.stringify(list)); }
function loadActiveIndex() { return Number(localStorage.getItem("xg_active") || 0); }
function saveActiveIndex(i) { localStorage.setItem("xg_active", String(i)); }

let state = {
  accounts: loadAccounts(),
  activeIndex: loadActiveIndex(),
  view: "home",
  games: [],
  category: "Tất cả",
  query: "",
  selectedGame: null,
  switcherOpen: false,
  adminUsers: [],
  friends: [],
  friendRequests: [],
  friendResults: [],
  friendQuery: "",
  authMode: "login", // login | register
  authError: "",
  toast: "",
};

function activeAccount() { return state.accounts[state.activeIndex] || null; }

async function api(path, { method = "GET", body, auth = true } = {}) {
  const acc = activeAccount();
  const headers = { "Content-Type": "application/json" };
  if (auth && acc?.token) headers.Authorization = "Bearer " + acc.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}

function showToast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => { state.toast = ""; render(); }, 2200);
}

function esc(s) { return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function devBadge(isDev, size = 12) {
  if (!isDev) return "";
  return `<svg class="dev-badge" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`;
}

// ---------- Data loaders ----------
async function loadGames() {
  const isAdmin = activeAccount()?.user?.isAdmin;
  const { games } = await api(`/games${isAdmin ? "?all=1" : ""}`, { auth: isAdmin });
  state.games = games;
}
async function loadFriends() {
  if (!activeAccount()) return;
  const { friends, requests } = await api("/friends");
  state.friends = friends;
  state.friendRequests = requests;
}
async function loadAdminUsers() {
  if (!activeAccount()?.user?.isAdmin) return;
  const { users } = await api("/users");
  state.adminUsers = users;
}

// ---------- Actions ----------
async function doLogin(username, password) {
  state.authError = "";
  try {
    const data = await api("/auth/login", { method: "POST", body: { username, password }, auth: false });
    addOrUpdateAccount(data);
  } catch (e) { state.authError = e.message; render(); }
}
async function doRegister(username, password) {
  state.authError = "";
  try {
    const data = await api("/auth/register", { method: "POST", body: { username, password }, auth: false });
    addOrUpdateAccount(data);
  } catch (e) { state.authError = e.message; render(); }
}
function addOrUpdateAccount(data) {
  const idx = state.accounts.findIndex((a) => a.user.id === data.user.id);
  if (idx >= 0) state.accounts[idx] = data; else state.accounts.push(data);
  state.activeIndex = idx >= 0 ? idx : state.accounts.length - 1;
  saveAccounts(state.accounts);
  saveActiveIndex(state.activeIndex);
  state.view = "home";
  bootstrapView();
}
function switchAccount(i) {
  state.activeIndex = i;
  saveActiveIndex(i);
  state.switcherOpen = false;
  showToast(`Đã chuyển sang ${state.accounts[i].user.displayName}`);
  bootstrapView();
}
function logoutAccount(i) {
  state.accounts.splice(i, 1);
  saveAccounts(state.accounts);
  state.activeIndex = 0;
  saveActiveIndex(0);
  bootstrapView();
}

async function submitGame(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await api("/games", { method: "POST", body: {
      title: f.title.value, category: f.category.value, description: f.description.value, link: f.link.value,
    }});
    showToast("Đã gửi game — chờ quản trị viên duyệt.");
    f.reset();
    await loadGames();
    render();
  } catch (err) { showToast(err.message); }
}
async function reportGame(game) {
  try { await api(`/games/${game.id}/report`, { method: "POST" }); showToast("Đã gửi báo cáo."); state.selectedGame = null; await loadGames(); render(); }
  catch (err) { showToast(err.message); }
}
async function approveGame(game) { await api(`/games/${game.id}/approve`, { method: "POST" }); await loadGames(); render(); }
async function deleteGame(game) { await api(`/games/${game.id}`, { method: "DELETE" }); state.selectedGame = null; await loadGames(); render(); }
async function reassignGame(gameId, devId) { await api(`/games/${gameId}/reassign`, { method: "POST", body: { devId } }); await loadGames(); render(); }
async function toggleDev(userId) { await api(`/users/${userId}/toggle-dev`, { method: "POST" }); await loadAdminUsers(); await loadGames(); render(); }

async function saveProfile(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const data = await api("/auth/me", { method: "PATCH", body: { displayName: f.displayName.value, urlSlug: f.urlSlug.value } });
    state.accounts[state.activeIndex].user = data.user;
    saveAccounts(state.accounts);
    showToast("Đã lưu thay đổi hồ sơ.");
    render();
  } catch (err) { showToast(err.message); }
}

async function searchFriends(q) {
  state.friendQuery = q;
  if (!activeAccount()) return;
  const { users } = await api(`/users/search?q=${encodeURIComponent(q)}`);
  state.friendResults = users;
  render();
}
async function sendFriendReq(userId) { await api("/friends/request", { method: "POST", body: { userId } }); showToast("Đã gửi lời mời kết bạn."); await searchFriends(state.friendQuery); }
async function acceptFriendReq(userId) { await api("/friends/accept", { method: "POST", body: { userId } }); showToast("Đã chấp nhận lời mời."); await loadFriends(); render(); }
async function declineFriendReq(userId) { await api("/friends/decline", { method: "POST", body: { userId } }); await loadFriends(); render(); }

async function bootstrapView() {
  await Promise.all([loadGames(), loadFriends(), loadAdminUsers()]);
  render();
}

// ---------- Render ----------
function render() {
  const root = document.getElementById("app");
  if (!activeAccount()) { root.innerHTML = renderAuth(); attachAuthEvents(); return; }
  root.innerHTML = renderHeader() + renderMain() + renderModal() + renderToast();
  attachEvents();
}

function renderAuth() {
  return `
  <div class="auth-wrap">
    <div class="panel" style="max-width:380px">
      <div class="panel-title">Xưởng Game</div>
      <div class="panel-sub">${state.authMode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}</div>
      ${state.authError ? `<div class="error-box">${esc(state.authError)}</div>` : ""}
      <form id="auth-form">
        <label class="field-label">Tên đăng nhập</label>
        <input class="field" name="username" required />
        <label class="field-label">Mật khẩu</label>
        <input class="field" name="password" type="password" required minlength="4" />
        <button class="btn-primary" type="submit">${state.authMode === "login" ? "Đăng nhập" : "Đăng ký"}</button>
      </form>
      <button class="btn-link" id="auth-switch">${state.authMode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button>
    </div>
  </div>`;
}
function attachAuthEvents() {
  document.getElementById("auth-form").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    if (state.authMode === "login") doLogin(f.username.value, f.password.value);
    else doRegister(f.username.value, f.password.value);
  };
  document.getElementById("auth-switch").onclick = () => { state.authMode = state.authMode === "login" ? "register" : "login"; state.authError = ""; render(); };
}

function renderHeader() {
  const acc = activeAccount();
  const u = acc.user;
  const navItems = [
    ["home", "Khám phá"], ["submit", "Đăng game"], ["friends", "Bạn bè"], ["profile", "Hồ sơ"],
  ];
  if (u.isAdmin) navItems.push(["admin", "Quản trị"]);
  const reqCount = state.friendRequests.length;

  return `
  <div class="header">
    <div class="brand"><div class="brand-mark">X</div><div class="brand-name">Xưởng Game</div></div>
    <div class="nav">
      ${navItems.map(([id, label]) => `
        <button data-nav="${id}" class="${state.view === id ? "active" : ""}">${esc(label)}${id === "friends" && reqCount ? `<span class="badge-count">${reqCount}</span>` : ""}</button>
      `).join("")}
    </div>
    <div class="account-area">
      <button class="switcher-btn" id="switcher-toggle">
        <span class="avatar" style="width:22px;height:22px;background:${u.avatarColor}"></span>
        <span style="font-size:12.5px;font-family:var(--font-mono)">${esc(u.displayName)}${devBadge(u.isDev, 12)}</span>
      </button>
      ${state.switcherOpen ? `
      <div class="switcher-menu">
        ${state.accounts.map((a, i) => `
          <button class="switcher-item ${i === state.activeIndex ? "active" : ""}" data-switch="${i}">
            <span class="avatar" style="width:20px;height:20px;background:${a.user.avatarColor}"></span>
            <span>${esc(a.user.displayName)}${devBadge(a.user.isDev, 11)}</span>
          </button>`).join("")}
        <button class="switcher-item switcher-add" id="add-account">+ Thêm tài khoản</button>
        <button class="switcher-item" id="logout-current" style="color:var(--danger)">Đăng xuất tài khoản này</button>
      </div>` : ""}
    </div>
  </div>`;
}

function renderMain() {
  switch (state.view) {
    case "home": return renderHome();
    case "submit": return renderSubmit();
    case "friends": return renderFriends();
    case "profile": return renderProfile();
    case "admin": return activeAccount().user.isAdmin ? renderAdmin() : "";
    default: return "";
  }
}

function renderHome() {
  const filtered = state.games.filter((g) => {
    const matchCat = state.category === "Tất cả" || g.category === state.category;
    const matchQuery = g.title.toLowerCase().includes(state.query.toLowerCase()) || (g.dev?.name || "").toLowerCase().includes(state.query.toLowerCase());
    return matchCat && matchQuery;
  });
  return `
  <div class="main">
    <div class="toolbar">
      <div class="search-box"><input id="search-input" placeholder="Tìm game hoặc nhà phát triển..." value="${esc(state.query)}" /></div>
      <select class="filter" id="cat-filter">
        ${["Tất cả", ...CATEGORIES].map((c) => `<option ${c === state.category ? "selected" : ""}>${c}</option>`).join("")}
      </select>
    </div>
    <div class="grid">
      ${filtered.map(gameCardHtml).join("")}
    </div>
    ${filtered.length === 0 ? `<div class="empty">Không tìm thấy game nào phù hợp.</div>` : ""}
  </div>`;
}

function gameCardHtml(g) {
  const statusLabel = { approved: "ĐÃ DUYỆT", pending: "CHỜ DUYỆT", flagged: "BỊ GẮN CỜ" }[g.status];
  return `
  <button class="card" data-open="${g.id}">
    <div class="stamp ${g.status}">${statusLabel}</div>
    <div class="card-thumb" style="background:linear-gradient(135deg, ${g.color}55, ${g.color}15); color:${g.color}">${esc(g.title.charAt(0))}</div>
    <div class="card-body">
      <div class="card-title">${esc(g.title)}</div>
      <div class="card-meta">by ${esc(g.dev?.name || "ẩn danh")} ${devBadge(g.dev?.isDev)} <span style="margin-left:4px">· ${esc(g.category)}</span></div>
      <div class="card-rating">★ ${g.rating || "—"}</div>
    </div>
  </button>`;
}

function renderSubmit() {
  return `
  <div class="main">
    <div class="panel">
      <div class="panel-title">Đăng game của bạn</div>
      <div class="panel-sub">Chỉ đăng game do chính bạn (hoặc nhóm bạn) phát triển. Mọi game sẽ ở trạng thái "Chờ duyệt" cho tới khi quản trị viên xác nhận.</div>
      <form id="submit-form">
        <label class="field-label">Tên game</label>
        <input class="field" name="title" required />
        <label class="field-label">Thể loại</label>
        <select class="field" name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
        <label class="field-label">Link tải (Google Drive hoặc GoFile)</label>
        <input class="field" name="link" placeholder="https://drive.google.com/..." required />
        <label class="field-label">Mô tả ngắn</label>
        <textarea class="field" name="description" rows="3"></textarea>
        <button class="btn-primary" type="submit">Gửi để duyệt</button>
      </form>
    </div>
  </div>`;
}

function renderFriends() {
  return `
  <div class="main">
    <div style="max-width:560px">
      <div class="search-box" style="margin-bottom:18px"><input id="friend-search" placeholder="Tìm người dùng để kết bạn..." value="${esc(state.friendQuery)}" /></div>

      ${state.friendRequests.length ? `
      <div class="section-label">LỜI MỜI KẾT BẠN</div>
      ${state.friendRequests.map((u) => `
        <div class="row-card">
          <span class="avatar" style="width:36px;height:36px;background:${u.avatarColor}"></span>
          <div style="flex:1;font-size:13.5px">${esc(u.displayName)}${devBadge(u.isDev)}</div>
          <button class="pill-btn success" data-accept-friend="${u.id}">Chấp nhận</button>
          <button class="pill-btn" data-decline-friend="${u.id}">Từ chối</button>
        </div>`).join("")}
      ` : ""}

      <div class="section-label">BẠN BÈ (${state.friends.length})</div>
      ${state.friends.map((u) => `
        <div class="row-card">
          <span class="avatar" style="width:36px;height:36px;background:${u.avatarColor}"></span>
          <div style="flex:1;font-size:13.5px">${esc(u.displayName)}${devBadge(u.isDev)}</div>
        </div>`).join("") || `<div class="empty">Chưa có bạn bè nào. Tìm và kết bạn bên dưới!</div>`}

      ${state.friendQuery ? `
      <div class="section-label" style="margin-top:14px">KẾT QUẢ TÌM KIẾM</div>
      ${state.friendResults.map((u) => `
        <div class="row-card">
          <span class="avatar" style="width:36px;height:36px;background:${u.avatarColor}"></span>
          <div style="flex:1;font-size:13.5px">${esc(u.displayName)}${devBadge(u.isDev)}</div>
          <button class="pill-btn" data-add-friend="${u.id}">+ Kết bạn</button>
        </div>`).join("") || `<div class="empty">Không tìm thấy người dùng.</div>`}
      ` : ""}
    </div>
  </div>`;
}

function renderProfile() {
  const u = activeAccount().user;
  return `
  <div class="main">
    <div class="panel">
      <div class="panel-title">Hồ sơ của bạn ${devBadge(u.isDev, 16)}</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <span class="avatar" style="width:56px;height:56px;border-radius:12px;background:${u.avatarColor}"></span>
      </div>
      <form id="profile-form">
        <label class="field-label">Tên hiển thị</label>
        <input class="field" name="displayName" value="${esc(u.displayName)}" />
        <div class="hint">Có thể đổi 1 lần / tháng.</div>
        <label class="field-label">URL trang cá nhân</label>
        <input class="field" name="urlSlug" value="${esc(u.urlSlug)}" />
        <div class="hint">Cũng chỉ đổi được 1 lần / tháng.</div>
        <button class="btn-primary" type="submit">Lưu thay đổi</button>
      </form>
    </div>
  </div>`;
}

function renderAdmin() {
  const pendingOrFlagged = state.games.filter((g) => g.status === "pending" || g.status === "flagged");
  return `
  <div class="main">
    <div class="section-title">Hàng chờ duyệt & báo cáo</div>
    <div class="panel-sub">Xem xét game mới đăng, báo cáo vi phạm, và gán lại nhà phát triển nếu cần.</div>
    ${pendingOrFlagged.map((g) => `
      <div class="row-card">
        <div style="width:44px;height:44px;border-radius:8px;background:${g.color}33;display:flex;align-items:center;justify-content:center;color:${g.color};font-family:var(--font-display);font-weight:700">${esc(g.title.charAt(0))}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:14px;font-weight:600">${esc(g.title)}</div>
          <div style="font-size:12px;color:${g.status === "flagged" ? "#F3AFBC" : "var(--muted)"};margin-top:2px">${g.status === "flagged" ? esc(g.flagReason || "") : "Mới đăng, đang chờ duyệt lần đầu."}</div>
        </div>
        <select class="filter" data-reassign="${g.id}">
          ${state.adminUsers.map((u) => `<option value="${u.id}" ${u.id === g.dev?.id ? "selected" : ""}>Dev: ${esc(u.displayName)}</option>`).join("")}
        </select>
        <button class="pill-btn success" data-approve="${g.id}">✓ Duyệt</button>
        <button class="pill-btn danger" data-delete="${g.id}">✕ Gỡ</button>
      </div>`).join("") || `<div class="empty">Không còn gì cần duyệt 🎉</div>`}

    <div class="section-title" style="margin-top:28px">Tất cả game</div>
    <div class="panel-sub">Xoá bất kỳ game nào khỏi nền tảng.</div>
    ${state.games.map((g) => `
      <div class="row-card">
        <div style="width:30px;height:30px;border-radius:6px;background:${g.color}33;display:flex;align-items:center;justify-content:center;color:${g.color};font-family:var(--font-display);font-weight:700;font-size:13px">${esc(g.title.charAt(0))}</div>
        <div style="flex:1;font-size:13px">${esc(g.title)} <span style="font-size:11px;color:var(--muted2);margin-left:6px;font-family:var(--font-mono)">· ${esc(g.dev?.name || "")}</span></div>
        <button class="pill-btn danger" data-delete="${g.id}">Xoá</button>
      </div>`).join("")}

    <div class="section-title" style="margin-top:28px">Quản lý người dùng</div>
    <div class="panel-sub">Cấp hoặc thu hồi huy hiệu Nhà phát triển cho bất kỳ tài khoản nào.</div>
    ${state.adminUsers.map((u) => `
      <div class="row-card">
        <span class="avatar" style="width:28px;height:28px;background:${u.avatarColor}"></span>
        <div style="flex:1;font-size:13px">${esc(u.displayName)}${devBadge(u.isDev, 13)}</div>
        <button class="pill-btn ${u.isDev ? "dev" : ""}" data-toggle-dev="${u.id}">${u.isDev ? "Thu hồi huy hiệu Dev" : "Cấp huy hiệu Dev"}</button>
      </div>`).join("")}
  </div>`;
}

function renderModal() {
  const g = state.selectedGame;
  if (!g) return "";
  const isAdmin = activeAccount().user.isAdmin;
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="modal-hero" style="background:linear-gradient(135deg, ${g.color}66, ${g.color}18); color:${g.color}">${esc(g.title.charAt(0))}</div>
      <div class="modal-content">
        <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${esc(g.title)}</div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);margin-top:4px">by ${esc(g.dev?.name || "ẩn danh")} ${devBadge(g.dev?.isDev)} · ${esc(g.category)}</div>
        <p style="color:#C4C8D4;font-size:13.5px;line-height:1.6;margin-top:12px">${esc(g.description || "")}</p>
        ${g.status === "flagged" ? `<div class="error-box">⚠ ${esc(g.flagReason || "")}</div>` : ""}
        <div style="display:flex;gap:8px;margin-top:18px">
          <a href="${esc(g.link)}" target="_blank" rel="noreferrer" class="btn-primary" style="text-decoration:none;text-align:center;flex:1">Tải xuống</a>
          <button class="pill-btn" id="report-btn">⚑ Báo cáo</button>
          ${isAdmin ? `<button class="pill-btn danger" id="modal-delete">🗑 Xoá</button>` : ""}
        </div>
      </div>
    </div>
  </div>`;
}

function renderToast() {
  return state.toast ? `<div class="toast">${esc(state.toast)}</div>` : "";
}

// ---------- Event wiring (re-attached after every render) ----------
function attachEvents() {
  document.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => { state.view = b.dataset.nav; state.switcherOpen = false; render(); });
  const st = document.getElementById("switcher-toggle");
  if (st) st.onclick = () => { state.switcherOpen = !state.switcherOpen; render(); };
  document.querySelectorAll("[data-switch]").forEach((b) => b.onclick = () => switchAccount(Number(b.dataset.switch)));
  const addAcc = document.getElementById("add-account");
  if (addAcc) addAcc.onclick = () => { state.accounts = state.accounts; state.activeIndex = -1; localStorage.setItem("xg_active", "-1"); render(); };
  const logoutBtn = document.getElementById("logout-current");
  if (logoutBtn) logoutBtn.onclick = () => logoutAccount(state.activeIndex);

  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.oninput = (e) => { state.query = e.target.value; render(); searchInput.focus(); searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length; };
  const catFilter = document.getElementById("cat-filter");
  if (catFilter) catFilter.onchange = (e) => { state.category = e.target.value; render(); };

  document.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { state.selectedGame = state.games.find((g) => g.id == b.dataset.open); render(); });
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.onclick = () => { state.selectedGame = null; render(); };
  const reportBtn = document.getElementById("report-btn");
  if (reportBtn) reportBtn.onclick = () => reportGame(state.selectedGame);
  const modalDelete = document.getElementById("modal-delete");
  if (modalDelete) modalDelete.onclick = () => deleteGame(state.selectedGame);

  const submitForm = document.getElementById("submit-form");
  if (submitForm) submitForm.onsubmit = submitGame;
  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.onsubmit = saveProfile;

  const friendSearch = document.getElementById("friend-search");
  if (friendSearch) friendSearch.oninput = (e) => searchFriends(e.target.value);
  document.querySelectorAll("[data-accept-friend]").forEach((b) => b.onclick = () => acceptFriendReq(Number(b.dataset.acceptFriend)));
  document.querySelectorAll("[data-decline-friend]").forEach((b) => b.onclick = () => declineFriendReq(Number(b.dataset.declineFriend)));
  document.querySelectorAll("[data-add-friend]").forEach((b) => b.onclick = () => sendFriendReq(Number(b.dataset.addFriend)));

  document.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => approveGame({ id: b.dataset.approve }));
  document.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => deleteGame({ id: b.dataset.delete }));
  document.querySelectorAll("[data-toggle-dev]").forEach((b) => b.onclick = () => toggleDev(b.dataset.toggleDev));
  document.querySelectorAll("[data-reassign]").forEach((sel) => sel.onchange = () => reassignGame(sel.dataset.reassign, sel.value));
}

// ---------- Boot ----------
if (activeAccount()) bootstrapView(); else render();
