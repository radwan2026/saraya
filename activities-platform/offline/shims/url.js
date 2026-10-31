export const fileURLToPath = (u) => (u instanceof URL ? u.pathname : String(u));
export default { fileURLToPath };
