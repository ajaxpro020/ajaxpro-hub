export const markerDistance = (markerIndex, activeIndex) => Math.min(Math.abs(markerIndex - activeIndex), 3);
export const normalizeSearch = value => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("nl-NL").trim();

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const page = document.querySelector(".mw-page");

const setupDrawer = root => {
  const layer = root.querySelector("[data-source-layer]");
  const content = root.querySelector("[data-source-content]");
  let sourceTrigger = null;
  if (!layer || !content) return;

  const focusable = () => [...layer.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])")];
  const closeSource = (keyboard = false) => {
    if (!layer.classList.contains("is-open")) return;
    layer.classList.toggle("is-keyboard-close", keyboard);
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mw-drawer-open");
    const delay = keyboard || reducedMotion.matches ? 0 : 260;
    setTimeout(() => {
      content.replaceChildren();
      layer.classList.remove("is-keyboard-close");
      sourceTrigger?.focus();
    }, delay);
  };

  const openSource = trigger => {
    const template = document.getElementById(trigger.dataset.sourceTemplate ?? "");
    if (!(template instanceof HTMLTemplateElement)) return;
    sourceTrigger = trigger;
    content.replaceChildren(template.content.cloneNode(true));
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("mw-drawer-open");
    content.querySelector("[data-source-close]")?.focus();
  };

  root.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-source-template]");
    if (trigger) openSource(trigger);
    if (event.target.closest?.("[data-source-close]")) closeSource(false);
  });

  document.addEventListener("keydown", event => {
    if (!layer.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSource(true);
      return;
    }
    if (event.key !== "Tab") return;
    const controls = focusable();
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
};

const setupLibrary = libraryPage => {
  const library = libraryPage.querySelector("[data-library]");
  const markers = [...libraryPage.querySelectorAll("[data-library-marker]")];
  const search = libraryPage.querySelector("[data-library-search]");
  const form = libraryPage.querySelector("[data-library-search-form]");
  const summary = libraryPage.querySelector("[data-search-summary]");
  const timelineLink = libraryPage.querySelector("[data-person-timeline]");
  const clear = libraryPage.querySelector("[data-clear-search]");
  const context = libraryPage.querySelector("[data-library-context]");
  const contextDate = context?.querySelector("time");
  const contextTitle = context?.querySelector("strong");
  const personIndexNode = libraryPage.querySelector("[data-person-index]");
  const people = personIndexNode ? JSON.parse(personIndexNode.textContent || "[]") : [];
  let rovingIndex = Math.max(0, markers.findIndex(marker => marker.tabIndex === 0));

  const setContext = marker => {
    if (!context || !contextDate || !contextTitle || !marker) return;
    contextDate.textContent = marker.dataset.date ?? "";
    contextTitle.textContent = marker.dataset.context ?? "";
    context.classList.add("is-visible");
  };

  const setRoving = (index, focus = false) => {
    if (!markers.length) return;
    rovingIndex = Math.max(0, Math.min(markers.length - 1, index));
    markers.forEach((marker, markerIndex) => {
      marker.tabIndex = markerIndex === rovingIndex ? 0 : -1;
      marker.toggleAttribute("data-roving", markerIndex === rovingIndex);
    });
    setContext(markers[rovingIndex]);
    if (focus) markers[rovingIndex].focus();
  };

  const exactPerson = value => {
    const needle = normalizeSearch(value);
    if (!needle) return null;
    const matches = people.filter(person => [person.name, ...(person.aliases ?? [])].some(name => normalizeSearch(name) === needle));
    return matches.length === 1 ? matches[0] : null;
  };

  const applySearch = (value, updateUrl = true) => {
    const raw = value.trim();
    const needle = normalizeSearch(raw);
    let count = 0;
    let firstMatch = -1;
    markers.forEach((marker, index) => {
      const matches = !needle || (marker.dataset.search ?? "").includes(needle);
      marker.classList.toggle("is-match", matches);
      if (matches && needle) {
        count += 1;
        if (firstMatch === -1) firstMatch = index;
      }
    });
    library?.classList.toggle("is-searching", Boolean(needle));
    const person = exactPerson(raw);
    if (summary) {
      summary.replaceChildren();
      if (!needle) summary.append(summary.dataset.defaultSummary ?? `${markers.length} bronmomenten`);
      else if (count) {
        const strong = document.createElement("strong");
        strong.textContent = raw;
        const span = document.createElement("span");
        span.textContent = `${count} ${count === 1 ? "bronmoment" : "bronmomenten"}`;
        summary.append(strong, span);
      } else {
        const strong = document.createElement("strong");
        strong.textContent = `Geen uitspraken gevonden voor “${raw}”`;
        const span = document.createElement("span");
        span.textContent = "De volledige geschiedenis blijft zichtbaar.";
        summary.append(strong, span);
      }
    }
    if (timelineLink) {
      timelineLink.hidden = !person;
      if (person) {
        timelineLink.href = `/club/tools/media-watch?entity=${encodeURIComponent(person.slug)}&q=${encodeURIComponent(raw)}`;
        timelineLink.querySelector("span").textContent = person.name;
      }
    }
    if (clear) clear.hidden = !needle;
    if (firstMatch >= 0) setRoving(firstMatch, false);
    if (updateUrl) {
      const url = new URL(location.href);
      if (raw) url.searchParams.set("q", raw);
      else url.searchParams.delete("q");
      url.searchParams.delete("entity");
      history.replaceState(history.state, "", url);
    }
  };

  form?.addEventListener("submit", event => {
    event.preventDefault();
    applySearch(search?.value ?? "");
  });
  search?.addEventListener("input", () => applySearch(search.value));
  clear?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    applySearch("");
    search.focus();
  });

  markers.forEach((marker, index) => {
    marker.addEventListener("focus", () => setRoving(index));
    marker.addEventListener("pointerenter", () => setContext(marker));
    marker.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0
        : event.key === "End" ? markers.length - 1
        : index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
      setRoving((next + markers.length) % markers.length, true);
    });
  });
  setRoving(rovingIndex);
  applySearch(search?.value ?? "", false);

  if (!library || reducedMotion.matches || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  const states = markers.map(marker => ({ marker, element: marker.querySelector("i"), current: 0, target: 0, rect: null }));
  let pointer = null;
  let frame = 0;
  let running = false;

  const measure = () => states.forEach(state => { state.rect = state.marker.getBoundingClientRect(); });
  const animate = () => {
    running = true;
    let unsettled = false;
    for (const state of states) {
      const next = state.current + (state.target - state.current) * .24;
      state.current = Math.abs(next - state.target) < .002 ? state.target : next;
      if (state.current !== state.target) unsettled = true;
      if (state.current > .001 || state.target > .001) {
        const influence = state.current;
        state.element.style.transform = `translate3d(0,${(-9 * influence).toFixed(2)}px,0) scale(${(1 + .72 * influence).toFixed(3)},${(1 + 2.55 * influence).toFixed(3)})`;
      } else state.element.style.removeProperty("transform");
    }
    if (pointer) {
      for (const state of states) {
        if (!state.rect) continue;
        const centerX = state.rect.left + state.rect.width / 2;
        const centerY = state.rect.top + state.rect.height * .72;
        const distance = Math.hypot(pointer.x - centerX, (pointer.y - centerY) * .55);
        const proximity = Math.max(0, 1 - distance / 128);
        state.target = proximity * proximity;
      }
      unsettled = true;
    }
    if (unsettled) frame = requestAnimationFrame(animate);
    else running = false;
  };
  const start = () => { if (!running) frame = requestAnimationFrame(animate); };
  library.addEventListener("pointerenter", () => { measure(); });
  library.addEventListener("pointermove", event => {
    pointer = { x: event.clientX, y: event.clientY };
    start();
  }, { passive: true });
  library.addEventListener("pointerleave", () => {
    pointer = null;
    states.forEach(state => { state.target = 0; });
    context?.classList.remove("is-visible");
    start();
  });
  addEventListener("resize", measure, { passive: true });
  addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
};

const setupTimeline = timelinePage => {
  const moments = [...timelinePage.querySelectorAll("[data-moment]")];
  const markers = [...timelinePage.querySelectorAll("[data-progress-marker]")];
  const activeYear = timelinePage.querySelector("[data-active-year]");
  const activeDate = timelinePage.querySelector("[data-active-date]");
  const activePosition = timelinePage.querySelector("[data-active-position]");
  let activeIndex = -1;
  const setActiveMoment = index => {
    if (index < 0 || index >= moments.length || index === activeIndex) return;
    activeIndex = index;
    const moment = moments[index];
    markers.forEach(marker => {
      const markerIndex = Number(marker.dataset.momentIndex);
      marker.dataset.distance = String(markerDistance(markerIndex, index));
      if (markerIndex === index) marker.setAttribute("aria-current", "true");
      else marker.removeAttribute("aria-current");
    });
    if (activeYear) activeYear.textContent = moment.dataset.year ?? "";
    if (activeDate) activeDate.textContent = moment.dataset.date ?? "";
    if (activePosition) activePosition.textContent = String(index + 1).padStart(2, "0");
  };
  setActiveMoment(0);
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((left, right) =>
      Math.abs(left.boundingClientRect.top - innerHeight * .38) - Math.abs(right.boundingClientRect.top - innerHeight * .38));
    const index = visible[0]?.target?.dataset?.momentIndex;
    if (index !== undefined) setActiveMoment(Number(index));
  }, { rootMargin: "-28% 0px -54% 0px", threshold: [0, .2, .6] });
  moments.forEach(moment => observer.observe(moment));
  markers.forEach(marker => marker.addEventListener("click", () => {
    moments[Number(marker.dataset.momentIndex)]?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  }));
};

if (page) {
  setupDrawer(page);
  if (page.classList.contains("mw-page--library")) setupLibrary(page);
  if (page.classList.contains("mw-page--timeline")) setupTimeline(page);
}
