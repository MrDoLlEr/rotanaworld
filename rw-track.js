/* Rotana World — lightweight anonymous visit + click counter */
(function () {
  var URL_ = "https://vtowjbodaleyenptghwm.supabase.co/rest/v1/rw_events", KEY = "sb_publishable_fnBayg7q3G25VaYNCXu7aQ_rEg59kt3";
  var ua = navigator.userAgent || "", ref = document.referrer || "", rh = "";
  try { rh = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch (e) {}
  if (rh === location.hostname) rh = "";
  var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  var os = /iPhone|iPad|iPod/i.test(ua) ? "iPhone" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Other";
  var q = new URLSearchParams(location.search);
  var src = (q.get("src") || q.get("utm_source") || "").toLowerCase().slice(0, 30);
  if (!src) {
    if (/Instagram/i.test(ua)) src = "instagram";
    else if (/Snapchat/i.test(ua)) src = "snapchat";
    else if (/FBAN|FBAV|FB_IAB/i.test(ua)) src = "facebook";
    else if (/Twitter/i.test(ua)) src = "x";
    else if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) src = "tiktok";
    else if (/WhatsApp/i.test(ua)) src = "whatsapp";
    else if (rh) {
      var m = { "instagram": "instagram", "t.co": "x", "x.com": "x", "twitter": "x", "facebook": "facebook", "fb.": "facebook", "snapchat": "snapchat", "tiktok": "tiktok", "google": "google", "youtube": "youtube", "whatsapp": "whatsapp", "linkedin": "linkedin", "bing": "bing" };
      for (var k in m) if (rh.indexOf(k) > -1) { src = m[k]; break; }
      if (!src) src = "other";
    } else src = mobile ? "qr" : "direct";
  }
  var vid = "", isNew = false;
  try { vid = localStorage.getItem("rw_vid") || ""; if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("rw_vid", vid); isNew = true; } } catch (e) { vid = "x" + Math.random().toString(36).slice(2); isNew = true; }
  var base = { vid: vid, src: src, ref: rh.slice(0, 120) || null, device: mobile ? "mobile" : "desktop", os: os,
    lang: (navigator.language || "").slice(0, 12), tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 50); } catch (e) { return null; } })() };
  function send(ev, label) {
    var body = {}; for (var k in base) body[k] = base[k];
    body.event = ev; body.label = label ? String(label).slice(0, 120) : null; if (ev === "visit") body.new_visitor = isNew;
    try { fetch(URL_, { method: "POST", keepalive: true, headers: { "apikey": KEY, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify(body) }).catch(function () {}); } catch (e) {}
  }
  send("visit");
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    var h = a.href, l = "";
    if (/apps\.apple\.com/.test(h)) l = "App Store";
    else if (/play\.google\.com/.test(h)) l = "Google Play";
    else { try { var u = new URL(h); l = u.hostname.replace(/^www\./, "").replace(/\.com$/, "") + (u.pathname.split("/")[1] ? "/" + u.pathname.split("/")[1].replace("@", "") : ""); } catch (er) { l = h; } }
    send("click", l);
  }, true);
})();
