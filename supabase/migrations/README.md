# Supabase Migrations

This directory contains database migrations for the Invoice Generator.

## Applying Migrations

### Option 1: Supabase SQL Editor (Recommended for Production)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migrations in order:
   - First run `000_complete_schema.sql` if tables don't exist
   - Or run `001_add_user_id_to_clients.sql` and `002_add_user_id_to_businesses.sql` for existing tables

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Push migrations
supabase db push
```

## Migration Files

| File | Description |
|------|-------------|
| `000_complete_schema.sql` | Full schema for new installations |
| `001_add_user_id_to_clients.sql` | Add user_id + RLS to clients table |
| `002_add_user_id_to_businesses.sql` | Add user_id + RLS to businesses table |

## Important Notes

- These migrations enable Row Level Security (RLS) so users can only access their own data
- The `user_id` column references `auth.users` with CASCADE delete
- After migration, update your code to include `user_id` when creating records