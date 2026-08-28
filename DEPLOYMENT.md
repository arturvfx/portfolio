# Publication checklist

The portfolio is a static site. Run `npm run build` and configure the hosting
provider to publish the generated `dist` directory. The build deliberately
excludes Supabase migrations, Edge Function source, repository documentation
and local development files.

## Before the first production deployment

1. Run every Supabase migration through `009_project_stills.sql`.
2. Confirm that `config/supabase-config.js` contains only the project URL and
   the browser-safe publishable key. Never add the service-role key there.
3. In Supabase Authentication, set the production Site URL and add both the
   apex and `www` origins to the redirect allow list.
4. In the `send-contact-email` Edge Function secrets, set:
   - `CONTACT_ALLOWED_ORIGINS=https://example.com,https://www.example.com`
   - `CONTACT_RATE_LIMIT_SECRET` to a long random value
   - `CONTACT_TO_EMAIL` to the private destination address
5. Verify a sending domain in Resend. Then replace the temporary sender with
   `CONTACT_FROM_EMAIL=Artur Araujo <contact@example.com>`.
6. Keep JWT verification disabled only for `send-contact-email`; the function
   performs its own validation, honeypot check and rate limiting.

## Domain and search metadata

After the final domain is known:

1. Point its DNS records to the selected static hosting provider and enforce
   HTTPS.
2. The build reads published Supabase sections/projects and generates their
   canonical URLs, social metadata and `sitemap.xml`. A new deploy refreshes
   these search entries after content changes.
3. Keep the absolute sitemap URL in `robots.txt` and submit it to the search
   engines you use.
4. If the provider needs a `CNAME` file or platform configuration, create it
   only after the final domain and provider have been chosen.

## Production smoke test

- Landing `ENTER` opens `/work`.
- Every mobile menu item changes the filter without reloading the fixed header.
- Gallery cards open `/project/project-slug` and browser back returns to the same filter.
- `/contact` and `/admin` load without exposing their underlying `.html` files.
- Older `.html` entry points redirect to their current clean URL.
- YouTube modal opens and closes with its visible close control and `Escape`.
- Contact form saves a row, sends one email and exposes no destination address.
- Admin login, project ordering, Site Settings and media uploads still work.
- Test at 320 px, 390 px and desktop widths with no horizontal overflow.

## Automated verification

- `npm test` builds the site and runs the Playwright navigation suite locally.
- `PLAYWRIGHT_TEST_BASE_URL=https://arturaraujo.com npx playwright test` runs the
  same non-destructive suite against production.
- GitHub Actions runs the local suite automatically on every push to `main`
  and on pull requests targeting `main`.
