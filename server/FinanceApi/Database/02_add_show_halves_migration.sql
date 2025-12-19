-- ============================================================================
-- 02_add_show_halves_migration.sql
-- Migration: Add show_halves column to user_settings table
-- ============================================================================
-- 
-- IMPORTANT: Run this ONLY if you have an existing database that was created
-- before the show_halves feature was added.
-- 
-- If you're creating a NEW database, use 01_schema_simple.sql instead,
-- which already includes the show_halves column.
-- 
-- ============================================================================

BEGIN;

SET lock_timeout = '30s';
SET statement_timeout = '60s';

SET search_path TO finance, public;

-- Add show_halves column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'finance' 
        AND table_name = 'user_settings' 
        AND column_name = 'show_halves'
    ) THEN
        ALTER TABLE finance.user_settings 
        ADD COLUMN show_halves BOOLEAN NOT NULL DEFAULT false;
        
        RAISE NOTICE 'Column show_halves added to user_settings table';
    ELSE
        RAISE NOTICE 'Column show_halves already exists in user_settings table';
    END IF;
END $$;

COMMIT;

