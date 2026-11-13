# Reproduction pages

1. Replace the placeholder IDs in `both.html` and `gtm-only.html`:
   - `GTM-AAAAAAA`: the Google tag ID that Google Ads asked you to install
   - `GTM-BBBBBBB`: your GTM container, which must contain a Google tag for the same `AW-` ID and a Google Ads Conversion Tracking tag on a Custom Event trigger (default event name: `generate_lead`)
2. Serve the folder over HTTP (cookies do not work on `file://`), for example:

   ```bash
   python3 -m http.server 8765 --bind 127.0.0.1
   ```

3. Open `http://localhost:8765/both.html?gclid=TeSt_repro_a` and `http://localhost:8765/gtm-only.html?gclid=TeSt_repro_b`, wait a few seconds, and press **Push event and check**.

Expected result in our case (November 2026):

| Page | Result |
|---|---|
| `both.html` | `NO conversion request sent` |
| `gtm-only.html` | `conversion request sent, label=…, gclaw=TeSt_repro_b` |

Each run sends one real conversion hit to the Ads account. The fake `gclid` keeps it from being attributed to an ad click, so it does not appear in conversion reports.
