// ============================================================
// LUDOTHÈQUE EN LIGNE — client API Cloudflare Worker
// ============================================================
(() => {
  const state = { user: null, loaded: false };

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(body);
    }
    const response = await fetch(path, { ...options, headers, body, credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    return data;
  }

  function updateNav() {
    const el = document.getElementById("accountNavLabel");
    if (el) el.textContent = state.user ? state.user.username : "Compte";
  }

  async function me(force = false) {
    if (state.loaded && !force) return state.user;
    const data = await request("/api/auth/me");
    state.user = data.user || null;
    state.loaded = true;
    updateNav();
    return state.user;
  }

  async function register(username, password) {
    const data = await request("/api/auth/register", { method: "POST", body: { username, password } });
    state.user = data.user; state.loaded = true; updateNav(); return data;
  }
  async function login(username, password) {
    const data = await request("/api/auth/login", { method: "POST", body: { username, password } });
    state.user = data.user; state.loaded = true; updateNav(); return state.user;
  }
  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    state.user = null; state.loaded = true; updateNav();
  }

  async function changePassword(currentPassword, newPassword) {
    return request("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  }

  async function generateRecoveryKey() {
    return request("/api/auth/recovery-key", { method: "POST" });
  }

  async function resetWithRecovery(username, recoveryKey, newPassword) {
    return request("/api/auth/reset-with-recovery", {
      method: "POST",
      body: { username, recoveryKey, newPassword }
    });
  }

  const saves = {
    list: async (game = "abalone") => (await request(`/api/saves?game=${encodeURIComponent(game)}`)).saves,
    create: async (game, name, saveState) => request("/api/saves", { method: "POST", body: { game, name, state: saveState } }),
    get: async id => (await request(`/api/saves/${id}`)).save,
    remove: async id => request(`/api/saves/${id}`, { method: "DELETE" })
  };

  const rooms = {
    create: async (game = "abalone") => request("/api/rooms", { method: "POST", body: { game } }),
    join: async code => request("/api/rooms/join", { method: "POST", body: { code } }),
    info: async code => request(`/api/rooms/${encodeURIComponent(code.toUpperCase())}`),
    connect(code, handlers = {}) {
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${scheme}//${location.host}/api/rooms/${encodeURIComponent(code.toUpperCase())}/ws`);
      ws.addEventListener("open", e => handlers.open?.(e, ws));
      ws.addEventListener("message", e => {
        try { handlers.message?.(JSON.parse(e.data), ws); }
        catch (err) { handlers.error?.(err, ws); }
      });
      ws.addEventListener("close", e => handlers.close?.(e, ws));
      ws.addEventListener("error", e => handlers.error?.(e, ws));
      return ws;
    }
  };

  window.LudoOnline = {
    state, request, me, register, login, logout,
    changePassword, generateRecoveryKey, resetWithRecovery,
    saves, rooms, updateNav
  };
  window.addEventListener("DOMContentLoaded", () => me().catch(() => updateNav()));
})();
