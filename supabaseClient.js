// supabaseClient.js
const SUPABASE_URL = 'https://zsuonqltlodkzrqlhsnm.supabase.co';     // ← CHANGE THIS
const SUPABASE_ANON_KEY = 'your-anon-public-key-here';           // ← CHANGE THIS

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabase;   // Global access for all pages