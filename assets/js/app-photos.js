// Prévia de fotos e câmera.
function updatePhotoPreview() {
  $("#photo-preview").hidden=!pendingPhotos.entrada && !pendingPhotos.saida;
  for (const kind of ["entrada","saida"]) {
    $(`#${kind === "entrada" ? "entry" : "exit"}-photo-preview`).hidden=!pendingPhotos[kind];
    const image=$(`#${kind === "entrada" ? "entry" : "exit"}-photo-image`);
    const value=pendingPhotos[kind];
    if (!value || /^(?:blob:|data:image\/)/.test(value)) { image.src=value || ""; continue; }
    image.removeAttribute("src");
    const id=$("#editing-id").value, generation=applicationGeneration;
    void repository.loadPhoto(id,kind).then((url)=>{
      if (generation===applicationGeneration && pendingPhotos[kind]===value && $("#editing-id").value===id) image.src=url;
    }).catch((error)=>captureError(error,"photo-preview-load"));
  }
}
function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((track)=>track.stop());
  cameraStream=undefined; $("#camera-preview").srcObject=null;
}
$("#open-camera").addEventListener("click",async()=>{
  if (!navigator.mediaDevices?.getUserMedia) return showToast("A câmera interna não é suportada neste navegador.","error");
  try {
    cameraStream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } }, audio:false });
    $("#camera-preview").srcObject=cameraStream; $("#camera-dialog").showModal(); await $("#camera-preview").play();
  } catch (error) { stopCamera(); showToast("Não foi possível acessar a câmera. Verifique a permissão do aplicativo.","error"); }
});
$("#capture-photo").addEventListener("click",()=>{
  const video=$("#camera-preview");
  if (!video.videoWidth || !video.videoHeight) return showToast("A câmera ainda está carregando. Tente novamente.","error");
  const maxSize=720, scale=Math.min(1,maxSize/Math.max(video.videoWidth,video.videoHeight));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height); capturedPhoto=canvas.toDataURL("image/jpeg",0.65);
  stopCamera(); $("#camera-dialog").close(); $("#photo-type-dialog").showModal();
});
function closeCamera() { stopCamera(); if ($("#camera-dialog").open) $("#camera-dialog").close(); }
$("#camera-close").addEventListener("click",closeCamera);
$("#camera-dialog").addEventListener("cancel",(event)=>{ event.preventDefault(); closeCamera(); });
document.addEventListener("visibilitychange",()=>{ if (document.hidden && cameraStream) closeCamera(); });
document.querySelectorAll("[data-photo-type]").forEach((button)=>button.addEventListener("click",()=>{
  const kind=button.dataset.photoType; pendingPhotos[kind]=capturedPhoto; capturedPhoto=""; $("#photo-type-dialog").close(); updatePhotoPreview(); showToast(`Foto de ${kind} anexada.`);
}));
function cancelPhotoType() { capturedPhoto=""; $("#photo-type-dialog").close(); }
$("#photo-type-cancel").addEventListener("click",cancelPhotoType);
$("#photo-type-dialog").addEventListener("cancel",(event)=>{ event.preventDefault(); cancelPhotoType(); });
$("#photo-preview").addEventListener("click",(event)=>{ const kind=event.target.dataset.removePhoto; if (kind) { pendingPhotos[kind]=""; updatePhotoPreview(); showToast(`Foto de ${kind} removida.`); } });
$("#photo-dialog-close").addEventListener("click",()=>$("#photo-dialog").close());
$("#photo-dialog").addEventListener("close",()=>$("#photo-dialog-image").removeAttribute("src"));
