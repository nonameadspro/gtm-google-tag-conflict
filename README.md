# Google Ads conversions silently dropped: Google tag + GTM container for the same Ads account (2026)

> Field report by [Ads.gz.cn](https://ads.gz.cn/en) (Souyi Marketing), a Google Ads management agency in Guangzhou, China.
> Article version: <https://ads.gz.cn/guide/google-tag-gtm-conflict-ads-conversions-dropped>

**TL;DR** — In November 2026 we installed two snippets on a landing page, as the Google Ads and Google Tag Manager setup flows asked us to: the Google tag that Google Ads hands out (now a `gtm.js?id=GTM-…` snippet) and our own GTM container. Both carried a Google tag for the **same** Google Ads account (`AW-…`). With both on the page, the Google Ads conversion tags inside the GTM container **fired in GTM Preview but never sent a conversion request**. Google Ads and GTM showed nothing wrong. Removing the standalone Google tag fixed it immediately.

If your Google Ads account shows zero conversions while leads are clearly coming in, check whether your page loads two containers that both configure the same `AW-` ID.

---

## Setup that triggered it

What we did in November 2026 for a new single-page lead-generation site:

1. **Google Ads → new website conversion action.** The flow asked us to install the Google tag. It now comes in the new single-block format and loads a `GTM-` ID:

   ```html
   <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-AAAAAAA"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
   </script>
   ```

   That container contained only a Google tag with destination `AW-1234567890`. Skipping it left the setup flagged in red.

2. **Google Tag Manager.** We chose the GTM method, created our own web container `GTM-BBBBBBB`, and installed its snippet as well (same new single-block format). GTM's install check did not recognize the first snippet as its own container (it is not; only the prefix is shared), so both were needed to get past the setup checks.

3. **Inside `GTM-BBBBBBB`:** three Custom Event triggers (a form-submission event `generate_lead` plus two contact-click events) and three *Google Ads Conversion Tracking* tags with conversion ID `1234567890` and their own labels. GTM also created a Google tag for `AW-1234567890` firing on *Initialization – All Pages*.

Final page head:

```html
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-AAAAAAA"></script> <!-- Google tag from Google Ads -->
<script>…gtag('js', new Date());</script>
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-BBBBBBB"></script> <!-- our GTM container -->
<script>…gtag('js', new Date());</script>
```

## Symptoms

- Real form submissions from Google Ads clicks (confirmed by the site's own visitor log: Google Ads source, form submitted) never showed up in Google Ads, not even in *All conversions*. They were still missing about a day later, when the network test below explained why.
- **GTM Preview:** all three conversion tags showed **Fired**.
- **Google Ads conversion troubleshooting / tag check:** reported that the tag was detected and sending data.
- **Conversion action status:** *No recent conversions* — the same grey status you get when the setup is fine but nobody converted.
- Auto-tagging on, `gclid` present in the landing URL, `_gcl_aw` cookie written correctly.

Every built-in check looked fine. Only the browser's network log showed the problem.

## How we reproduced it

We served the same head on `localhost`, opened it with a test `gclid` (`?gclid=TeSt_…`), pushed the event manually and listed the requests sent to Google afterwards. Test pages are in [`repro/`](repro/), the console check is below.

| Page head | `_gcl_aw` cookie | Page-load requests for `AW-1234567890` | Conversion request after `dataLayer.push({event:'generate_lead'})` |
|---|---|---|---|
| Google tag snippet **+** GTM container (production setup) | written | sent (`ccm/collect … en=page_view`, `rmkt/collect`, `viewthroughconversion … en=gtag.config`) | **none** (reproduced twice) |
| GTM container only | written | sent | **sent**: `googleadservices.com/pagead/conversion/1234567890/?…&label=<lead label>&gclaw=TeSt_…` |
| Production page after removing the Google tag snippet | written | sent | **sent** for all three events, each with its own label and `gclaw` |

In the failing case GTM itself was fine: `google_tag_manager['GTM-BBBBBBB'].dataLayer.get('event')` returned `generate_lead`, so the container received and processed the event. The conversion hit was simply never transmitted.

Environment: Chromium-based browser, November 2026, Google tag runtime reported as `gtm=45He6bb1…` in the request parameters. Both containers were published with no pending changes.

### Console check

Run this in DevTools on the page after it has fully loaded. Replace the event name with yours. **It sends a real conversion hit**; open the page without a real `gclid` (or with a fake one) so it cannot be attributed to an ad click.

```js
(() => {
  const t0 = performance.now();
  dataLayer.push({ event: 'generate_lead' });
  setTimeout(() => {
    const labels = performance.getEntriesByType('resource')
      .filter(r => r.startTime > t0 && r.name.includes('/pagead/conversion/'))
      .map(r => new URL(r.name).searchParams.get('label'));
    console.log(labels.length
      ? 'Conversion request sent, label(s): ' + labels.join(', ')
      : 'NO conversion request sent');
  }, 5000);
})();
```

Or filter the Network panel for `pagead/conversion` and trigger the event yourself.

## Why the built-in checks missed it

- **GTM Preview "Fired"** means GTM executed the tag. It does not mean a request left the browser. In Tag Assistant, open the event and look at the requests actually sent to the `AW-` destination instead.
- **Google Ads troubleshooting** checks whether the account's Google tag is on the page and sending data. It was: page views and remarketing hits for `AW-1234567890` went out normally. It does not check that each conversion action's label is being sent.
- **"No recent conversions"** is indistinguishable from a working setup with no traffic.

## Likely cause (our interpretation, not confirmed by Google)

Both containers configure a Google tag for the same destination, and both carried `"ignoreDupeGtagConfigCalls": true` for it in the published container JSON. Our reading: the container that loads first takes over `AW-1234567890`, and the conversion tags in the second container hand their event to a destination they do not control, so nothing is sent.

Timing fits the GTM release notes:

- **2026-10-08** — *Standardizing gtag('config') command behavior*: all `gtm.js` container snippets initialize on load, with or without a `gtag('config')` command.
- **2026-10-12** — *Optimizing Google Tag Manager containers*: containers send data directly to Google destinations without loading a separate gtag.js.

Google's *Google tag management* help page also warns that if the same Google tag is configured two or more times on a page, "it may cause duplicate data or mixed settings". It does not mention conversions being dropped, and none of the release notes mention this interaction.

## What we did not test

- Reversed load order (GTM container first, Google tag snippet second).
- A GTM container **without** its own Google tag for the `AW-` ID.
- The legacy combination: `gtag/js?id=AW-…` with `gtag('config', 'AW-…')` plus the old two-part GTM snippet (head script + `<noscript>` iframe). In our day-to-day work this combination is still recording conversions normally on other sites, but we have not run the controlled test on it.

## Fix

Keep **one** owner per Google Ads account on the page:

- **Using GTM:** install only your GTM container. Put the Google tag for `AW-…` inside it (GTM may create it for you). Do not add the separate Google tag snippet from Google Ads to the site, even if the setup flow flags it. The Conversion Linker tag is not needed when a Google tag for the destination fires on every page.
- **Not using GTM:** install only the Google tag and send conversions from your own code with `gtag('event', 'conversion', { send_to: 'AW-…/label' })`. Verify with the network check before going live.

After the fix, conversions are sent with the right label and `gclaw`. Conversions lost before the fix cannot be recovered: an offline upload needs either the `gclid` or user-provided data that a tag captured at submission time, and neither existed.

## Takeaways

1. Verify conversion tracking by the **conversion request**, not by GTM Preview, Ads diagnostics or the conversion status.
2. With the 2026 snippets, a Google tag and a GTM container look the same (`gtm.js?id=GTM-…`). List every `gtm.js` ID on the page and check which `AW-` / `G-` destinations each one configures.
3. Any page that loads two containers for the same `AW-` ID is a candidate for this problem.

## Side note: enhanced conversions in this setup

On the GTM-only page we also tried sending user data purely from page code with `gtag('set', 'user_data', { email: … })` before pushing the event. The conversion request switched to `ec_mode=c`, but `em` stayed `tv.1~ec.e3` with no hash, so the data was not attached. With GTM, configure user-provided data in the container (CSS selectors or a code/data-layer variable) and verify that `em` carries a hash.

## References

- Google Tag Manager release notes (2026-10-08, 2026-10-12): https://support.google.com/tagmanager/answer/4620708
- Google tag management (duplicate configuration, combining tags): https://support.google.com/tagmanager/answer/12329709
- Install Tag Manager (current single-block snippet): https://support.google.com/tagmanager/answer/14847097
- Conversion Linker: https://support.google.com/tagmanager/answer/7549390
- Understand your conversion tracking data (24–48 h reporting delay, click-date reporting): https://support.google.com/google-ads/answer/6270625
- About enhanced conversions for leads (GCLID needed without a tag): https://support.google.com/google-ads/answer/15713840
- Set up enhanced conversions for web using Google Tag Manager: https://support.google.com/google-ads/answer/13262500

All IDs, labels and domains in this write-up are placeholders.

## Contributing

If you have run one of the cases listed under [What we did not test](#what-we-did-not-test), or you see different behavior on your setup, please open an issue with your page head, the browser, the date and the requests you observed.

## About

Written and maintained by [Ads.gz.cn](https://ads.gz.cn/en) (Souyi Marketing). The same write-up is published at <https://ads.gz.cn/guide/google-tag-gtm-conflict-ads-conversions-dropped>.

## License

[MIT](LICENSE)
