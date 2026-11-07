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

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function toBusiness(row, interactions = []) {
  const counts = interactions
    .filter((interaction) => interaction.business_id === row.id)
    .reduce((result, interaction) => {
      result[interaction.type] = (result[interaction.type] || 0) + 1;
      return result;
    }, {});
  return { ...row, interactions: counts };
}

export async function fetchBusinesses() {
  const [{ data: businesses, error: businessesError }, { data: interactions, error: interactionsError }] = await Promise.all([
    supabase.from('businesses').select('*').order('created_at', { ascending: false }),
    supabase.from('business_interactions').select('business_id, type'),
  ]);
  if (businessesError) throw businessesError;
  if (interactionsError) throw interactionsError;
  return (businesses || []).map((business) => toBusiness(business, interactions || []));
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

export async function addInteraction(businessId, type) {
  const { error } = await supabase.from('business_interactions').insert({
    business_id: businessId,
    type,
  });
  if (error) throw error;
}
