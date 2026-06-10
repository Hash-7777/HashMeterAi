// ==============================================================
// HashMeterAi — Window state: remember size + position
//
// Saves position + size to localStorage every 3 s.
// Restores on next launch, then shows the window.
// Prevents the window flashing in the wrong place.
// ==============================================================

(function () {
  if (!window.__TAURI_INTERNALS__) return;
  const invoke = window.__TAURI_INTERNALS__.invoke;
  if (!invoke) return;

  const readSaved = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };
  const finite = (v) => Number.isFinite(Number(v));

  const showWindow = async () => {
    try { await invoke('plugin:window|show'); } catch (_) {}
  };

  (async function init() {
    try {
      // Restore size before position so the OS does not visibly re-place the frame.
      const savedSize = readSaved('hma_win_size');
      if (savedSize && finite(savedSize.width) && finite(savedSize.height)) {
        try {
          await invoke('plugin:window|set_size', {
            value: {
              Physical: {
                width: Math.round(Number(savedSize.width)),
                height: Math.round(Number(savedSize.height))
              }
            }
          });
        } catch (_) {}
      }

      // Restore saved position, or center once after the restored size is known.
      const savedPos = readSaved('hma_win_pos');
      if (savedPos && finite(savedPos.x) && finite(savedPos.y)) {
        try {
          await invoke('plugin:window|set_position', {
            value: {
              Physical: {
                x: Math.round(Number(savedPos.x)),
                y: Math.round(Number(savedPos.y))
              }
            }
          });
        } catch (_) {
          try { await invoke('plugin:window|center'); } catch (_2) {}
        }
      } else {
        try { await invoke('plugin:window|center'); } catch (_) {}
      }

      // Save position + size every 3 s (only when changed)
      let lastX, lastY, lastW, lastH;
      setInterval(async () => {
        try {
          const pos = await invoke('plugin:window|outer_position');
          if (pos && (pos.x !== lastX || pos.y !== lastY)) {
            lastX = pos.x; lastY = pos.y;
            localStorage.setItem('hma_win_pos', JSON.stringify({ x: pos.x, y: pos.y }));
          }
        } catch (_) {}
        try {
          const size = await invoke('plugin:window|inner_size');
          if (size && (size.width !== lastW || size.height !== lastH)) {
            lastW = size.width; lastH = size.height;
            localStorage.setItem('hma_win_size', JSON.stringify({ width: size.width, height: size.height }));
          }
        } catch (_) {}
      }, 3000);
    } catch (_) {
    } finally {
      await showWindow();
    }
  })();
})();
