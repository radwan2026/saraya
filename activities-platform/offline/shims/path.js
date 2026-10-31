const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');
const dirname = (p) => String(p).replace(/\/[^/]*$/, '') || '/';
const resolve = (...parts) => join(...parts);
export { join, dirname, resolve };
export default { join, dirname, resolve };
