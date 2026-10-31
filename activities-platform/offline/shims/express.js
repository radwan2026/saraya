// موجّه بسيط متوافق مع ما يستخدمه app.js من Express 5، يعمل داخل المتصفح.
function compile(path) {
  const keys = [];
  const src = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  return { re: new RegExp(`^${src}$`), keys };
}

function match(layer, req) {
  if (layer.method === null) {
    if (!layer.prefix) return {};
    return req.path === layer.prefix || req.path.startsWith(`${layer.prefix}/`) ? {} : null;
  }
  if (layer.method !== req.method) return null;
  const m = req.path.match(layer.re);
  if (!m) return null;
  return Object.fromEntries(layer.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}

export default function express() {
  const stack = [];
  const route = (method) => (path, ...handlers) => { stack.push({ method, ...compile(path), handlers }); };
  const app = {
    get: route('GET'), post: route('POST'), put: route('PUT'), patch: route('PATCH'), delete: route('DELETE'),
    use(prefix, ...handlers) {
      if (typeof prefix === 'function') { handlers.unshift(prefix); prefix = null; }
      stack.push({ method: null, prefix, handlers });
    },
    disable() {}, set() {}, listen() {},
    handle(req, res) {
      return new Promise((resolve) => {
        res.onDone = resolve;
        let i = 0;
        let layer = null;
        let h = 0;
        const next = (err) => {
          for (;;) {
            if (layer && h < layer.handlers.length) {
              const fn = layer.handlers[h++];
              if (err ? fn.length !== 4 : fn.length === 4) continue;
              try {
                const r = err ? fn(err, req, res, next) : fn(req, res, next);
                if (r && typeof r.then === 'function') r.catch((e) => next(e));
              } catch (e) { next(e); }
              return;
            }
            layer = null;
            if (i >= stack.length) {
              if (!res.finished) res.status(err ? 500 : 404).json({ error: err ? String(err.message || err) : 'Not found' });
              return;
            }
            const candidate = stack[i++];
            const params = match(candidate, req);
            if (params) { req.params = params; layer = candidate; h = 0; }
          }
        };
        next();
      });
    },
  };
  return app;
}
express.json = () => (req, res, next) => next();
express.static = () => (req, res, next) => next();
