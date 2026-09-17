function setAuthMessage(message, type = "error") {
  const element = $("#auth-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function setSignupMessage(message, type = "error") {
  const element = $("#signup-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function setRecoveryMessage(message, type = "error") {
  const element = $("#recovery-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function translateAuthError(error) {
  const translations = {
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar.",
    user_already_exists: "Este e-mail já possui uma conta.",
    signup_disabled: "A criação de novas contas está desativada.",
    over_email_send_rate_limit: "Muitos e-mails foram solicitados. Aguarde alguns minutos.",
    weak_password: "A senha não atende aos requisitos de segurança.",
    same_password: "A nova senha deve ser diferente da senha atual.",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  };
  return translations[error?.code] || translations[error?.message] || "Não foi possível concluir a operação. Tente novamente.";
}
function passwordRules(password) {
  return { length: password.length >= 8, uppercase: /[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(password), number: /\d/.test(password) };
}
function isStrongPassword(password) { return Object.values(passwordRules(password)).every(Boolean); }
function updatePasswordStrength(input, list) {
  const rules = passwordRules(input.value);
  Object.entries(rules).forEach(([rule, valid]) => list.querySelector(`[data-rule="${rule}"]`).classList.toggle("password-rule--valid", valid));
}
function selectAuthTab(tab) {
  const signup = tab === "signup";
  $("#auth-form").hidden = signup; $("#signup-form").hidden = !signup; $("#recovery-form").hidden = true;
  $("#login-tab").classList.toggle("auth-tab--active", !signup);
  $("#signup-tab").classList.toggle("auth-tab--active", signup);
  $("#login-tab").setAttribute("aria-selected", String(!signup));
  $("#signup-tab").setAttribute("aria-selected", String(signup));
  (signup ? $("#signup-email") : $("#auth-email")).focus();
}
function clearSensitiveState() {
  applicationGeneration+=1;
  for (const timer of manualBalanceSaveTimers.values()) clearTimeout(timer);
  manualBalanceSaveTimers.clear();
  clearHistoryRange();
  closeForpontoPreview();
  if ($("#confirm-dialog").open) $("#confirm-cancel").click();
  stopCamera();
  document.querySelectorAll("dialog[open]").forEach((dialog)=>dialog.close());
  repository?.dispose?.();
  repository=undefined; useCases=undefined; loadedUserId=""; applicationLoad=undefined; records=[];
  pendingPhotos={entrada:"",saida:""}; capturedPhoto="";
  document.querySelectorAll('input[type="password"]').forEach((input)=>{ input.value=""; input.type="password"; });
  document.querySelectorAll("[data-toggle-password]").forEach((button)=>{ button.textContent="Mostrar"; button.setAttribute("aria-label","Mostrar senha"); });
  document.querySelectorAll(".password-strength li").forEach((item)=>item.classList.remove("password-rule--valid"));
  $("#records-body").replaceChildren(); $("#photo-gallery").replaceChildren();
  $("#photo-dialog-image").removeAttribute("src");
  $("#entry-photo-image").src=""; $("#exit-photo-image").src="";
  $("#change-password-form").reset();
}
function showAuthentication() {
  clearSensitiveState();
  applyTheme(); $("#auth-screen").hidden = false; $("#password-setup-screen").hidden = true; $("#app-content").hidden = true; $("#logout-button").hidden = true; $("#change-password-button").hidden = true;
}
function showPasswordSetup() {
  applyTheme(); $("#auth-screen").hidden = true; $("#password-setup-screen").hidden = false; $("#app-content").hidden = true; $("#logout-button").hidden = false; $("#change-password-button").hidden = true;
}
async function loadApplication(user) {
  if (loadedUserId===user.id && repository) return applicationLoad;
  repository?.dispose?.();
  const generation=++applicationGeneration;
  loadedUserId=user.id;
  const nextRepository=HoursRepository.createSupabaseRepository(supabaseClient,user.id);
  const nextUseCases=HoursUseCases.createHoursUseCases({ calculator:HoursCalculator, repository:nextRepository, fixedBreakMinutes:FIXED_BREAK_MINUTES, maxDailyWorkMinutes:MAX_DAILY_WORK_MINUTES });
  repository=nextRepository; useCases=nextUseCases;
  applicationLoad=(async()=>{
  try {
    const [loadedRecords,loadedSettings] = await Promise.all([nextRepository.findAllRecords(), nextUseCases.getSettings()]);
    if (generation!==applicationGeneration) { nextRepository.dispose(); return; }
    records=loadedRecords; settings=loadedSettings;
    clearHistoryRange();
    $("#work-date").value=localDate(); $("#month-filter").value=HoursCycle.monthForDate(localDate()); $("#daily-target").value=toClock(settings.target); loadManualBalance();
    $("#break-time").value=FIXED_BREAK_MINUTES; applyTheme(); updateForecast(); render();
    $("#auth-screen").hidden = true; $("#password-setup-screen").hidden = true; $("#app-content").hidden = false; $("#logout-button").hidden = false; $("#change-password-button").hidden = false;
    window.AppMonitor?.flush();
  } catch (error) {
    captureError(error,"application-load");
    if (generation!==applicationGeneration) { nextRepository.dispose(); return; }
    showAuthentication(); setAuthMessage(`Não foi possível carregar seus dados: ${error.message}`);
  }
  finally { if (generation===applicationGeneration) applicationLoad=undefined; }
  })();
  return applicationLoad;
}
async function restoreSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) showAuthentication();
  else if (requiresPasswordSetup) showPasswordSetup();
  else await loadApplication(session.user);
}
$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setAuthMessage("");
  const email = $("#auth-email").value.trim(), password = $("#auth-password").value;
  $("#auth-password").value="";
  if ($("#remember-access").checked) appStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  else appStorage.removeItem(REMEMBERED_EMAIL_KEY);
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) setAuthMessage(translateAuthError(error));
});
$("#login-tab").addEventListener("click", () => selectAuthTab("login"));
$("#signup-tab").addEventListener("click", () => selectAuthTab("signup"));
$("#forgot-password-button").addEventListener("click", () => {
  $("#auth-form").hidden = true; $("#signup-form").hidden = true; $("#recovery-form").hidden = false;
  $("#recovery-email").value = $("#auth-email").value; $("#recovery-email").focus();
});
$("#recovery-back-button").addEventListener("click", () => selectAuthTab("login"));
$("#recovery-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setRecoveryMessage("");
  const email = $("#recovery-email").value.trim();
  const submit = event.submitter; submit.disabled = true; submit.textContent = "Enviando...";
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}` });
  submit.disabled = false; submit.textContent = "Enviar link";
  setRecoveryMessage(error ? translateAuthError(error) : "Link enviado. Confira sua caixa de entrada e o spam.", error ? "error" : "success");
});
document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => {
  const input = document.getElementById(button.dataset.togglePassword);
  const visible = input.type === "text"; input.type = visible ? "password" : "text";
  button.textContent = visible ? "Mostrar" : "Ocultar"; button.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
}));
$("#signup-password").addEventListener("input", () => updatePasswordStrength($("#signup-password"), $("#signup-password-strength")));
$("#new-password").addEventListener("input", () => updatePasswordStrength($("#new-password"), $("#setup-password-strength")));
$("#account-new-password").addEventListener("input", () => updatePasswordStrength($("#account-new-password"), $("#account-password-strength")));
$("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setSignupMessage("");
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const confirmation = $("#signup-password-confirmation").value;
  if (!email || !isStrongPassword(password)) {
    setSignupMessage("Use pelo menos 8 caracteres, uma letra maiúscula e um número.");
    return;
  }
  if (password !== confirmation) {
    setSignupMessage("As senhas não coincidem.");
    return;
  }
  const button = $("#signup-button");
  button.disabled = true; button.textContent = "Criando conta...";
  const options = { emailRedirectTo: `${window.location.origin}${window.location.pathname}` };
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options });
  button.disabled = false; button.textContent = "Criar conta";
  if (error) { setSignupMessage(translateAuthError(error)); return; }
  $("#signup-password").value=""; $("#signup-password-confirmation").value="";
  $("#resend-confirmation-button").hidden = Boolean(data.session);
  setSignupMessage(
    data.session ? "Conta criada com sucesso." : "Conta criada. Confira seu e-mail para confirmar o cadastro.",
    "success"
  );
});
$("#resend-confirmation-button").addEventListener("click", async () => {
  const email = $("#signup-email").value.trim();
  if (!email) { setSignupMessage("Informe o e-mail usado no cadastro."); return; }
  const button = $("#resend-confirmation-button"); button.disabled = true; button.textContent = "Reenviando...";
  const { error } = await supabaseClient.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
  button.disabled = false; button.textContent = "Reenviar confirmação";
  setSignupMessage(error ? translateAuthError(error) : "Confirmação reenviada. Confira também o spam.", error ? "error" : "success");
});
$("#password-setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("#password-setup-message");
  const password = $("#new-password").value;
  const confirmation = $("#confirm-password").value;
  message.hidden = true;
  if (!isStrongPassword(password)) {
    message.textContent = "Use pelo menos 8 caracteres, uma letra maiúscula e um número."; message.hidden = false; return;
  }
  if (password !== confirmation) {
    message.textContent = "As senhas não coincidem."; message.hidden = false; return;
  }
  const submit = event.submitter;
  submit.disabled = true; submit.textContent = "Salvando...";
  const { data, error } = await supabaseClient.auth.updateUser({ password });
  submit.disabled = false; submit.textContent = "Salvar senha e entrar";
  if (error) { message.textContent = translateAuthError(error); message.hidden = false; return; }
  requiresPasswordSetup = false;
  window.history.replaceState({}, document.title, window.location.pathname);
  await loadApplication(data.user);
  showToast("Senha definida com sucesso.");
});
function closeChangePasswordDialog() {
  $("#change-password-form").reset();
  $("#change-password-message").hidden = true;
  $("#account-password-strength").querySelectorAll("li").forEach((item) => item.classList.remove("password-rule--valid"));
  if ($("#change-password-dialog").open) $("#change-password-dialog").close();
}
$("#change-password-button").addEventListener("click", () => { $("#change-password-dialog").showModal(); $("#current-password").focus(); });
$("#change-password-cancel").addEventListener("click", closeChangePasswordDialog);
$("#change-password-dialog").addEventListener("cancel", (event) => { event.preventDefault(); closeChangePasswordDialog(); });
$("#change-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentPassword = $("#current-password").value;
  const password = $("#account-new-password").value;
  const confirmation = $("#account-password-confirmation").value;
  const message = $("#change-password-message");
  message.hidden = true;
  if (!isStrongPassword(password)) { message.textContent = "Use pelo menos 8 caracteres, uma letra maiúscula e um número."; message.hidden = false; return; }
  if (password !== confirmation) { message.textContent = "As senhas não coincidem."; message.hidden = false; return; }
  if (password === currentPassword) { message.textContent = "A nova senha deve ser diferente da senha atual."; message.hidden = false; return; }
  const submit = event.submitter; submit.disabled = true; submit.textContent = "Alterando...";
  const { error } = await supabaseClient.auth.updateUser({ password, current_password:currentPassword });
  submit.disabled = false; submit.textContent = "Salvar nova senha";
  if (error) { message.textContent = error.code==="invalid_credentials" ? "A senha atual está incorreta." : translateAuthError(error); message.hidden = false; return; }
  closeChangePasswordDialog(); showToast("Senha alterada com sucesso.");
});
$("#logout-button").addEventListener("click", async () => {
  $("#logout-button").disabled=true;
  const { error }=await supabaseClient.auth.signOut();
  $("#logout-button").disabled=false;
  if (error) showToast(translateAuthError(error),"error");
  else showAuthentication();
});
supabaseClient.auth.onAuthStateChange((event, session) => {
  queueMicrotask(()=>{
    if (!session) showAuthentication();
    else if (requiresPasswordSetup) showPasswordSetup();
    else if (event!=="TOKEN_REFRESHED" && session.user.id!==loadedUserId) loadApplication(session.user);
  });
});
restoreSession();
