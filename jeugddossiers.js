(() => {
  const form = document.querySelector('.jeugd-search');
  const input = document.querySelector('#jeugd-q');
  const list = document.querySelector('#jeugd-suggestions');
  const status = document.querySelector('#jeugd-search-status');
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(list instanceof HTMLElement)) return;

  let players = [];
  try { players = JSON.parse(form.dataset.players || '[]'); } catch { return; }
  let active = -1;
  let closeTimer = 0;
  const normalize = value => String(value || '').toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const finishClose = () => {
    list.hidden = true;
    list.replaceChildren();
    closeTimer = 0;
  };
  const close = (immediate = false) => {
    window.clearTimeout(closeTimer);
    list.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
    if (status) status.textContent = '';
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose();
    else closeTimer = window.setTimeout(finishClose, 110);
  };
  const open = () => {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
    const wasHidden = list.hidden;
    list.hidden = false;
    if (wasHidden) window.requestAnimationFrame(() => list.classList.add('is-open'));
    else list.classList.add('is-open');
  };
  const select = index => {
    const options = [...list.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    active = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => option.setAttribute('aria-selected', String(optionIndex === active)));
    input.setAttribute('aria-activedescendant', options[active].id);
    options[active].scrollIntoView({ block: 'nearest' });
  };
  const render = () => {
    const term = normalize(input.value.trim());
    if (!term) {
      close(true);
      if (form.dataset.hasQuery === 'true') window.location.assign('/club/jeugddossiers');
      return;
    }
    const matches = players.filter(player => [player.name, ...(player.aliases || [])].some(value => normalize(value).includes(term))).slice(0, 5);
    list.replaceChildren(...matches.map((player, index) => {
      const link = document.createElement('a');
      link.id = `jeugd-suggestion-${index}`;
      link.href = `/club/jeugddossiers/speler/${encodeURIComponent(player.id)}`;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      if (player.photo) {
        const image = document.createElement('img');
        image.src = player.photo;
        image.alt = '';
        link.append(image);
      }
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = player.name;
      const meta = document.createElement('small');
      meta.textContent = [player.club, player.departureSeason ? `vertrek ${player.departureSeason}` : null].filter(Boolean).join(' · ');
      copy.append(name);
      if (meta.textContent) copy.append(meta);
      link.append(copy);
      const action = document.createElement('span');
      action.className = 'jeugd-suggestion__action';
      action.textContent = 'Bekijk dossier';
      link.append(action);
      return link;
    }));
    if (matches.length) open(); else close(true);
    input.setAttribute('aria-expanded', String(Boolean(matches.length)));
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (status) status.textContent = matches.length ? `${matches.length} suggesties beschikbaar.` : 'Geen suggesties gevonden.';
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    const options = list.querySelectorAll('[role="option"]');
    if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); select(active + 1); }
    else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); select(active - 1); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); window.location.assign(options[active].getAttribute('href')); }
    else if (event.key === 'Escape') close(true);
  });
  document.addEventListener('click', event => { if (!form.contains(event.target)) close(); });
})();
