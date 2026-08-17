const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const css = fs.readFileSync("style.css", "utf8");

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

test("mantém autenticação sem dependência de CAPTCHA", () => {
  assert.doesNotMatch(html, /turnstile|captcha/i);
  assert.doesNotMatch(script, /turnstile|captcha/i);
  assert.match(script, /signInWithPassword\(\{ email, password \}\)/);
});

test("lembra somente o e-mail e mantém a sessão do Supabase", () => {
  assert.match(html, /id="remember-access"/);
  assert.match(html, /Lembrar meu e-mail neste dispositivo/);
  assert.match(script, /REMEMBERED_EMAIL_KEY/);
  assert.match(script, /persistSession:true/);
  assert.match(script, /localStorage\.setItem\(REMEMBERED_EMAIL_KEY, email\)/);
  assert.doesNotMatch(script, /localStorage\.setItem\([^,]*password/i);
});

test("permite ao usuário autenticado alterar a própria senha", () => {
  assert.match(html, /id="change-password-button"/);
  assert.match(html, /id="change-password-button"[\s\S]*id="logout-button"/);
  assert.match(html, /id="current-password"[^>]*autocomplete="current-password"/);
  assert.match(html, /id="account-password-confirmation"/);
  assert.match(script, /auth\.updateUser\(\{ password, current_password:currentPassword \}\)/);
  assert.match(script, /A senha atual está incorreta/);
});

test("limpa dados sensíveis e recursos ao encerrar a sessão", () => {
  assert.match(script, /function clearSensitiveState/);
  assert.match(script, /repository\?\.dispose/);
  assert.match(script, /input\[type="password"\]/);
  assert.match(script, /stopCamera\(\)/);
});

test("checkbox de lembrar e-mail não herda dimensões dos campos de texto", () => {
  assert.match(css, /\.remember-access input\[type="checkbox"\][^{]*\{[^}]*min-height:20px/);
  assert.match(css, /\.remember-access input\[type="checkbox"\]:focus-visible/);
});
