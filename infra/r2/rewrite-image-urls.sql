-- Rewrite the stored image URLs from the Hetzner host to images.motori.fi (#229).
--
-- Hand-run SQL for the R2 cutover window (issue #227), not a Kysely migration:
-- it must run after the object copy is verified and while both apps are stopped,
-- and it writes two schemas (public and talli) in one transaction.
--
-- How to run. Copy each of sections 1, 2, 4a and 4b into its own scratch file with
-- the two \set lines below at the top, then pipe it:
--
--   ssh root@motori "dokku postgres:connect motori" < <section>.sql > <output>
--
-- Never pipe the whole file: 4a and 4b would then report success from inside the
-- transaction that section 3 opened, and nothing would be committed.
--
-- Section 3 is pasted into an interactive `just psql` (paste the \set lines first),
-- so the numbers are read before COMMIT is typed by hand.
--
-- Both prefixes carry the trailing slash on purpose. isValidImageUrl matches
-- `${STORAGE_PUBLIC_URL}/`, so a value without the slash would be rejected by the
-- app. Neither host contains % or _, so no LIKE escaping is needed.

\set old_prefix 'https://motori-images.hel1.your-objectstorage.com/'
\set new_prefix 'https://images.motori.fi/'

-- ─── 1. Pre-flight counts ─────────────────────────────────────────────────────
-- Expected (inventory 2026-09-15): public.listing_image.url 19 / 0,
-- public.listing_image.thumbnail_url 19 / 0, every other row 0 / 0.
-- Any other number stops the window. A non-zero other_host is a value nobody
-- expected. A non-zero public.user.image matters because the rewrite below does
-- not cover that column.

SELECT 'public.listing_image.url' AS col,
       count(*) FILTER (WHERE url LIKE :'old_prefix' || '%') AS old_host,
       count(*) FILTER (WHERE url IS NOT NULL AND url NOT LIKE :'old_prefix' || '%') AS other_host
  FROM listing_image
UNION ALL
SELECT 'public.listing_image.thumbnail_url',
       count(*) FILTER (WHERE thumbnail_url LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE :'old_prefix' || '%')
  FROM listing_image
UNION ALL
SELECT 'public.user.image',
       count(*) FILTER (WHERE image LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE image IS NOT NULL AND image NOT LIKE :'old_prefix' || '%')
  FROM "user"
UNION ALL
SELECT 'talli.vehicle.photo_url',
       count(*) FILTER (WHERE photo_url LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url NOT LIKE :'old_prefix' || '%')
  FROM talli.vehicle
UNION ALL
SELECT 'talli.vehicle.thumbnail_url',
       count(*) FILTER (WHERE thumbnail_url LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE :'old_prefix' || '%')
  FROM talli.vehicle
UNION ALL
SELECT 'talli.service_record_photo.url',
       count(*) FILTER (WHERE url LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE url IS NOT NULL AND url NOT LIKE :'old_prefix' || '%')
  FROM talli.service_record_photo
UNION ALL
SELECT 'talli.service_record_photo.thumbnail_url',
       count(*) FILTER (WHERE thumbnail_url LIKE :'old_prefix' || '%'),
       count(*) FILTER (WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE :'old_prefix' || '%')
  FROM talli.service_record_photo
 ORDER BY 1;

-- ─── 2. Target URLs, fetched before anything is written ───────────────────────
-- Built by the same expression the UPDATE uses, so the check covers the exact
-- bytes about to be committed. Pipe this section with its output to urls.txt.

COPY (
  SELECT :'new_prefix' || substr(url, length(:'old_prefix') + 1)
    FROM listing_image WHERE url LIKE :'old_prefix' || '%'
  UNION ALL
  SELECT :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
    FROM listing_image WHERE thumbnail_url LIKE :'old_prefix' || '%'
  UNION ALL
  SELECT :'new_prefix' || substr(photo_url, length(:'old_prefix') + 1)
    FROM talli.vehicle WHERE photo_url LIKE :'old_prefix' || '%'
  UNION ALL
  SELECT :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
    FROM talli.vehicle WHERE thumbnail_url LIKE :'old_prefix' || '%'
  UNION ALL
  SELECT :'new_prefix' || substr(url, length(:'old_prefix') + 1)
    FROM talli.service_record_photo WHERE url LIKE :'old_prefix' || '%'
  UNION ALL
  SELECT :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
    FROM talli.service_record_photo WHERE thumbnail_url LIKE :'old_prefix' || '%'
) TO STDOUT;

-- Then, in a shell:
--
--   while read -r u; do
--     hdr=$(curl -sS -I "$u")
--     code=$(printf '%s\n' "$hdr" | head -1 | awk '{print $2}')
--     len=$(printf '%s\n' "$hdr" | awk 'tolower($1) == "content-length:" { gsub(/\r/, "", $2); print $2 }')
--     printf '%s\t%s\t%s\n' "$code" "$len" "$u"
--   done < urls.txt > fetch-before.tsv
--
--   wc -l < fetch-before.tsv                  # 38
--   awk -F'\t' '$1 != "200"' fetch-before.tsv # prints nothing
--
-- Compare each response length with the R2 manifest by object key.
-- Stop before the rewrite if any request fails or any size differs.

-- ─── 3. The transaction (interactive psql, COMMIT typed by hand) ──────────────
-- Preserve object keys; rewrite only URLs on the old host.
-- Re-running updates zero rows. NULLs remain unchanged.
-- Keep talli.vehicle.updated_at: changing the host is not an owner edit (#229).

BEGIN;

UPDATE listing_image
   SET url = :'new_prefix' || substr(url, length(:'old_prefix') + 1)
 WHERE url LIKE :'old_prefix' || '%';                    -- UPDATE 19

UPDATE listing_image
   SET thumbnail_url = :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
 WHERE thumbnail_url LIKE :'old_prefix' || '%';          -- UPDATE 19

UPDATE talli.vehicle
   SET photo_url = :'new_prefix' || substr(photo_url, length(:'old_prefix') + 1)
 WHERE photo_url LIKE :'old_prefix' || '%';              -- UPDATE 0

UPDATE talli.vehicle
   SET thumbnail_url = :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
 WHERE thumbnail_url LIKE :'old_prefix' || '%';          -- UPDATE 0

UPDATE talli.service_record_photo
   SET url = :'new_prefix' || substr(url, length(:'old_prefix') + 1)
 WHERE url LIKE :'old_prefix' || '%';                    -- UPDATE 0

UPDATE talli.service_record_photo
   SET thumbnail_url = :'new_prefix' || substr(thumbnail_url, length(:'old_prefix') + 1)
 WHERE thumbnail_url LIKE :'old_prefix' || '%';          -- UPDATE 0

-- Assertion, still inside the transaction. Literals, not the two variables: a check
-- built from the same variable would pass even if the variable was wrong.
-- Expected: 0, 38, 0, 0. no_slash catches a literal edited by hand during the window.

WITH v AS (
            SELECT url           AS value FROM listing_image
  UNION ALL SELECT thumbnail_url            FROM listing_image
  UNION ALL SELECT photo_url                FROM talli.vehicle
  UNION ALL SELECT thumbnail_url            FROM talli.vehicle
  UNION ALL SELECT url                      FROM talli.service_record_photo
  UNION ALL SELECT thumbnail_url            FROM talli.service_record_photo
)
SELECT count(*) FILTER (WHERE value LIKE 'https://motori-images.hel1.your-objectstorage.com/%') AS old_host,
       count(*) FILTER (WHERE value LIKE 'https://images.motori.fi/%')                          AS new_host,
       count(*) FILTER (WHERE value LIKE 'https://images.motori.fi%'
                          AND value NOT LIKE 'https://images.motori.fi/%')                      AS no_slash,
       count(*) FILTER (WHERE value IS NOT NULL
                          AND value NOT LIKE 'https://images.motori.fi/%')                      AS other
  FROM v;

-- Typed by hand, after reading the four numbers above:
--
--   COMMIT;    -- or ROLLBACK; if any number is wrong
--
-- Do not leave the session idle inside the transaction: it holds row locks on
-- listing_image. Commit or roll back before you step away.

-- ─── 4a. After the commit: the same assertion, outside the transaction ────────
-- Expected: 0, 38, 0, 0.

WITH v AS (
            SELECT url           AS value FROM listing_image
  UNION ALL SELECT thumbnail_url            FROM listing_image
  UNION ALL SELECT photo_url                FROM talli.vehicle
  UNION ALL SELECT thumbnail_url            FROM talli.vehicle
  UNION ALL SELECT url                      FROM talli.service_record_photo
  UNION ALL SELECT thumbnail_url            FROM talli.service_record_photo
)
SELECT count(*) FILTER (WHERE value LIKE 'https://motori-images.hel1.your-objectstorage.com/%') AS old_host,
       count(*) FILTER (WHERE value LIKE 'https://images.motori.fi/%')                          AS new_host,
       count(*) FILTER (WHERE value LIKE 'https://images.motori.fi%'
                          AND value NOT LIKE 'https://images.motori.fi/%')                      AS no_slash,
       count(*) FILTER (WHERE value IS NOT NULL
                          AND value NOT LIKE 'https://images.motori.fi/%')                      AS other
  FROM v;

-- ─── 4b. After the commit: read the values back and fetch them again ──────────
-- Pipe this section with its output to urls-after.txt, then run the same shell
-- loop as section 2. Expected: 38 lines, all 200, sizes equal to the manifest.
-- The two talli.service_record_photo selects carry no IS NOT NULL filter because
-- both columns are NOT NULL in the schema, so the 38-line count still holds.
-- Then the inventory's cross-reference with BASE=https://images.motori.fi/:
-- 0 missing references, orphans still 22.

COPY (
            SELECT url           FROM listing_image WHERE url IS NOT NULL
  UNION ALL SELECT thumbnail_url FROM listing_image WHERE thumbnail_url IS NOT NULL
  UNION ALL SELECT photo_url     FROM talli.vehicle WHERE photo_url IS NOT NULL
  UNION ALL SELECT thumbnail_url FROM talli.vehicle WHERE thumbnail_url IS NOT NULL
  UNION ALL SELECT url           FROM talli.service_record_photo
  UNION ALL SELECT thumbnail_url FROM talli.service_record_photo
) TO STDOUT;

-- ─── 5. Reverse rewrite (abort path) ──────────────────────────────────────────
-- Full literals so it can be copied on its own without the \set lines. Only
-- useful while the Hetzner objects still exist. Uncomment to use.

-- BEGIN;
-- UPDATE listing_image
--    SET url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--              substr(url, length('https://images.motori.fi/') + 1)
--  WHERE url LIKE 'https://images.motori.fi/%';
-- UPDATE listing_image
--    SET thumbnail_url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--                        substr(thumbnail_url, length('https://images.motori.fi/') + 1)
--  WHERE thumbnail_url LIKE 'https://images.motori.fi/%';
-- UPDATE talli.vehicle
--    SET photo_url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--                    substr(photo_url, length('https://images.motori.fi/') + 1)
--  WHERE photo_url LIKE 'https://images.motori.fi/%';
-- UPDATE talli.vehicle
--    SET thumbnail_url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--                        substr(thumbnail_url, length('https://images.motori.fi/') + 1)
--  WHERE thumbnail_url LIKE 'https://images.motori.fi/%';
-- UPDATE talli.service_record_photo
--    SET url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--              substr(url, length('https://images.motori.fi/') + 1)
--  WHERE url LIKE 'https://images.motori.fi/%';
-- UPDATE talli.service_record_photo
--    SET thumbnail_url = 'https://motori-images.hel1.your-objectstorage.com/' ||
--                        substr(thumbnail_url, length('https://images.motori.fi/') + 1)
--  WHERE thumbnail_url LIKE 'https://images.motori.fi/%';
-- COMMIT;
