(function initializeTheme() {
  let preference;
  try { preference = localStorage.getItem("controle-horas-tema-v1"); } catch {}
  document.documentElement.dataset.theme = preference === "dark" ? "dark" : "light";
})();
