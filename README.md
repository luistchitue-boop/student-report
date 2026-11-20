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

## AI proofreading for reports

Set `AI_GATEWAY_API_KEY` in the server environment to enable automatic proofreading of coordinator weekly observations before PDF reports are generated and AI-assisted interactive presentation creation for coordinators. The default model is `google/gemini-2.5-flash-lite`; set `AI_GATEWAY_MODEL` to use another chat model available in Vercel AI Gateway.

Proofreading is limited to spelling, accents, grammar, punctuation, and capitalization. If the gateway is unavailable, the original observation is used.

School administrators can enable **Apresentações** for selected coordinators on the school administration page. Only selected coordinators can use the feature in that active school. They can create and save lesson plans, add URL and uploaded-file resources, then select a saved lesson before choosing a subject template and creating a GSAP presentation. Lesson plans and uploaded-file metadata are stored per school and coordinator. Uploaded Blob files use public, unlisted URLs; anyone with a direct URL can access them, so do not upload sensitive personal data. Generated slide edits remain in the current browser session; review AI-generated content before class.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Multi-school rollout

The schema includes school memberships and assigns existing classes, activity logs, weekly closures, and users to the legacy school in a forward migration. A normal build does **not** apply database migrations. After taking and verifying a restorable backup and rehearsing pending migrations against a disposable copy, apply them as an explicit deployment step with `npm run db:deploy`; do not use `prisma db push` or run the seed script against production.

After the migration, existing users keep their current login and receive a membership in the legacy school. School administrators can add schools from the application and switch only between schools where they have a membership. Creating a school does not copy any student, class, or report data. Public guardian lookup requires choosing a school, and the seed script requires explicit `SEED_SCHOOL_ID`, `SEED_COORDINATOR_EMAIL`, and `SEED_COORDINATOR_PASSWORD` values; it never resets an existing account's password.

### School activation codes

School creation requires a single-use activation code in addition to the signed-in school-admin role. Generate one with `npm run school:license`, then add it to the server's `SCHOOL_CREATION_CODES` environment variable in Vercel (multiple codes may be comma- or newline-separated). Give each code to one customer and remove it from the environment after it is redeemed. The application stores only a SHA-256 hash of redeemed codes and enforces one-time use in the same database transaction that creates the school. Do not commit generated codes or put them in `NEXT_PUBLIC_*` variables. Apply the single-use-code migration before enabling code redemption.
