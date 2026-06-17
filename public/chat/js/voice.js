// ========== VOICE RECORDER (Telegram-style) ==========

// Пороги для жестов
const CANCEL_THRESHOLD = 80; // пикселей влево для отмены
const LOCK_THRESHOLD = 80; // пикселей вверх для блокировки

async function startVoice(e) {
  if (!currentChat || recording) return;

  e.preventDefault();
  e.stopPropagation();

  const touch = e.touches ? e.touches[0] : null;
  voiceStartY = touch ? touch.clientY : 0;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Настройка анализатора громкости
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Проверяем поддержку кодеков
    let mimeType = "audio/webm";
    if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }
    } else {
      mimeType = "audio/webm;codecs=opus";
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];
    voiceLocked = false;
    voiceSeconds = 0;

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) audioChunks.push(ev.data);
    };

    mediaRecorder.onstop = () => {
      cancelAnimationFrame(animationFrame);
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      analyser = null;

      const totalSeconds = voiceSeconds;

      // Если слишком короткая запись — отменяем
      if (totalSeconds < 0.5 || audioChunks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        resetVoiceUI();
        showNotification("⚠️", "Слишком короткое сообщение");
        return;
      }

      const blob = new Blob(audioChunks, { type: mimeType });
      const reader = new FileReader();
      reader.onload = function () {
        if (currentChat && reader.result) {
          const msgData = {
            chatId: currentChat.id,
            fromUser: currentUser,
            type: "audio",
            fileName: `voice_${Date.now()}.webm`,
            content: reader.result,
            duration: totalSeconds,
          };
          if (currentChat.type === "private") {
            const toUser = currentChat.members.find(
              (m) => m.id !== currentUser.id,
            );
            if (toUser)
              socket.emit("private-message", {
                ...msgData,
                toUserId: toUser.id,
              });
          } else {
            socket.emit("group-message", {
              ...msgData,
              groupId: currentChat.id,
            });
          }
          setTimeout(() => {
            if (currentChat) loadMessages(currentChat.id);
          }, 300);
        }
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach((t) => t.stop());
    };

    // Запуск записи
    mediaRecorder.start(100);
    recording = true;

    // UI
    const voiceBtn = document.getElementById("voice-btn");
    const voiceSlider = document.getElementById("voice-slider");

    if (voiceBtn) voiceBtn.classList.add("recording");
    if (voiceSlider) {
      voiceSlider.classList.add("active");
      voiceSlider.classList.remove("cancelling", "locked");
    }

    const lockIcon = document.getElementById("voice-lock-icon");
    if (lockIcon) lockIcon.textContent = "🔒";

    const sliderText = document.getElementById("voice-slider-text");
    if (sliderText) sliderText.textContent = "Отпустите для отправки";

    // Запуск визуализации
    visualizeVolume();

    // Таймер
    voiceSeconds = 0;
    updateVoiceTimer();
    clearInterval(voiceTimer);
    voiceTimer = setInterval(() => {
      voiceSeconds++;
      updateVoiceTimer();
    }, 1000);
  } catch (err) {
    console.error("Ошибка микрофона:", err);
    showNotification("❌", "Нет доступа к микрофону");
    resetVoiceUI();
  }
}

// Визуализация громкости (волны как в Telegram)
function visualizeVolume() {
  if (!analyser) return;

  const bars = document.querySelectorAll(".voice-wave-bar");
  if (bars.length === 0) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    bars.forEach((bar, i) => {
      const index = Math.floor(i * (dataArray.length / bars.length));
      const value = dataArray[index] || 0;
      const height = Math.max(3, (value / 255) * 100);
      bar.style.height = height + "%";
    });

    animationFrame = requestAnimationFrame(draw);
  }

  draw();
}

function updateVoiceTimer() {
  const timer = document.getElementById("voice-timer");
  if (timer) {
    const mins = Math.floor(voiceSeconds / 60);
    const secs = voiceSeconds % 60;
    timer.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

// Жесты
function moveVoice(e) {
  if (!recording || !e.touches) return;

  const touch = e.touches[0];
  const deltaY = voiceStartY - touch.clientY;
  const deltaX = touch.clientX - window.innerWidth / 2;

  const slider = document.getElementById("voice-slider");
  if (!slider) return;

  const sliderText = document.getElementById("voice-slider-text");

  // Свайп влево — отмена
  if (deltaX < -CANCEL_THRESHOLD && !voiceLocked) {
    slider.classList.add("cancelling");
    slider.classList.remove("locked");
    if (sliderText) sliderText.textContent = "Отпустите для отмены";
  }
  // Свайп вверх — блокировка
  else if (deltaY > LOCK_THRESHOLD && !voiceLocked) {
    lockVoice();
  }
  // Возврат
  else if (!voiceLocked) {
    slider.classList.remove("cancelling");
    if (sliderText) sliderText.textContent = "Отпустите для отправки";
  }
}

function lockVoice() {
  voiceLocked = true;
  const slider = document.getElementById("voice-slider");
  if (slider) {
    slider.classList.add("locked");
    slider.classList.remove("cancelling");
  }
  const lockIcon = document.getElementById("voice-lock-icon");
  if (lockIcon) lockIcon.textContent = "🔓";
  const sliderText = document.getElementById("voice-slider-text");
  if (sliderText) sliderText.textContent = "Нажмите кнопку для отправки";
  showNotification("🔒", "Запись закреплена");
}

function toggleVoiceLock() {
  if (voiceLocked) {
    voiceLocked = false;
    const slider = document.getElementById("voice-slider");
    if (slider) slider.classList.remove("locked");
    const lockIcon = document.getElementById("voice-lock-icon");
    if (lockIcon) lockIcon.textContent = "🔒";
    const sliderText = document.getElementById("voice-slider-text");
    if (sliderText) sliderText.textContent = "Отпустите для отправки";
  }
}

function stopVoice(e) {
  if (!recording) return;

  const slider = document.getElementById("voice-slider");

  // Если свайпнули влево — отмена
  if (slider && slider.classList.contains("cancelling")) {
    cancelVoice();
    return;
  }

  // Если не заблокировано — останавливаем
  if (!voiceLocked) {
    finishRecording();
  }
}

function finishRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  recording = false;
  voiceLocked = false;
  clearInterval(voiceTimer);
  resetVoiceUI();
}

function cancelVoice() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    audioChunks = [];
    mediaRecorder.stop();
  }
  recording = false;
  voiceLocked = false;
  clearInterval(voiceTimer);
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  analyser = null;
  resetVoiceUI();

  showNotification("🗑️", "Запись отменена");
}

function resetVoiceUI() {
  const voiceBtn = document.getElementById("voice-btn");
  const voiceSlider = document.getElementById("voice-slider");
  const lockIcon = document.getElementById("voice-lock-icon");

  if (voiceBtn) voiceBtn.classList.remove("recording");
  if (voiceSlider)
    voiceSlider.classList.remove("active", "cancelling", "locked");
  if (lockIcon) lockIcon.textContent = "🔒";
}

// Инициализация кнопки голосовых
function initVoiceButton() {
  const voiceBtn = document.getElementById("voice-btn");
  if (!voiceBtn) return;

  // Удаляем старые обработчики
  const newBtn = voiceBtn.cloneNode(true);
  voiceBtn.parentNode.replaceChild(newBtn, voiceBtn);

  // Добавляем обработчик клика (для завершения заблокированной записи)
  newBtn.addEventListener("click", function (e) {
    if (voiceLocked && recording) {
      e.preventDefault();
      e.stopPropagation();
      finishRecording();
    }
  });
}

// Запускаем инициализацию после загрузки DOM
document.addEventListener("DOMContentLoaded", initVoiceButton);
