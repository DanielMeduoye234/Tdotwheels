-- Supabase Migration: Add Missing DELETE RLS Policies & Fix Product Delete Permission
-- This migration adds DELETE policies that were missing from the initial schema
-- and changes the product delete policy from admin-only to authenticated users
-- =====================================================================

-- Fix product delete policy - change from admin-only to authenticated users
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- Add DELETE policy for suppliers
CREATE POLICY "Authenticated can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);

-- Add DELETE policy for purchases
CREATE POLICY "Authenticated can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (true);

-- Add DELETE policy for channel_pricing
CREATE POLICY "Authenticated can delete pricing" ON public.channel_pricing FOR DELETE TO authenticated USING (true);

-- Add DELETE policies for shipment tables
CREATE POLICY "Authenticated can delete shipments" ON public.shipment_tracking FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete shipment events" ON public.shipment_events FOR DELETE TO authenticated USING (true);
