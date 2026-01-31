-- Add logs module to existing users
UPDATE "User"
SET "enabledModules" = ARRAY(SELECT DISTINCT unnest("enabledModules" || ARRAY['logs']))
WHERE NOT ('logs' = ANY("enabledModules"));
