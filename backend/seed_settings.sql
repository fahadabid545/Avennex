-- Seed new settings keys
INSERT INTO settings (key, value) VALUES
('site_theme', 'dark'),
('space_bg_enabled', 'true'),
('animations_enabled', 'true'),
('game_enabled', 'true'),
('ai_brain_enabled', 'true'),
('pipeline_enabled', 'true'),
('stats_enabled', 'true'),
('home_chat_enabled', 'true'),
('faq_enabled', 'true'),
('default_blog_status', 'draft'),
('default_job_expiry_days', '30')
ON CONFLICT (key) DO NOTHING;

-- Add error column to chatbot_documents if it doesn't exist
ALTER TABLE chatbot_documents ADD COLUMN IF NOT EXISTS error text;

-- Add missing columns to faqs if they don't exist
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS last_edited_by text;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Table to track chatbot API usage for analytics
CREATE TABLE IF NOT EXISTS chatbot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);
ALTER TABLE chatbot_requests DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
