/**
 * Anti-inspect protections (best-effort, cannot fully prevent a determined user).
 * Blocks: right-click, common devtools shortcuts, text selection on sensitive UI,
 * and clears the page when devtools appears to be open.
 */
export function installAntiInspect() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;

  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Right-click
  window.addEventListener("contextmenu", block, { capture: true });

  // Keyboard shortcuts: F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U, Ctrl/Cmd+S
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (
        k === "f12" ||
        (mod && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
        (mod && (k === "u" || k === "s"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );

  // Devtools open detection (size heuristic + debugger timing)
  const nuke = () => {
    try {
      document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#fff;font-family:sans-serif;font-size:16px;text-align:center;padding:24px" dir="rtl">تم إغلاق الصفحة لأسباب أمنية.</div>';
    } catch {}
    try {
      window.location.replace("about:blank");
    } catch {}
  };

  const check = () => {
    const threshold = 160;
    const wDiff = window.outerWidth - window.innerWidth;
    const hDiff = window.outerHeight - window.innerHeight;
    if (wDiff > threshold || hDiff > threshold) nuke();
  };
  setInterval(check, 1000);

  // Debugger timing check
  setInterval(() => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - start > 100) nuke();
  }, 2000);

  // Disable console
  try {
    const noop = () => undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = window.console as any;
    ["log", "warn", "info", "debug", "error", "table", "dir"].forEach((k) => {
      c[k] = noop;
    });
  } catch {}
}
