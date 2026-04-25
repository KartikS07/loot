# launch post drafts — linkedin

Three variants drafted on 2026-04-25 (Saturday). To be posted **Monday morning** for better LinkedIn algorithm reach (weekend posts perform 40–60% worse for B2C/builder content).

Pick ONE before posting. Edit freely — these are drafts, not finals.

---

## draft A — pragmatic builder

> Last weekend I shipped Loot — an AI shopping copilot for India.
>
> Live: https://loot-eta.vercel.app
>
> What it does: tell it what you want to buy, it surfaces the top 5 picks from across 11 Indian platforms (Amazon, Flipkart, Croma, Reliance, Vijay Sales, and more), applies your bank card discounts, and tells you exactly when and where to buy.
>
> Why I built it: I was tired of running the same deep research across 4 different AI tools every time I had to make a serious purchase. Existing copilots don't know India — they don't know UPI offers, they don't know SBI vs HDFC card discounts, they don't know the seasonal sale calendar. I built one that does.
>
> Status as of today:
> – Onboarding live (4-step persona + saved cards + UPI prefs)
> – Researcher module live (Gemini 2.5 Flash with Google Search grounding)
> – Price Optimizer live with real-time Amazon prices
> – Razorpay live — first ₹49 capture this morning
> – PostHog wired — already watching real users. First stranger spent 10 minutes on the site and ran 6 research queries on router UPS products.
>
> If you make 6+ considered purchases a year on Indian e-commerce — try it. Tell me what's broken. I want the worst feedback you can give me.

---

## draft B — story-led

> Last September, I was fitting out the interior of my new house.
>
> Electronics. Home appliances. The whole thing.
>
> I had Flipkart Big Billion Day and Amazon Great Indian Sale running back to back. I ran deep research across Claude, ChatGPT, and Perplexity. I built custom prompts. I set up custom skills. And I *still* found myself repeating the same patterns query after query: which product, which platform, which card to swipe, when to actually buy.
>
> I saved a lot of money. But I also wasted a lot of hours.
>
> So I built Loot — the AI shopping copilot I wish I'd had last September.
>
> Live: https://loot-eta.vercel.app
>
> The first stranger to find Loot on his own — through an AI course Telegram channel I'm in — spent 10 minutes on the site, ran 6 deep research queries, and drilled into two router UPS options. He didn't buy anything yet, and he hasn't replied to my DM yet. But he reached out unprompted to tell me he tried it.
>
> That's the signal I needed.
>
> If you've ever spent two hours comparing the same product across five tabs trying to figure out the actual best price — Loot is for you.
>
> Try it. Tell me what's broken.

---

## draft C — bold / contrarian

> Most AI shopping copilots are built for America.
>
> They don't know what Flipkart Big Billion Day means. They don't know that an HDFC Diners card gets you 10% off on Amazon during specific windows. They don't know what UPI is. They don't understand that the same product on Croma and Reliance Digital can have a ₹2,000 difference because of an exchange offer the assistant has never heard of.
>
> So I built one that does. For India. Specifically.
>
> It's called Loot. *Not just a deal — a loot.* Live at https://loot-eta.vercel.app.
>
> 11 platforms. Bank card discount logic. UPI offers. Real-time Amazon pricing. Sale-calendar awareness. Personalized to your saved cards.
>
> Built in a week. Ships continuously. Already has its first paying user (₹49, real UPI, captured this morning) and its first organic stranger (came in via a Telegram course channel, used it for 10 minutes without me asking).
>
> The thesis: the next phase of AI tools isn't bigger models. It's tools that actually know the specific country, currency, and bank you're standing in.
>
> Try it if you spend any meaningful money on Indian e-commerce. Tell me what's broken — that's the only feedback that matters this week.

---

## quick comparison

| Draft | Hook | Voice | Best for |
|---|---|---|---|
| **A** Pragmatic | "Last weekend I shipped..." | Receipt-led, list-heavy | Engineers / tech-twitter overflow audience |
| **B** Story-led | "Last September I was fitting out..." | Personal, narrative arc | Mixed feed, founders, anyone who's felt the pain |
| **C** Contrarian | "Most AI shopping copilots are built for America." | Bold thesis statement | Indian product/AI builders, invites thoughtful pushback |

---

## posting notes (for monday)

- **Best time to post on LinkedIn** for India audience: Monday or Tuesday, 9–11am IST. Avoid Friday afternoon onwards.
- **First hour matters** — share to your direct network in DMs/WhatsApp groups within the first 30 min so the algorithm sees engagement velocity. The GrowthX cohort + the "Extensive Agentic Generation" Telegram channel are both natural seeds.
- **Add the live URL in a comment, not the body** — LinkedIn deprioritizes posts with external links in the body. Putting the URL in a comment can lift reach 30–60%.
- **One image** — a screenshot of the savings card or a research result page works well. Posts with one image outperform pure text on LinkedIn for product/launch content.
- **Reply to every comment in the first 24h** — extends the post's life in feed.
- **Track**: at 24h, check PostHog (https://us.posthog.com → project Loot) for `session_start`, `waitlist_signup`, `research_run` deltas vs baseline.
