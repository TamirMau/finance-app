# Finance Application

אפליקציית ניהול כספים עם Angular Frontend ו-ASP.NET Core Backend.

## 📋 דרישות מוקדמות

- **Node.js** (גרסה 18 ומעלה) ו-**npm** (גרסה 11.4.0)
- **.NET SDK 9.0** או גרסה חדשה יותר
- **PostgreSQL** (או Neon PostgreSQL - מומלץ)

## 🚀 התקנה והרצה

### שלב 1: פתיחת הפרויקט

1. פתח את קובץ ה-ZIP
2. העתק את התיקייה למקום הרצוי

### שלב 2: התקנת תלויות - Client (Angular)

```bash
cd client/finance-client
npm install
```

### שלב 3: התקנת תלויות - Server (ASP.NET Core)

התלויות יותקנו אוטומטית בעת build, אבל אם צריך:

```bash
cd server/FinanceApi
dotnet restore
```

### שלב 4: הגדרת Database

#### אופציה A: Neon PostgreSQL (מומלץ - חינמי)

1. היכנס ל-[Neon Console](https://console.neon.tech) ויצור database חדש
2. העתק את ה-Connection String
3. פתח את `server/FinanceApi/Database/01_schema_simple.sql`
4. העתק את התוכן והרץ אותו ב-Neon SQL Editor
5. ראה `server/FinanceApi/Database/README_SIMPLE.md` להוראות מפורטות

#### אופציה B: PostgreSQL מקומי

1. התקן PostgreSQL
2. צור database חדש בשם `finance`
3. הרץ את `server/FinanceApi/Database/01_schema_simple.sql`

### שלב 5: הגדרת appsettings.json

צור את הקובץ `server/FinanceApi/appsettings.json` מהדוגמה:

```bash
cd server/FinanceApi
copy appsettings.example.json appsettings.json
```

ערוך את `appsettings.json` והגדר:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "YOUR_POSTGRESQL_CONNECTION_STRING_HERE"
  },
  "JWT": {
    "Secret": "YOUR_SUPER_SECRET_KEY_MINIMUM_32_CHARACTERS_LONG"
  },
  "CORS": {
    "AllowedOrigins": [
      "http://localhost:4200"
    ]
  }
}
```

**חשוב:**
- החלף את `YOUR_POSTGRESQL_CONNECTION_STRING_HERE` ב-Connection String שלך
- החלף את `YOUR_SUPER_SECRET_KEY_MINIMUM_32_CHARACTERS_LONG` במפתח סודי (לפחות 32 תווים)

### שלב 6: הרצת השרת (Backend)

```bash
cd server/FinanceApi
dotnet run
```

השרת יעלה על `https://localhost:5001` (או פורט אחר לפי ההגדרות).

Swagger UI יהיה זמין ב: `https://localhost:5001/swagger`

### שלב 7: הרצת הלקוח (Frontend)

פתח טרמינל חדש:

```bash
cd client/finance-client
npm start
```

או:

```bash
ng serve
```

האפליקציה תהיה זמינה ב: `http://localhost:4200`

## 📁 מבנה הפרויקט

```
finance/
├── client/
│   └── finance-client/     # Angular Frontend
│       ├── src/
│       └── package.json
├── server/
│   └── FinanceApi/         # ASP.NET Core Backend
│       ├── Controllers/
│       ├── Services/
│       ├── Models/
│       ├── Database/
│       └── FinanceApi.csproj
└── README.md
```

## 🔧 פיתוח

### Build Production

**Client:**
```bash
cd client/finance-client
ng build --configuration production
```

**Server:**
```bash
cd server/FinanceApi
dotnet build --configuration Release
```

### הרצת Tests

**Client:**
```bash
cd client/finance-client
npm test
```

## ⚠️ הערות חשובות

1. **node_modules לא נכלל ב-ZIP** - צריך להריץ `npm install` אחרי פתיחת ה-ZIP
2. **appsettings.json לא נכלל** - צריך ליצור אותו מ-`appsettings.example.json`
3. **storage.json לא נכלל** - זה נתונים של משתמש, ייווצר אוטומטית
4. **bin/obj לא נכללים** - תוצרי build, ייווצרו אוטומטית בעת build

## 🐛 פתרון בעיות

### שגיאת Connection String
- ודא שה-Connection String נכון
- ודא שה-Database קיים והסכימה נוצרה

### שגיאת npm install
- ודא שיש לך Node.js מותקן
- נסה למחוק `package-lock.json` ולהריץ שוב

### שגיאת dotnet
- ודא שיש לך .NET SDK 9.0 מותקן
- הרץ `dotnet --version` כדי לבדוק

## 📚 משאבים נוספים

- [Angular Documentation](https://angular.dev)
- [ASP.NET Core Documentation](https://learn.microsoft.com/en-us/aspnet/core/)
- [Neon PostgreSQL](https://neon.tech)

---

**תאריך עדכון:** 2025-12-17

