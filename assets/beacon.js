/**
 * Artifact Machine — client half of the first-party counter.
 *
 * Sends one small JSON POST per event to the studio's own Worker. No cookies,
 * no localStorage, no fingerprinting, nothing read off the device beyond the
 * page you are on and where you arrived from. There is no third party in this
 * path at all — the only host contacted is the studio's.
 *
 * It honours Do Not Track and Global Privacy Control by not sending anything,
 * which is the point of stating a privacy position rather than advertising one.
 *
 * Every failure is swallowed on purpose. A counter must never be the reason a
 * page misbehaves.
 */
(function () {
  'use strict';

  // Same origin. The site and the counter are one Worker on one hostname, so
  // there is no cross-origin request, no second domain, and nothing to
  // configure per environment.
  var ENDPOINT = '/beacon/hit';

  var nav = window.navigator || {};
  var optedOut =
    nav.doNotTrack === '1' ||
    nav.doNotTrack === 'yes' ||
    window.doNotTrack === '1' ||
    nav.msDoNotTrack === '1' ||
    nav.globalPrivacyControl === true;

  if (optedOut) return;

  function send(event, label) {
    try {
      var payload = {
        e: event,
        p: window.location.pathname,
        r: document.referrer || '',
      };
      if (label) payload.l = String(label);

      var body = JSON.stringify(payload);

      // keepalive so a click that navigates away still records. sendBeacon is
      // not used: it cannot set Content-Type: application/json without a Blob
      // dance, and fetch+keepalive is supported everywhere that matters.
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      }).catch(function () {});
    } catch (e) {
      /* never surface a counter failure to the page */
    }
  }

  // Public hook, so the checkout button and the grader can report themselves
  // once they exist. window.am.track('checkout_click', 'report-249')
  window.am = window.am || {};
  window.am.track = send;

  send('pageview');

  if (window.location.pathname.indexOf('/tools/') === 0) {
    send('tool_view', document.title);
  }

  // Outbound clicks matter here specifically: today every tool page's call to
  // action leaves for Apify, so an outbound click is the closest thing the site
  // currently has to an expression of intent.
  document.addEventListener(
    'click',
    function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!el) return;
      try {
        var url = new URL(el.href, window.location.href);
        if (url.host && url.host !== window.location.host) {
          send('outbound', url.host + url.pathname);
        }
      } catch (e) {
        /* ignore unparseable hrefs */
      }
    },
    true
  );
})();
