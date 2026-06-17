function clearPendingMedia() {
  pendingMedia = [];
  updateMediaPreview();
  updateSendButton();
}

function handleMediaSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  let loaded = 0;
  const total = files.length;

  files.forEach((file) => {
    // Проверка размера файла (50MB лимит как на сервере)
    if (file.size > 50 * 1024 * 1024) {
      showNotification("⚠️", `Файл ${file.name} слишком большой (>50MB)`);
      loaded++;
      if (loaded === total) {
        updateMediaPreview();
        updateSendButton();
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      pendingMedia.push({
        data: reader.result,
        type: file.type,
        fileName: file.name,
      });
      loaded++;
      if (loaded === total) {
        updateMediaPreview();
        updateSendButton();
      }
    };
    reader.onerror = function () {
      showNotification("❌", `Ошибка чтения файла ${file.name}`);
      loaded++;
      if (loaded === total) {
        updateMediaPreview();
        updateSendButton();
      }
    };
    reader.readAsDataURL(file);
  });

  event.target.value = "";
}

function updateMediaPreview() {
  const container = document.getElementById("media-preview");
  if (!container) return;

  container.innerHTML = "";

  if (pendingMedia.length === 0) {
    container.classList.remove("active");
    return;
  }

  container.classList.add("active");

  pendingMedia.forEach((media, index) => {
    const isVideo = media.type.startsWith("video/");
    const isImage = media.type.startsWith("image/");

    const wrapper = document.createElement("div");
    wrapper.className = "media-preview-item";

    let element;
    if (isVideo) {
      element = document.createElement("video");
      element.src = media.data;
      element.muted = true;
      element.playsInline = true;
      element.autoplay = true;
      element.loop = true;
    } else if (isImage) {
      element = document.createElement("img");
      element.src = media.data;
      element.alt = media.fileName;
    } else {
      // Файл или аудио — показываем иконку
      element = document.createElement("div");
      element.style.cssText =
        "width:60px;height:60px;border-radius:8px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;";
      element.textContent = "📎";
      element.title = media.fileName;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-media";
    removeBtn.textContent = "✕";
    removeBtn.onclick = function (e) {
      e.stopPropagation();
      pendingMedia.splice(index, 1);
      updateMediaPreview();
      updateSendButton();
    };

    wrapper.appendChild(element);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });

  updateSendButton();
}
