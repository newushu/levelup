This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Avatar Daily Award Job

The daily avatar bonus is granted by a server-side scheduled request to `POST /api/avatars/daily-points`.

### Option A: Supabase scheduled trigger (recommended)
1. In Supabase, enable scheduled functions for your project.
2. Create a scheduled job that runs once per day (e.g. `0 6 * * *`).
3. Configure the job to call:

```
POST https://<your-domain>/api/avatars/daily-points
Header: x-avatar-daily-secret: <AVATAR_DAILY_POINTS_SECRET>
```

Set `AVATAR_DAILY_POINTS_SECRET` in your server environment and use the same value in the job header.

### Option B: External cron (GitHub Actions, cron-job.org, etc.)
Schedule a daily POST request using the same endpoint + header. Example curl:

```bash
curl -X POST "https://<your-domain>/api/avatars/daily-points" \
  -H "x-avatar-daily-secret: $AVATAR_DAILY_POINTS_SECRET"
```

Notes:
- The award runs for all students with an active avatar and `daily_free_points` set.
- The dashboard shows “Ready now” when the next drop is due but the job has not run yet.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
