const SUPABASE_URL="https://nphenccoyaqkmusaknxp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_mrfc6H6GVYdmQgZ2IC5uww_XgSCw_8c";
window.testtSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});