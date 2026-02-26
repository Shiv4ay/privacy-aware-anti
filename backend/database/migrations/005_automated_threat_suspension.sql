-- Automated Threat Suspension Trigger

-- Create a function that checks for recent security violations
CREATE OR REPLACE FUNCTION check_security_threat_suspension()
RETURNS TRIGGER AS $$
DECLARE
    violation_count INTEGER;
BEGIN
    -- Only act on critical security events
    IF NEW.action IN ('rate_limit_exceeded', 'jailbreak_attempt') AND NEW.user_id IS NOT NULL THEN
        
        -- Count occurrences for this user in the last 10 minutes
        SELECT COUNT(*) INTO violation_count
        FROM audit_log
        WHERE user_id = NEW.user_id
          AND action IN ('rate_limit_exceeded', 'jailbreak_attempt')
          AND created_at >= NOW() - INTERVAL '10 minutes';
          
        -- If this new event pushes them to 5 or more violations, suspend the account
        IF violation_count >= 5 THEN
            -- Suspend the user account
            UPDATE users SET is_active = FALSE WHERE id = NEW.user_id OR user_id = NEW.user_id::text;
            
            -- Log the autonomous suspension action
            INSERT INTO audit_log (user_id, action, resource_type, success, error_message)
            VALUES (NEW.user_id, 'autonomous_suspension', 'security_system', TRUE, 'User automatically suspended due to excessive security violations.');
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_threat_suspension ON audit_log;

-- Attach trigger to the audit_log table after every insert
CREATE TRIGGER trigger_threat_suspension
AFTER INSERT ON audit_log
FOR EACH ROW
EXECUTE FUNCTION check_security_threat_suspension();
