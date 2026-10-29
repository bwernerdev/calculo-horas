// Menus suspensos (details.menu): um aberto por vez, fecham ao escolher, clicar fora ou com Esc.
const menus = [...document.querySelectorAll("details[data-menu]")];
function closeMenus(except) {
  for (const menu of menus) if (menu !== except && menu.open) menu.open = false;
}
for (const menu of menus) {
  menu.addEventListener("toggle", () => { if (menu.open) closeMenus(menu); });
  menu.addEventListener("click", (event) => { if (event.target.closest(".menu__item")) menu.open = false; });
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll(".menu__item:not(:disabled)")];
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
      event.preventDefault();
      const next = items.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1);
      items[(next + items.length) % items.length].focus();
    }
  });
}
document.addEventListener("click", (event) => { if (!event.target.closest("details[data-menu]")) closeMenus(); });
