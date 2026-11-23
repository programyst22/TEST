// ==UserScript==
// @name         Rugs.fun Mobile Paper Bot Bridge
// @namespace    https://programyst22.github.io/TEST/
// @version      1.0.0
// @description  Forwards incoming public game events from your logged-in Rugs.fun browser tab to your paper-trading dashboard. Does not read or export cookies, tokens, or credentials.
// @match        https://rugs.fun/*
// @match        https://www.rugs.fun/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(() => {
  "use strict";
  if (window.__rugsPaperMobileBridgeInstalled) return;
  window.__rugsPaperMobileBridgeInstalled = true;

  const APP_URL = "https://programyst22.github.io/TEST/rugs-bot/?mobileBridge=1";
  const APP_ORIGIN = "https://programyst22.github.io";
  const BACKEND_HOST = "backend.rugs.fun";
  let panelFrame = null;
  let panelWrap = null;
  let pending = [];
  let socketSeen = false;

  function sendToPanel(message) {
    const packet = { source: "rugs-mobile-bridge", ...message };
    if (panelFrame && panelFrame.contentWindow) {
      try { panelFrame.contentWindow.postMessage(packet, APP_ORIGIN); return; } catch (_) {}
    }
    if (pending.length < 300) pending.push(packet);
  }

  function flushQueue() {
    if (!panelFrame || !panelFrame.contentWindow) return;
    const queue = pending;
    pending = [];
    for (const item of queue) {
      try { panelFrame.contentWindow.postMessage(item, APP_ORIGIN); } catch (_) {}
    }
  }

  function parseSocketPacket(raw) {
    if (typeof raw !== "string" || !raw.startsWith("42")) return;
    let body = raw.slice(2);
    // Socket.IO namespace packets can look like 42/admin,[...]
    if (body.startsWith("/")) {
      const comma = body.indexOf(",");
      if (comma < 0) return;
      body = body.slice(comma + 1);
    }
    try {
      const packet = JSON.parse(body);
      if (!Array.isArray(packet) || typeof packet[0] !== "string") return;
      sendToPanel({ kind: "event", event: packet[0], payload: packet[1] ?? null });
    } catch (_) {}
  }

  const NativeWebSocket = window.WebSocket;
  if (NativeWebSocket) {
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, args) {
        const ws = Reflect.construct(target, args, target);
        let url = "";
        try { url = String(args[0] || ""); } catch (_) {}
        if (url.includes(BACKEND_HOST)) {
          ws.addEventListener("open", () => {
            socketSeen = true;
            sendToPanel({ kind: "status", connected: true, transport: "WebSocket Rugs.fun" });
          });
          ws.addEventListener("close", () => {
            sendToPanel({ kind: "status", connected: false, transport: "WebSocket отключён" });
          });
          ws.addEventListener("message", event => parseSocketPacket(event.data));
        }
        return ws;
      }
    });
    // Proxy inherits the native WebSocket prototype and static constants.
  }

  function addPanel() {
    if (!document.documentElement || document.getElementById("rugs-paper-mobile-host")) return;
    const host = document.createElement("div");
    host.id = "rugs-paper-mobile-host";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:12px;bottom:18px;";
    const shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    const style = document.createElement("style");
    style.textContent = `
      .launch{border:0;border-radius:999px;background:#d8b45b;color:#171717;font:700 13px system-ui;padding:13px 17px;box-shadow:0 4px 18px #0008}
      .wrap{position:fixed;inset:0;background:#090d14;z-index:2147483647;display:flex;flex-direction:column}
      .bar{height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#111a27;color:#fff;font:600 13px system-ui}
      .close{border:0;background:#26364a;color:#fff;border-radius:8px;padding:7px 12px;font:600 13px system-ui}
      iframe{border:0;width:100%;height:calc(100% - 44px);background:#090d14}
    `;
    shadow.appendChild(style);
    const launch = document.createElement("button");
    launch.className = "launch";
    launch.textContent = "ОТКРЫТЬ PAPER BOT";
    launch.addEventListener("click", () => {
      if (panelWrap) { panelWrap.style.display = "flex"; flushQueue(); return; }
      panelWrap = document.createElement("div");
      panelWrap.className = "wrap";
      const bar = document.createElement("div");
      bar.className = "bar";
      const label = document.createElement("span");
      label.textContent = "RUGS.FUN · PAPER BOT";
      const close = document.createElement("button");
      close.className = "close";
      close.textContent = "Закрыть";
      close.addEventListener("click", () => { panelWrap.style.display = "none"; });
      bar.append(label, close);
      panelFrame = document.createElement("iframe");
      panelFrame.src = APP_URL;
      panelFrame.setAttribute("allow", "clipboard-write");
      panelFrame.addEventListener("load", () => {
        flushQueue();
        if (socketSeen) sendToPanel({ kind: "status", connected: true, transport: "WebSocket Rugs.fun" });
      });
      panelWrap.append(bar, panelFrame);
      shadow.appendChild(panelWrap);
      launch.style.display = "none";
    });
    shadow.appendChild(launch);
    document.documentElement.appendChild(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addPanel, { once: true });
  } else {
    addPanel();
  }
  // SPA navigation may replace document contents; restore the launcher if needed.
  const observer = new MutationObserver(() => {
    if (!document.getElementById("rugs-paper-mobile-host")) addPanel();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();