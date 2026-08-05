const resultShare = document.querySelector("[data-result-share]");

if (document.querySelector("[data-winner-visual]")) {
  const visualScript = document.createElement("script");
  visualScript.src = "/motm-admin.js";
  visualScript.defer = true;
  document.head.append(visualScript);
}

resultShare?.querySelector("[data-native-share]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const payload = {
    title: resultShare.dataset.shareTitle,
    text: resultShare.dataset.shareText,
    url: resultShare.dataset.shareUrl,
  };
  try {
    if (navigator.share) {
      const imageUrl = resultShare.dataset.shareImage;
      const filename = resultShare.dataset.shareFilename;
      if (imageUrl && filename && navigator.canShare) {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], filename, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ ...payload, files: [file] });
            return;
          }
        }
      }
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    button.textContent = "Link gekopieerd";
  } catch (error) {
    if (error?.name !== "AbortError") button.textContent = "Delen lukt niet";
  }
});
