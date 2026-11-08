import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data.user;
}

export async function signUp(email, password) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/htmladm.html` },
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function sendPasswordResetEmail(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/htmladm.html`,
  });
}

export async function updatePassword(password) {
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function toBusiness(row, interactions = []) {
  const counts = interactions
    .filter((interaction) => interaction.business_id === row.id)
    .reduce((result, interaction) => {
      result[interaction.type] = (result[interaction.type] || 0) + (interaction.interaction_count || 1);
      return result;
    }, {});
  return {
    ...row,
    interactions: counts,
    interactionHistory: interactions
      .filter((interaction) => interaction.business_id === row.id)
      .filter((interaction) => interaction.created_at)
      .map(({ type, created_at }) => ({ type, created_at })),
  };
}

function mergeGallery(businesses, gallery = []) {
  return businesses.map((business) => ({
    ...business,
    gallery: gallery.filter((image) => image.business_id === business.id).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function fetchBusinesses() {
  const { data: businesses, error: businessesError } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
  if (businessesError) throw businessesError;
  const user = await getCurrentUser();
  const [interactionRequest, galleryRequest] = [
    user
    ? supabase.rpc('get_my_business_interactions')
    : supabase.rpc('get_public_business_interaction_counts'),
    supabase.from('business_gallery').select('*').order('sort_order'),
  ];
  const [{ data: interactions, error: interactionsError }, { data: gallery, error: galleryError }] = await Promise.all([interactionRequest, galleryRequest]);
  if (interactionsError) throw interactionsError;
  if (galleryError) throw galleryError;
  return mergeGallery((businesses || []).map((business) => toBusiness(business, interactions || [])), gallery || []);
}

export async function upsertBusiness(business) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para salvar uma empresa.');
  const record = {
    id: business.id,
    owner_id: user.id,
    name: business.name,
    category: business.category,
    description: business.description,
    location: business.location,
    phone: business.phone || null,
    address: business.address || null,
    latitude: business.latitude ?? null,
    longitude: business.longitude ?? null,
    secondary_categories: business.secondaryCategories || business.secondary_categories || [],
    hours: business.hours || null,
    whatsapp: business.whatsapp || null,
    instagram: business.instagram || null,
    map: business.map || null,
    order: business.order || null,
    logo: business.logo || null,
    cover: business.cover || null,
    status: business.status,
    created_at: business.createdAt || business.created_at || new Date().toISOString(),
  };
  const { data, error } = await supabase.from('businesses').upsert({
    ...record,
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return toBusiness(data, []);
}

export async function uploadBusinessImage(file, businessId, kind = 'gallery') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para enviar imagens.');
  const extension = file.name.split('.').pop().toLowerCase() || 'jpg';
  const path = `${user.id}/${businessId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('business-images').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('business-images').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function migrateLegacyBusinessImages(business) {
  const updates = {};
  for (const [field, kind] of [['logo', 'logo'], ['cover', 'cover']]) {
    if (!business[field]?.startsWith('data:image/')) continue;
    const response = await fetch(business[field]);
    const blob = await response.blob();
    const image = await uploadBusinessImage(new File([blob], `${kind}.jpg`, { type: blob.type }), business.id, kind);
    updates[field] = image.publicUrl;
  }
  if (!Object.keys(updates).length) return business;
  const { data, error } = await supabase.from('businesses').update(updates).eq('id', business.id).select().single();
  if (error) throw error;
  return { ...business, ...data };
}

export async function addBusinessGalleryImage(businessId, image, sortOrder = 0) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para salvar a galeria.');
  const { data, error } = await supabase.from('business_gallery').insert({
    business_id: businessId,
    owner_id: user.id,
    storage_path: image.path,
    public_url: image.publicUrl,
    alt_text: image.altText || null,
    sort_order: sortOrder,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data === true;
}

export async function fetchModerationBusinesses() {
  const { data, error } = await supabase.from('businesses').select('id,name,status,location,created_at,updated_at,owner_id').order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function moderateBusiness(id, status) {
  const { data, error } = await supabase.from('businesses').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function addInteraction(businessId, type, visitorId) {
  const { data, error } = await supabase.rpc('record_business_interaction', {
    p_business_id: businessId,
    p_type: type,
    p_visitor_id: visitorId,
  });
  if (error) throw error;
  return data === true;
}
