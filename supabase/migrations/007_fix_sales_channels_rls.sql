-- Supabase Migration: Fix Sales Channels RLS Policies
-- Allow all authenticated users to create and update sales channels (not just admins)
-- =====================================================================

-- Drop admin-only policies
DROP POLICY IF EXISTS "Admins can manage channels" ON public.sales_channels;
DROP POLICY IF EXISTS "Admins can update channels" ON public.sales_channels;

-- Create new policies allowing all authenticated users
CREATE POLICY "Authenticated can create channels" ON public.sales_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update channels" ON public.sales_channels FOR UPDATE TO authenticated USING (true);

-- Add DELETE policy for consistency
CREATE POLICY "Authenticated can delete channels" ON public.sales_channels FOR DELETE TO authenticated USING (true);
