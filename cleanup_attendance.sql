-- Remove all PENDING attendance.csv documents
-- This will keep processed attendance (already embedded) but remove unprocessed ones from the queue

DELETE FROM documents 
WHERE filename = 'attendance.csv' 
AND status = 'pending';

-- Summary query to show what's left
SELECT status, COUNT(*) as count 
FROM documents 
GROUP BY status 
ORDER BY status;
