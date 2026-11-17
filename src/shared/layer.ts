// A small dialog over the page (or over an open dialog, which keeps its state underneath), the same in every app:
// tapping outside it or a [data-action=<closeAction>] button closes it, Escape closes it, Tab stays inside it and the
// arrows move around a .pick-grid (the month and year picker). Focus goes into it when it opens and back to whatever
// opened it when it closes.
import type { AppName } from './apps.ts';
import { onShown } from './apps.ts';
import { esc } from './html.ts';

export interface LayerOptions {
  id: string;                       // the dialog's element id (each app has its own)
  host: () => Element;              // where it is put
  closeAction?: string;             // the data-action that closes it (default 'layer-close')
  panelClass?: string;              // extra classes on the panel
  focus?: string;                   // what gets the focus first, as a selector list tried in order (default: FOCUS_ORDER)
  onClose?: () => void;             // after it closes, however that happened
  onCancel?: () => void;            // when the user closed it (outside, a close button or Escape), before onClose
}

const FOCUS_ORDER = '[aria-pressed="true"]:not(:disabled), .pick.now:not(:disabled), [data-focus], .pick:not(:disabled), button:not(:disabled)';
const TABBABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';
const GRID_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };

export function makeLayer(app: AppName, o: LayerOptions) {
  const closeAction = o.closeAction ?? 'layer-close';
  let from: HTMLElement | null = null;
  const el = () => document.getElementById(o.id);

  // Replaces the open one without closing it, so a dialog that redraws itself (the picker) keeps its state.
  function open(html: string, label: string, opts: { from?: HTMLElement; role?: 'dialog' | 'alertdialog' } = {}) {
    const old = el();
    if (!old) from = opts.from ?? (document.activeElement as HTMLElement | null);
    old?.remove();
    const layer = document.createElement('div');
    layer.id = o.id;
    layer.className = 'scrim layer';
    layer.dataset.action = closeAction;
    layer.innerHTML = `<div class="panel${o.panelClass ? ` ${o.panelClass}` : ''}" role="${opts.role ?? 'dialog'}" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    o.host().appendChild(layer);
    const sels = (o.focus ?? FOCUS_ORDER).split(',');
    for (const q of sels) { const b = layer.querySelector<HTMLElement>(q.trim()); if (b) { b.focus(); break; } }
  }

  function close(refocus = true) {
    const layer = el();
    if (!layer) return;
    layer.remove();
    o.onClose?.();
    if (refocus && from?.isConnected) from.focus();
    from = null;
  }
  const cancel = () => { o.onCancel?.(); close(); };

  onShown(app, 'click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (b?.dataset.action !== closeAction || !el()?.contains(b)) return;
    if (ev.target === b || b.tagName === 'BUTTON') cancel();   // the scrim itself, not a tap inside the panel
  });

  onShown(app, 'keydown', (ev) => {
    const layer = el();
    if (!layer) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); cancel(); return; }
    const at = document.activeElement as HTMLButtonElement;
    if (ev.key === 'Tab') {
      const all = [...layer.querySelectorAll<HTMLElement>(TABBABLE)];
      const i = all.indexOf(at);
      const to = ev.shiftKey ? (i <= 0 ? all[all.length - 1] : null) : (i === -1 || i === all.length - 1 ? all[0] : null);
      if (to) { ev.preventDefault(); to.focus(); }
      return;
    }
    const grid = at?.closest('.pick-grid');
    if (!GRID_STEP[ev.key] || !grid) return;
    ev.preventDefault();
    const cells = [...grid.querySelectorAll<HTMLButtonElement>('button')];
    const next = cells[cells.indexOf(at) + GRID_STEP[ev.key]];
    if (next && !next.disabled) next.focus();
  });

  return { open, close, el };
}
