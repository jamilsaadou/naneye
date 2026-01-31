UPDATE "User"
SET "enabledModules" = ARRAY(SELECT DISTINCT unnest("enabledModules" || ARRAY['payments']))
WHERE NOT ('payments' = ANY("enabledModules"));
