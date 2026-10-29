// Abre um menu suspenso do histórico (Exportar, Importar ou Mais) antes de clicar em um item.
async function openMenu(page, name) {
  await page.locator("details.menu > summary", { hasText: name }).click();
}

module.exports = { openMenu };
