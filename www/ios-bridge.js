/*
 * ios-bridge.js — NoAds Athan iOS bridge shim.
 *
 * The web layer was built against the Android native bridge: on every
 * load and every prayer-relevant settings change it calls
 *
 *   window.NoAdsBridge.schedulePrayers(JSON.stringify(payload))
 *   window.NoAdsBridge.cancelAll()
 *
 * with payload (computed by praytimes.js in the web layer, device
 * timezone, exactly the displayed times):
 *
 *   {
 *     generatedAt: <epoch ms>,
 *     settings: { lat, lng, method, asrFactor,
 *                 adhanId: 0..3,            // index into ADHAN_FILES
 *                 lang: 'en' | 'fr' | 'ar',
 *                 athanMuted: bool,         // v1.4.1 'Athan sound' off:
 *                                           // notify without the sound
 *                 notificationsOff: bool }, // v1.4.1 'Prayer
 *                                           // notifications' off: none
 *     days: [ {
 *       date: 'YYYY-MM-DD',
 *       prayers: { fajr: <epoch ms>, dhuhr: ..., asr: ...,
 *                  maghrib: ..., isha: ... },
 *       names:   { fajr: '<localized name>', ... },
 *       salatMessage: '<localized salat message>'
 *     }, ... ]                              // today + tomorrow
 *   }
 *
 * On Android a Java @JavascriptInterface implements that object. On
 * iOS there is no such native object, so this shim provides the same
 * interface on top of Capacitor's LocalNotifications plugin: each
 * prayer becomes a local notification at its epoch time, titled with
 * the localized salat message, bodied with the localized prayer name,
 * and sounded with the trimmed athan clip for the chosen recording
 * (athan1.caf .. athan4.caf, bundled in the app — iOS caps
 * notification sounds at 30 s, so the clips are ~29 s).
 *
 * Safety: this file is a strict no-op unless it is running inside the
 * Capacitor iOS shell. On Android (raw WebView + Java bridge), webOS
 * and desktop browsers it changes nothing — and it never overwrites
 * an existing window.NoAdsBridge.
 */
(function () {
  'use strict';

  var PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var IDS_STORAGE_KEY = 'noads.ios.notifIds';
  var installed = false;

  function getLocalNotifications() {
    var Cap = window.Capacitor;
    if (!Cap) return null;
    try {
      if (typeof Cap.registerPlugin === 'function') {
        return Cap.registerPlugin('LocalNotifications');
      }
    } catch (e) { /* fall through to Plugins map */ }
    try {
      if (Cap.Plugins && Cap.Plugins.LocalNotifications) {
        return Cap.Plugins.LocalNotifications;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function isCapacitorIOS() {
    var Cap = window.Capacitor;
    if (!Cap) return false;
    try {
      if (typeof Cap.isNativePlatform === 'function' && !Cap.isNativePlatform()) {
        return false;
      }
      if (typeof Cap.getPlatform === 'function') {
        return Cap.getPlatform() === 'ios';
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function loadStoredIds() {
    try {
      var raw = window.localStorage.getItem(IDS_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function storeIds(ids) {
    try {
      window.localStorage.setItem(IDS_STORAGE_KEY, JSON.stringify(ids));
    } catch (e) { /* ignore */ }
  }

  function cancelIds(plugin, ids) {
    if (!ids.length) return Promise.resolve();
    var list = [];
    for (var i = 0; i < ids.length; i++) list.push({ id: ids[i] });
    return plugin.cancel({ notifications: list }).catch(function () {});
  }

  function ensurePermission(plugin) {
    return plugin.checkPermissions()
      .then(function (status) {
        if (status && status.display === 'granted') return true;
        return plugin.requestPermissions().then(function (res) {
          return !!(res && res.display === 'granted');
        });
      })
      .catch(function () { return false; });
  }

  function schedulePrayers(json) {
    var plugin = getLocalNotifications();
    if (!plugin) return;
    var payload;
    try {
      payload = (typeof json === 'string') ? JSON.parse(json) : json;
    } catch (e) {
      return; // malformed payload: keep the previous schedule untouched
    }
    if (!payload || !payload.days) return;

    var adhanId = 0;
    if (payload.settings && typeof payload.settings.adhanId === 'number') {
      adhanId = payload.settings.adhanId;
    }
    if (adhanId < 0 || adhanId > 3) adhanId = 0;
    var sound = 'athan' + (adhanId + 1) + '.caf';

    // Settings switches (v1.4.1). Absent flags keep the old behavior.
    var athanMuted = !!(payload.settings && payload.settings.athanMuted);
    var notificationsOff = !!(payload.settings && payload.settings.notificationsOff);
    if (notificationsOff) {
      // No prayer alerts at all: drop everything already scheduled
      // and schedule nothing until a later payload turns them back on.
      var offIds = loadStoredIds();
      storeIds([]);
      cancelIds(plugin, offIds);
      return;
    }

    var now = Date.now();
    var notifications = [];
    var newIds = [];
    for (var d = 0; d < payload.days.length; d++) {
      var day = payload.days[d];
      if (!day || !day.prayers) continue;
      for (var k = 0; k < PRAYER_KEYS.length; k++) {
        var key = PRAYER_KEYS[k];
        var when = day.prayers[key];
        if (typeof when !== 'number' || when <= now) continue; // already passed
        // Stable, unique-per-prayer-minute id (fits in a signed 32-bit int).
        var id = Math.floor(when / 60000);
        var notif = {
          id: id,
          title: day.salatMessage || "It's time for Salat!",
          body: (day.names && day.names[key]) || key,
          schedule: { at: new Date(when), allowWhileIdle: true },
          extra: { prayer: key, date: day.date || '' }
        };
        // Athan sound off (v1.4.1): the notification still shows its
        // title/body, just silently — no 'sound' field at all.
        if (!athanMuted) notif.sound = sound;
        notifications.push(notif);
        newIds.push(id);
      }
    }

    var previousIds = loadStoredIds();
    ensurePermission(plugin)
      .then(function () { return cancelIds(plugin, previousIds); })
      .then(function () {
        if (notifications.length) {
          return plugin.schedule({ notifications: notifications });
        }
        return null;
      })
      .then(function () { storeIds(newIds); })
      .catch(function () { /* scheduling is best-effort; next emit retries */ });
  }

  function cancelAll() {
    var plugin = getLocalNotifications();
    if (!plugin) return;
    var ids = loadStoredIds();
    storeIds([]);
    cancelIds(plugin, ids);
  }

  function install() {
    if (installed) return;
    if (window.NoAdsBridge) { installed = true; return; } // native bridge wins
    if (!isCapacitorIOS()) return;
    if (!getLocalNotifications()) return;
    window.NoAdsBridge = {
      schedulePrayers: schedulePrayers,
      cancelAll: cancelAll
    };
    installed = true;
  }

  install();
  if (!installed) {
    document.addEventListener('DOMContentLoaded', install);
    // The Capacitor bridge is injected before page scripts run, so the
    // retries below are pure belt-and-braces for slow shell starts.
    var tries = 0;
    var timer = setInterval(function () {
      install();
      if (installed || ++tries >= 20) clearInterval(timer);
    }, 250);
  }
})();
