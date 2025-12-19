-- בדיקת Schema ו-Columns מול DB אמיתי
-- Finance API - PostgreSQL Database Verification

-- 1. בדיקת IsHalves Column
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions' 
  AND column_name = 'is_halves';
-- Expected: is_halves | boolean | NO | false

-- 2. בדיקת כל העמודות בטבלת transactions
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 3. בדיקת Indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'transactions'
ORDER BY indexname;

-- 4. בדיקת Foreign Keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'transactions';

-- 5. בדיקת User Settings עם ShowHalves
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'user_settings' 
  AND column_name = 'show_halves';
-- Expected: show_halves | boolean | NO | false

-- 6. בדיקת Constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
ORDER BY conname;

-- 7. בדיקת Data Types
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name IN ('transactions', 'categories', 'user_settings', 'bank_statements')
ORDER BY table_name, ordinal_position;



