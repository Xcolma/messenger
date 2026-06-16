async function startVoice(e) {
  if (!currentChat || recording) return;
  if (e && e.touches) {
    e.preventDefault();
    voiceStartY = e.touches[0].clientY;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    voiceLocked = false;

    mediaRecorder.ondataavailable = (ev) => audioChunks.push(ev.data);

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = function () {
        if (currentChat) {
          const msgData = {
            chatId: currentChat.id,
            fromUser: currentUser,
            message: "🎤 Голосовое сообщение",
            type: "audio",
            fileName: "voice.webm",
            content: reader.result,
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

    mediaRecorder.start();
    recording = true;
    document.getElementById("voice-btn").classList.add("recording");
    document.getElementById("voice-slider").classList.add("active");
  } catch (err) {
    showNotification("❌", "Нет доступа к микрофону");
  }
}

function moveVoice(e) {
  if (!recording || !e.touches || voiceLocked) return;
  if (voiceStartY - e.touches[0].clientY > 80) lockVoice();
}

function toggleVoiceLock() {
  voiceLocked = !voiceLocked;
  const btn = document.getElementById("voice-lock-btn");
  btn.classList.toggle("locked", voiceLocked);
  btn.textContent = voiceLocked ? "🔓" : "🔒";
}

function lockVoice() {
  voiceLocked = true;
  const btn = document.getElementById("voice-lock-btn");
  btn.classList.add("locked");
  btn.textContent = "🔓";
  showNotification("🔒", "Запись закреплена");
}

function stopVoice(e) {
  if (!recording || voiceLocked) return;
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recording = false;
    document.getElementById("voice-btn").classList.remove("recording");
    document.getElementById("voice-slider").classList.remove("active");
  }
}

function cancelVoice() {
  if (!recording) return;
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    audioChunks = [];
  }
  recording = false;
  voiceLocked = false;
  document.getElementById("voice-btn").classList.remove("recording");
  document.getElementById("voice-slider").classList.remove("active");
}

document.getElementById("voice-btn").addEventListener("click", function (e) {
  if (voiceLocked && recording) {
    e.preventDefault();
    e.stopPropagation();
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      recording = false;
      voiceLocked = false;
      this.classList.remove("recording");
      document.getElementById("voice-slider").classList.remove("active");
    }
  }
});
