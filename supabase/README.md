# Supabase setup for the portfolio

The site remains in local mode until both values in
`config/supabase-config.js` are filled. Do not use a `service_role` key in
browser code.

## 1. Create the project

Create a Supabase project and keep its Project URL and publishable/anon key.

## 2. Create the database

Open the Supabase SQL editor and run:

`supabase/migrations/001_portfolio_schema.sql`

This creates:

- `portfolio_sections`
- `portfolio_projects`
- `portfolio_admins`
- the public `portfolio-media` bucket
- public read policies for published content
- authenticated admin policies for drafts and writes

For a database created with the older thumbnail/poster model, also run:

`supabase/migrations/002_cover_and_hover_video.sql`

That migration preserves compatible existing media, introduces `cover_image`
and `preview_video`, and removes the obsolete columns.

To enable full-length YouTube videos on individual project pages, run:

`supabase/migrations/003_youtube_url.sql`

To manage the landing page and shared footer from the admin, also run:

`supabase/migrations/006_site_settings.sql`

To activate the protected contact form, run:

`supabase/migrations/007_contact_messages.sql`

To add the editable Contact page copy to an existing Site Settings row, run:

`supabase/migrations/008_contact_site_settings.sql`

To add up to three configurable still images to each project page, run:

`supabase/migrations/009_project_stills.sql`

To configure the mobile focal point of each project's cover image, run:

`supabase/migrations/012_mobile_cover_focus.sql`

To add the mobile cover scale/zoom control, run:

`supabase/migrations/013_mobile_cover_scale.sql`

To add the independent desktop cover focal point and scale controls, run:

`supabase/migrations/014_desktop_cover_framing.sql`

To add optional English project and section content while keeping the existing
fields as the canonical PT-BR version, run:

`supabase/migrations/015_bilingual_content.sql`

Then configure and deploy the Edge Function. The destination address remains
server-side and is never included in the public site:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  CONTACT_TO_EMAIL=your-private-email@example.com \
  CONTACT_FROM_EMAIL="Portfolio <contact@your-verified-domain.com>" \
  CONTACT_ALLOWED_ORIGINS=https://your-domain.com \
  CONTACT_RATE_LIMIT_SECRET=replace-with-a-long-random-value

supabase functions deploy send-contact-email --no-verify-jwt
```

`CONTACT_FROM_EMAIL` must use a sender/domain verified in Resend. For local
testing, add `http://localhost:8765` to `CONTACT_ALLOWED_ORIGINS`, separated by
a comma.

## 3. Create the administrator

Create the admin user in Supabase Authentication. Copy that user's UUID and
run this once in the SQL editor:

```sql
insert into public.portfolio_admins (user_id)
values ('YOUR_AUTH_USER_UUID');
```

## 4. Configure the browser client

Edit `config/supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  mediaBucket: 'portfolio-media'
};
```

The publishable/anon key is intended for browser use. RLS is what protects
write access. Never place the `service_role` key in this repository.

## 5. Current data flow

- The authenticated admin reads and writes Supabase directly.
- Browser storage is a local backup, not the public source of truth.
- Public galleries read published rows and fall back to local source data if
  Supabase is unavailable.
- Cover images and optional hover videos upload to the public media bucket.
- Full project videos can use privacy-enhanced YouTube embeds.
