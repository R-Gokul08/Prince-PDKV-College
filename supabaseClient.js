// supabaseClient.js — Plain script (no module), works with CDN
(function () {
  const SUPABASE_URL      = 'https://zsuonqltlodkzrqlhsnm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW9ucWx0bG9ka3pycWxoc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODUwNzAsImV4cCI6MjA4OTE2MTA3MH0.Ea8xTDxxp6GaDfUNuByjkQaUcFxJPrdO1VrzG06cTH4';

  // The CDN exposes the SDK as window.supabase (the module object)
  const { createClient } = window.supabase;

  // Replace window.supabase with the actual client instance
  window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('✅ Supabase client ready!');
})();
