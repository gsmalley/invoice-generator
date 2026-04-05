-- Migration: Add user_id column to clients table
-- This enables row-level security so users can only see their own clients

-- Add user_id column (nullable first to avoid breaking existing data)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

-- Create RLS policies
CREATE POLICY "Users can view their own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- Optional: Clean up any orphaned clients without user_id
-- DELETE FROM clients WHERE user_id IS NULL;

-- Optional: Make user_id NOT NULL after migration (run separately if needed)
-- ALTER TABLE clients ALTER COLUMN user_id SET NOT NULL;