const STORAGE_KEY = 'procure-aonde-data-v1';
const SESSION_KEY = 'procure-aonde-session-v1';

const categories = [
  { name: 'Alimentação', icon: '🍴', tone: 'food' },
  { name: 'Beleza', icon: '✦', tone: 'beauty' },
  { name: 'Saúde', icon: '♡', tone: 'health' },
  { name: 'Manutenção', icon: '⌁', tone: 'home' },
  { name: 'Transporte', icon: '⌖', tone: 'transport' },
  { name: 'Educação', icon: '▣', tone: 'education' },
  { name: 'Eventos', icon: '♢', tone: 'events' },
  { name: 'Lojas', icon: '▤', tone: 'shops' },
  { name: 'Serviços profissionais', icon: '◆', tone: 'professional' },
];

const starterBusinesses = [
  { id: 'cafe-praca', name: 'Café da Praça', category: 'Alimentação', description: 'Café especial, brunch e doces artesanais em um ambiente acolhedor.', location: 'Centro, São Paulo', hours: 'Seg a sáb, 8h às 18h', whatsapp: 'https://wa.me/5511999991111', instagram: 'https://instagram.com', map: 'https://maps.google.com', order: 'https://wa.me/5511999991111', status: 'published', createdAt: '2026-01-15', interactions: { view: 128, whatsapp: 42, instagram: 18, location: 23, order: 11 } },
  { id: 'studio-lumi', name: 'Studio Lumi', category: 'Beleza', description: 'Cuidado, beleza e bem-estar para você se sentir ainda melhor.', location: 'Vila Madalena, São Paulo', hours: 'Ter a sáb, 9h às 20h', whatsapp: 'https://wa.me/5511988882222', instagram: 'https://instagram.com', map: 'https://maps.google.com', order: 'https://wa.me/5511988882222', status: 'published', createdAt: '2026-02-04', interactions: { view: 94, whatsapp: 31, instagram: 27, location: 14, order: 8 } },
  { id: 'conserta-ja', name: 'Conserta Já', category: 'Manutenção', description: 'Assistência residencial rápida e confiável para pequenos reparos.', location: 'Moema, São Paulo', hours: 'Seg a sex, 8h às 17h', whatsapp: 'https://wa.me/5511977773333', instagram: '', map: 'https://maps.google.com', order: 'https://wa.me/5511977773333', status: 'published', createdAt: '2026-03-12', interactions: { view: 71, whatsapp: 25, instagram: 0, location: 16, order: 6 } },
  { id: 'clinica-viva', name: 'Clínica Viva', category: 'Saúde', description: 'Atendimento humanizado com profissionais especializados.', location: 'Pinheiros, São Paulo', hours: 'Seg a sex, 7h às 19h', whatsapp: 'https://wa.me/5511966664444', instagram: 'https://instagram.com', map: 'https://maps.google.com', order: '', status: 'published', createdAt: '2026-04-02', interactions: { view: 62, whatsapp: 19, instagram: 10, location: 18, order: 0 } },
];

const state = { businesses: [], query: '', location: '', category: '', sort: 'relevance', editingId: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    state.businesses = Array.isArray(saved) && saved.length ? saved : starterBusinesses;
  } catch {
    state.businesses = starterBusinesses;
  }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.businesses)); }
function categoryInfo(name) { return categories.find((category) => category.name === name) || categories[0]; }
function totalClicks(business) { return Object.values(business.interactions || {}).reduce((sum, value) => sum + value, 0); }
function escapeHtml(value = '') { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function iconFor(business) { return categoryInfo(business.category).icon; }

function renderCategories() {
  $('#drawer-list').innerHTML = `<button data-category="">Todas as categorias</button>${categories.map((category) => `<button data-category="${category.name}">${category.icon} &nbsp; ${category.name}</button>`).join('')}`;
}

function getVisibleBusinesses() {
  const normalizedQuery = state.query.toLocaleLowerCase();
  const normalizedLocation = state.location.toLocaleLowerCase();
  let visible = state.businesses.filter((business) => business.status === 'published' &&
    (!normalizedQuery || `${business.name} ${business.category} ${business.description}`.toLocaleLowerCase().includes(normalizedQuery)) &&
    (!normalizedLocation || business.location.toLocaleLowerCase().includes(normalizedLocation)) &&
    (!state.category || business.category === state.category));
  if (state.sort === 'clicks') visible.sort((a, b) => totalClicks(b) - totalClicks(a));
  if (state.sort === 'recent') visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return visible;
}

function businessCard(business) {
  const category = categoryInfo(business.category);
  const actions = [
    business.whatsapp && `<a class="action-button main" href="${escapeHtml(business.whatsapp)}" target="_blank" rel="noopener" data-interaction="whatsapp" data-id="${business.id}">WhatsApp</a>`,
    business.instagram && `<a class="action-button" href="${escapeHtml(business.instagram)}" target="_blank" rel="noopener" data-interaction="instagram" data-id="${business.id}">Instagram</a>`,
    business.map && `<a class="action-button" href="${escapeHtml(business.map)}" target="_blank" rel="noopener" data-interaction="location" data-id="${business.id}">Localização</a>`,
  ].filter(Boolean).join('');
  return `<article class="business-card"><button class="business-cover ${category.tone}" data-business="${business.id}" aria-label="Ver detalhes de ${escapeHtml(business.name)}"><span class="business-avatar">${iconFor(business)}</span></button><div class="business-body"><span class="business-category">${escapeHtml(business.category)}</span><h3>${escapeHtml(business.name)}</h3><p class="business-description">${escapeHtml(business.description)}</p><div class="business-meta"><span>⌖ ${escapeHtml(business.location)}</span><span>◷ ${escapeHtml(business.hours || 'Consulte')}</span></div><div class="business-actions">${actions}<button class="action-button" data-business="${business.id}">Detalhes</button></div></div></article>`;
}

function renderBusinesses() {
  const visible = getVisibleBusinesses();
  $('#business-grid').innerHTML = visible.length ? visible.map(businessCard).join('') : '<div class="empty-state"><h3>Nenhuma empresa encontrada</h3><p>Tente buscar por outro termo ou limpe os filtros.</p><button class="outline-button" data-action="clear-filters">Limpar filtros</button></div>';
  const filters = [state.query && `Busca: “${escapeHtml(state.query)}”`, state.location && `Local: ${escapeHtml(state.location)}`, state.category && `Categoria: ${escapeHtml(state.category)}`].filter(Boolean);
  $('#active-filters').innerHTML = filters.length ? `${filters.join(' · ')} <button class="text-button" data-action="clear-filters">Limpar</button>` : '';
}

function recordInteraction(id, type) {
  const business = state.businesses.find((item) => item.id === id);
  if (!business) return;
  const key = type === 'view' ? 'view' : type;
  business.interactions[key] = (business.interactions[key] || 0) + 1;
  saveData();
}

function openBusiness(id) {
  const business = state.businesses.find((item) => item.id === id);
  if (!business) return;
  recordInteraction(id, 'view');
  const category = categoryInfo(business.category);
  const contactLinks = [
    business.whatsapp && `<a class="primary-button" href="${escapeHtml(business.whatsapp)}" target="_blank" rel="noopener" data-interaction="whatsapp" data-id="${id}">Conversar no WhatsApp</a>`,
    business.instagram && `<a class="outline-button" href="${escapeHtml(business.instagram)}" target="_blank" rel="noopener" data-interaction="instagram" data-id="${id}">Ver Instagram</a>`,
    business.map && `<a class="outline-button" href="${escapeHtml(business.map)}" target="_blank" rel="noopener" data-interaction="location" data-id="${id}">Abrir localização</a>`,
    business.order && `<a class="outline-button" href="${escapeHtml(business.order)}" target="_blank" rel="noopener" data-interaction="order" data-id="${id}">Fazer um pedido</a>`,
  ].filter(Boolean).join('');
  $('#modal-content').innerHTML = `<div class="modal-hero"><div class="business-cover ${category.tone}"><span class="business-avatar">${iconFor(business)}</span></div><div><span class="business-category">${escapeHtml(business.category)}</span><h2 id="modal-title">${escapeHtml(business.name)}</h2><p class="business-meta">⌖ ${escapeHtml(business.location)}</p></div></div><p class="modal-description">${escapeHtml(business.description)}</p><p class="business-meta">◷ ${escapeHtml(business.hours || 'Horário não informado')}</p><div class="modal-stat">Este anúncio já recebeu ${totalClicks(business)} interações.</div><div class="modal-actions">${contactLinks}</div>`;
  $('#modal-backdrop').hidden = false; $('#business-modal').hidden = false;
}

function closeModal() { $('#modal-backdrop').hidden = true; $('#business-modal').hidden = true; }
function setCategory(category) { state.category = category; renderCategories(); renderBusinesses(); closeDrawer(); $('#results').scrollIntoView({ behavior: 'smooth' }); }
function closeDrawer() { $('#services-drawer').classList.remove('open'); $('#services-drawer').setAttribute('aria-hidden', 'true'); $('#drawer-backdrop').hidden = true; $('.services-toggle').setAttribute('aria-expanded', 'false'); }
function openDrawer() { $('#services-drawer').classList.add('open'); $('#services-drawer').setAttribute('aria-hidden', 'false'); $('#drawer-backdrop').hidden = false; $('.services-toggle').setAttribute('aria-expanded', 'true'); }
function toggleDrawer() { $('#services-drawer').classList.contains('open') ? closeDrawer() : openDrawer(); }

function showAdmin() {
  if (!localStorage.getItem(SESSION_KEY)) { $('#auth-modal').hidden = false; $('#modal-backdrop').hidden = false; return; }
  $('#admin-view').hidden = false; document.body.classList.add('admin-active'); renderAdmin(); window.scrollTo(0, 0);
}
function showPublic() { $('#admin-view').hidden = true; document.body.classList.remove('admin-active'); window.scrollTo(0, 0); }
function closeAuth() { $('#auth-modal').hidden = true; if ($('#business-modal').hidden) $('#modal-backdrop').hidden = true; }
function logout() { localStorage.removeItem(SESSION_KEY); showPublic(); }
function renderAnalytics() {
  const totals = state.businesses.reduce((acc, item) => {
    Object.keys(acc).forEach((key) => { acc[key] += item.interactions[key] || 0; });
    return acc;
  }, { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 });
  const labels = [['Visualizações', totals.view], ['WhatsApp', totals.whatsapp], ['Instagram', totals.instagram], ['Localização', totals.location], ['Pedidos', totals.order]];
  const max = Math.max(...labels.map(([, value]) => value), 1);
  $('#analytics-bars').innerHTML = labels.map(([label, value]) => `<div class="analytics-row"><span>${label}</span><div class="analytics-track"><i style="width:${Math.max((value / max) * 100, value ? 5 : 0)}%"></i></div><strong>${value}</strong></div>`).join('');
}
function renderAdmin() {
  const businesses = state.businesses;
  const totals = businesses.reduce((acc, item) => { Object.keys(acc).forEach((key) => { acc[key] += item.interactions[key] || 0; }); return acc; }, { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 });
  const interactions = Object.values(totals).reduce((sum, value) => sum + value, 0);
  $('#stats-grid').innerHTML = [['Interações totais', interactions, '↑ Visão geral'], ['Visualizações', totals.view, '↑ Anúncios vistos'], ['WhatsApp', totals.whatsapp, '↑ Cliques de contato'], ['Localização', totals.location, '↑ Rotas abertas']].map(([label, value, note]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  $('#admin-business-list').innerHTML = businesses.length ? businesses.map((business) => `<div class="admin-business"><span class="business-avatar">${iconFor(business)}</span><div class="admin-business-info"><strong>${escapeHtml(business.name)}</strong><span>${escapeHtml(business.category)} · ${totalClicks(business)} interações</span></div><span class="status ${business.status === 'published' ? 'published' : 'draft'}">${business.status === 'published' ? 'Publicado' : 'Rascunho'}</span><button class="small-button" data-edit="${business.id}">Editar</button></div>`).join('') : '<p class="business-meta">Nenhum anúncio cadastrado ainda.</p>';
  renderAnalytics();
}

function resetForm() { state.editingId = null; $('#editor-title').textContent = 'Novo anúncio'; $('#business-form').reset(); $('#business-id').value = ''; $('#business-published').checked = true; $('#form-message').textContent = ''; }
function fillForm(id) {
  const business = state.businesses.find((item) => item.id === id); if (!business) return;
  state.editingId = id; $('#editor-title').textContent = 'Editar anúncio'; $('#business-id').value = id;
  [['business-name', 'name'], ['business-description', 'description'], ['business-location', 'location'], ['business-hours', 'hours'], ['business-whatsapp', 'whatsapp'], ['business-instagram', 'instagram'], ['business-map', 'map'], ['business-order', 'order']].forEach(([field, key]) => { $(`#${field}`).value = business[key] || ''; });
  $('#business-category').value = business.category; $('#business-published').checked = business.status === 'published'; $('#form-message').textContent = ''; $('#editor-panel').scrollIntoView({ behavior: 'smooth' });
}

function handleBusinessSubmit(event) {
  event.preventDefault();
  const id = state.editingId || `business-${Date.now()}`;
  const previous = state.businesses.find((item) => item.id === id);
  const business = { id, name: $('#business-name').value.trim(), category: $('#business-category').value, description: $('#business-description').value.trim(), location: $('#business-location').value.trim(), hours: $('#business-hours').value.trim(), whatsapp: $('#business-whatsapp').value.trim(), instagram: $('#business-instagram').value.trim(), map: $('#business-map').value.trim(), order: $('#business-order').value.trim(), status: $('#business-published').checked ? 'published' : 'draft', createdAt: previous?.createdAt || new Date().toISOString().slice(0, 10), interactions: previous?.interactions || { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 } };
  if (!business.name || !business.description || !business.location) { $('#form-message').textContent = 'Preencha nome, descrição e localização.'; return; }
  if (previous) state.businesses = state.businesses.map((item) => item.id === id ? business : item); else state.businesses.push(business);
  saveData(); renderAdmin(); resetForm(); $('#form-message').textContent = 'Anúncio salvo com sucesso.'; renderBusinesses();
}

function search(query, location = $('#hero-location').value) { state.query = query.trim(); state.location = location.trim(); $('#hero-query').value = state.query; $('#hero-location').value = state.location; renderBusinesses(); $('#results').scrollIntoView({ behavior: 'smooth' }); }

document.addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-category]'); if (categoryButton) { setCategory(categoryButton.dataset.category); return; }
  const businessButton = event.target.closest('[data-business]'); if (businessButton) { openBusiness(businessButton.dataset.business); return; }
  const interaction = event.target.closest('[data-interaction]'); if (interaction) { recordInteraction(interaction.dataset.id, interaction.dataset.interaction); return; }
  const editButton = event.target.closest('[data-edit]'); if (editButton) { fillForm(editButton.dataset.edit); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'admin') showAdmin(); if (action === 'home') showPublic(); if (action === 'open-services') openDrawer(); if (action === 'toggle-services') toggleDrawer(); if (action === 'close-services') closeDrawer(); if (action === 'close-modal') closeModal(); if (action === 'close-auth') closeAuth(); if (action === 'logout') logout(); if (action === 'clear-filters') { state.query = ''; state.location = ''; state.category = ''; $('#hero-query').value = ''; $('#hero-location').value = ''; renderCategories(); renderBusinesses(); } if (action === 'new-business') { resetForm(); $('#editor-panel').scrollIntoView({ behavior: 'smooth' }); }
});
if ($('#hero-search-form')) $('#hero-search-form').addEventListener('submit', (event) => { event.preventDefault(); search($('#hero-query').value); });
if ($('#sort-select')) $('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; renderBusinesses(); });
if ($('#business-form')) $('#business-form').addEventListener('submit', handleBusinessSubmit);
if ($('#auth-form')) $('#auth-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!$('#auth-form').reportValidity()) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: $('#auth-email').value.trim(), loggedAt: Date.now() }));
  $('#auth-message').textContent = 'Acesso realizado.';
  closeAuth();
  showAdmin();
});
if ($('#drawer-backdrop')) $('#drawer-backdrop').addEventListener('click', closeDrawer);
if ($('#modal-backdrop')) $('#modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeDrawer(); closeModal(); closeAuth(); } });

loadData();
if ($('#business-grid')) {
  renderCategories();
  renderBusinesses();
}
if (document.body.dataset.page === 'admin') {
  $('#business-category').innerHTML = categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join('');
  if (localStorage.getItem(SESSION_KEY)) renderAdmin();
  else {
    $('#auth-modal').hidden = false;
    $('#modal-backdrop').hidden = false;
  }
}
