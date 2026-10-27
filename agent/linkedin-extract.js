// Runs inside a LinkedIn tab (post search results or the home feed) through
// Claude in Chrome's javascript tool. Read-only: it scrolls, expands "…more"
// on posts, and returns the posts as an object. It never likes, comments or follows.
//
// Before running, replace the two placeholders:
//   __SEEN__  JSON array of post keys to skip (from `openings plan` + this run)
//   __OPTS__  {"includeNoEmail": false, "scrolls": 3}
await (async () => {
  const SEEN = new Set(__SEEN__);
  const OPTS = Object.assign({ includeNoEmail: false, scrolls: 3 }, __OPTS__);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // LinkedIn showing a security check or login wall: stop the whole run.
  // (No URLs are returned: the browser tool withholds results that look like they carry tokens.)
  if (/\/(checkpoint|authwall|login|uas\/)/.test(location.pathname) || document.querySelector('iframe[src*="captcha"], #captcha-internal')) {
    return { blocked: true };
  }

  const isMarker = (e) => e.childElementCount === 0 && e.textContent.trim() === "Feed post";
  const markers = () => [...document.querySelectorAll("main *")].filter(isMarker);

  // Load more results the way a person scrolling would, with uneven pauses.
  for (let i = 0; i < OPTS.scrolls; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1800 + Math.random() * 1500);
  }
  for (const b of [...document.querySelectorAll("main button")]) {
    if (/^…?\s*(see )?more$/i.test(b.innerText.trim())) {
      b.click();
      await sleep(120 + Math.random() * 200);
    }
  }

  // FNV-1a: a short, stable fingerprint for a post.
  const fnv = (s, seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };

  const AGE = /^\d+\s*(s|m|h|d|w|mo|yr)\b/;
  const FOOTER = /^(\d[\d,]*|[\u200b\s]+|Like|Comment|Repost|Send|Are these results helpful\?|Your feedback helps us improve search results|Only connections can comment on this post\..*|Comments have been turned off on this post\..*)$/;
  const EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;

  const posts = [];
  for (const m of markers()) {
    // Climb to the largest ancestor that still holds only this one post.
    let c = m;
    while (c.parentElement && c.parentElement !== document.body && [...c.parentElement.querySelectorAll("*")].filter(isMarker).length === 1) {
      c = c.parentElement;
    }
    const lines = c.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[0] === "Feed post") lines.shift();
    const ageIdx = lines.findIndex((l) => AGE.test(l));
    if (ageIdx === -1) continue;
    // Feed posts can start with activity lines ("Asha likes this"); they aren't the poster.
    const header = lines.slice(0, ageIdx).filter((l) => !/\b(likes|loves|celebrates|supports|finds this|commented on|reposted|follows)\b.*\b(this|that)\b/i.test(l));
    let bodyLines = lines.slice(ageIdx + 1);
    if (/^(\+ )?(Follow|Following|Connect)$/.test(bodyLines[0] || "")) bodyLines = bodyLines.slice(1);
    while (bodyLines.length && FOOTER.test(bodyLines[bodyLines.length - 1])) bodyLines.pop();
    const body = bodyLines.join("\n");
    if (body.length < 40) continue;

    const link = c.querySelector('a[href*="/in/"], a[href*="/company/"]');
    const profile = link ? link.href.split("?")[0] : null;
    // Keyed on the text alone, so the same post shared by a person and their company is one post.
    const longest = [...bodyLines].sort((a, b) => b.length - a.length).slice(0, 3).join("|").toLowerCase();
    const key = fnv(longest, 2166136261) + fnv(longest, 5381);
    if (SEEN.has(key)) continue;
    SEEN.add(key);

    const mailto = [...c.querySelectorAll('a[href^="mailto:"]')].map((a) => decodeURIComponent(a.href.slice(7)).split("?")[0]);
    const emails = [...new Set([...mailto, ...(body.match(EMAIL) || [])].map((e) => e.toLowerCase()))];
    // Obfuscated addresses ("hr [at] acme [dot] com") are left for Claude to spot in the text.
    const maybeEmail = emails.length > 0 || /\[\s*at\s*\]|\(\s*at\s*\)|\b[a-z0-9._-]+\s+at\s+[a-z0-9-]+\s+dot\s+[a-z]{2,}/i.test(body);
    if (!OPTS.includeNoEmail && !maybeEmail) continue;

    posts.push({
      key,
      poster: header[0] || null,
      headline: header.find((l, i) => i > 0 && !/^•/.test(l) && !/^(Premium|Verified|Hiring)/i.test(l)) || null,
      profile,
      age: lines[ageIdx],
      emails,
      // The browser tool cuts strings at ~1,000 characters, so the body comes in pieces: join them with "".
      bodyParts: body.match(/[\s\S]{1,800}/g),
    });
  }
  return { blocked: false, postsOnPage: markers().length, returned: posts.length, posts };
})();
