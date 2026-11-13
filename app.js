import { addBusinessGalleryImage, addInteraction, fetchBusinesses, fetchModerationBusinesses, getCurrentUser, isCurrentUserAdmin, migrateLegacyBusinessImages, moderateBusiness, sendPasswordResetEmail, signIn, signOut, signUp, updatePassword, uploadBusinessImage, upsertBusiness } from './supabase-client.js';

const STORAGE_KEY = 'procure-aonde-data-v1';
const VISITOR_KEY = 'procure-aonde-visitor-id';

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

const starterBusinesses = [];

const state = { businesses: [], query: '', location: '', category: '', sort: 'relevance', editingId: null };
let currentUser = null;
let authMode = 'signup';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const THEME_KEY = 'procure-aonde-theme';
const visitorId = getVisitorId();
const interactionCooldowns = new Map();
const statusLabels = { draft: 'Rascunho', published: 'Publicado', paused: 'Pausado' };
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function getVisitorId() {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing && /^[a-zA-Z0-9_-]{16,128}$/.test(existing)) return existing;
  const generated = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  localStorage.setItem(VISITOR_KEY, generated);
  return generated;
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const toggle = $('.theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
    toggle.querySelector('.theme-toggle-icon').textContent = isDark ? '☀' : '☾';
    toggle.querySelector('.theme-toggle-label').textContent = isDark ? 'Modo claro' : 'Modo escuro';
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(preferredTheme);
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, nextTheme);
  setTheme(nextTheme);
}

function handleAuthCallbackError() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const errorCode = hash.get('error_code');
  const errorDescription = hash.get('error_description');
  if (!errorCode && !errorDescription) return;

  const message = errorCode === 'otp_expired'
    ? 'Este link de confirmação expirou ou já foi usado. Faça o cadastro novamente para receber um novo link.'
    : `Não foi possível confirmar o e-mail: ${errorDescription?.replace(/\+/g, ' ') || 'link inválido'}.`;
  const notice = document.createElement('div');
  notice.className = 'auth-callback-error';
  notice.innerHTML = `<strong>Confirmação de e-mail</strong><span>${escapeHtml(message)}</span><a href="htmladm.html">Voltar para o cadastro</a>`;
  document.body.prepend(notice);
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

async function loadData() {
  if ($('#public-status')) $('#public-status').textContent = 'Carregando empresas...';
  try {
    state.businesses = await fetchBusinesses();
    if (currentUser) {
      for (const business of state.businesses.filter((item) => item.owner_id === currentUser.id)) {
        if (business.logo?.startsWith('data:image/') || business.cover?.startsWith('data:image/')) {
          try {
            const migrated = await migrateLegacyBusinessImages(business);
            state.businesses = state.businesses.map((item) => item.id === business.id ? { ...item, ...migrated } : item);
          } catch (error) {
            console.error('Não foi possível migrar uma imagem legada para o Storage.', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar os dados do Supabase.', error);
    if ($('#public-status')) $('#public-status').textContent = 'Não foi possível carregar as empresas. Tente novamente.';
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      state.businesses = Array.isArray(saved) ? saved : starterBusinesses;
    } catch {
      state.businesses = starterBusinesses;
    }
  }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.businesses)); }
function categoryInfo(name) { return categories.find((category) => category.name === name) || categories[0]; }
function totalClicks(business) { return Object.values(business.interactions || {}).reduce((sum, value) => sum + value, 0); }
function escapeHtml(value = '') { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function iconFor(business) { return categoryInfo(business.category).icon; }

function renderCategories() {
  $('#drawer-list').innerHTML = `<a class="drawer-profile-link" href="htmladm.html">Perfil</a><button data-category="">Todas as categorias</button>${categories.map((category) => `<button data-category="${category.name}">${category.icon} &nbsp; ${category.name}</button>`).join('')}`;
}

function renderPopularCategories() {
  const counts = state.businesses.filter((business) => business.status === 'published').reduce((result, business) => {
    [business.category, ...(business.secondary_categories || business.secondaryCategories || [])].forEach((category) => { result[category] = (result[category] || 0) + 1; });
    return result;
  }, {});
  const popular = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if ($('#popular-categories')) $('#popular-categories').innerHTML = (popular.length ? popular : categories.slice(0, 6).map((category) => [category.name, 0]))
    .map(([name]) => `<button class="category-card" data-category="${escapeHtml(name)}"><span class="category-icon">${iconFor({ category: name })}</span><strong>${escapeHtml(name)}</strong></button>`).join('');
}

function getVisibleBusinesses() {
  const normalizedQuery = state.query.toLocaleLowerCase();
  const normalizedLocation = state.location.toLocaleLowerCase();
  let visible = state.businesses.filter((business) => business.status === 'published' &&
    (!normalizedQuery || `${business.name} ${business.category} ${(business.secondary_categories || []).join(' ')} ${business.description}`.toLocaleLowerCase().includes(normalizedQuery)) &&
    (!normalizedLocation || `${business.location} ${business.address || ''}`.toLocaleLowerCase().includes(normalizedLocation)) &&
    (!state.category || business.category === state.category));
  if (state.sort === 'clicks') visible.sort((a, b) => totalClicks(b) - totalClicks(a));
  if (state.sort === 'recent') visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return visible;
}

function businessCard(business) {
  const category = categoryInfo(business.category);
  const avatar = business.logo ? `<span class="business-avatar business-logo-avatar"><img src="${escapeHtml(business.logo)}" alt="Logo de ${escapeHtml(business.name)}" /></span>` : `<span class="business-avatar">${iconFor(business)}</span>`;
  const actions = [
    business.whatsapp && `<a class="action-button main" href="${escapeHtml(business.whatsapp)}" target="_blank" rel="noopener" data-interaction="whatsapp" data-id="${business.id}">WhatsApp</a>`,
    business.instagram && `<a class="action-button" href="${escapeHtml(business.instagram)}" target="_blank" rel="noopener" data-interaction="instagram" data-id="${business.id}">Instagram</a>`,
    business.map && `<a class="action-button" href="${escapeHtml(business.map)}" target="_blank" rel="noopener" data-interaction="location" data-id="${business.id}">Localização</a>`,
  ].filter(Boolean).join('');
  return `<article class="business-card"><button class="business-cover ${category.tone}" data-business="${business.id}" aria-label="Ver detalhes de ${escapeHtml(business.name)}">${avatar}</button><div class="business-body"><span class="business-category">${escapeHtml(business.category)}</span><h3>${escapeHtml(business.name)}</h3><p class="business-description">${escapeHtml(business.description)}</p><div class="business-meta"><span>⌖ ${escapeHtml(business.address || business.location)}</span><span>◷ ${escapeHtml(business.hours || 'Consulte')}</span></div><div class="business-actions">${actions}<button class="action-button" data-business="${business.id}">Detalhes</button></div></div></article>`;
}

function renderBusinesses() {
  const visible = getVisibleBusinesses();
  $('#business-grid').innerHTML = visible.length ? visible.map(businessCard).join('') : '<div class="empty-state"><h3>Nenhuma empresa encontrada</h3><p>Tente buscar por outro termo ou limpe os filtros.</p><button class="outline-button" data-action="clear-filters">Limpar filtros</button></div>';
  const filters = [state.query && `Busca: “${escapeHtml(state.query)}”`, state.location && `Local: ${escapeHtml(state.location)}`, state.category && `Categoria: ${escapeHtml(state.category)}`].filter(Boolean);
  $('#active-filters').innerHTML = filters.length ? `${filters.join(' · ')} <button class="text-button" data-action="clear-filters">Limpar</button>` : '';
  if ($('#public-status')) $('#public-status').textContent = `${visible.length} empresa${visible.length === 1 ? '' : 's'} encontrada${visible.length === 1 ? '' : 's'}.`;
}

async function recordInteraction(id, type) {
  const business = state.businesses.find((item) => item.id === id);
  if (!business) return;
  const key = type === 'view' ? 'view' : type;
  const cooldownKey = `${id}:${key}`;
  const lastInteraction = interactionCooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastInteraction < 30000) return;
  interactionCooldowns.set(cooldownKey, Date.now());
  try {
    const accepted = await addInteraction(id, key, visitorId);
    if (accepted) {
      business.interactions = business.interactions || {};
      business.interactions[key] = (business.interactions[key] || 0) + 1;
      saveData();
    }
  } catch (error) {
    console.error('Não foi possível registrar a interação no Supabase.', error);
    interactionCooldowns.delete(cooldownKey);
  }
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
    business.phone && `<a class="outline-button" href="tel:${escapeHtml(business.phone.replace(/[^\d+]/g, ''))}" data-interaction="phone" data-id="${id}">Ligar</a>`,
  ].filter(Boolean).join('');
  const avatar = business.logo ? `<span class="business-avatar business-logo-avatar"><img src="${escapeHtml(business.logo)}" alt="Logo de ${escapeHtml(business.name)}" /></span>` : `<span class="business-avatar">${iconFor(business)}</span>`;
  const gallery = (business.gallery || []).map((image) => `<img src="${escapeHtml(image.public_url)}" alt="${escapeHtml(image.alt_text || business.name)}" loading="lazy" />`).join('');
  $('#modal-content').innerHTML = `<div class="modal-hero"><div class="business-cover ${category.tone}">${avatar}</div><div><span class="business-category">${escapeHtml(business.category)}</span><h2 id="modal-title">${escapeHtml(business.name)}</h2><p class="business-meta">⌖ ${escapeHtml(business.address || business.location)}</p></div></div><p class="modal-description">${escapeHtml(business.description)}</p><p class="business-meta">◷ ${escapeHtml(business.hours || 'Horário não informado')}</p>${business.phone ? `<p class="business-meta">☎ ${escapeHtml(business.phone)}</p>` : ''}${gallery ? `<div class="business-gallery">${gallery}</div>` : ''}<div class="modal-stat">Este anúncio já recebeu ${totalClicks(business)} interações.</div><div class="modal-actions">${contactLinks}</div>`;
  $('#modal-backdrop').hidden = false; $('#business-modal').hidden = false;
}

function closeModal() { if ($('#modal-backdrop')) $('#modal-backdrop').hidden = true; if ($('#business-modal')) $('#business-modal').hidden = true; }
function setCategory(category) { state.category = category; renderCategories(); renderBusinesses(); closeDrawer(); $('#results').scrollIntoView({ behavior: 'smooth' }); }
function closeDrawer() { $('#services-drawer').classList.remove('open'); $('#services-drawer').setAttribute('aria-hidden', 'true'); $('#drawer-backdrop').hidden = true; $('.services-toggle').setAttribute('aria-expanded', 'false'); }
function openDrawer() { $('#services-drawer').classList.add('open'); $('#services-drawer').setAttribute('aria-hidden', 'false'); $('#drawer-backdrop').hidden = false; $('.services-toggle').setAttribute('aria-expanded', 'true'); }
function toggleDrawer() { $('#services-drawer').classList.contains('open') ? closeDrawer() : openDrawer(); }

async function showAdmin() {
  await dataReady;
  currentUser = await getCurrentUser();
  if (!hasAdminSession()) { showPublic(); showAuth(); return; }
  await loadData();
  const isAdmin = await isCurrentUserAdmin().catch(() => false);
  const ownedBusiness = getOwnedBusiness();
  if (!ownedBusiness && !isAdmin) { showCompanyOnboarding(); return; }
  $('#admin-onboarding').hidden = true; $('#admin-view').hidden = false; $('#auth-modal').hidden = true; if (!$('#business-modal') || $('#business-modal').hidden) $('#modal-backdrop').hidden = true; document.body.classList.add('admin-active'); $('#admin-panels').appendChild($('#profile-panel')); $('#profile-panel').classList.remove('onboarding-profile'); $('#profile-view').hidden = false; $('#profile-editor').hidden = true;
  if (ownedBusiness) renderAdmin();
  await renderModeration();
  window.scrollTo(0, 0);
}
function showPublic() { $('#admin-view').hidden = true; $('#admin-onboarding').hidden = true; document.body.classList.remove('admin-active'); window.scrollTo(0, 0); }
function hasAdminSession() {
  return Boolean(currentUser);
}
function getOwnedBusiness() { return currentUser ? state.businesses.find((business) => business.owner_id === currentUser.id) : null; }
function whatsappLink(value = '') {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${number}`;
}
function whatsappNumber(value = '') {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') ? digits.slice(2) : digits;
}
function safeLink(value = '') { return /^https?:\/\//i.test(value) ? value : ''; }
function showAuth() { $('#auth-modal').hidden = false; $('#modal-backdrop').hidden = false; }
function closeAuth() { if (!hasAdminSession()) return; $('#auth-modal').hidden = true; if (!$('#business-modal') || $('#business-modal').hidden) $('#modal-backdrop').hidden = true; }
async function logout() {
  await signOut();
  currentUser = null;
  showPublic();
  showAuth();
}
function showCompanyOnboarding() { $('#admin-view').hidden = true; $('#admin-onboarding').hidden = false; document.body.classList.remove('admin-active'); $('#profile-panel-slot').appendChild($('#profile-panel')); $('#profile-panel').classList.add('onboarding-profile'); $('#profile-view').hidden = true; $('#profile-editor').hidden = false; resetForm(); window.scrollTo(0, 0); }
function getPeriodInteractions(business, period) {
  const history = business.interactionHistory || [];
  if (period === 'total') return history;
  const now = new Date();
  const cutoff = period === 'today'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000);
  return history.filter((interaction) => new Date(interaction.created_at) >= cutoff);
}
function renderAnalytics() {
  const businesses = [getOwnedBusiness()].filter(Boolean);
  const period = $('#analytics-period')?.value || 'total';
  const totals = businesses.reduce((acc, item) => {
    if (period === 'total' && !(item.interactionHistory || []).length) {
      Object.keys(acc).forEach((key) => { acc[key] += item.interactions?.[key] || 0; });
    } else {
      getPeriodInteractions(item, period).forEach(({ type }) => { acc[type] = (acc[type] || 0) + 1; });
    }
    return acc;
  }, { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 });
  const labels = [['Visualizações', totals.view], ['WhatsApp', totals.whatsapp], ['Instagram', totals.instagram], ['Localização', totals.location], ['Pedidos', totals.order]];
  const max = Math.max(...labels.map(([, value]) => value), 1);
  const days = {};
  businesses.flatMap((business) => getPeriodInteractions(business, period)).forEach((interaction) => {
    const day = new Date(interaction.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    days[day] = (days[day] || 0) + 1;
  });
  const maxDay = Math.max(...Object.values(days), 1);
  const evolution = Object.entries(days).slice(-7).map(([day, value]) => `<div class="analytics-row"><span>${day}</span><div class="analytics-track"><i style="width:${Math.max((value / maxDay) * 100, value ? 5 : 0)}%"></i></div><strong>${value}</strong></div>`).join('');
  $('#analytics-bars').innerHTML = `${labels.map(([label, value]) => `<div class="analytics-row"><span>${label}</span><div class="analytics-track"><i style="width:${Math.max((value / max) * 100, value ? 5 : 0)}%"></i></div><strong>${value}</strong></div>`).join('')}<p class="eyebrow purple">Evolução diária</p>${evolution || '<p class="business-meta">Sem interações no período.</p>'}`;
}

async function renderModeration() {
  if (!$('#moderation-panel') || !(await isCurrentUserAdmin())) return;
  $('#moderation-panel').hidden = false;
  const businesses = await fetchModerationBusinesses();
  $('#moderation-list').innerHTML = businesses.map((business) => `<div class="analytics-row"><span>${escapeHtml(business.name)} · ${escapeHtml(business.location)}</span><strong>${statusLabels[business.status]}</strong><select data-moderate="${business.id}"><option value="draft" ${business.status === 'draft' ? 'selected' : ''}>Rascunho</option><option value="published" ${business.status === 'published' ? 'selected' : ''}>Publicado</option><option value="paused" ${business.status === 'paused' ? 'selected' : ''}>Pausado</option></select></div>`).join('');
}

function previewBusiness() {
  const previous = state.businesses.find((item) => item.id === state.editingId);
  const business = collectBusinessForm(previous);
  const category = categoryInfo(business.category);
  $('#modal-content').innerHTML = `<div class="modal-hero"><div class="business-cover ${category.tone}"><span class="business-avatar">${iconFor(business)}</span></div><div><span class="business-category">${escapeHtml(business.category)}</span><h2 id="modal-title">${escapeHtml(business.name || 'Pré-visualização')}</h2><p class="business-meta">⌖ ${escapeHtml(business.address || business.location || 'Localização')}</p></div></div><p class="modal-description">${escapeHtml(business.description || 'Descrição da empresa')}</p><p class="business-meta">◷ ${escapeHtml(business.hours || 'Horário não informado')}</p><div class="modal-stat">Status: ${statusLabels[business.status]}</div>`;
  $('#modal-backdrop').hidden = false; $('#business-modal').hidden = false;
}
function renderAdmin() {
  const businesses = [getOwnedBusiness()].filter(Boolean);
  const totals = businesses.reduce((acc, item) => { Object.keys(acc).forEach((key) => { acc[key] += item.interactions[key] || 0; }); return acc; }, { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 });
  const interactions = Object.values(totals).reduce((sum, value) => sum + value, 0);
  $('#stats-grid').innerHTML = [['Interações totais', interactions, '↑ Visão geral'], ['Visualizações', totals.view, '↑ Anúncios vistos'], ['WhatsApp', totals.whatsapp, '↑ Cliques de contato'], ['Localização', totals.location, '↑ Rotas abertas']].map(([label, value, note]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  renderProfile(businesses[0]);
  renderAnalytics();
}

function renderProfile(business) {
  if (!business) return;
  fillForm(business.id);
  $('#editor-title').textContent = 'Perfil da Empresa'; $('#profile-status').textContent = statusLabels[business.status] || 'Rascunho';
  $('#business-logo-preview').style.backgroundImage = business.logo ? `url("${business.logo}")` : '';
  $('#business-logo-placeholder').hidden = Boolean(business.logo);
  $('#profile-name').textContent = business.name;
  $('#profile-category').textContent = business.category;
  $('#profile-description').textContent = business.description;
  $('#profile-location-cover').textContent = business.location;
  $('#profile-hours').textContent = business.hours || 'Horário não informado';
  $('#profile-info-category').textContent = business.category;
  $('#profile-info-location').textContent = business.address || business.location;
  $('#profile-info-hours').textContent = business.hours || 'Não informado';
  $('#profile-info-order').textContent = business.order ? 'Link disponível' : 'Não informado';
  $('#profile-logo').style.backgroundImage = business.logo ? `url("${business.logo}")` : '';
  $('#profile-logo-placeholder').hidden = Boolean(business.logo);
  $('#profile-cover').style.backgroundImage = business.cover ? `url("${business.cover}")` : '';
  const totals = business.interactions || {};
  const interactions = Object.entries(totals).filter(([key]) => key !== 'view').reduce((sum, [, value]) => sum + value, 0);
  $('#profile-interactions').textContent = interactions;
  $('#profile-views').textContent = totals.view || 0;
  $('#profile-whatsapp').textContent = totals.whatsapp || 0;
  setProfileLink('#profile-whatsapp-link', whatsappLink(business.whatsapp), 'WhatsApp', 'whatsapp');
  setProfileLink('#profile-order-link', safeLink(business.order), 'Fazer pedido', 'order');
  setProfileLink('#profile-phone-link', business.phone ? `tel:${business.phone.replace(/[^\d+]/g, '')}` : '', 'Telefone', 'phone');
  setProfileLink('#profile-instagram-link', safeLink(business.instagram), 'Instagram', 'instagram');
  setProfileLink('#profile-map-link', safeLink(business.map), 'Como chegar', 'location');
  renderProfilePerformance(business);
}
function setProfileLink(selector, href, label, interaction) { const link = $(selector); link.href = href || '#'; link.classList.toggle('is-disabled', !href); link.setAttribute('aria-disabled', String(!href)); link.dataset.profileInteraction = interaction; link.textContent = label; }
function renderProfilePerformance(business) {
  const values = [['Visualizações', business.interactions?.view || 0], ['WhatsApp', business.interactions?.whatsapp || 0], ['Instagram', business.interactions?.instagram || 0], ['Localização', business.interactions?.location || 0], ['Pedidos', business.interactions?.order || 0]];
  const max = Math.max(...values.map(([, value]) => value), 1);
  const history = business.interactionHistory || [];
  const last = history.map((item) => new Date(item.created_at)).sort((a, b) => b - a)[0];
  $('#profile-performance-bars').innerHTML = `${values.map(([label, value]) => `<div class="profile-bar"><div><span>${label}</span><strong>${value}</strong></div><i style="width:${Math.max((value / max) * 100, value ? 5 : 0)}%"></i></div>`).join('')}<p class="business-meta">Última interação: ${last ? last.toLocaleString('pt-BR') : 'Ainda não registrada'}</p>`;
}
function resetForm() { state.editingId = null; state.logoData = ''; state.coverData = ''; $('#editor-title').textContent = 'Cadastro da empresa'; $('#business-form').reset(); $('#business-id').value = ''; $('#business-status').value = 'draft'; $('#business-logo-preview').style.backgroundImage = ''; $('#business-logo-placeholder').hidden = false; $('#form-message').textContent = ''; }
function fillForm(id) {
  const business = state.businesses.find((item) => item.id === id); if (!business) return;
  state.editingId = id; $('#business-id').value = id;
  [['business-name', 'name'], ['business-description', 'description'], ['business-location', 'location'], ['business-hours', 'hours'], ['business-phone', 'phone'], ['business-address', 'address'], ['business-instagram', 'instagram'], ['business-map', 'map'], ['business-order', 'order'], ['business-latitude', 'latitude'], ['business-longitude', 'longitude']].forEach(([field, key]) => { $(`#${field}`).value = business[key] ?? ''; });
  $('#business-whatsapp').value = whatsappNumber(business.whatsapp || '');
  $('#business-category').value = business.category; [...$('#business-secondary-categories').options].forEach((option) => { option.selected = (business.secondary_categories || []).includes(option.value); }); $('#business-status').value = business.status || 'draft'; $('#form-message').textContent = ''; $('#profile-panel').scrollIntoView({ behavior: 'smooth' });
}

function validUrl(value) { return !value || /^https?:\/\/[^\s]+$/i.test(value); }
function validPhone(value) { return !value || /^[+\d()\s-]{8,20}$/.test(value); }
function validImage(file) { return allowedImageTypes.includes(file.type) && file.size <= MAX_IMAGE_SIZE; }
function collectBusinessForm(previous) {
  return {
    id: state.editingId || `business-${Date.now()}`, owner_id: currentUser.id,
    name: $('#business-name').value.trim(), category: $('#business-category').value,
    secondaryCategories: [...$('#business-secondary-categories').selectedOptions].map((option) => option.value),
    description: $('#business-description').value.trim(), location: $('#business-location').value.trim(),
    address: $('#business-address').value.trim(), latitude: $('#business-latitude').value ? Number($('#business-latitude').value) : null,
    longitude: $('#business-longitude').value ? Number($('#business-longitude').value) : null, hours: $('#business-hours').value.trim(),
    phone: $('#business-phone').value.trim(), whatsapp: whatsappLink($('#business-whatsapp').value.trim()),
    instagram: $('#business-instagram').value.trim(), map: $('#business-map').value.trim(), order: $('#business-order').value.trim(),
    logo: state.logoData || previous?.logo || '', cover: state.coverData || previous?.cover || '',
    status: $('#business-status').value, createdAt: previous?.createdAt || new Date().toISOString().slice(0, 10),
    interactions: previous?.interactions || { view: 0, whatsapp: 0, instagram: 0, location: 0, order: 0 },
  };
}

function handleBusinessSubmit(event) {
  event.preventDefault();
  const submitButton = $('#business-form button[type="submit"]');
  if (submitButton.disabled) return;
  const id = state.editingId || `business-${Date.now()}`;
  const previous = state.businesses.find((item) => item.id === id);
  const business = collectBusinessForm(previous);
  business.id = id;
  if (!business.name || !business.description || !business.location) { $('#form-message').textContent = 'Preencha nome, descrição e localização.'; return; }
  if (!validPhone(business.phone) || !validPhone($('#business-whatsapp').value) || ![business.instagram, business.map, business.order].every(validUrl)) { $('#form-message').textContent = 'Verifique telefone e URLs informados.'; return; }
  if (![business.latitude, business.longitude].every((value) => value === null || Number.isFinite(value))) { $('#form-message').textContent = 'Latitude e longitude inválidas.'; return; }
  const logoData = state.logoData;
  const coverData = state.coverData;
  state.logoData = '';
  state.coverData = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Salvando...';
  (async () => {
    const files = [...($('#business-gallery').files || [])];
    if (files.some((file) => !validImage(file))) throw new Error('Cada imagem deve ser JPG, PNG ou WEBP com até 5 MB.');
    if (logoData?.startsWith('data:image/')) {
      const response = await fetch(logoData);
      const blob = await response.blob();
      business.logo = (await uploadBusinessImage(new File([blob], 'logo.jpg', { type: blob.type }), id, 'logo')).publicUrl;
    }
    if (coverData?.startsWith('data:image/')) {
      const response = await fetch(coverData);
      const blob = await response.blob();
      business.cover = (await uploadBusinessImage(new File([blob], 'cover.jpg', { type: blob.type }), id, 'cover')).publicUrl;
    }
    const saved = await upsertBusiness(business);
    for (const [index, file] of files.entries()) await addBusinessGalleryImage(id, await uploadBusinessImage(file, id), index);
    return saved;
  })()
    .then((savedBusiness) => {
      if (previous) {
        savedBusiness.interactionHistory = previous.interactionHistory;
        savedBusiness.interactions = previous.interactions;
        savedBusiness.gallery = previous.gallery;
        state.businesses = state.businesses.map((item) => item.id === id ? savedBusiness : item);
      }
      else state.businesses.push(savedBusiness);
      saveData();
      $('#form-message').textContent = 'Dados salvos com sucesso.';
      renderBusinesses();
      return showAdmin();
    })
    .catch((error) => {
      console.error('Não foi possível salvar a empresa no Supabase.', error);
      $('#profile-view').hidden = true;
      $('#profile-editor').hidden = false;
      $('#form-message').textContent = 'Não foi possível salvar os dados. Tente novamente.';
    })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar alterações';
    });
}

function search(query, location = $('#hero-location').value) { state.query = query.trim(); state.location = location.trim(); $('#hero-query').value = state.query; $('#hero-location').value = state.location; renderBusinesses(); $('#results').scrollIntoView({ behavior: 'smooth' }); }

document.addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-category]'); if (categoryButton) { setCategory(categoryButton.dataset.category); return; }
  const businessButton = event.target.closest('[data-business]'); if (businessButton) { openBusiness(businessButton.dataset.business); return; }
  const interaction = event.target.closest('[data-interaction]'); if (interaction) { recordInteraction(interaction.dataset.id, interaction.dataset.interaction); return; }
  const profileInteraction = event.target.closest('[data-profile-interaction]'); if (profileInteraction && !profileInteraction.classList.contains('is-disabled')) { const business = getOwnedBusiness(); if (business) { recordInteraction(business.id, profileInteraction.dataset.profileInteraction); renderProfile(business); } return; }
  const editButton = event.target.closest('[data-edit]'); if (editButton) { fillForm(editButton.dataset.edit); return; }
  const profileTab = event.target.closest('[data-profile-tab]'); if (profileTab) { const tab = profileTab.dataset.profileTab; $$('.profile-tabs button').forEach((button) => button.classList.toggle('active', button === profileTab)); $$('.profile-tab-content').forEach((content) => content.classList.toggle('active', content.id === `profile-${tab}`)); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'admin') showAdmin(); if (action === 'home') showPublic(); if (action === 'open-services') openDrawer(); if (action === 'toggle-services') toggleDrawer(); if (action === 'close-services') closeDrawer(); if (action === 'close-modal') closeModal(); if (action === 'close-auth') closeAuth(); if (action === 'logout') logout(); if (action === 'toggle-theme') toggleTheme(); if (action === 'edit-profile') { $('#profile-view').hidden = true; $('#profile-editor').hidden = false; } if (action === 'close-profile-editor') { $('#profile-editor').hidden = true; $('#profile-view').hidden = false; } if (action === 'preview-business') previewBusiness(); if (action === 'clear-filters') { state.query = ''; state.location = ''; state.category = ''; $('#hero-query').value = ''; $('#hero-location').value = ''; renderCategories(); renderBusinesses(); }
  const moderation = event.target.closest('[data-moderate]'); if (moderation) moderateBusiness(moderation.dataset.moderate, moderation.value).then(() => loadData()).then(() => renderModeration()).catch((error) => console.error('Não foi possível moderar a empresa.', error));
});
if ($('#hero-search-form')) $('#hero-search-form').addEventListener('submit', (event) => { event.preventDefault(); search($('#hero-query').value); });
if ($('#sort-select')) $('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; renderBusinesses(); });
if ($('#analytics-period')) $('#analytics-period').addEventListener('change', renderAnalytics);
if ($('#business-form')) $('#business-form').addEventListener('submit', handleBusinessSubmit);
if ($('#business-logo')) $('#business-logo').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!validImage(file)) { event.target.value = ''; $('#form-message').textContent = 'A logo deve ser JPG, PNG ou WEBP com até 5 MB.'; return; }
  const reader = new FileReader();
  reader.addEventListener('load', () => { state.logoData = reader.result; $('#business-logo-preview').style.backgroundImage = `url("${reader.result}")`; $('#business-logo-placeholder').hidden = true; });
  reader.readAsDataURL(file);
});
if ($('#business-cover')) $('#business-cover').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!validImage(file)) { event.target.value = ''; $('#form-message').textContent = 'O banner deve ser JPG, PNG ou WEBP com até 5 MB.'; return; }
  const reader = new FileReader();
  reader.addEventListener('load', () => { state.coverData = reader.result; });
  reader.readAsDataURL(file);
});
if ($('#business-gallery')) $('#business-gallery').addEventListener('change', (event) => {
  const invalid = [...event.target.files].find((file) => !validImage(file));
  if (invalid) { event.target.value = ''; $('#form-message').textContent = 'Cada imagem deve ser JPG, PNG ou WEBP com até 5 MB.'; }
});
if ($('#business-phone')) $('#business-phone').addEventListener('blur', (event) => { if (!validPhone(event.target.value)) $('#form-message').textContent = 'Informe um telefone válido.'; });
function configureAuthForm(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  const isSignin = mode === 'signin';
  const isReset = mode === 'reset';
  const isForgot = mode === 'forgot';
  $('#auth-title').textContent = isSignup ? 'Cadastre-se para acessar o painel' : isSignin ? 'Entre para acessar o painel' : isForgot ? 'Recupere sua senha' : 'Redefina sua senha';
  $('#auth-description').textContent = isSignup
    ? 'Informe seu e-mail empresarial e crie uma senha com pelo menos 8 caracteres.'
    : isSignin
      ? 'Use o e-mail e a senha cadastrados no Supabase.'
      : isForgot
        ? 'Informe seu e-mail e enviaremos um link para criar uma nova senha.'
      : 'Crie uma nova senha com pelo menos 8 caracteres.';
  $('#auth-email').closest('label').hidden = isReset;
  $('#auth-email').required = !isReset;
  $('#auth-password-label').hidden = isForgot;
  $('#auth-password').required = !isForgot;
  $('#auth-password-label').firstChild.textContent = isReset ? 'Nova senha' : 'Senha';
  $('#auth-password').placeholder = isReset ? 'Digite sua nova senha' : 'Digite sua senha';
  $('#auth-submit').textContent = isSignup ? 'Concluir cadastro' : isSignin ? 'Entrar' : isForgot ? 'Enviar link' : 'Salvar nova senha';
  $('#auth-mode-toggle').hidden = isReset;
  $('#auth-mode-toggle').textContent = isForgot ? 'Voltar para entrar' : isSignup ? 'Já tenho uma conta' : 'Ainda não tenho uma conta';
  $('#auth-reset-toggle').hidden = !isSignin;
  $('#auth-message').textContent = '';
}
if ($('#auth-mode-toggle')) $('#auth-mode-toggle').addEventListener('click', () => configureAuthForm(authMode === 'forgot' ? 'signin' : authMode === 'signup' ? 'signin' : 'signup'));
if ($('#auth-reset-toggle')) $('#auth-reset-toggle').addEventListener('click', () => configureAuthForm('forgot'));
if ($('#auth-form')) $('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!$('#auth-form').reportValidity()) return;
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const submitButton = $('#auth-submit');
  submitButton.disabled = true;
  $('#auth-message').textContent = 'Conectando ao Supabase...';
  try {
    if (authMode === 'reset') {
      const { error } = await updatePassword(password);
      if (error) throw error;
      $('#auth-message').textContent = 'Senha alterada com sucesso.';
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setTimeout(() => { closeAuth(); showAdmin(); }, 600);
      return;
    }
    if (authMode === 'forgot') {
      const { error } = await sendPasswordResetEmail(email);
      if (error) throw error;
      $('#auth-message').textContent = 'Enviamos um link de recuperação para seu e-mail.';
      return;
    }
    const { data, error } = authMode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    if (error) throw error;
    currentUser = data.session ? data.user : null;
    if (!currentUser) {
      $('#auth-message').textContent = 'Cadastro realizado. Confirme seu e-mail para continuar.';
      return;
    }
    $('#auth-message').textContent = authMode === 'signup' ? 'Cadastro concluído.' : 'Login realizado.';
    closeAuth();
    await showAdmin();
  } catch (error) {
    console.error('Não foi possível autenticar no Supabase.', error);
    $('#auth-message').textContent = error.message || 'Não foi possível concluir a autenticação.';
  } finally {
    submitButton.disabled = false;
  }
});
if ($('#drawer-backdrop')) $('#drawer-backdrop').addEventListener('click', closeDrawer);
if ($('#modal-backdrop')) $('#modal-backdrop').addEventListener('click', () => { if ($('#auth-modal').hidden) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeDrawer(); closeModal(); closeAuth(); } });

initializeTheme();
handleAuthCallbackError();
const dataReady = loadData();
dataReady.then(async () => {
  if ($('#business-grid')) {
    renderCategories();
    renderBusinesses();
    renderPopularCategories();
  }
  if (document.body.dataset.page === 'admin') {
    $('#business-category').innerHTML = categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join('');
    $('#business-secondary-categories').innerHTML = categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join('');
    currentUser = await getCurrentUser();
    if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
      configureAuthForm('reset');
      showAuth();
    } else if (hasAdminSession()) { await showAdmin(); }
    else showAuth();
  }
});
if ($('#profile-view')) $$('.profile-tab-content').forEach((content, index) => { if (index > 0) content.classList.remove('active'); });
