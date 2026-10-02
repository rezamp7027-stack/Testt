-- Testt Café hardening — 2026-10-03
-- Mirrors the live performance hardening and stable image URLs applied to Supabase.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (qual ILIKE '%auth.uid()%' OR with_check ILIKE '%auth.uid()%')
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
      r.policyname, r.schemaname, r.tablename,
      replace(r.qual, 'auth.uid()', '(select auth.uid())'),
      replace(coalesce(r.with_check, 'true'), 'auth.uid()', '(select auth.uid())')
    );
  END LOOP;
END $$;

UPDATE public.products
SET image_url = CASE slug
  WHEN 'espresso' THEN 'https://images.unsplash.com/photo-1510707577719-ae7c14805e32?auto=format&fit=crop&w=900&q=85'
  WHEN 'double-espresso' THEN 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85'
  WHEN 'cappuccino' THEN 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=85'
  WHEN 'latte' THEN 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?auto=format&fit=crop&w=900&q=85'
  WHEN 'hot-chocolate' THEN 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=900&q=85'
  WHEN 'special-tea' THEN 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85'
  WHEN 'iced-latte' THEN 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85'
  WHEN 'cold-brew' THEN 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=85'
  WHEN 'mojito' THEN 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=85'
  WHEN 'signature-mocktail' THEN 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=85'
  WHEN 'classic-burger' THEN 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85'
  WHEN 'double-cheeseburger' THEN 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=85'
  WHEN 'crispy-chicken' THEN 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=85'
  WHEN 'loaded-fries' THEN 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85'
  WHEN 'alfredo-pasta' THEN 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85'
  WHEN 'fruit-hookah' THEN 'https://images.unsplash.com/photo-1600369671236-e74521d4b2a1?auto=format&fit=crop&w=900&q=85'
  WHEN 'mint-hookah' THEN 'https://images.unsplash.com/photo-1600369671236-e74521d4b2a1?auto=format&fit=crop&w=900&q=85'
  WHEN 'signature-hookah' THEN 'https://images.unsplash.com/photo-1600369671236-e74521d4b2a1?auto=format&fit=crop&w=900&q=85'
  WHEN 'tiramisu' THEN 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85'
  WHEN 'cheesecake' THEN 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=900&q=85'
  WHEN 'chocolate-brownie' THEN 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=900&q=85'
  WHEN 'signature-dessert' THEN 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=85'
  ELSE image_url
END
WHERE slug IS NOT NULL;
