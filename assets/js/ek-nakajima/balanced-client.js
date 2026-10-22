// One solve in flight and at most one queued request: dragging never builds
// an obsolete solver backlog. The generated worker also works offline.
import { BALANCED_WORKER_SOURCE } from './balanced-worker-source.js';
import { solveBalancedAtlas } from './balanced-model.js';

export function createBalancedClient(options = {}) {
  let worker = null, active = null, queued = null, revision = 0, epoch = 0, previous = null;
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    const url = URL.createObjectURL(new Blob([BALANCED_WORKER_SOURCE], { type: 'text/javascript' }));
    try { worker = new Worker(url); } catch (_) { worker = null; }
    finally { URL.revokeObjectURL(url); }
  }
  function deliver(result) {
    const request = active;
    active = null;
    if (request && request.id === revision) request.callback(result);
    else if (request && request.epoch === epoch && result.success && options.onProgress) {
      options.onProgress(result, request.parameters);
    }
    if (queued) { const next = queued; queued = null; start(next); }
  }
  if (worker) {
    worker.onmessage = event => deliver(event.data);
    worker.onerror = () => {
      worker.terminate(); worker = null;
      deliver({ success: false, diagnostics: { status: 'worker_error' } });
    };
  }
  function start(request) {
    active = request;
    if (worker) { worker.postMessage(request.parameters); return; }
    let result;
    try {
      result = solveBalancedAtlas(request.parameters, undefined, { previous });
      if (result.success) previous = result;
    } catch (error) {
      result = { success: false, diagnostics: { status: 'solver_error', message: String(error) } };
    }
    deliver(result);
  }
  return {
    request(parameters, callback) {
      const next = { id: ++revision, epoch, parameters, callback };
      if (active) queued = next; else start(next);
    },
    invalidate() { revision++; epoch++; queued = null; },
    dispose() { revision++; epoch++; queued = null; if (worker) worker.terminate(); worker = null; }
  };
}
