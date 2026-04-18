// ===============================
// K3-Z | stateManager.js
// Central Brain Engine
// ===============================

(function () {
  "use strict";

  const STATE_KEY = "K3Z_PROJECT_STATE";

  const DEFAULT_STATE = {
    version: "K3-Z + BDR1",
    firebase_connected: false,
    auto_focus: false,

    featured_mode: "activity_score",
    notifications_count: 0,
    ui_state: "home_chat",
    users_online: 0,

    last_update: Date.now()
  };

  let cache = loadState();
  let subscribers = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function normalize(input) {
    const src = input && typeof input === "object" ? input : {};
    const base = clone(DEFAULT_STATE);

    return {
      version: typeof src.version === "string" ? src.version : base.version,
      firebase_connected: !!src.firebase_connected,
      auto_focus: !!src.auto_focus,

      featured_mode:
        typeof src.featured_mode === "string" ? src.featured_mode : base.featured_mode,

      notifications_count: Number.isFinite(Number(src.notifications_count))
        ? Number(src.notifications_count)
        : base.notifications_count,

      ui_state: typeof src.ui_state === "string" ? src.ui_state : base.ui_state,

      users_online: Number.isFinite(Number(src.users_online))
        ? Number(src.users_online)
        : base.users_online,

      last_update: Number.isFinite(Number(src.last_update))
        ? Number(src.last_update)
        : Date.now()
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (!saved) return clone(DEFAULT_STATE);

      const parsed = safeParse(saved);
      if (!parsed) return clone(DEFAULT_STATE);

      return normalize(parsed);
    } catch (_) {
      return clone(DEFAULT_STATE);
    }
  }

  function persist(nextState) {
    cache = normalize(nextState);
    cache.last_update = Date.now();

    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(cache));
    } catch (err) {
      console.warn("K3_STATE save failed:", err);
    }

    notifySubscribers(cache);
    syncExternalSystems();
    emitChange();
  }

  function getState() {
    return clone(cache);
  }

  function saveState(nextState) {
    persist(nextState);
    return getState();
  }

  function updateState(partial) {
    const current = loadState();
    const next = normalize({
      ...current,
      ...(partial && typeof partial === "object" ? partial : {})
    });
    persist(next);
    return getState();
  }

  function resetState() {
    persist(clone(DEFAULT_STATE));
    return getState();
  }

  function incrementNotifications(step = 1) {
    const amount = Number.isFinite(Number(step)) ? Number(step) : 1;
    const next = getState();
    next.notifications_count = Math.max(0, Number(next.notifications_count || 0) + amount);
    persist(next);
    return next.notifications_count;
  }

  function setNotificationsCount(count) {
    const next = getState();
    next.notifications_count = Math.max(0, Number(count) || 0);
    persist(next);
    return next.notifications_count;
  }

  function setFirebaseConnected(isConnected) {
    return updateState({
      firebase_connected: !!isConnected
    });
  }

  function setUIState(uiState) {
    return updateState({
      ui_state: String(uiState || "home_chat")
    });
  }

  function setFeaturedMode(mode) {
    return updateState({
      featured_mode: String(mode || "activity_score")
    });
  }

  function setUsersOnline(count) {
    return updateState({
      users_online: Math.max(0, Number(count) || 0)
    });
  }

  function setAutoFocus(value) {
    return updateState({
      auto_focus: !!value
    });
  }

  function subscribe(callback) {
    if (typeof callback !== "function") return () => {};

    subscribers.push(callback);

    try {
      callback(getState());
    } catch (_) {}

    return function unsubscribe() {
      subscribers = subscribers.filter((fn) => fn !== callback);
    };
  }

  function notifySubscribers(state) {
    subscribers.slice().forEach((fn) => {
      try {
        fn(clone(state));
      } catch (err) {
        console.warn("K3_STATE subscriber failed:", err);
      }
    });
  }

  function syncExternalSystems() {
    const snapshot = getState();

    // Health monitor support
    try {
      if (window.K3_HEALTH && typeof window.K3_HEALTH === "object") {
        window.K3_HEALTH.state = true;
      }
      if (window.K3_HEALTH_API && typeof window.K3_HEALTH_API.mark === "function") {
        window.K3_HEALTH_API.mark("state");
      }
    } catch (_) {}

    // Legacy / compatibility support
    try {
      if (window.K3Z_STATE && window.K3Z_STATE !== api) {
        // keep compatibility alias in sync later below
      }
    } catch (_) {}

    // If the event system exists, announce the updated snapshot
    try {
      if (window.K3_SYSTEM && typeof window.K3_SYSTEM.emit === "function") {
        window.K3_SYSTEM.emit("state:changed", snapshot);
      }
    } catch (_) {}
  }

  function emitChange() {
    try {
      if (window.CustomEvent && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("k3-state:changed", {
            detail: getState()
          })
        );
      }
    } catch (_) {}
  }

  const api = {
    get: getState,
    save: saveState,
    update: updateState,
    reset: resetState,

    notify: incrementNotifications,
    setNotificationsCount,
    setFirebaseConnected,
    setUIState,
    setFeaturedMode,
    setUsersOnline,
    setAutoFocus,

    subscribe,
    load: loadState
  };

  // Optional compatibility aliases used by previous versions
  window.K3_STATE = api;
  window.K3Z_STATE = api;

  // Initial sync
  try {
    syncExternalSystems();
  } catch (_) {}

  // Auto-mark when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (window.K3_HEALTH && typeof window.K3_HEALTH === "object") {
        window.K3_HEALTH.state = true;
      }
      if (window.K3_HEALTH_API && typeof window.K3_HEALTH_API.mark === "function") {
        window.K3_HEALTH_API.mark("state");
      }
    } catch (_) {}
  });
})();
