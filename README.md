# Imperial Break Rooms sync runner

Runs Comlink only when a daily refresh or an officer-requested update is due. The schedule checks at 7, 22, 37 and 52 minutes past each hour; GitHub can delay or skip scheduled runs. Daily updates become due 24 hours after the last successful update. Failed pulls leave the last successful data intact and retry after one hour.

This repository contains runner code only. It does not publish guild snapshots, performance exports, officer records, credentials, artifacts or caches. The Worker authenticates short-lived GitHub OIDC tokens for this exact public repository ID, main branch and workflow. No personal access token, Cloudflare API key or Discord secret is available to the runner.

Standard GitHub-hosted runners in public repositories are free. The workflow refuses private repositories and uses only `ubuntu-latest`, without larger runners, artifact uploads or caches. Do not change those boundaries. The tracker remains on Cloudflare Workers Free and D1 Free.

The runner updates membership, names, ally codes, GP, join dates and last activity. It sends completed Raid results from Comlink's `recentRaidResult` to the private tracker, where scores are matched by stable player ID and imported once per Raid. Live Raid progress is unavailable. Explicit zero scores remain zero, and missing players remain unknown. Detailed TB records use officer-uploaded exports; individual TW offence/defence results still require officer input. See the [Comlink guild data documentation](https://github.com/swgoh-utils/swgoh-comlink/wiki/Guild-Data#raid-data).

GitHub can disable scheduled workflows in public repositories after 60 days without repository activity. A separate heartbeat job periodically commits only a timestamp, at most once a week, to keep this repository active. Its short-lived GitHub token can write this repository only and is not passed to Comlink or the sync job. If GitHub disables the workflow for another reason, the owner must re-enable it under Actions. The tracker labels data older than 48 hours as stale. Officers can continue to import records manually.

References: [Comlink](https://github.com/swgoh-utils/swgoh-comlink), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
