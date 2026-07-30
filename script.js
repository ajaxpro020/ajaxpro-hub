const nextMatchBanner = document.querySelector("[data-next-match]");

if (nextMatchBanner) {
  const teamsField = nextMatchBanner.querySelector("[data-match-teams]");
  const metaField = nextMatchBanner.querySelector("[data-match-meta]");
  const tvField = nextMatchBanner.querySelector("[data-match-tv]");
  const cacheKey = "ajaxpro-next-match";

  const renderNextMatch = (payload) => {
    if (!payload?.match) {
      teamsField.textContent = payload?.message || "Volgende wedstrijd nog niet bekend";
      metaField.textContent = "Bekijk het programma voor de laatste informatie";
      tvField.textContent = "Nog niet bekend";
      nextMatchBanner.classList.add("is-unavailable");
      return;
    }

    const kickoff = new Date(payload.match.kickoff);
    const date = new Intl.DateTimeFormat("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Amsterdam",
    }).format(kickoff);
    const time = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    }).format(kickoff);

    teamsField.textContent = `${payload.match.home} – ${payload.match.away}`;
    metaField.textContent = `${date} · ${time} · ${payload.match.competition}`;
    tvField.textContent = payload.match.tv || "Zender nog niet bekend";
    nextMatchBanner.classList.remove("is-loading", "is-unavailable");
  };

  try {
    const cachedMatch = JSON.parse(window.localStorage.getItem(cacheKey));
    if (cachedMatch?.match) renderNextMatch(cachedMatch);
  } catch {
    window.localStorage.removeItem(cacheKey);
  }

  window
    .fetch("/api/next-match", { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`Next match returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      renderNextMatch(payload);
      window.localStorage.setItem(cacheKey, JSON.stringify(payload));
    })
    .catch(() => {
      if (!nextMatchBanner.classList.contains("is-loading")) return;
      renderNextMatch({
        message: "Wedstrijdinformatie tijdelijk niet beschikbaar",
      });
    });
}

const youtubeCard = document.querySelector(".youtube-card");

if (youtubeCard) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameId = 0;
  let currentY = 0;
  const targetY = 150;
  const easing = 0.012;

  const render = () => {
    currentY += (targetY - currentY) * easing;
    youtubeCard.style.setProperty("--youtube-preview-y", `${currentY}px`);

    if (Math.abs(targetY - currentY) > 0.5) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  const stopPreview = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  youtubeCard.addEventListener("mouseenter", () => {
    youtubeCard.classList.add("is-preview-active");
    if (reduceMotion.matches) {
      return;
    }

    stopPreview();
    frameId = window.requestAnimationFrame(render);
  });

  youtubeCard.addEventListener("mouseleave", () => {
    youtubeCard.classList.remove("is-preview-active");
    stopPreview();
  });
}

const discordTransferCard = document.querySelector(".discord-transfer-card");

if (discordTransferCard) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const chatMessages = [
    "Godts blijft toch?",
    "Nieuwe naam uit Frankrijk.",
    "Bron lijkt betrouwbaar.",
    "Zet maar in transferpraat.",
  ];
  const chatDirections = ["right", "left", "right", "left"];
  const chatLayer = discordTransferCard.querySelector(".discord-card__chat");
  let chatTimer = 0;
  let chatIndex = 0;

  const captureMessagePositions = () =>
    new Map(
      [...chatLayer.querySelectorAll(".discord-card__message")].map((message) => [
        message,
        message.getBoundingClientRect().top,
      ]),
    );

  const animateMessageShift = (positions) => {
    if (reduceMotion.matches) {
      return;
    }

    chatLayer.querySelectorAll(".discord-card__message").forEach((message) => {
      const previousTop = positions.get(message);

      if (previousTop === undefined) {
        return;
      }

      const delta = previousTop - message.getBoundingClientRect().top;

      if (Math.abs(delta) < 1) {
        return;
      }

      message.animate(
        [
          { transform: `translateY(${delta}px) scale(1)` },
          { transform: "translateY(0) scale(1)" },
        ],
        {
          duration: 520,
          easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
        },
      );
    });
  };

  const clearChat = () => {
    window.clearInterval(chatTimer);
    chatTimer = 0;
    chatIndex = 0;
    chatLayer.replaceChildren();
    discordTransferCard.classList.remove("is-chatting");
  };

  const addChatMessage = () => {
    const previousPositions = captureMessagePositions();
    const message = document.createElement("span");
    const direction = chatDirections[chatIndex % chatDirections.length];

    message.className = `discord-card__message discord-card__message--${direction}`;
    message.textContent = chatMessages[chatIndex % chatMessages.length];
    chatLayer.append(message);

    window.requestAnimationFrame(() => {
      animateMessageShift(previousPositions);
      message.classList.add("is-visible");
    });

    const messages = chatLayer.querySelectorAll(".discord-card__message");
    if (messages.length > 3) {
      const oldestMessage = messages[0];
      oldestMessage.classList.add("is-exiting");
      window.setTimeout(() => {
        oldestMessage.remove();
      }, reduceMotion.matches ? 0 : 560);
    }

    chatIndex += 1;
  };

  const startChat = () => {
    discordTransferCard.classList.add("is-chatting");
    window.clearInterval(chatTimer);
    chatLayer.replaceChildren();
    chatIndex = 0;

    window.setTimeout(() => {
      if (!discordTransferCard.classList.contains("is-chatting")) {
        return;
      }

      addChatMessage();
      chatTimer = window.setInterval(addChatMessage, reduceMotion.matches ? 1000 : 760);
    }, reduceMotion.matches ? 0 : 300);
  };

  discordTransferCard.addEventListener("mouseenter", startChat);
  discordTransferCard.addEventListener("mouseleave", clearChat);
  discordTransferCard.addEventListener("blur", clearChat);
}
