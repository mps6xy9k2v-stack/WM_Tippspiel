// Nach "config.js" kopieren und die Werte des eigenen Supabase-Projekts eintragen.
// Beides findest du im Supabase-Dashboard unter Settings -> API.
// Der "anon public" Key darf öffentlich sein – die Zugriffsregeln (RLS)
// aus supabase/setup.sql schützen die Daten.
window.TIPPSPIEL_CONFIG = {
  SUPABASE_URL: 'https://DEIN-PROJEKT.supabase.co',
  SUPABASE_ANON_KEY: 'DEIN_ANON_PUBLIC_KEY',
};
