UPDATE "User"
SET "enabledModules" = ARRAY(SELECT DISTINCT unnest("enabledModules" || ARRAY['reductions']))
WHERE NOT ('reductions' = ANY("enabledModules"));
