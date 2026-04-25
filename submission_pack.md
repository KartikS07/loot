# Loot — GrowthX AI Weekender submission pack

Drafted on 2026-04-25 (Saturday) for submission at https://growthx.club/ai-weekender-buildathon/submit.

The form is JS-rendered behind a splash screen — automated discovery couldn't read the field labels. Section A below is **inferred from the rubric in `handbook/09-scoring.md`** + standard buildathon patterns. **Verify against the live form before submitting.** Section B has copy-paste-ready answers.

---

## Section A — likely fields (verify in browser)

| # | Likely field | Type | Limit (likely) | Required | Why we expect this |
|---|---|---|---|---|---|
| 1 | Founder name | short text | — | Y | Standard |
| 2 | Email | email | — | Y | Standard, also matches rubric "team members do not count" |
| 3 | Team size / solo flag | short text or radio | — | Y | Rubric distinguishes team vs founder |
| 4 | Product name | short text | ~60 chars | Y | Standard |
| 5 | Tagline / one-liner | short text | ~140 chars | Y | "Tweet length" pitch is universal |
| 6 | Primary track | dropdown (Virality / Revenue / MaaS) | — | Y | Tracks are the scoring backbone |
| 7 | Bonus tracks claimed | multi-select | — | N | Rubric explicitly allows cross-track bonus |
| 8 | Live product URL | URL | — | Y | "100% live product. No decks." |
| 9 | GitHub / repo URL | URL | — | likely Y | Standard for builder events |
| 10 | Demo video / Loom | URL | — | Y | Standard buildathon ask |
| 11 | Problem / pain point | long text | 500–1000 chars | Y | Rubric param: "Pain point severity" |
| 12 | Target user / first user evidence | long text | 500–1000 chars | Y | Rubric: "named user, conversations, quotes" |
| 13 | What you built (product description) | long text | 1000–1500 chars | Y | Standard |
| 14 | Right to win | long text | 500–1000 chars | Y | Rubric param |
| 15 | Why now | long text | 300–500 chars | Y | Rubric param |
| 16 | SOM (TAM/SAM/SOM with math) | long text | 500–1000 chars | Y | Rubric: "show the math, not the vibe" |
| 17 | Moat / defensibility | long text | 300–500 chars | Y | Rubric param |
| 18 | Signups (number + screenshot) | number + file | — | Y | Root parameter for Revenue + Virality |
| 19 | Waitlist count | number | — | likely Y | Rubric param (Revenue) |
| 20 | Revenue generated (USD) | number + screenshot | — | Y | Rubric param |
| 21 | Visitors / unique users | number | — | Y | Rubric param (Virality) |
| 22 | Impressions across socials | number + links | — | Y if Virality | Rubric param |
| 23 | Reactions + comments | number + links | — | Y if Virality | Rubric param |
| 24 | PostHog / GA4 read-only access | URL or token | — | Y for L4+ | Rubric explicitly: "Read-only access required or capped at L2" |
| 25 | Launch post link(s) | URL | — | Y | Standard |
| 26 | Screenshots / artifact upload | file upload | — | likely Y | Standard |
| 27 | What's broken / known gaps | long text | 300–500 chars | N | Common honesty field |

---

## Section B — proposed answers, field by field

### 1. Founder name
Kartik Sangani

### 2. Email
kartik.h.sangani@gmail.com

### 3. Team size
Solo founder.

### 4. Product name
Loot

### 5. Tagline (≤140 chars)
Not just a deal. A loot. AI shopping copilot for India — 11 platforms, real-time prices, bank card + UPI offer logic.

### 6. Primary track
Revenue

### 7. Bonus tracks claimed
Virality + MaaS (per cross-track bonus rules; Virality scored on signups + visitors, MaaS on real output)

### 8. Live product URL
https://loot-eta.vercel.app

### 9. GitHub
https://github.com/KartikS07/loot

### 10. Demo video / Loom
[gap — record a 60–90 sec walkthrough before submitting. Suggested flow: landing → onboarding (cards + UPI) → researcher run on a real product → price optimizer → savings card share → ₹49 tip flow]

### 11. Problem / pain point
Indians making considered online purchases (electronics, appliances) face two compounding problems: deciding *what* to buy across thousands of options, and figuring out *where and when* to buy across 11+ platforms with overlapping bank card discounts, UPI offers, exchange offers, and seasonal sale calendars (Flipkart BBD, Amazon GIS). Existing AI copilots — Claude, ChatGPT, Perplexity — don't know India: no UPI offers, no SBI vs HDFC card logic, no sale-calendar awareness. Result: serious buyers run the same deep research query across 4 tools and still leave money on the table. Founder lived this exact pain in Sept 2025 fitting out a new house — saved real money but wasted hours.

### 12. Target user / first user evidence
Named user: **Prateek (pkvk.ml@gmail.com)** — first organic stranger. Found Loot via the "Extensive Agentic Generation" Telegram channel (an AI course the founder is taking, separate from GrowthX). Reached out unprompted. Spent 10 min on the site (PostHog: 66 events, 6 research_runs, 2 product drilldowns on Oakter Mini UPS 12V + Cuzor Router UPS — domestic India use case for home router power backup). Did not convert (no tip, no buy_click) — engaged but not yet bought. Telegram conversation in progress to capture verbatim quotes. [gap — quotes pending; capture before submission]

### 13. What you built (product description)
Loot is an AI shopping copilot for India built across one weekend. Two modules:

(1) **Researcher** — Gemini 2.5 Flash with Google Search grounding, returns top 5 personalised picks for any product category, factoring in user persona captured at onboarding (saved bank cards, UPI prefs, budget).
(2) **Price Optimizer** — 2-phase architecture, Rainforest API for real-time Amazon India prices, scrapes/grounded-search across 11 platforms (Amazon, Flipkart, Croma, Reliance Digital, Vijay Sales, Tata Cliq, and more). Applies the user's bank card discount, UPI offer, and exchange offer logic on top of base price. Surfaces a single "buy here, on this card, for this much" verdict.

Plus: shareable Savings Card with personalized OG image, wishlist, deal logging, feedback widget, Razorpay tip + ₹199 premium unlock. Stack: Next.js, Convex, shadcn, Tailwind, PostHog, Razorpay live, Vercel.

### 14. Right to win
Three pillars (full version in repo `weekender.md`):

**1. Lived expertise.** I'm the "deal guy" in my own network — friends and family come to me before any meaningful purchase, and have for years. Loot encodes taste I've earned by doing this for myself.

**2. The pain is mine.** Sept 2025 I fit out a new house across Flipkart Big Billion Day + Amazon Great Indian Sale, ran deep research across Claude, ChatGPT, Perplexity, built custom prompts and skills — and still kept repeating the same query patterns. Loot is the fix for my own life that turns out to generalize.

**3. Feedback-loop velocity.** Instrumented from day one — PostHog across 12 events, Convex feedback widget, identified-user journeys. Within 4 hours of PostHog going live we had Prateek's full 10-min path captured. A clone team can copy the surface in 30 days; they cannot replicate iteration speed.

### 15. Why now
Specific unlocks in the last 12 months:
- Gemini 2.5 Flash with Google Search grounding → real-time price search without scraping
- Rainforest API → real-time Amazon pricing via API
- Quick commerce (Blinkit, Zepto) carrying electronics → new comparison dimension
- UPI + bank card offer complexity exploding → manual calculation is genuinely broken now in a way it wasn't 18 months ago

### 16. SOM (with math)
**TAM:** ~200M Indians registered on Amazon + Flipkart (combined, with overlap).

**SAM:** Urban Indians, 30–45 yrs, household income ₹5L+, top 50 cities, who buy 6+ considered electronics/appliances per year and research before buying = **~8M users**. Source: Bain & Company + Flipkart, *"How India Shops Online 2025"* (Mar 2025) — affluent persona ~30–40M, narrowed ~75–80% by behavioral filter. https://www.bain.com/insights/how-india-shops-online-2025/

**SOM (24-month capture target):** 1% of SAM = **80,000 users**.

**Blended ARPU/year = ₹240** across the user base:
- Free 50% × ₹0 = ₹0
- Tippers 30% × ₹100 = ₹30
- Premium subs 12% × ~₹360/yr amortized = ₹130
- Affiliate-converting 8% × ₹500 = ₹80

**SOM revenue = 80,000 × ₹240 = ₹19.2 crore/year.**

Monetization roadmap (commitment): tips + ₹199 one-time live now → subscription (₹199/mo or ₹999/yr) shipped month 6 → affiliate revenue active month 9 → save-back pricing tested month 12.

### 17. Moat / defensibility
Three compounding layers:
- **Data flywheel** — every research run + buy click is a label on what Indians actually research vs actually buy at given price points. Gets sharper with use.
- **Taste as moat** — bank card / UPI / sale-calendar logic encoded by someone who's lived it; copyable list, hard to replicate judgment.
- **Iteration velocity** — instrumented from day one (PostHog 12 events, Convex feedback, identified-user trace). Cloners chase the artifact; we ship to the user. The gap widens weekly.

### 18. Signups
**5 waitlist signups** + **14 unique users today** (PostHog floor; pre-PostHog traffic from Friday's X post + course Google Meet drop is uncountable). Convex prod is source of truth for waitlist. PostHog read-only access available on request. [gap — capture screenshot of PostHog dashboard before submitting]

### 19. Waitlist count
5 (Convex prod, source of truth)

### 20. Revenue generated
**₹49 captured via Razorpay live** (payment_id `pay_ShhIGa6M0vGaIb`, real UPI from `kartik.h.sangani@okicici`).

**Honest caveat:** this was the founder's own end-to-end test of the live Razorpay flow. Per the rubric ("payments from team members ... do not qualify"), this does not count as third-party revenue. Submitting transparently. The full payment infrastructure is live, KYC-cleared, and signature-verified end-to-end on both Razorpay and Convex (silent bug found and fixed: Convex needed its own `RAZORPAY_KEY_SECRET` rotated to live for `markPaid` re-verification, otherwise capture succeeds but Convex stays in `status:"created"`). Real third-party revenue: ₹0 as of submission.

### 21. Visitors / unique users
14 unique users today, 13 unique sessions today (PostHog, 2026-04-25). Pre-PostHog traffic invisible. PostHog project ID 396779, US Cloud, read-only access available on request.

### 22. Impressions across socials
- X post: https://x.com/kartiksangani07/status/2047602291273027604 — [gap — paste current impressions count]
- LinkedIn launch post: drafted in `launch_post_drafts.md`, scheduled Monday 9–11am IST for algorithmic reach (weekend posts perform 40–60% worse for builder content). Three variants: pragmatic / story-led / contrarian.
- Telegram drop in "Extensive Agentic Generation" channel — yielded first organic stranger (Prateek).
- GrowthX cohort Google Meet drop (~200 classmates).

### 23. Reactions + comments
[gap — pull current numbers from X post + capture before submission]

### 24. PostHog / GA4 read-only access
PostHog project ID **396779**, US Cloud, project name "Loot". Personal API key available on request. 12 events instrumented: `session_start`, `waitlist_signup`, `onboarding_complete`, `research_run`, `research_result`, `price_run`, `price_check_from_research`, `buy_click`, `share_click`, `checkout_started`, `tip_paid`, `premium_unlocked`. Caveat: PostHog only began capturing 2026-04-25 ~06:30 UTC; earlier traffic invisible.

### 25. Launch post link(s)
- X (live): https://x.com/kartiksangani07/status/2047602291273027604
- LinkedIn: scheduled Monday 9–11am IST. Draft snippet (from `launch_post_drafts.md` draft A): *"Last weekend I shipped Loot — an AI shopping copilot for India. Live: https://loot-eta.vercel.app. Tell it what you want to buy, it surfaces the top 5 picks from across 11 Indian platforms (Amazon, Flipkart, Croma, Reliance, Vijay Sales, and more), applies your bank card discounts, and tells you exactly when and where to buy."*

### 26. Screenshots / artifact upload
[gap — capture before submission]: (a) Razorpay dashboard showing `pay_ShhIGa6M0vGaIb` captured, (b) PostHog dashboard with today's events, (c) Convex `waitlist` + `deals` tables, (d) one Researcher result page, (e) one Savings Card share preview.

### 27. What's broken / known gaps
1. **Flipkart direct URL** — search page not product page (backlogged).
2. **Perceived latency** — research 15–35s, price check 40–70s. Streaming UX backlogged.
3. **Savings accuracy** — "deals found" not "confirmed saved"; affiliate option needed for real confirmation.
4. **WhatsApp OG image** — may take 24h for WhatsApp to bust its domain cache.
5. **PostHog blind spot** — Friday's traffic invisible (PostHog set up Saturday morning).
6. **`tip_paid` event missed for the ₹49** — fired from a UPI mobile context where the PostHog beacon couldn't reach. Razorpay + Convex both have it; only the analytics event is missing.

### Tweet-length blurb (if asked)
Loot — AI shopping copilot for India. 11 platforms, real-time prices, bank card + UPI offer logic. Built in a weekend. Live at https://loot-eta.vercel.app. Not just a deal. A loot.

---

## Gaps to close before submitting (in order)

1. **Form discovery** — open the actual form in your browser; flag any field above that doesn't exist or any extra one I missed.
2. **Demo video / Loom** — 60–90 sec walkthrough.
3. **Quote from Prateek** — even one line from the Telegram conversation lifts pain-severity from L3 to L4.
4. **Screenshots** — Razorpay capture, PostHog dashboard, Convex tables, one Researcher result, one Savings Card.
5. **Live X impression count** — paste at submission time.
