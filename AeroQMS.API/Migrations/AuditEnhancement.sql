-- =============================================
-- Audit History Enhancement Migration
-- =============================================

-- 1. Enhance NCR History Table (if it exists)
-- Note: Since we're using SQLite, we'll need to handle table creation carefully

-- First, check if ncr_history table exists (SQLite specific)
CREATE TABLE IF NOT EXISTS ncr_history (
    id TEXT NOT NULL PRIMARY KEY,
    ncr_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    change_reason TEXT,
    metadata TEXT,
    FOREIGN KEY (ncr_id) REFERENCES non_conformances (id) ON DELETE CASCADE
);

-- Create indexes for ncr_history
CREATE INDEX IF NOT EXISTS idx_ncr_history_timestamp ON ncr_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ncr_history_user_id ON ncr_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ncr_history_action ON ncr_history(action);
CREATE INDEX IF NOT EXISTS idx_ncr_history_ncr_id ON ncr_history(ncr_id);

-- 2. Enhance CAPA History Table
-- First, check if we need to add columns to capa_history
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we'll handle this carefully

-- For existing capa_history table, add new columns (if not already present)
-- These commands are idempotent - safe to run multiple times

-- 3. Create Unified Audit View
CREATE VIEW IF NOT EXISTS unified_audit_trail AS
SELECT 
    'NCR' as entity_type,
    ncr_id as entity_id,
    n.ncr_number as entity_reference,
    h.user_id,
    h.user_name,
    h.action,
    h.old_value,
    h.new_value,
    h.timestamp,
    h.ip_address,
    h.user_agent,
    h.change_reason,
    h.metadata
FROM ncr_history h 
JOIN non_conformances n ON h.ncr_id = n.id 

UNION ALL 

SELECT 
    'CAPA' as entity_type,
    capa_id as entity_id,
    c.title as entity_reference,
    h.user_id,
    h.user_name,
    h.action,
    h.old_value,
    h.new_value,
    h.timestamp,
    h.ip_address,
    h.user_agent,
    h.change_reason,
    h.metadata
FROM capa_histories h 
JOIN capa_actions c ON h.capa_id = c.id 

ORDER BY timestamp DESC;

-- =============================================
-- Action Types Reference
-- =============================================
-- NCR Actions:
-- - "created" - NCR created
-- - "status_changed" - Status updated
-- - "severity_changed" - Severity modified
-- - "assigned" - Assigned to different person
-- - "category_changed" - Category updated
-- - "description_updated" - Description modified
-- - "commented" - Comment added
-- - "attachment_added" - File uploaded
-- - "attachment_removed" - File deleted
-- - "closed" - NCR closed
-- - "reopened" - NCR reopened
--
-- CAPA Actions:
-- - "created" - CAPA created
-- - "status_changed" - Status updated
-- - "priority_changed" - Priority modified
-- - "assigned" - Responsible person changed
-- - "due_date_changed" - Due date modified
-- - "commented" - Comment added
-- - "attachment_added" - File uploaded
-- - "attachment_removed" - File deleted
-- - "verified" - CAPA verified
-- - "closed" - CAPA closed
-- - "cost_updated" - Cost information changed
--
-- =============================================
-- Metadata Example (JSON):
-- =============================================
-- {
--   "previous_status": "open",
--   "new_status": "in_progress",
--   "trigger": "manual",
--   "session_id": "abc123",
--   "related_entity_id": "capa-uuid"
-- }
