# Journal Club Deployment Guide
<!-- pragma: allowlist secret -->

This guide walks you through deploying the Journal Club feature to production on Vercel with Postgres.

## Prerequisites

Before deploying, ensure you have:

1. **Vercel Project**: An existing Vercel project linked to this repository
2. **Vercel Postgres**: A Postgres database provisioned in Vercel (via Storage tab)
3. **HUJI Credentials**: Hebrew University institutional email and password for article access
4. **Admin Password**: A secure password for `/admin/login` access
5. **Resend Account** (optional): For email notifications - sign up at https://resend.com/api-keys
6. **Verified Email Domain** (optional): If using Resend, verify a sending domain
7. **sim_users Table**: The `sim_users` table must exist in the database (created by labor-ai-site's main schema). Journal Club schema depends on this table via foreign key constraints.

## Required Environment Variables

Configure these in your Vercel project settings (Project → Settings → Environment Variables):

<!-- pragma: allowlist secret -->

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `POSTGRES_URL` | PostgreSQL connection string from Vercel Postgres | ✓ | `postgresql://user:pass@ep-...vercel.postgres.com/...` |
| `JWT_SECRET` | Secret for signing JWT tokens (32+ chars, random) | ✓ | Generate: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Key for encrypting stored credentials (32+ chars) | ✓ | Generate: `openssl rand -hex 32` |
| `HUJI_EMAIL` | Your HUJI institutional email | ✓ | `student@huji.ac.il` |
| `HUJI_PASSWORD` | Your HUJI password | ✓ | (will be encrypted) |
| `ADMIN_PASSWORD` | Password for `/admin/login` | ✓ | (choose secure password) |
| `RESEND_API_KEY` | Resend API key for sending emails | ✗ | `re_...` (from resend.com) |
| `RESEND_FROM` | Email address to send from | ✗ | `noreply@labor-ai.org` |
| `EMAIL_TO_1` | First email recipient | ✗ | `user@example.com` |
| `EMAIL_TO_2` | Second email recipient | ✗ | `user2@example.com` |
| `EMAIL_TO_3` | Third email recipient | ✗ | `user3@example.com` |

### How to Generate Secrets

```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

## Deployment Steps

### 1. Get Postgres Connection String

1. Go to your Vercel project → **Storage** tab
2. Click on your Postgres database
3. Copy the **Connection String** (labeled as `POSTGRES_URL`)
4. Add it to Vercel environment variables

### 2. Set Environment Variables

In Vercel Project Settings → Environment Variables, add:
- `JWT_SECRET` (generated)
- `ENCRYPTION_KEY` (generated)
- `POSTGRES_URL` (from Vercel Postgres)
- `HUJI_EMAIL` (your institutional email)
- `HUJI_PASSWORD` (your institutional password)
- `ADMIN_PASSWORD` (choose a secure password)
- Optional: `RESEND_API_KEY` and `RESEND_FROM` (if using email)
- Optional: `EMAIL_TO_1`, `EMAIL_TO_2`, `EMAIL_TO_3` (if using email)

### 3. Migrate Database Schema

Run the schema migration to create all required tables:

```bash
# Set your Postgres URL (from Vercel or local testing)
export POSTGRES_URL="postgresql://..."

# Run the schema migration
psql $POSTGRES_URL < lib/journal-club/schema.sql
```

Or via Vercel's data browser:
1. Go to Vercel → Storage → Postgres → **Query** tab
2. Copy contents of `lib/journal-club/schema.sql` and paste into the query editor
3. Click **Run Query**

### 4. Testing (Before Deployment)

⚠️ **IMPORTANT**: Tests must run against a **separate test database**, NOT production.

```bash
# Create a separate test database in Vercel Postgres or use a development database
# Copy the connection string

# Set TEST_DATABASE_URL to your test database
export TEST_DATABASE_URL="postgresql://test_user:test_pass@ep-...vercel.postgres.com/test_db"

# Run the Journal Club tests
npm run test:journal-club

# Verify TypeScript types
npx tsc --noEmit
```

**Test Database Setup**:
1. In Vercel, create a separate Postgres instance for testing (or use a development branch)
2. Set `TEST_DATABASE_URL` environment variable to the test database connection string
3. Ensure the test database has the `sim_users` table (run labor-ai-site schema first)
4. Run `psql $TEST_DATABASE_URL < lib/journal-club/schema.sql` to initialize Journal Club tables

**Do NOT run tests against production database.**

### 5. Deploy to Vercel

Push your code to the main branch:

```bash
git add .
git commit -m "chore: add deployment configuration for journal club"
git push origin main
```

Vercel will automatically deploy. Monitor the deployment at https://vercel.com/dashboard.

### 6. Verify Deployment

After deployment, run the following checks:

#### Login Page
1. Navigate to `/tools/journal-club/login`
2. Verify the login form loads without errors
3. Try logging in with test credentials (if available)

#### Journal Management
1. Navigate to `/tools/journal-club/journals`
2. Verify you can view the journal list
3. Try adding a new journal (search catalog or custom URL)
4. Verify journals appear in the list

#### Admin Settings (Protected)
1. Navigate to `/admin/settings` (requires session auth)
2. Verify the admin login form appears
3. Log in with `ADMIN_PASSWORD` from environment variables
4. Verify you can view and save HUJI credentials
5. Verify you can view and save Resend configuration

#### Table of Contents (TOC)
1. From journals list, click "View TOC" on any journal
2. Verify articles load from the database
3. Try expanding article details
4. Verify "Download" and "Add to Reading List" buttons appear

#### Reading List (Optional)
1. Add several articles to the reading list
2. Navigate to `/tools/journal-club/reading-list`
3. Verify selected articles appear
4. (If Resend configured) Click "Email Reading List" and verify email sends

## Troubleshooting

### Schema Migration Fails

**Symptom**: `ERROR: relation "sim_users" does not exist` when running `psql $POSTGRES_URL < lib/journal-club/schema.sql`

**Root Cause**: The `sim_users` table must exist first (created by labor-ai-site's main schema)

**Solution**:
1. Verify `sim_users` table exists:
   ```bash
   psql $POSTGRES_URL -c "SELECT 1 FROM sim_users LIMIT 1"
   ```
2. If table doesn't exist, run labor-ai-site's main schema first
3. Then run Journal Club schema

### Tests Fail on Database Connection

**Symptom**: `Error: connect ECONNREFUSED` or database connection timeout in test output

**Root Cause**: Tests are either:
- Running against production database (never do this!)
- Using wrong TEST_DATABASE_URL
- Test database doesn't exist or is unreachable

**Solution**:
1. Create a separate test database (do NOT use production)
2. Set TEST_DATABASE_URL environment variable:
   ```bash
   export TEST_DATABASE_URL="postgresql://user:pass@host/test_db"
   ```
3. Run schema migration on test database:
   ```bash
   psql $TEST_DATABASE_URL < lib/journal-club/schema.sql
   ```
4. Verify test database is reachable:
   ```bash
   psql $TEST_DATABASE_URL -c "SELECT 1"
   ```
5. Run tests:
   ```bash
   npm run test:journal-club
   ```

### Test "User not found" Error

**Symptom**: Test fails with "Test user with ID 1 not found in sim_users table"

**Root Cause**: Test database doesn't have any users in `sim_users` table

**Solution**:
1. Create a test user in the test database:
   ```bash
   psql $TEST_DATABASE_URL -c "INSERT INTO sim_users (id, email, name) VALUES (1, 'test@example.com', 'Test User')"
   ```
2. Verify user exists:
   ```bash
   psql $TEST_DATABASE_URL -c "SELECT * FROM sim_users WHERE id = 1"
   ```
3. Re-run tests

### Database Connection Error in Production

- **Symptom**: "Failed to connect to database"
- **Solution**: Verify `POSTGRES_URL` is set and correct in Vercel environment variables
- **Debug**: Run `psql $POSTGRES_URL -c "SELECT 1"` locally to test connection

### Authentication Failures

- **Symptom**: "Invalid credentials" on login
- **Solution**: Verify `HUJI_EMAIL` and `HUJI_PASSWORD` are correct
- **Debug**: Test credentials locally before deploying

### Admin Settings Not Accessible

- **Symptom**: Redirect loop or 401 error on `/admin/settings`
- **Solution**: Clear browser cookies and re-login with correct `ADMIN_PASSWORD`
- **Debug**: Check browser console for session-related errors

### TOC Not Updating

- **Symptom**: Articles list is empty or stale
- **Solution**: Run the scheduled refresh manually via `/api/journal-club/journals/refresh`
- **Debug**: Check database for content in `jc_toc_articles` table

### Email Not Sending

- **Symptom**: "Failed to send email" when submitting reading list
- **Solution**: Verify `RESEND_API_KEY` is set and the API key is valid
- **Solution**: Verify `RESEND_FROM` domain is verified in Resend dashboard
- **Debug**: Check Vercel logs for Resend API errors

## Post-Deployment Configuration

### Configure HUJI Credentials (Required Once)

1. Login to `/admin/settings`
2. Enter your HUJI email and password
3. Click "Save" — credentials are encrypted and stored in the database
4. These persist across deployments

### Configure Resend (Optional, for Email)

1. Get your API key from https://resend.com/api-keys
2. Verify a sending domain in Resend dashboard
3. Login to `/admin/settings`
4. Enter `RESEND_API_KEY` and `RESEND_FROM` address
5. Click "Save"

### Configure Email Recipients (Optional)

Recipients can be set in two ways:
- **Via environment**: Set `EMAIL_TO_1`, `EMAIL_TO_2`, `EMAIL_TO_3` in Vercel
- **Via settings**: Login to `/settings` and configure recipients

## Monitoring

### Key Logs to Monitor

After deployment, check Vercel Function logs for:

```
# Successful journal sync
[journal-club] Synced X journals, Y new articles

# Authentication errors
[journal-club] HUJI auth failed: ...

# PDF download issues
[journal-club] Download failed: ...

# Email send errors
[journal-club] Resend API error: ...
```

### Health Check Endpoint

Test the deployment health:

```bash
curl https://your-vercel-app.vercel.app/api/health
```

Should return:
```json
{"status": "ok"}
```

## Rollback

If something goes wrong:

1. **Vercel**: Go to Deployments tab, select a previous working deployment, click "Promote to Production"
2. **Database**: Changes to schema are not easily rolled back. If you need to, delete and recreate the Vercel Postgres database, then re-run migrations
3. **Environment Variables**: Changes take effect on next deployment — revert in Vercel Settings and redeploy

## Scaling Considerations

### Database Performance
- The schema includes indexes on frequently queried columns (user_id, journal_id, doi)
- For >10,000 articles, consider adding indexes on `jc_toc_articles(issue_label)` and `jc_articles(journal)`

### PDF Storage
- Currently configured for S3 or local storage via `pdf_path` column
- For Vercel, consider using Vercel Blob Storage or S3

### Scheduled Tasks
- TOC refresh is configured via cron (via APScheduler or Vercel Cron Functions)
- Ensure your Vercel plan supports scheduled tasks

## Additional Resources

- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Resend Email Documentation](https://resend.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Journal Club Feature Overview](./journal-club-feature.md)
