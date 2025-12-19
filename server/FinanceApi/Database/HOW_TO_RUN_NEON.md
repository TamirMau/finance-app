# איך להריץ את הסקריפט SQL על Neon PostgreSQL

## מה זה Neon?

Neon הוא PostgreSQL cloud service - אתה לא צריך להתקין PostgreSQL מקומי!

## שלב 1: קבלת Connection String מ-Neon

1. היכנס ל-Neon Console: https://console.neon.tech
2. בחר את ה-project שלך
3. לחץ על ה-database שלך
4. העתק את ה-Connection String (נראה כך):
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

## שלב 2: הרצת הסקריפט

### דרך 1: דרך Neon SQL Editor (הכי פשוט)

1. היכנס ל-Neon Console
2. לחץ על ה-database שלך
3. לחץ על **SQL Editor**
4. פתח את הקובץ `01_schema_simple.sql` (העתק את התוכן)
5. הדבק ב-SQL Editor
6. לחץ **Run** או **Execute**

**זה הכל!** הסכימה נוצרה.

### דרך 2: דרך psql עם Connection String

פתח **Command Prompt** או **PowerShell**:

```bash
# הרץ את הסקריפט ישירות עם connection string
psql "postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require" -f server\FinanceApi\Database\01_schema_simple.sql
```

**החלף:**
- `user` - שם המשתמש שלך ב-Neon
- `password` - הסיסמה שלך
- `ep-xxx-xxx.region.aws.neon.tech` - ה-host מ-Neon
- `dbname` - שם ה-database

### דרך 3: דרך .env או appsettings.json

אם יש לך connection string ב-`appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"
  }
}
```

השתמש ב-psql:
```bash
# קרא את ה-connection string מהקובץ
psql "הדבק כאן את ה-connection string מ-appsettings.json" -f server\FinanceApi\Database\01_schema_simple.sql
```

## שלב 3: בדיקה שהכל עבד

ב-Neon SQL Editor, הרץ:
```sql
-- רשימת כל הטבלאות
SELECT tablename FROM pg_tables WHERE schemaname = 'finance';
```

אמור לראות 6 טבלאות:
- users
- categories
- transactions
- user_settings
- bank_statements
- bank_statement_rows

## עדכון appsettings.json

אחרי שהסקריפט רץ, ודא ש-`appsettings.json` מכיל את ה-connection string הנכון:

```json
{
  "Storage": {
    "Type": "Database"
  },
  "ConnectionStrings": {
    "DefaultConnection": "postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"
  }
}
```

## פתרון בעיות

### בעיה: "connection refused" או "timeout"
**פתרון:** 
- ודא שה-connection string נכון
- ודא ש-SSL mode = require (Neon דורש SSL)
- בדוק שה-firewall מאפשר חיבור

### בעיה: "schema finance does not exist"
**פתרון:** הסקריפט יוצר את ה-schema אוטומטית. אם זה לא עובד, הרץ:
```sql
CREATE SCHEMA IF NOT EXISTS finance;
```

### בעיה: "permission denied"
**פתרון:** ודא שיש לך הרשאות ליצור schema/tables ב-Neon

---

## דוגמה מלאה

1. היכנס ל-Neon Console → SQL Editor
2. פתח את `01_schema_simple.sql`
3. העתק את כל התוכן
4. הדבק ב-SQL Editor
5. לחץ **Run**

**זה הכל!** 🎉

---

**קישור שימושי:** https://neon.tech/docs/

