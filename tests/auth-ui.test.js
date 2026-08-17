const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");

test("separa login e cadastro em abas acessiveis", () => {
  assert.match(html, /id="login-tab"[^>]*role="tab"/);
  assert.match(html, /id="signup-tab"[^>]*role="tab"/);
  assert.match(html, /id="signup-form"[^>]*role="tabpanel"/);
});

test("cadastro exige confirmacao de senha igual", () => {
  assert.match(html, /id="signup-password-confirmation"/);
  assert.match(script, /password !== confirmation/);
  assert.match(script, /As senhas não coincidem/);
});

test("oferece recuperacao, reenvio, senha visivel e forca minima", () => {
  assert.match(html, /id="forgot-password-button"/);
  assert.match(html, /id="recovery-form"/);
  assert.match(html, /id="resend-confirmation-button"/);
  assert.match(html, /data-toggle-password="auth-password"/);
  assert.match(script, /resetPasswordForEmail/);
  assert.match(script, /auth\.resend/);
  assert.match(script, /isStrongPassword/);
});

test("integra Turnstile sem expor chave secreta", () => {
  assert.match(script, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(script, /captchaToken/);
  assert.match(script, /container\.clientWidth < 300 \? "compact" : "flexible"/);
  assert.match(script, /script\.onload/);
  assert.match(script, /appearance: "always"/);
  assert.match(script, /Carregando validação contra robôs/);
  assert.doesNotMatch(script, /TURNSTILE_SECRET/);
});

test("protege login, cadastro e recuperação com Turnstile", () => {
  assert.match(html, /id="login-turnstile-container"/);
  assert.match(html, /id="signup-turnstile-container"/);
  assert.match(html, /id="recovery-turnstile-container"/);
  assert.match(script, /signInWithPassword\(\{ email, password, options \}\)/);
  assert.match(script, /options\.captchaToken = captchaTokens\.recovery/);
});
