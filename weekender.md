# Loot — Weekender Working File

> This is Kartik's working file for the GrowthX AI Weekender sprint.
> Fill in the blanks marked [YOU]. Claude reads this at the start of every session.

---

## track

**Primary:** Revenue
**Bonus:** Virality + MaaS

---

## idea

Loot — AI shopping assistant for India. Eliminates the two biggest friction points:
1. Deciding *what* to buy (Researcher module — top 5 personalised picks)
2. Finding *where and when* to buy for the best price (Price Optimizer — 11 platforms, real-time prices, bank card discounts applied)

**Tagline:** "Not just a deal. A loot."
**Why this name:** Indians already say "what a loot deal" as the highest praise for a bargain. Reclaiming it as a brand.

---

## first user

**Prateek** (`pkvk.ml@gmail.com`) — first organic stranger user. Came in via the Telegram channel of **"Extensive Agentic Generation"** (an AI course Kartik is taking from The School of AI — separate from GrowthX), then **reached out to Kartik on Telegram unprompted** after using the product.

Verified usage from PostHog (2026-04-25 06:50–07:00 UTC, 10 min session):
- Joined waitlist → identified → completed onboarding
- 6 `research_run` events (multiple within 9 sec of each other — actively iterating)
- 2 `price_check_from_research` clicks → drilled into product price pages
- Products researched: **Oakter Mini UPS 12V** and **Cuzor Router UPS** — domestic India use case (home router power backup)
- 66 events total. No tip / no buy_click — engaged but didn't convert (yet)

Quotes / verbatim feedback: [YOU — capture from Telegram conversation. Probe: why router UPS? what made you try Loot? if Loot saved you ₹500, would you tip ₹49? what felt slow / wrong / missing?]

---

## stage

**As of end of Friday 24 April 2026:**
- Landing page + waitlist: live
- Onboarding: live
- Researcher module: live (Gemini 2.5 Flash)
- Price Optimizer: live (Gemini + Rainforest API for Amazon)
- Savings Card / Loot Report: live (shareable with personalized OG image)
- Wishlist: live
- Feedback widget: live
- Deal logging: live

---

## live url

**Production:** https://loot-eta.vercel.app
**GitHub:** https://github.com/KartikS07/loot

---

## metrics

| Metric | Target | Current (snapshot 2026-04-26 ~01:48 IST, post-submission) |
|---|---|---|
| Waitlist signups | 100 | **5** (Convex prod, source of truth) |
| App sessions (first-use events) | 50 | **20** unique sessions, **19** unique merged persons (PostHog `dau`; pre-PostHog traffic from Friday's X post + class drop is uncountable) |
| Research runs | 30 | **10** (Prateek's session + post-submission visitors) |
| Price optimizer runs | 30 | **3** |
| Deals logged (Buy clicks) | 20 | **18** total tracked / ₹1,06,053 deals found (Convex; includes pre-decimal-fix entries) |
| Loot Report shares | 10 | 0 captured by PostHog so far |
| Revenue (Razorpay) | $0+ | **₹49 captured** (1 paying user — Kartik's own e2e test, real UPI from `kartik.h.sangani@okicici`, payment_id `pay_ShhIGa6M0vGaIb`) |

**Public PostHog dashboard (read-only, no login):** https://us.posthog.com/shared/IANWfXzG1tZDaCgdGD2KuphWqlNo-w
Tiles: daily unique users, research runs over time, activation funnel (waitlist signup → research run → price drilldown), event volume across all 6 product events. Numbers above are a point-in-time snapshot; the dashboard is the live source of truth.

---

## env vars (all set)

- `GEMINI_API_KEY` — AI (Gemini 2.5 Flash)
- `RAINFOREST_API_KEY` — Real-time Amazon India prices
- `NEXT_PUBLIC_CONVEX_URL` — Convex backend
- `ANTHROPIC_API_KEY` — Paused (no credits), switch back later
- `RAZORPAY_KEY_ID/SECRET` — **LIVE** (rotated 2026-04-25 from test → live keys; both Vercel prod env AND Convex prod env updated; redeployed; ₹49 e2e test captured cleanly)
- `NEXT_PUBLIC_POSTHOG_KEY` — live (set 2026-04-25 ~06:30 UTC; project ID 396779, US Cloud)

---

## submission checklist

- [x] Razorpay KYC approved + wired (live keys swapped 2026-04-25; ₹49 e2e capture verified)
- [x] Launch post drafts written (3 variants in `launch_post_drafts.md` — pragmatic / story-led / contrarian)
- [ ] Launch post live on LinkedIn (scheduled Monday morning IST for algorithmic reach)
- [x] PostHog / analytics tracking wired for signups + sessions (12 events firing, project ID 396779)
- [x] weekender.md metrics filled in (current pass — 2026-04-25)
- [ ] First user interviewed (Prateek on Telegram + Amol in person)
- [x] Submission form submitted (2026-04-26 afternoon; 4-hour extension granted)
- [ ] Phase 2 evidence pass (4-hour extension): demo video, PostHog read-only link, X post with savings card, Telegram drop, Prateek ₹199 ask, observability description in submission

---

## daily log

### Friday 24 April 2026 (build day)
- Set up repo, scaffolded Next.js + Convex + shadcn
- Built landing page with Loot brand (amber/black, dark)
- Built onboarding (4-step persona + cards)
- Built Researcher module (Gemini 2.5 Flash, JSON mode)
- Built Price Optimizer (2-phase architecture, Rainforest for Amazon)
- Built Savings Card with shareable OG image
- Built Wishlist, Feedback widget, Deal logging
- Wired WhatsApp/X/LinkedIn sharing with personalized card
- Fixed 15+ bugs: price accuracy, JSON parsing, hydration, URLs, UX
- Test suite: `npm run test:prices` (12/15 passing)
- Deployed to Vercel, GitHub connected for auto-deploy

### Saturday 25 April 2026 (submission day)

**Distribution + first organic user:**
- X post live: https://x.com/kartiksangani07/status/2047602291273027604
- Dropped link in GrowthX course Google Meet class (~200 classmates)
- **Prateek (pkvk.ml@gmail.com) found Loot via the "Extensive Agentic Generation" Telegram channel** (an AI course Kartik is taking from The School of AI) **and used it for 10 min straight** — 6 research_runs, 2 price-check drilldowns on router UPS products. Reached out to Kartik on Telegram unprompted.

**Razorpay live:**
- KYC cleared. Live keys generated from Razorpay dashboard → Account & Settings → API Keys (NOT the wizard, which regenerates ephemeral test keys per click).
- Swapped `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` on Vercel prod. Redeployed.
- Found a silent bug mid-flight: Convex stores its own `RAZORPAY_KEY_SECRET` for defense-in-depth signature re-verification inside `markPaid`. Rotated that too via `npx convex env set --prod`. Without this, payment captures on Razorpay but Convex `payments` row stays in `status:"created"` and frontend shows "Payment received but verification hit a snag."
- ₹49 real UPI tip captured end-to-end: Razorpay `pay_ShhIGa6M0vGaIb` → Convex `status:"paid"`, signature stored. Revenue rubric L1 → L2 unlocked.

**PostHog verified:**
- Created Personal API key (`Performing analytics queries` scope), pulled real numbers via HogQL.
- 12 client events wired: `session_start`, `waitlist_signup`, `onboarding_complete`, `research_run`, `research_result`, `price_run`, `price_check_from_research`, `buy_click`, `share_click`, `checkout_started`, `tip_paid`, `premium_unlocked` + autocapture/pageviews.
- Caveat: PostHog only started capturing today (~06:30 UTC when key first set on Vercel). Yesterday's X post / class drop traffic is invisible to PostHog. Convex remains the source of truth for waitlist + deals.

**Bugs / cleanup deferred (still acceptable for ship):**
- `tip_paid` PostHog event missed for Kartik's own ₹49 — fired from a mobile context (UPI flow) where PostHog beacon couldn't reach the wire. Razorpay + Convex both have the payment; only the analytics event is missing. Not a code bug.
- Pre-decimal-fix `deals` entries inflate `totalDealsFound` slightly. Tier 4 cleanup, not blocking.

### Saturday afternoon → 26 April 2026 morning (submission + Phase 2)

**Submission filed at GrowthX in the afternoon.** Self-graded score returned with a 4-hour deadline extension. Phase 2 framing from the platform: "Stop building. Spend these 4 hours making what already exists provable." Evidence is the gap, not features.

**Documentation pass:**
- weekender.md filled with right-to-win section, SOM rewritten with Bain & Flipkart "How India Shops Online 2025" citation (SAM 8M, SOM 80K users × ₹240 ARPU = ₹19.2cr/year, monetization roadmap committed in writing).
- LinkedIn launch post drafts written (3 variants in `launch_post_drafts.md`), scheduled for Monday morning IST.
- GrowthX submission pack drafted in `submission_pack.md` (kept local, gitignored — contains drafted answers + honest caveats).

**Git hygiene caught up.** Discovered the entire session 2/3 build had been deployed via `vercel deploy` directly from local without going through git. 5 catch-up commits pushed (`b16dbf1`, `392c23b`, `1ab284c`, `af30c2f`, `1ad42f5`). Installed a project-local PreToolUse Bash hook in `.claude/settings.local.json` (gitignored) that warns on `vercel deploy/redeploy/--prod` with uncommitted changes.

**Phase 2 priorities (next 4 hours, evidence not features):**
1. Get Prateek (pkvk.ml@gmail.com) to pay ₹199 — direct Telegram ask. One paying stranger = pain_severity L3 → L4 + a real quote.
2. Record a 90-second screen capture (onboarding → research → price → savings card → Razorpay). Upload as `demo_video_url`.
3. ~~Share a PostHog read-only link in the submission.~~ **DONE 2026-04-26** — public dashboard at https://us.posthog.com/shared/IANWfXzG1tZDaCgdGD2KuphWqlNo-w, 4 tiles, no login required.
4. Post the savings card with tier escalation on X with a "built in 4 days" hook. The screenshot moment that hasn't been distributed.
5. Drop the Loot link in the "Extensive Agentic Generation" Telegram channel where Prateek came from.
6. Add visitor count + PostHog URL to the submission (dual-track: Revenue + Virality).
7. Add one sentence on the Gemini grounding response chain to the submission (MaaS legibility).
8. Name the observability setup (12 PostHog events + Convex feedback widget) in two sentences in the submission.
9. Screenshot one PostHog funnel / session replay (Prateek's 10-min path) and include in the submission.

---

## known gaps going into Saturday

1. **Flipkart direct URL**: Shows search page not product page (Jam confirmed). Backlogged.
2. **Perceived latency**: Research takes 15–35s, price takes 40–70s. Backlogged.
3. ~~**Razorpay**: Pending KYC — needed for Revenue track scoring.~~ ✅ Live as of 2026-04-25, ₹49 captured.
4. **Savings accuracy**: "Deals found" not "confirmed saved" — Option A+B done, need affiliate (Option C) for real confirmation.
5. **WhatsApp OG image**: May take 24h for WhatsApp to bust its domain cache and show personalized card.

---

## what to build Saturday if time allows

Priority order:
1. Add Razorpay payment gate (Revenue track primary signal)
2. PostHog analytics wiring (signup + session events)
3. Streaming for perceived latency (progress messages during research)
4. Flipkart URL fix (Apify scraper or affiliate API)

---

## SOM (for submission)

**TAM** — All Indian online shoppers who buy on Amazon/Flipkart: ~200M registered users (combined, with overlap).

**SAM** — Urban Indians, age 30–45, household income ₹5L+, in top 50 Indian cities, who buy 6+ considered electronics/appliances per year and research before buying: **~8M users**.

*Citation:* Bain & Company + Flipkart, *"How India Shops Online 2025"* (Mar 2025). Bain defines an "affluent" persona as married working couples, 30–45 yrs, household income >₹5L/year, top 50 cities. Their affluent shopper population is ~30–40M; this SAM applies an additional behavioral filter ("6+ considered electronics/appliance purchases/year, research-deep") that narrows it by ~75–80%, landing at ~8M. Source: https://www.bain.com/insights/how-india-shops-online-2025/

**SOM (24-month capture target)** — 1% penetration of SAM = **80,000 users**.

Justification for 1%: organic distribution channels already touched (X post + course Telegram channel "Extensive Agentic Generation" + GrowthX cohort) yielded a strangers-to-engaged-users conversion in week 1. Scaling to 80K over 24 months requires roughly 3,300 new active users/month — achievable via affiliate + creator distribution + organic SEO on price-comparison queries. Aggressive but defensible for a single-founder product.

**Blended ARPU/year** — **₹240** across the user base, breakdown:

| Cohort | % of users | Avg revenue/user/year | Contribution to ARPU |
|---|---|---|---|
| Free | 50% | ₹0 | ₹0 |
| Tippers (₹49/99/199 occasional) | 30% | ₹100 | ₹30 |
| Premium subscribers (₹199 lifetime + ₹999/yr power tier) | 12% | ~₹1,080 amortized over 3yr (₹360 LTV/yr) | ₹130 |
| Affiliate-converting (1–2 buy-click conversions/yr × avg ₹2K commission, partial-credit attribution) | 8% | ₹500 | ₹80 |

**SOM revenue (annualized at full SOM capture):** 80,000 users × ₹240 = **₹19.2 crore/year**.

**Monetization roadmap (commitment, makes the ARPU model defensible):**
- **Month 0 (now):** ₹49/99/199 tip + ₹199 one-time premium (built; live as of 2026-04-25).
- **Month 6:** Ship subscription tiers — ₹199/month or ₹999/year — for power features (price history, exchange offers, deep verification, push alerts on saved searches).
- **Month 9:** Affiliate revenue active (Amazon Associates + Flipkart Affiliate program; tags injected into buy-click URLs).
- **Month 12:** Test "save-back" pricing — % of confirmed savings, capped — as alternative to subscription for low-frequency buyers.

**Honest current state vs target:**
- *Today (month 0):* ₹49 captured (1 paying user). Real revenue = ₹0.30cr/year if today's product scales linearly with no roadmap. This is the floor.
- *Month 24 target (SOM above):* ₹19.2cr/year.
- *The gap is the monetization roadmap above. Without it, the SOM number is fiction.*

---

## right to win

Three pillars, in order of how hard each is for someone else to copy:

**1. Lived expertise — I'm the "deal guy" in my own network.**
Friends and family come to me before any meaningful online purchase, and have for years. Last September I fit out an entire new house — electronics + home appliances — across Flipkart Big Billion Day and Amazon Great Indian Sale, and saved meaningfully on every category. Loot encodes taste I've earned by doing this for myself; I'm not building from a market-research deck.

**2. The pain is mine — Loot exists because existing AI tools failed me.**
During that same house fit-out I ran deep researches across Claude, ChatGPT, and Perplexity, built my own custom prompts and skills, and *still* kept repeating the same query patterns query after query. The work was high-leverage (real money saved) but the tools were broken for the way I needed to use them. That's the moment Loot was conceived. It's not a hypothesis about a market — it's the fix for my own life, that turns out to generalize.

**3. Feedback-loop velocity, not pure first-mover.**
A well-funded clone team can copy the surface in 30 days. What they can't replicate in 30 days is the iteration speed of a product instrumented from day one — PostHog across 12 events, Convex `feedback` widget live, deal logging tied to identified users, identified-user journeys (within 4 hours of PostHog going live we already had Prateek's full 10-minute path captured: 6 research_runs, 2 product drilldowns, exact products, exact pacing). Every user shapes the next ship. Cloners chase the artifact; I chase the user. The gap widens weekly.

---

## why now

Specific unlocks in the last 12 months:
- Gemini 2.5 Flash with Google Search grounding → real-time price search without scraping
- Rainforest API → real-time Amazon pricing via API
- Quick commerce (Blinkit, Zepto) carrying electronics → new comparison dimension
- UPI + bank card offer complexity exploding → manual calculation is genuinely broken
