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
    if (!response.ok) {
      const error = new Error(data.error || `Erreur ${response.status}`);
      error.status = response.status;
      error.data = data;
      if (data && typeof data === "object") Object.assign(error, data);
      throw error;
    }
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

  async function register(username, email, password, turnstileToken = "") {
    const data = await request("/api/auth/register", { method: "POST", body: { username, email, password, turnstileToken } });
    state.user = data.user; state.loaded = true; updateNav(); return data;
  }
  async function login(username, password, turnstileToken = "") {
    const data = await request("/api/auth/login", { method: "POST", body: { username, password, turnstileToken } });
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

  async function requestPasswordReset(email, turnstileToken = "") {
    return request("/api/auth/forgot-password", { method: "POST", body: { email, turnstileToken } });
  }

  async function resetPasswordWithEmail(token, newPassword) {
    return request("/api/auth/reset-password", { method: "POST", body: { token, newPassword } });
  }

  async function verifyEmail(token) {
    return request("/api/auth/verify-email", { method: "POST", body: { token } });
  }

  async function setEmail(email, password) {
    return request("/api/auth/email", { method: "POST", body: { email, password } });
  }

  async function resendVerification() {
    return request("/api/auth/resend-verification", { method: "POST" });
  }

  async function deleteAccount(password, confirmation) {
    const data=await request("/api/auth/account", { method: "DELETE", body: { password, confirmation } });
    state.user=null; state.loaded=true; updateNav(); return data;
  }

  const security = (() => {
    let configPromise = null;
    let scriptPromise = null;

    async function config(force = false) {
      if (!configPromise || force) configPromise = request("/api/security/config");
      return configPromise;
    }

    async function loadTurnstile() {
      if (window.turnstile) return window.turnstile;
      if (scriptPromise) return scriptPromise;
      scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-strathasard-turnstile="1"]');
        const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile n’a pas pu être chargé."));
        if (existing) {
          const started = Date.now();
          const timer = setInterval(() => {
            if (window.turnstile) { clearInterval(timer); resolve(window.turnstile); }
            else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error("Turnstile n’a pas pu être chargé.")); }
          }, 100);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.strathasardTurnstile = "1";
        script.onload = ready;
        script.onerror = () => reject(new Error("Impossible de charger la vérification anti-robot."));
        document.head.appendChild(script);
      });
      return scriptPromise;
    }

    async function render(container, action, options = {}) {
      const cfg = await config();
      const el = typeof container === "string" ? document.querySelector(container) : container;
      if (!el) return null;
      if (!cfg.turnstileEnabled || !cfg.turnstileSiteKey) {
        el.innerHTML = '<div class="turnstile-config-warning">Protection anti-robot non configurée.</div>';
        return null;
      }
      const api = await loadTurnstile();
      el.innerHTML = "";
      let latestToken = "";
      let executionPromise = null;
      let resolveExecution = null;
      let rejectExecution = null;

      const finishExecution = token => {
        latestToken = token || "";
        if (resolveExecution) resolveExecution(latestToken);
        executionPromise = null;
        resolveExecution = null;
        rejectExecution = null;
        options.callback?.(latestToken);
      };

      const failExecution = error => {
        latestToken = "";
        if (rejectExecution) rejectExecution(error instanceof Error ? error : new Error(String(error || "Échec de la vérification anti-robot.")));
        executionPromise = null;
        resolveExecution = null;
        rejectExecution = null;
      };

      const widgetId = api.render(el, {
        sitekey: cfg.turnstileSiteKey,
        action,
        theme: "auto",
        language: "fr",
        size: "flexible",
        appearance: options.appearance || "interaction-only",
        execution: options.execution || "render",
        callback: finishExecution,
        "expired-callback": () => {
          latestToken = "";
          failExecution(new Error("La vérification anti-robot a expiré. Merci de recommencer."));
          options.expired?.();
        },
        "error-callback": code => {
          failExecution(new Error("La vérification anti-robot a échoué."));
          options.error?.(code);
        }
      });

      return {
        id: widgetId,
        getToken: () => api.getResponse(widgetId) || latestToken || "",
        execute: () => {
          const existing = api.getResponse(widgetId) || latestToken || "";
          if (existing) return Promise.resolve(existing);
          if (executionPromise) return executionPromise;
          executionPromise = new Promise((resolve, reject) => {
            resolveExecution = resolve;
            rejectExecution = reject;
            try {
              api.execute(widgetId);
            } catch (error) {
              failExecution(error);
            }
          });
          return executionPromise;
        },
        reset: () => {
          latestToken = "";
          executionPromise = null;
          resolveExecution = null;
          rejectExecution = null;
          try { api.reset(widgetId); } catch {}
        },
        remove: () => {
          latestToken = "";
          executionPromise = null;
          resolveExecution = null;
          rejectExecution = null;
          try { api.remove(widgetId); } catch {}
        }
      };
    }

    return { config, render };
  })();

  const saves = {
    list: async (game = "abalone") => (await request(`/api/saves?game=${encodeURIComponent(game)}`)).saves,
    create: async (game, name, saveState) => request("/api/saves", { method: "POST", body: { game, name, state: saveState } }),
    get: async id => (await request(`/api/saves/${id}`)).save,
    remove: async id => request(`/api/saves/${id}`, { method: "DELETE" })
  };


  const ratings = {
    mine: async () => (await request("/api/ratings/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) =>
      request(`/api/ratings/chess?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const chessGames = {
    list: async () => (await request("/api/chess/games")).games,
    get: async id => (await request(`/api/chess/games/${encodeURIComponent(id)}`)).game
  };

  const checkersRatings = {
    mine: async (variant = "international") => (await request(`/api/ratings/checkers/me?variant=${encodeURIComponent(variant)}`)).ratings,
    leaderboard: async (variant = "international", category = "rapid", limit = 30) =>
      request(`/api/ratings/checkers?variant=${encodeURIComponent(variant)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const checkersGames = {
    list: async (variant = "") => (await request(`/api/checkers/games${variant?`?variant=${encodeURIComponent(variant)}`:""}`)).games,
    get: async id => (await request(`/api/checkers/games/${encodeURIComponent(id)}`)).game
  };


  const goRatings = {
    mine: async (size = 19) => (await request(`/api/ratings/go/me?size=${encodeURIComponent(size)}`)).ratings,
    leaderboard: async (size = 19, category = "rapid", limit = 30) =>
      request(`/api/ratings/go?size=${encodeURIComponent(size)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const goGames = {
    list: async (size = "") => (await request(`/api/go/games${size?`?size=${encodeURIComponent(size)}`:""}`)).games,
    get: async id => (await request(`/api/go/games/${encodeURIComponent(id)}`)).game
  };

  const awaleRatings = {
    mine: async () => (await request("/api/ratings/awale/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) => request(`/api/ratings/awale?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const awaleGames = {
    list: async () => (await request("/api/awale/games")).games,
    get: async id => (await request(`/api/awale/games/${encodeURIComponent(id)}`)).game
  };

  const abaloneRatings = {
    mine: async () => (await request("/api/ratings/abalone/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) => request(`/api/ratings/abalone?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const abaloneGames = {
    list: async () => (await request("/api/abalone/games")).games,
    get: async id => (await request(`/api/abalone/games/${encodeURIComponent(id)}`)).game
  };


  const yamsRatings = {
    mine: async () => (await request("/api/ratings/yams/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/yams?limit=${encodeURIComponent(limit)}`)
  };

  const yamsGames = {
    list: async () => (await request("/api/yams/games")).games,
    get: async id => (await request(`/api/yams/games/${encodeURIComponent(id)}`)).game
  };


  const game421Ratings = {
    mine: async () => (await request("/api/ratings/421/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/421?limit=${encodeURIComponent(limit)}`)
  };

  const game421Games = {
    list: async () => (await request("/api/421/games")).games,
    get: async id => (await request(`/api/421/games/${encodeURIComponent(id)}`)).game
  };

  const dominoRatings = {
    mine: async () => (await request("/api/ratings/dominos/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/dominos?limit=${encodeURIComponent(limit)}`)
  };

  const dominoGames = {
    list: async () => (await request("/api/dominos/games")).games,
    get: async id => (await request(`/api/dominos/games/${encodeURIComponent(id)}`)).game
  };

  const rooms = {
    create: async (game = "abalone", options = {}) => request("/api/rooms", { method: "POST", body: { game, ...options } }),
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
    changePassword, generateRecoveryKey, resetWithRecovery, requestPasswordReset, resetPasswordWithEmail, verifyEmail, setEmail, resendVerification, deleteAccount, security,
    saves, ratings, chessGames, checkersRatings, checkersGames, goRatings, goGames, awaleRatings, awaleGames, abaloneRatings, abaloneGames, yamsRatings, yamsGames, game421Ratings, game421Games, dominoRatings, dominoGames, rooms, updateNav
  };
  window.addEventListener("DOMContentLoaded", () => me().catch(() => updateNav()));
})();
