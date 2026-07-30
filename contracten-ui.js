document.querySelectorAll(".contract-card h3").forEach((heading) => {
  const [firstName, ...lastNameParts] = heading.textContent.trim().split(/\s+/);

  if (!firstName || lastNameParts.length === 0) return;

  const firstNameElement = document.createElement("span");
  firstNameElement.className = "player-first-name";
  firstNameElement.textContent = firstName;

  const lastNameElement = document.createElement("span");
  lastNameElement.className = "player-last-name";
  lastNameElement.textContent = lastNameParts.join(" ");

  heading.replaceChildren(lastNameElement, firstNameElement);
});
