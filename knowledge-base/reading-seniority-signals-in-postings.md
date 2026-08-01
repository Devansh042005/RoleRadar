# Reading Seniority Signals in Postings

RoleRadar extracts a `seniority` field (JUNIOR, MID, SENIOR, LEAD, STAFF) and a `yearsExperience` number from every posting during skill extraction, but those fields are Claude's best structured read of language that is often vague or inconsistent on purpose. Knowing what actually signals seniority — beyond the title itself — makes both the extracted field and your own read of a raw posting more reliable.

## Titles are the weakest signal

Title inflation is common enough that "Senior" in a title is only weak evidence on its own. A more reliable read comes from three things in the body text: the years-of-experience range stated, the scope language used to describe the role, and whether the posting describes reporting relationships (who the role reports to, whether it manages anyone).

## Scope language is the strongest signal

Look for verbs and nouns that describe scope rather than skill. Junior and mid-level postings tend to describe *tasks*: "implement features," "fix bugs," "write tests," "follow existing patterns." Senior postings shift toward *ownership* language: "own the architecture of," "drive technical decisions for," "define the roadmap," "mentor other engineers." Staff and above postings often mention influence beyond a single team: "cross-team," "org-wide," "sets technical direction for multiple teams." A posting that lists mentorship or cross-team influence as a responsibility is a stronger senior/staff signal than the title alone, even if the title just says "Software Engineer."

## Years-of-experience ranges are noisy at the edges

A stated range like "3-5 years" is a genuine mid-level signal, but ranges that span very wide bands ("2-8 years") usually mean the company is flexible on level and will settle it during the interview loop rather than the posting reflecting an intentional level decision. Don't over-index on a wide range as a precise signal — it's closer to "we don't know yet" than "we want exactly this."

## Required vs. nice-to-have skill depth

RoleRadar's extraction splits skills into `REQUIRED` and `NICE_TO_HAVE` per posting. A useful secondary signal: postings with a long nice-to-have list relative to the required list tend to be less senior-specific — the company is casting a wide net on level. Postings where nearly everything is marked required, with few or no nice-to-haves, usually mean the company has a specific, narrow level in mind and extracted seniority is likely to be accurate.

## What extracted seniority does and doesn't capture

The extracted `seniority` field is inferred from the raw text at ingestion time, using the same signals described above (scope language, years ranges, reporting structure) — it is not the same as `roleCategory`, which is a separate classification (BACKEND, FRONTEND, DEVOPS, etc.) and doesn't affect seniority inference at all. Treat `seniority: null` as "the posting didn't say," not as an error — some raw postings genuinely omit level language entirely, especially short RemoteOK-style listings, and Claude correctly reports it as unspecified rather than guessing.
