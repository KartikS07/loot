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

[YOU — who is the first real user outside the team? Name them. What did they say?]

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

| Metric | Target | Current |
|---|---|---|
| Waitlist signups | 100 | [YOU — check Convex dashboard] |
| App sessions (first-use events) | 50 | [YOU] |
| Price optimizer runs | 30 | [YOU] |
| Deals logged (Buy clicks) | 20 | [YOU] |
| Loot Report shares | 10 | [YOU] |
| Revenue (Razorpay) | $0+ | Pending KYC approval |

---

## env vars (all set)

- `GEMINI_API_KEY` — AI (Gemini 2.5 Flash)
- `RAINFOREST_API_KEY` — Real-time Amazon India prices
- `NEXT_PUBLIC_CONVEX_URL` — Convex backend
- `ANTHROPIC_API_KEY` — Paused (no credits), switch back later
- `RAZORPAY_KEY_ID/SECRET` — Pending KYC

---

## submission checklist

- [ ] Razorpay KYC approved + wired
- [ ] Launch post live on LinkedIn (copy drafted in session)
- [ ] PostHog / analytics tracking wired for signups + sessions
- [ ] weekender.md metrics filled in
- [ ] First user interviewed
- [ ] Submission form submitted by Saturday 8pm

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
[YOU — fill this in as the day progresses]

---

## known gaps going into Saturday

1. **Flipkart direct URL**: Shows search page not product page (Jam confirmed). Backlogged.
2. **Perceived latency**: Research takes 15–35s, price takes 40–70s. Backlogged.
3. **Razorpay**: Pending KYC — needed for Revenue track scoring.
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

[YOU — use the GrowthX TAM/SAM/SOM calculator]

Suggested framing:
- Target: Urban Indian online shoppers who buy 6+ electronics/appliances/year
- Platform: amazon.in + flipkart.com have ~200M registered users combined
- Realistic TAM segment: 15M deliberate researchers (buy 6+ considered purchases/year)
- ACV: ₹199/month subscription (planned) = ₹2,388/year
- SOM at 0.1% penetration: 15,000 users × ₹2,388 = ₹3.58 crore
- [YOU — verify and refine these numbers]

---

## right to win

[YOU — fill in: what is your unfair advantage on this specific problem?]

Suggested angles:
- Deep knowledge of Indian e-commerce (AB InBev Clara team context)
- Personal pain: you've spent hours comparing prices and still overpaid
- Product thinking: PRD quality reflects domain knowledge
- Network: GrowthX community = exact target user

---

## why now

Specific unlocks in the last 12 months:
- Gemini 2.5 Flash with Google Search grounding → real-time price search without scraping
- Rainforest API → real-time Amazon pricing via API
- Quick commerce (Blinkit, Zepto) carrying electronics → new comparison dimension
- UPI + bank card offer complexity exploding → manual calculation is genuinely broken
