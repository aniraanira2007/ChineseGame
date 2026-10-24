import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function getStoredId(storage, key) {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function browserId(storageName, key) {
  try {
    return getStoredId(globalThis[storageName], key);
  } catch {
    return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function mountPlayerStats({ totalElement, onlineElement, statusElement }) {
  if (!totalElement || !onlineElement || !statusElement) return () => {};

  if (!projectUrl || !anonKey) {
    statusElement.textContent = "Counts need a connected analytics service.";
    return () => {};
  }

  const client = createClient(projectUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 1 } },
  });
  const visitorId = browserId("localStorage", "little-lantern-visitor-v1");
  const sessionId = browserId("sessionStorage", "little-lantern-session-v1");
  let stopped = false;
  let channel;
  let visitorReady = false;
  let presenceReady = false;
  let visitorFailed = false;
  let presenceFailed = false;

  const updateStatus = () => {
    if (visitorFailed && presenceFailed) statusElement.textContent = "Player counts are unavailable. Check the service setup and connection.";
    else if (visitorFailed) statusElement.textContent = "Live count is connected; total visitor count needs database setup.";
    else if (presenceFailed) statusElement.textContent = "Total visitors are counted; live count couldn’t connect.";
    else if (visitorReady && presenceReady) statusElement.textContent = "Anonymous browser counts; online means active sessions, not verified people.";
    else statusElement.textContent = "Connecting to player counts…";
  };

  updateStatus();
  client.rpc("register_game_visit", { p_visitor_id: visitorId }).then(({ data, error }) => {
    if (stopped) return;
    if (error) {
      totalElement.textContent = "—";
      visitorFailed = true;
      updateStatus();
      console.warn("Little Lantern visitor counter is not configured correctly.", error.message);
      return;
    }
    const count = Number(data);
    totalElement.textContent = Number.isFinite(count) ? count.toLocaleString() : "—";
    visitorReady = Number.isFinite(count);
    visitorFailed = !visitorReady;
    updateStatus();
  }).catch(error => {
    if (stopped) return;
    totalElement.textContent = "—";
    visitorFailed = true;
    updateStatus();
    console.warn("Little Lantern visitor count could not load.", error);
  });

  const renderOnline = () => {
    if (!channel || stopped) return;
    const state = channel.presenceState();
    const count = Object.values(state).reduce((total, sessions) => total + sessions.length, 0);
    onlineElement.textContent = count.toLocaleString();
  };

  channel = client.channel("little-lantern:game-presence", {
    config: { presence: { key: sessionId }, broadcast: { self: false } },
  });
  channel
    .on("presence", { event: "sync" }, renderOnline)
    .on("presence", { event: "join" }, renderOnline)
    .on("presence", { event: "leave" }, renderOnline)
    .subscribe(async status => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        try {
          await channel.track({ joinedAt: new Date().toISOString() });
          presenceReady = true;
          presenceFailed = false;
          updateStatus();
          renderOnline();
        } catch (error) {
          onlineElement.textContent = "—";
          presenceFailed = true;
          updateStatus();
          console.warn("Little Lantern live presence could not connect.", error);
        }
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        onlineElement.textContent = "—";
        presenceReady = false;
        presenceFailed = true;
        updateStatus();
        console.warn(`Little Lantern live presence status: ${status}.`);
      }
    });

  return () => {
    stopped = true;
    if (channel) client.removeChannel(channel);
  };
}
