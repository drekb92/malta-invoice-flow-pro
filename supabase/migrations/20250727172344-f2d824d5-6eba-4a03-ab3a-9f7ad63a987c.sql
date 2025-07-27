-- First, let's see what user accounts exist
-- This migration will help associate existing data with user accounts

-- If there are existing auth users, we can update the data to belong to the first user
-- If no users exist yet, the user will need to sign up first

DO $$
DECLARE
    first_user_id uuid;
BEGIN
    -- Get the first user from auth.users (if any exists)
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;
    
    -- If a user exists, update all existing records to belong to them
    IF first_user_id IS NOT NULL THEN
        -- Update customers
        UPDATE customers 
        SET user_id = first_user_id 
        WHERE user_id IS NULL;
        
        -- Update invoices
        UPDATE invoices 
        SET user_id = first_user_id 
        WHERE user_id IS NULL;
        
        -- Update invoice_templates
        UPDATE invoice_templates 
        SET user_id = first_user_id 
        WHERE user_id IS NULL;
        
        RAISE NOTICE 'Updated existing records to belong to user: %', first_user_id;
    ELSE
        RAISE NOTICE 'No users found. User must sign up first to see data.';
    END IF;
END $$;