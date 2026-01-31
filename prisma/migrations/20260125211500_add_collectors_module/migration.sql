UPDATE "User"
SET "enabledModules" = ARRAY(SELECT DISTINCT unnest("enabledModules" || ARRAY['collectors']))
WHERE NOT ('collectors' = ANY("enabledModules"));
