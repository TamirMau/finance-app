# Finance API - PostgreSQL Schema (Simplified)

## גרסה פשוטה - תואמת בדיוק ל-FinanceDbContext

סקריפט זה יוצר את הסכימה בדיוק כפי שהיא מוגדרת ב-`FinanceDbContext.cs` - ללא תוספות מיותרות.

## מה כלול?

✅ **רק מה שצריך:**
- 6 טבלאות (users, categories, transactions, user_settings, bank_statements, bank_statement_rows)
- Foreign keys עם ON DELETE נכון
- Unique constraints (username, email, user_id ב-bank_statements)
- Indexes בדיוק כמו בקוד
- JSONB ל-merchant_aliases

❌ **מה לא כלול (מיותר):**
- DOMAINS מותאמים אישית
- Extensions מיותרים
- CHECK constraints שלא קיימים בקוד
- Triggers (אופציונלי)
- Views (אופציונלי)
- RLS (לא נדרש)
- Roles מותאמים (אופציונלי)

## איך להריץ על Neon PostgreSQL?

### דרך 1: דרך Neon SQL Editor (הכי פשוט) ⭐

1. היכנס ל-Neon Console: https://console.neon.tech
2. בחר את ה-project וה-database שלך
3. לחץ על **SQL Editor**
4. פתח את הקובץ `01_schema_simple.sql` (העתק את כל התוכן)
5. הדבק ב-SQL Editor
6. לחץ **Run** או **Execute**

**זה הכל!** הסכימה נוצרה.

### דרך 2: דרך psql עם Connection String

```bash
# הרץ את הסקריפט עם connection string מ-Neon
psql "postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require" -f server\FinanceApi\Database\01_schema_simple.sql
```

**החלף:**
- `user` - שם המשתמש שלך ב-Neon
- `password` - הסיסמה שלך
- `ep-xxx-xxx.region.aws.neon.tech` - ה-host מ-Neon
- `dbname` - שם ה-database

### בדיקה שהכל עבד

ב-Neon SQL Editor, הרץ:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'finance';
```

אמור לראות 6 טבלאות: users, categories, transactions, user_settings, bank_statements, bank_statement_rows

---

**📖 למדריך מפורט:** ראה `HOW_TO_RUN_NEON.md`

## השוואה לגרסה המורכבת

| תכונה | גרסה פשוטה | גרסה מורכבת |
|-------|------------|-------------|
| טבלאות | ✅ 6 | ✅ 6 |
| Foreign Keys | ✅ | ✅ |
| Indexes | ✅ | ✅ |
| DOMAINS | ❌ | ✅ |
| Extensions | ❌ | ✅ |
| CHECK Constraints | ❌ | ✅ |
| Triggers | ❌ | ✅ |
| Views | ❌ | ✅ |
| RLS | ❌ | ✅ |
| Roles | ❌ | ✅ |

**המלצה:** השתמש בגרסה הפשוטה (`01_schema_simple.sql`) אלא אם אתה צריך את התכונות הנוספות.

## תיקונים לעומת הגרסה המורכבת

1. **תאריכים**: `TIMESTAMP WITH TIME ZONE` (לא DATE) - תואם ל-`DateTime` ב-C#
2. **assigned_month_date**: `TIMESTAMP WITH TIME ZONE` (לא DATE) - תואם לקוד
3. **selected_month**: `TIMESTAMP WITH TIME ZONE` (לא DATE) - תואם ל-`DateTime?`
4. **value_date ו-date**: `TIMESTAMP WITH TIME ZONE` (לא DATE) - תואם ל-`DateTime`
5. **אין CHECK constraints** - לא קיימים בקוד
6. **אין DOMAINS** - לא קיימים בקוד, רק VARCHAR/TEXT

## אימות

לאחר הרצת הסקריפט, ודא שהכל עובד:

```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'finance';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'finance';

-- Test insert
INSERT INTO finance.users (username, email, password_hash) 
VALUES ('test', 'test@test.com', 'hash');
```

---

**תאריך:** 2025-12-14  
**גרסה:** 1.0 (Simplified)

