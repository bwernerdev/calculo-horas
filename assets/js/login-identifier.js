(function exposeLoginIdentifier(root, factory) {
  const api=factory();
  if (typeof module==="object" && module.exports) module.exports=api;
  if (root) root.HoursLoginIdentifier=api;
})(typeof globalThis!=="undefined" ? globalThis : this, function createLoginIdentifier() {
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernamePattern=/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;
  const domainPattern=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

  function resolveEmail(identifier, configuredDomain) {
    const value=String(identifier || "").trim();
    if (value.includes("@")) {
      if (!emailPattern.test(value)) throw new Error("Informe um e-mail válido ou apenas o nome de usuário.");
      return value;
    }
    if (!usernamePattern.test(value)) throw new Error("Informe um nome de usuário válido, como admin.");
    const domain=String(configuredDomain || "").trim().replace(/^@/, "").toLowerCase();
    if (!domainPattern.test(domain)) throw new Error("O login por usuário ainda não foi configurado. Informe o e-mail completo ou configure LOGIN_EMAIL_DOMAIN.");
    return `${value.toLowerCase()}@${domain}`;
  }

  return { resolveEmail };
});
