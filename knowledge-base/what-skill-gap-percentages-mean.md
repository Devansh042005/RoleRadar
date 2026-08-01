# What Skill-Gap Percentages Mean

The `/api/analytics/skill-gap` endpoint returns two lists — `covered` and `gaps` — each with a `demandPct` per skill. This document explains what that number actually measures, since it's easy to misread as something it isn't.

## demandPct is a share of postings, not a strength score

`demandPct` is the fraction of postings in scope (for the chosen role category and time window) that reference a given skill at all — required or nice-to-have, combined. It is computed as `postingCount / totalPostingsAnalyzed`, where `postingCount` is a distinct count of postings mentioning the skill. A `demandPct` of `0.42` means 42% of the postings RoleRadar analyzed for that role category and window mention the skill somewhere, not that the skill is worth 42 "points," and not that 42% of employers consider it mandatory — required and nice-to-have mentions are blended into one number.

## Required vs. nice-to-have detail lives elsewhere on the row

Each gap row also carries `requiredInCount` and `niceToHaveCount` — the raw counts of postings that marked the skill REQUIRED versus NICE_TO_HAVE, respectively, within the same scope. A skill with a high `demandPct` driven mostly by `niceToHaveCount` is a "good to have" trend, not a hard requirement most employers are gatekeeping on. Read `demandPct` and the required/nice-to-have split together — a skill can have identical `demandPct` to another while meaning something very different in practice, if one is nearly all-required and the other is nearly all-nice-to-have.

## Covered vs. gap is a live diff against your saved skill profile

`covered` and `gaps` are just a partition of the same demand data by whether the current `UserSkillProfile` already lists that skill (by skill id, not fuzzy name matching). This diff is computed fresh on every request, not cached, specifically so that editing your saved skills is reflected immediately in the next skill-gap fetch, without needing a background job to invalidate anything. The underlying market-demand numbers (which skills postings ask for, and how often) ARE cached per role-category-and-day-window pair, since that half is the same for every viewer regardless of their profile.

## Why small samples return insufficientData instead of a number

Below 5 total postings analyzed for a role-category-and-window combination (`MIN_POSTINGS_FOR_GAP_ANALYSIS`), the endpoint returns `insufficientData: true` with empty `covered`/`gaps` arrays rather than a demand breakdown computed from too few postings. A demand percentage computed from, say, 2 postings is not a market signal — it's just describing those 2 postings — so the endpoint refuses to present it as one rather than let a misleadingly precise-looking percentage stand in for real market data.

## Time window changes the answer, not just the sample size

`days` (default 90, max 365) bounds which postings count toward the denominator. A skill's `demandPct` over the last 30 days can differ meaningfully from its number over the last year, especially for skills tied to a recent framework release or a hiring trend that's cooling off — treat a skill-gap read from one window as a snapshot of that window's market, not a permanent fact about the skill.
