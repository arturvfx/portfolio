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
2. Add absolute canonical URLs and an `og:image` social preview to the public
   pages.
3. Generate `sitemap.xml` using the production domain and add its absolute URL
   to `robots.txt`.
4. If the provider needs a `CNAME` file or platform configuration, create it
   only after the final domain and provider have been chosen.

## Production smoke test

- Landing `ENTER` opens the gallery.
- Every mobile menu item changes the filter without reloading the fixed header.
- Gallery cards open their project and browser back returns to the same filter.
- YouTube modal opens and closes with its visible close control and `Escape`.
- Contact form saves a row, sends one email and exposes no destination address.
- Admin login, project ordering, Site Settings and media uploads still work.
- Test at 320 px, 390 px and desktop widths with no horizontal overflow.
