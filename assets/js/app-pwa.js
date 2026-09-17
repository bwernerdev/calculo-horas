let deferredInstallPrompt;
const installButton=$("#install-app");
const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;

window.addEventListener("beforeinstallprompt",(event)=>{
  event.preventDefault(); deferredInstallPrompt=event; installButton.hidden=false;
});
if (isIos && !isStandalone) installButton.hidden=false;

installButton.addEventListener("click",async()=>{
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt(); const choice=await deferredInstallPrompt.userChoice;
    if (choice.outcome==="accepted") showToast("Aplicativo instalado com sucesso.");
    deferredInstallPrompt=null; installButton.hidden=true;
  } else if (isIos) showToast("No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.");
});
window.addEventListener("appinstalled",()=>{ deferredInstallPrompt=null; installButton.hidden=true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load",async()=>{
    const hadController=Boolean(navigator.serviceWorker.controller);
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if (hadController && !reloading) { reloading=true; window.location.reload(); }
    });
    try {
      const registration=await navigator.serviceWorker.register("./service-worker.js");
      const notice=$("#update-notice");
      const updateButton=$("#update-app");
      const offerUpdate=()=>{
        if (!navigator.serviceWorker.controller || !registration.waiting) return;
        notice.hidden=false;
        updateButton.onclick=()=>{
          updateButton.disabled=true;
          updateButton.textContent="Atualizando...";
          registration.waiting.postMessage({ type:"SKIP_WAITING" });
        };
      };
      if (registration.waiting) offerUpdate();
      registration.addEventListener("updatefound",()=>{
        const installing=registration.installing;
        installing?.addEventListener("statechange",()=>{
          if (installing.state==="installed") offerUpdate();
        });
      });
      let checkingUpdate=false;
      const checkForUpdate=async()=>{
        if (checkingUpdate || !navigator.onLine || registration.waiting) { offerUpdate(); return; }
        checkingUpdate=true;
        try { await registration.update(); offerUpdate(); }
        catch (error) { captureError(error,"service-worker-update"); }
        finally { checkingUpdate=false; }
      };
      void checkForUpdate();
      window.setInterval(checkForUpdate,60_000);
      window.addEventListener("focus",checkForUpdate);
      window.addEventListener("online",checkForUpdate);
      document.addEventListener("visibilitychange",()=>{ if (!document.hidden) void checkForUpdate(); });
    } catch (error) {
      captureError(error,"service-worker-register");
      console.error("Falha ao ativar o modo offline:",error);
    }
  });
}
