-- Add map module to existing users
UPDATE "User"
SET "enabledModules" = ARRAY(SELECT DISTINCT unnest("enabledModules" || ARRAY['map']))
WHERE NOT ('map' = ANY("enabledModules"));
