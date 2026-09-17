const test=require("node:test");
const assert=require("node:assert/strict");
const { resolveEmail }=require("../assets/js/login-identifier.js");

test("usa o domínio configurado para entrar com nome de usuário",()=>{
  assert.equal(resolveEmail(" Admin ","@Exemplo.COM"),"admin@exemplo.com");
});

test("continua aceitando e-mail completo sem alterar o domínio",()=>{
  assert.equal(resolveEmail(" pessoa@outro.com ","exemplo.com"),"pessoa@outro.com");
});

test("não inventa e-mail quando o domínio não foi configurado",()=>{
  assert.throws(()=>resolveEmail("admin",""),/LOGIN_EMAIL_DOMAIN/);
  assert.throws(()=>resolveEmail("admin","domínio inválido"),/LOGIN_EMAIL_DOMAIN/);
});

test("recusa nomes e e-mails malformados",()=>{
  assert.throws(()=>resolveEmail("admin@","exemplo.com"),/e-mail válido/);
  assert.throws(()=>resolveEmail("a b","exemplo.com"),/usuário válido/);
  assert.throws(()=>resolveEmail("","exemplo.com"),/usuário válido/);
});
