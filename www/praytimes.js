/*
 * PrayTimes — JavaScript port of the prayer-time calculation used in the
 * Android Athan TV app (itself a port of the PrayTimes algorithm by
 * Hamid Zarrabi-Zadeh, praytimes.org). Pure on-device astronomy, no network.
 *
 * Configuration: selectable calculation method (see METHODS below —
 * ISNA is the default, exactly as before), Maghrib = sunset,
 * Asr factor 1 = Shafi'i, 2 = Hanafi, NightMiddle high-latitude safety net.
 *
 * Works in the browser (window.PrayTimesLib) and in Node (module.exports)
 * so the math can be verified headlessly.
 */
(function (global) {
  'use strict';

  var FAJR = 0, SUNRISE = 1, DHUHR = 2, ASR = 3, SUNSET = 4, MAGHRIB = 5, ISHA = 6;
  var NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'];

  var RISE_SET_ANGLE = 0.833;

  // Calculation methods: Fajr/Isha twilight angles in degrees. MAKKAH
  // (Umm al-Qura) defines Isha as a fixed 90-minute interval after
  // Maghrib instead of an angle (ishaInterval, minutes; 0 = use angle).
  var METHODS = {
    ISNA:   { fajr: 15.0, isha: 15.0, ishaInterval: 0 },
    MWL:    { fajr: 18.0, isha: 17.0, ishaInterval: 0 },
    EGYPT:  { fajr: 19.5, isha: 17.5, ishaInterval: 0 },
    MAKKAH: { fajr: 18.5, isha: 0,    ishaInterval: 90 }
  };

  function methodParams(method) {
    return METHODS[method] || METHODS.ISNA;
  }

  // degree-based trig helpers
  function dsin(d) { return Math.sin(d * Math.PI / 180); }
  function dcos(d) { return Math.cos(d * Math.PI / 180); }
  function dtan(d) { return Math.tan(d * Math.PI / 180); }
  function darcsin(x) { return Math.asin(x) * 180 / Math.PI; }
  function darccos(x) { return Math.acos(x) * 180 / Math.PI; }
  function darctan2(y, x) { return Math.atan2(y, x) * 180 / Math.PI; }
  function darccot(x) { return Math.atan(1.0 / x) * 180 / Math.PI; }

  function fixAngle(a) {
    a = a - 360.0 * Math.floor(a / 360.0);
    return a < 0 ? a + 360.0 : a;
  }
  function fixHour(a) {
    a = a - 24.0 * Math.floor(a / 24.0);
    return a < 0 ? a + 24.0 : a;
  }

  function julian(year, month, day) {
    var y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100.0);
    var b = 2 - a + Math.floor(a / 4.0);
    return Math.floor(365.25 * (y + 4716))
         + Math.floor(30.6001 * (m + 1))
         + day + b - 1524.5;
  }

  function PrayTimes(lat, lng, timeZone, asrFactor, method) {
    this.lat = lat;
    this.lng = lng;
    this.timeZone = timeZone;   // hours from UTC for the date in question
    this.asrFactor = asrFactor; // 1 = Shafi'i, 2 = Hanafi
    var mp = methodParams(method);
    this.fajrAngle = mp.fajr;
    this.ishaAngle = mp.isha;
    this.ishaInterval = mp.ishaInterval; // minutes after Maghrib; 0 = angle
    this.jDate = 0;
  }

  /* returns {declination, equation of time} for a Julian date */
  PrayTimes.prototype.sunPosition = function (jd) {
    var d = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * d);
    var q = fixAngle(280.459 + 0.98564736 * d);
    var l = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
    var e = 23.439 - 0.00000036 * d;
    var ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15.0;
    var eqt = q / 15.0 - fixHour(ra);
    var decl = darcsin(dsin(e) * dsin(l));
    return [decl, eqt];
  };

  PrayTimes.prototype.computeMidDay = function (t) {
    var eqt = this.sunPosition(this.jDate + t)[1];
    return fixHour(12.0 - eqt);
  };

  PrayTimes.prototype.computeTime = function (angle, t) {
    var decl = this.sunPosition(this.jDate + t)[0];
    var z = this.computeMidDay(t);
    var beg = -dsin(angle) - dsin(decl) * dsin(this.lat);
    var mid = dcos(decl) * dcos(this.lat);
    var v = darccos(beg / mid) / 15.0;
    return z + (angle > 90 ? -v : v);
  };

  PrayTimes.prototype.computeAsr = function (factor, t) {
    var decl = this.sunPosition(this.jDate + t)[0];
    var g = -darccot(factor + dtan(Math.abs(this.lat - decl)));
    return this.computeTime(g, t);
  };

  PrayTimes.prototype.timeDiff = function (a, b) {
    return fixHour(b - a);
  };

  PrayTimes.prototype.nightPortion = function (angle, night) {
    // NightMiddle method
    return 0.5 * night;
  };

  PrayTimes.prototype.adjustHLTime = function (time, base, angle, night, ccw) {
    var portion = this.nightPortion(angle, night);
    var diff = ccw ? this.timeDiff(time, base) : this.timeDiff(base, time);
    if (isNaN(time) || diff > portion) {
      time = base + (ccw ? -portion : portion);
    }
    return time;
  };

  PrayTimes.prototype.adjustHighLatTimes = function (times) {
    var nightTime = this.timeDiff(times[SUNSET], times[SUNRISE]);
    times[FAJR] = this.adjustHLTime(times[FAJR], times[SUNRISE], this.fajrAngle, nightTime, true);
    if (!this.ishaInterval) {
      times[ISHA] = this.adjustHLTime(times[ISHA], times[SUNSET], this.ishaAngle, nightTime, false);
    }
    times[MAGHRIB] = this.adjustHLTime(times[MAGHRIB], times[SUNSET], 0, nightTime, false);
    return times;
  };

  PrayTimes.prototype.computeTimes = function () {
    var t = [5, 6, 12, 13, 18, 18, 18]; // initial guesses, hours
    var times = new Array(7);
    times[FAJR]    = this.computeTime(180.0 - this.fajrAngle, t[FAJR] / 24.0);
    times[SUNRISE] = this.computeTime(180.0 - RISE_SET_ANGLE, t[SUNRISE] / 24.0);
    times[DHUHR]   = this.computeMidDay(t[DHUHR] / 24.0);
    times[ASR]     = this.computeAsr(this.asrFactor, t[ASR] / 24.0);
    times[SUNSET]  = this.computeTime(RISE_SET_ANGLE, t[SUNSET] / 24.0);
    times[MAGHRIB] = this.computeTime(RISE_SET_ANGLE, t[MAGHRIB] / 24.0); // placeholder
    // Interval methods (Umm al-Qura) derive Isha from Maghrib in
    // adjustTimes; the angle value computed here is only a placeholder.
    times[ISHA]    = this.ishaInterval ? times[MAGHRIB]
                                       : this.computeTime(this.ishaAngle, t[ISHA] / 24.0);
    return times;
  };

  PrayTimes.prototype.adjustTimes = function (times) {
    for (var i = 0; i < times.length; i++) {
      times[i] += this.timeZone - this.lng / 15.0;
    }
    times[MAGHRIB] = times[SUNSET]; // Maghrib is 0 minutes after sunset
    if (this.ishaInterval) {
      // Umm al-Qura: Isha is a fixed interval after Maghrib.
      times[ISHA] = times[MAGHRIB] + this.ishaInterval / 60.0;
    }
    return this.adjustHighLatTimes(times);
  };

  /**
   * Prayer times as minutes since local midnight (rounded),
   * indexed [FAJR, SUNRISE, DHUHR, ASR, SUNSET, MAGHRIB, ISHA],
   * for the given Gregorian date.
   */
  PrayTimes.prototype.getTimes = function (year, month, day) {
    this.jDate = julian(year, month, day) - this.lng / (15.0 * 24.0);
    var times = this.adjustTimes(this.computeTimes());
    var out = new Array(7);
    for (var i = 0; i < 7; i++) {
      out[i] = Math.round(fixHour(times[i]) * 60.0);
    }
    return out;
  };

  /**
   * Convenience: times for a JS Date, using the device's local UTC offset
   * for that date (the TV is set to America/Toronto local time).
   */
  function timesForDate(date, lat, lng, asrFactor, method) {
    var tz = -date.getTimezoneOffset() / 60.0;
    var pt = new PrayTimes(lat, lng, tz, asrFactor, method);
    return pt.getTimes(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  /** minutes since midnight -> "5:29 AM" */
  function formatMinutes(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h24 = Math.floor(mins / 60);
    var m = mins % 60;
    var suffix = h24 < 12 ? 'AM' : 'PM';
    var h = h24 % 12;
    if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix;
  }

  var api = {
    PrayTimes: PrayTimes,
    timesForDate: timesForDate,
    formatMinutes: formatMinutes,
    METHODS: METHODS,
    NAMES: NAMES,
    FAJR: FAJR, SUNRISE: SUNRISE, DHUHR: DHUHR, ASR: ASR,
    SUNSET: SUNSET, MAGHRIB: MAGHRIB, ISHA: ISHA
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.PrayTimesLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
