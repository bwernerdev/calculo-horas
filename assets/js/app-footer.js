// Rodapé com a versão (ou o commit do deploy), útil para suporte.
{
  const version=String(window.APP_CONFIG?.version || "desenvolvimento");
  $("#app-version").textContent=/^[0-9a-f]{12}$/.test(version) ? "build "+version : "versão "+version;
}
