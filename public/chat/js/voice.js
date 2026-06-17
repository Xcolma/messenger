// ========== VOICE RECORDER (Telegram-style) ==========
let mediaRecorder = null;
let audioChunks = [];
let voiceLocked = false;
let recording = false;
let voiceStartY = 0;
let voiceTimer = null;
let voiceSeconds = 0;

// Анализатор громкости
let audioContext = null;
let analyser = null;
let animationFrame = null;

// Пороги для жестов
const CANCEL_THRESHOLD = 100; // пикселей влево для отмены
const LOCK_THRESHOLD = 80; // пикселей вверх для блокировки

async function startVoice(e) {
  if (!currentChat || recording) return;

  e.preventDefault();
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

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    audioChunks = [];
    voiceLocked = false;
    voiceSeconds = 0;

    mediaRecorder.ondataavailable = (ev) => audioChunks.push(ev.data);

    mediaRecorder.onstop = () => {
      cancelAnimationFrame(animationFrame);
      if (audioContext) audioContext.close();

      const totalSeconds = voiceSeconds;

      // Если слишком короткая запись — отменяем
      if (totalSeconds < 0.5) {
        showNotification("⚠️", "Слишком короткое сообщение");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = function () {
        if (currentChat) {
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
            socket.emit("private-message", { ...msgData, toUserId: toUser.id });
          } else {
            socket.emit("group-message", {
              ...msgData,
              groupId: currentChat.id,
            });
          }
          setTimeout(() => loadMessages(currentChat.id), 300);
        }
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach((t) => t.stop());
    };

    // Запуск записи
    mediaRecorder.start(100); // чанки каждые 100мс
    recording = true;

    // UI
    document.getElementById("voice-btn").classList.add("recording");
    document.getElementById("voice-slider").classList.add("active");
    document
      .getElementById("voice-slider")
      .classList.remove("cancelling", "locked");

    // Запуск визуализации
    visualizeVolume();

    // Таймер
    voiceSeconds = 0;
    updateVoiceTimer();
    voiceTimer = setInterval(() => {
      voiceSeconds++;
      updateVoiceTimer();
    }, 1000);
  } catch (err) {
    showNotification("❌", "Нет доступа к микрофону");
  }
}

// Визуализация громкости (волны как в Telegram)
function visualizeVolume() {
  if (!analyser) return;

  const bars = document.querySelectorAll(".voice-wave-bar");
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);

    bars.forEach((bar, i) => {
      const value = dataArray[i * 4] || 0;
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

  // Свайп влево — отмена
  if (deltaX < -CANCEL_THRESHOLD && !voiceLocked) {
    slider.classList.add("cancelling");
    slider.classList.remove("locked");
  }
  // Свайп вверх — блокировка
  else if (deltaY > LOCK_THRESHOLD && !voiceLocked) {
    lockVoice();
  }
  // Возврат
  else if (!voiceLocked) {
    slider.classList.remove("cancelling");
  }
}

function lockVoice() {
  voiceLocked = true;
  const slider = document.getElementById("voice-slider");
  slider.classList.add("locked");
  slider.classList.remove("cancelling");
  document.getElementById("voice-lock-icon").textContent = "🔓";
  showNotification("🔒", "Запись закреплена. Нажмите чтобы остановить");
}

function toggleVoiceLock() {
  if (voiceLocked) {
    voiceLocked = false;
    document.getElementById("voice-slider").classList.remove("locked");
    document.getElementById("voice-lock-icon").textContent = "🔒";
  }
}

function stopVoice(e) {
  if (!recording) return;

  const slider = document.getElementById("voice-slider");

  // Если свайпнули влево — отмена
  if (slider.classList.contains("cancelling")) {
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

  document.getElementById("voice-btn").classList.remove("recording");
  document
    .getElementById("voice-slider")
    .classList.remove("active", "cancelling", "locked");
  document.getElementById("voice-lock-icon").textContent = "🔒";
}

function cancelVoice() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    audioChunks = []; // очищаем чанки
    mediaRecorder.stop();
  }
  recording = false;
  voiceLocked = false;
  clearInterval(voiceTimer);
  if (audioContext) audioContext.close();

  document.getElementById("voice-btn").classList.remove("recording");
  document
    .getElementById("voice-slider")
    .classList.remove("active", "cancelling", "locked");
  document.getElementById("voice-lock-icon").textContent = "🔒";

  showNotification("🗑️", "Запись отменена");
}

// Клик по кнопке когда запись заблокирована
document.getElementById("voice-btn").addEventListener("click", function (e) {
  if (voiceLocked && recording) {
    e.preventDefault();
    e.stopPropagation();
    finishRecording();
  }
});
