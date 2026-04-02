# Klipklop (Vite + React + Supabase)

## Run locally

```bash
npm install
npm run dev
```

Create a `.env` file with:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Horses feature (profiles + medical log + reminders)
The Horses UI is available at:
- `/horses`
- `/horses/:horseId`

### 1) Create the database tables + RLS policies
Run the SQL script in Supabase SQL Editor:
- `supabase/horses_schema.sql`

This creates:
- `horses`
- `horse_medical_entries`
- `horse_reminders`

And enables Row Level Security so users only access their own data.

### 2) Create the storage bucket for horse photos
In Supabase Storage, create a **public** bucket named:
- `horse-photos`

The app uploads to `horse-photos/<userId>/<horseId>/photo.<ext>` and saves the resulting public URL on `horses.photo_url`.

