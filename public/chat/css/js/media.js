function clearPendingMedia() {
  pendingMedia = [];
  updateMediaPreview();
}

function handleMediaSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = function () {
      pendingMedia.push({
        data: reader.result,
        type: file.type,
        fileName: file.name,
      });
      updateMediaPreview();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
  updateSendButton();
}

function updateMediaPreview() {
  const container = document.getElementById("media-preview");
  container.innerHTML = "";

  if (pendingMedia.length === 0) {
    container.classList.remove("active");
    return;
  }

  container.classList.add("active");

  pendingMedia.forEach((media, index) => {
    const isVideo = media.type.startsWith("video/");
    const wrapper = document.createElement("div");
    wrapper.className = "media-preview-item";

    const element = isVideo
      ? document.createElement("video")
      : document.createElement("img");
    element.src = media.data;
    if (isVideo) {
      element.muted = true;
      element.playsInline = true;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-media";
    removeBtn.textContent = "✕";
    removeBtn.onclick = function () {
      pendingMedia.splice(index, 1);
      updateMediaPreview();
      updateSendButton();
    };

    wrapper.appendChild(element);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}
