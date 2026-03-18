// ============================================================
//  supabaseClient.js  —  Supabase initialisation
//  Must be loaded with  type="module"  in HTML
// ============================================================

import { createClient }
  from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL      = 'https://zsuonqltlodkzrqlhsnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW9ucWx0bG9ka3pycWxoc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODUwNzAsImV4cCI6MjA4OTE2MTA3MH0.Ea8xTDxxp6GaDfUNuByjkQaUcFxJPrdO1VrzG06cTH4';

// Named export → imported directly by Home.js
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase connected successfully!');
