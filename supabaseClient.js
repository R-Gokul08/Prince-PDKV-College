// supabaseClient.js
const SUPABASE_URL = 'https://zsuonqltlodkzrqlhsnm.supabase.co';     // ← CHANGE THIS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW9ucWx0bG9ka3pycWxoc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODUwNzAsImV4cCI6MjA4OTE2MTA3MH0.Ea8xTDxxp6GaDfUNuByjkQaUcFxJPrdO1VrzG06cTH4';           // ← CHANGE THIS

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabase;   // Global access for all pages