-- Migration 003: Convert repository IDs to UUIDs
-- Changes repository IDs from auto-incrementing integers to UUIDs
-- This prevents ID collisions and makes the system more robust

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 1: Create temporary UUID column in repositories table
ALTER TABLE repositories ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid();

-- Step 2: Populate UUIDs for existing repositories
UPDATE repositories SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

-- Step 3: Add temporary UUID foreign key column in files table
ALTER TABLE files ADD COLUMN uuid_repository_id UUID;

-- Step 4: Populate the UUID foreign key by joining with repositories
UPDATE files f
SET uuid_repository_id = r.uuid_id
FROM repositories r
WHERE f.repository_id = r.id;

-- Step 5: Drop old foreign key constraint
ALTER TABLE files DROP CONSTRAINT files_repository_id_fkey;

-- Step 6: Drop old ID columns
ALTER TABLE repositories DROP COLUMN id;
ALTER TABLE files DROP COLUMN repository_id;

-- Step 7: Rename UUID columns to be the primary columns
ALTER TABLE repositories RENAME COLUMN uuid_id TO id;
ALTER TABLE files RENAME COLUMN uuid_repository_id TO repository_id;

-- Step 8: Set NOT NULL constraint on new columns
ALTER TABLE repositories ALTER COLUMN id SET NOT NULL;
ALTER TABLE files ALTER COLUMN repository_id SET NOT NULL;

-- Step 9: Add primary key constraint to repositories
ALTER TABLE repositories ADD PRIMARY KEY (id);

-- Step 10: Add foreign key constraint back to files
ALTER TABLE files ADD CONSTRAINT files_repository_id_fkey
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE;

-- Step 11: Recreate indexes that might have been affected
-- The unique constraint on (repository_id, file_path) needs to be recreated
DROP INDEX IF EXISTS files_repository_id_file_path_key;
CREATE UNIQUE INDEX files_repository_id_file_path_key ON files(repository_id, file_path);
