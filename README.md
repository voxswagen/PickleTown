# Pickle Town Sports Center — install guide

| File | What it is |
|---|---|
| `index.html` | The whole app — customer site, booking, open play, TV board, player page. **This is the file you edit.** |
| `supabase.sql` | Sets up your database. Run once |
| `netlify.toml` | Tells Netlify how to build and serve the site |
| `build.js` | Turns `index.html` into the `dist` folder that gets published. Netlify runs it for you |
| `tools/babel.min.js` | Used by the build. Don't edit |
| `README.md` | This |

Total time: about 20 minutes.

**You only ever edit `index.html`.** It is still one self-contained file — open it
in a browser and the whole app works. Everything else is scaffolding.

---

## 1 · Create the database

1. Go to **supabase.com**, sign up, click **New project**.
2. Name it `pickletown`. Pick a strong database password and save it somewhere.
   Choose the **Singapore** region — closest to Manila, so the app feels quicker.
3. Wait for it to finish setting up (a minute or two).
4. Open **SQL Editor → New query**. Paste everything from `supabase.sql` and
   press **Run**. You should see "Success. No rows returned."
5. Copy two values out of the dashboard. They're on **different pages**:
   - **Project Settings → Data API → Project URL** — like `https://abcdefgh.supabase.co`
   - **Project Settings → API Keys → Publishable key** — starts `sb_publishable_…`

   (Supabase renamed these recently. The **publishable key** is what older guides
   call the *anon key*. If you see a long string starting `eyJ…` instead, that's
   the old name for the same thing and it works too.)

**Never use the Secret key** (`sb_secret_…`). It ignores every policy you just
set up, and this file is downloaded by everyone who visits your site. The
publishable key is designed to be public — the policies control who can change
what.

## 2 · Put those two values in the app

Open `index.html` in any text editor. Near the top:

```js
window.PT_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
```

Paste your two values between the quotes:

```js
window.PT_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "sb_publishable_4Z8M1OwxsHmLE8bfnt972A_K_aFg..."
};
```

It's near the top of the file, inside `<head>`, just above the React script
tags — search for `PT_CONFIG` if your editor has a find box.

Save the file.

Leave them blank and the app still works, but it saves to whichever browser it's
open in — every device gets its own separate copy. Fine for a demo, no good for
the club.

## 3 · Publish on Netlify

This folder is a Git repo. Put it on GitHub and let Netlify build it — then you
never run anything by hand.

1. Make an **empty** repo on github.com (no README, no .gitignore).
2. In this folder:
   ```
   git remote add origin https://github.com/YOU/pickletown.git
   git push -u origin main
   ```
3. Netlify → **Add new site → Import an existing project** → GitHub → pick the repo.
   It reads `netlify.toml` and fills in the build command and publish folder
   itself. Press deploy.

From then on, editing is: change `index.html`, then

```
git add -A && git commit -m "what changed" && git push
```

Netlify runs `node build.js`, publishes the `dist` folder, and the site is live
in under a minute. **Nothing to drag, nothing to build by hand.**

Open **Site configuration → Change site name** and pick something short. That
name is printed under the QR code on the TV screen, so make it easy to type.

### What the build does

`index.html` is one big file with the stylesheet and the app inside it. That is
lovely to edit and wrong to publish, so the build splits it into `dist/`:

- the page becomes about 23 KB of plain markup — View Source is readable rather
  than a wall of CSS
- the stylesheet and the app move to their own files, named with a hash of their
  contents so browsers cache them forever and still get changes instantly
- comments come out
- the app is compiled ahead of time, so visitors no longer download 2.8 MB of
  Babel and compile the page on arrival. This is the difference between a slow
  and a quick load on a phone in the hall.

You can run it yourself with `node build.js` if you want to see the output.

**It cannot hide your code.** Nothing can — the browser has to download the CSS
and the JavaScript to run the page, so anyone can read them in developer tools.
The build makes the page tidy and fast, not secret.

## 4 · First sign-in

Click **Staff** in the top right. Three accounts exist already:

| Username | Password | Role |
|---|---|---|
| `superadmin` | `1234` | Everything |
| `admin1` | `1234` | Morning shift |
| `admin2` | `1234` | Evening shift |

**Change all three passwords today.** Each person signs in and goes to
**Settings → Your account**. The super admin can also rename accounts, change
roles and reset a forgotten password from **Settings → Staff**.

## 5 · Payments

Sign in as `superadmin` → **Settings → Payments & rates**:

- Hourly rate (₱500 to start)
- Bank name, account name, account number, and a photo of your bank QR
- GCash name, number, and a photo of your GCash QR

Customers see these on the booking form with the total worked out from how long
they've booked. Sign in as `superadmin` and they save — nothing else to set up.

**Optional, and only if you want it:** you can link a staff account to a real
Supabase user. Nothing in the app needs it now, but it's there if you later
lock the payment QR images down (see the last section of `supabase.sql`).

1. Supabase → **Authentication → Users → Add user**. Use a real email and a
   password. Turn **off** "Confirm email" under Authentication → Providers →
   Email first, or confirm the address.
2. In the app: **Settings → Your account → Linked email**. Enter that same email
   and set your app password to match. Sign out and back in.

Under Authentication → Providers → Email, turn **off** "Enable sign-ups" so
nobody can create their own account.

---

## The addresses

| Page | Address | For |
|---|---|---|
| Home | `pickletown.netlify.app` | Customers |
| Book a court | `…/#book` | Customers |
| Player queue | `…/#stack` | Players' phones — this is the QR code |
| Open play board | `…/#openplay` | Staff at the desk |
| TV screen | `…/#tv` | The screen in the hall |
| Requests | `…/#requests` | Staff |
| Settings | `…/#settings` | Staff |

Each page has its own address, so refreshing keeps you where you were and you
can bookmark the TV screen on the hall computer.

## Setting up the TV

1. Open `…/#tv` on the hall computer.
2. Press **Sound off** once to turn sound on. Browsers won't let a page speak
   until someone has clicked it — do this every time the TV restarts.
3. Press **F11** for full screen.

The board then calls the names itself: "One minute left on Court 3", then
"Time's up on Court 3", and reads the next four when you press **Call next up**
at the desk. Players scan the QR code to follow the queue on their own phones.

---

## Worth knowing

**Passwords are hashed, but this isn't bank security.** The hashes sit in a
database anyone with the link can read, and `1234` would take seconds to crack.
Treat the accounts as shift separation and accountability — who approved what —
rather than a lock. Use real passwords.

**Anyone with the link can write anything the site stores** — booking requests,
the open play queue, and now the rates and payment details too. They have to be
able to write most of it; customers aren't signed in, and the database can't
tell the browser at your desk apart from anyone else's.

The app only shows the payments screen to the super admin, so nobody stumbles
into it. But someone who knows how the site is built could write those rows
directly, and the one that would actually cost you money is the **payment QR
images** — swap those and a customer pays into someone else's account. Glance at
the QR codes on the booking form now and then and check they're still yours. If
you'd rather have them locked, the last section of `supabase.sql` puts them back
behind a Supabase login; set the linked email up first, or you'll lock yourself
out of your own rates.

**Receipts and QR photos are stored as text in the database**, shrunk to roughly
100–250KB each. Fine for a few thousand bookings. When it gets heavy, the fix is
Supabase Storage — a proper file bucket.

**Back it up.** Free-plan Supabase doesn't keep automatic backups. Export a CSV
from Settings → Records now and then, or take a database dump from the Supabase
dashboard.

**Everything lives in one `kv` table** rather than separate tables for bookings,
players and sessions. That was deliberate — it moved the whole app onto Supabase
without a rewrite. When you want real reporting (revenue by month, busiest
courts, who attends most), proper tables would make those queries much easier.
That's a good next project, not something to do before you open.
