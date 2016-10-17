(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['exports'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
    // CommonJS
    factory(exports);
  } else {
    // Browser globals
    factory(root.spash = {});
  }
}(this, function (exports) {

  var base64url = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var base64urlChar = Object.create(null);
  (function() {
    for (var i = 0; i < base64url.length; i++) {
      base64urlChar[base64url[i]] = i;
    }
  }());

  var midpoint = function(low, high) {
    return +low + (+high - low) / 2;
  };

  var sigmoid = function(x) {
    x = +x;
    return x / (1 + Math.abs(x));
  };

  var asig = function(x) {
    x = +x;
    if (x >= 0) { return - x / (x - 1); }
    else { return x / (x + 1); }
  };

  var earthRadius = 6371000;  // meters

  var longitudeMeterError = function(longErr, radius, lat) {
    var cos = Math.cos(lat * Math.PI / 180);
    var haversine = (1 - Math.cos(longErr * Math.PI / 180)) / 2;
    return 2 * radius * Math.asin(Math.sqrt(cos * cos * haversine));
  };

  var latitudeMeterError = function(latErr, radius) {
    return (latErr * Math.PI / 180) * radius;
  };

  var bisect = function(target, low, high, bits, len) {
    target = +target, low = +low, high = +high, len = +len;
    for (var i = 0; i < len; i++) {
      var mid = midpoint(low, high);
      if (target >= mid) {
        bits[i] = 1;
        low = mid;
      } else {
        bits[i] = 0;
        high = mid;
      }
    }
    return [low, high];
  };

  // Reverse bisect.
  var rbisect = function(low, high, bits, bitsLen) {
    var target = midpoint(low, high);
    for (var i = 0; i < bitsLen; i++) {
      if (bits[i] === 1) {
        low = target;
      } else {
        high = target;
      }
      target = midpoint(low, high);
    }
    return target;
  };

  // Take {latitude, longitude, altitude} information in degrees and metre.
  // Return a geoloc hash.
  var encodeGeoloc = function(coords, nchar) {
    var lat = coords.latitude;  // degree
    var long = coords.longitude;  // degree
    var alt = coords.altitude || 0;  // metres
    var sigalt = sigmoid(alt / 1e3);  // km

    // Each character is a 6-bit number.
    nchar = +nchar;
    var latBitsLen = nchar * 2, longBitsLen = nchar * 2, altBitsLen = nchar * 2;
    var latBits = new Array(latBitsLen);
    var longBits = new Array(longBitsLen);
    var altBits = new Array(altBitsLen);

    // Generate bits for longitude, latitude, altitude.
    var latRange = bisect(lat, -90, 90, latBits, latBitsLen);
    var longRange = bisect(long, -180, 180, longBits, longBitsLen);
    var altRange = bisect(sigalt, -1, 1, altBits, altBitsLen);
    var latErr = (latRange[1] - latRange[0]) / 2;
    var longErr = (longRange[1] - longRange[0]) / 2;
    var altErr = (asig(altRange[1]) - asig(altRange[0])) / 2 * 1e3;  // metres

    // Order bits.
    var bitsLen = nchar * 6;
    var bits = new Array(bitsLen);
    for (var i = 0, longi = 0, lati = 0, alti = 0; i < bitsLen; i++) {
      if (i % 3 === 0) {
        bits[i] = longBits[longi++];
      } else if (i % 3 === 1) {
        bits[i] = latBits[lati++];
      } else {
        bits[i] = altBits[alti++];
      }
    }

    // Convert bits to integers.
    var ints = new Array(nchar);
    for (var i = 0; i < bitsLen; i += 6) {
      ints[(i / 6) >>> 0] = (bits[i] << 5) + (bits[i + 1] << 4) + (bits[i + 2] << 3) +
                        (bits[i + 3] << 2) + (bits[i + 4] << 1) + (bits[i + 5]);
    }

    // Convert integers to characters.
    var hash = '';
    for (var i = 0; i < nchar; i++) {
      hash += base64url[ints[i]];
    }

    return {
      hash: hash,
      latError: latitudeMeterError(latErr, earthRadius + alt),
      longError: longitudeMeterError(longErr, earthRadius + alt, lat),
      altError: altErr,
    };
  };

  // Take a Unix timestamp. Return a time hash.
  var encodeTime = function(utc, nchar) {
    var time = tcgFromUtc(utc);
    var sigtime = sigmoid(time / timeHashPeriod);

    // Each character is a 6-bit number.
    nchar = +nchar;
    var bitsLen = nchar * 6;
    var bits = new Array(bitsLen);

    // Generate bits for longitude, latitude, altitude.
    var range = bisect(sigtime, -1, 1, bits, bitsLen);
    var err = (asig(range[1]) - asig(range[0])) / 2
      * timeHashPeriod;

    // Convert bits to integers.
    var ints = new Array(nchar);
    for (var i = 0; i < bitsLen; i += 6) {
      ints[(i / 6) >>> 0] = (bits[i] << 5) + (bits[i + 1] << 4) + (bits[i + 2] << 3) +
                        (bits[i + 3] << 2) + (bits[i + 4] << 1) + (bits[i + 5]);
    }

    // Convert integers to characters.
    var hash = '';
    for (var i = 0; i < nchar; i++) {
      hash += base64url[ints[i]];
    }

    return {hash: hash, error: err}
  };

  var encode = function(geo, nchar, timeNchar) {
    timeNchar = timeNchar || nchar;
    var geoloc = encodeGeoloc(geo.coords, nchar);
    var time = encodeTime(geo.timestamp / 1000, timeNchar);
    var celestialObj = 'E';  // FIXME: detect planet.

    return {
      hash: celestialObj + '.' + geoloc.hash + '.' + time.hash,
      geolocHash: geoloc.hash,
      timeHash: time.hash,
      iau: celestialObj,
      latError: geoloc.latError,
      longError: geoloc.longError,
      altError: geoloc.altError,
      timeError: time.error,
    };
  };

  // location: String of the form "ek0uvhuQ4AA".
  // Return an array of bits.
  var decodeGeoloc = function(location) {
    // Convert characters to integers.
    var ints = new Array(location.length);
    for (var i = 0; i < location.length; i++) {
      ints[i] = base64urlChar[location[i]];
    }

    // Convert integers to bits.
    var intsLen = ints.length;
    var locBitsLen = intsLen * 2;
    var latBits = new Array(locBitsLen);
    var longBits = new Array(locBitsLen);
    var altBits = new Array(locBitsLen);
    for (var i = 0; i < intsLen; i++) {
      var double = i * 2;
      longBits[double + 0] = (ints[i] & 32) >> 5;
      latBits [double + 0] = (ints[i] & 16) >> 4;
      altBits [double + 0] = (ints[i] & 8)  >> 3;
      longBits[double + 1] = (ints[i] & 4)  >> 2;
      latBits [double + 1] = (ints[i] & 2)  >> 1;
      altBits [double + 1] = (ints[i] & 1)  >> 0;
    }

    // Extract longitude, latitude, altitude.
    var lat = rbisect(-90, 90, latBits, locBitsLen);
    var long = rbisect(-180, 180, longBits, locBitsLen);
    var sigalt = rbisect(-1, 1, altBits, locBitsLen);
    var alt = asig(sigalt) * 1e3;  // metres

    return {
      latitude: lat,
      longitude: long,
      altitude: alt,
    };
  };

  var timeHashPeriod = 0xffffffff;  // 2^32-1 sec, ~136 years

  // Unix timestamp in milliseconds, ie number of milliseconds since
  // 1970-01-01T00:00:00Z with leap seconds ignored.
  var unixTimestampMs = function() { return Date.now(); };

  // Constant difference in the rate between TT and TCG.
  var LG = 6.969290134e-10;
  // TCG timestamp of Julian Date 2443144.5003725.
  // That is the moment when TAI started accounting for gravitational time
  // dilation.
  // It corresponds to TAI 1977-01-01T00:00:00.000 (6 leap seconds from UTC), so
  // new Date('1977-01-01T00:00:00.000Z') / 1000 + 6 + 32.184
  var julianTcgTaiCorrection = 220924838.184;

  // Unix timestamps of the instant just after the end of a leap second.
  var leapSeconds = [
    78796800, 94694400, 126230400, 157766400, 189302400, 220924800, 252460800,
    283996800, 315532800, 362793600, 394329600, 425865600, 489024000, 567993600,
    631152000, 662688000, 709948800, 741484800, 773020800, 820454400, 867715200,
    915148800, 1136073600, 1230768000, 1341100800, 1435708800, 1483228800
  ];

  var leapSecondsTai = leapSeconds.map(function(leap, i) { return leap + i; });

  // tai: TAI time in seconds since the Unix Epoch.
  // Returns the number of UTC leap seconds since that TAI time.
  var leapSecondsSinceTai = function(tai) {
    for (var i = 0; i < leapSecondsTai.length; i++) {
      if (tai < leapSecondsTai[i]) {break;}
    }
    return i;
  };

  // utc: Unix timestamp.
  // Returns the number of UTC leap seconds since that time.
  var leapSecondsSinceUtc = function(utc) {
    for (var i = 0; i < leapSeconds.length; i++) {
      if (utc < leapSeconds[i]) {break;}
    }
    return i;
  };

  // Convert a TCG timestamp (number of seconds since Unix epoch in TCG) to a
  // Unix timestamp.
  var utcFromTcg = function(tcg) {
    // Convert TCG to TT, and TT to TAI.
    var daysSinceTaiCorrection = (tcg - julianTcgTaiCorrection) / 24 / 3600;
    var tt = tcg - LG * daysSinceTaiCorrection * 86400;
    var tai = tt - 32.184;
    // Convert TAI to UTC.
    var utc = tai - leapSecondsSinceTai(tai) - 10;
    return utc;
  };

  var tcgFromUtc = function(utc) {
    // Convert UTC to TAI.
    var tai = utc + leapSecondsSinceUtc(utc) + 10;
    // Convert TAI to TT, then to TCG.
    var tt = tai + 32.184;
    // The TCG timestamp of the TAI correction date is identical to the TT one.
    var daysSinceTaiCorrection = (tt - julianTcgTaiCorrection) / 24 / 3600;
    var tcg = tt + LG * daysSinceTaiCorrection * 86400;
    return tcg;
  };

  // Take something of the form "ek0", return a Unix timestamp in milliseconds.
  var decodeTime = function(time) {
    // Convert characters to integers.
    var ints = new Array(time.length);
    for (var i = 0; i < time.length; i++) {
      ints[i] = base64urlChar[time[i]];
    }

    // Convert integers to bits.
    var intsLen = ints.length;
    var bitsLen = intsLen * 6;
    var bits = new Array(bitsLen);
    for (var i = 0, j = 0; i < intsLen; i++, j += 6) {
      bits[j + 0] = (ints[i] & 32) >> 5;
      bits[j + 1] = (ints[i] & 16) >> 4;
      bits[j + 2] = (ints[i] & 8)  >> 3;
      bits[j + 3] = (ints[i] & 4)  >> 2;
      bits[j + 4] = (ints[i] & 2)  >> 1;
      bits[j + 5] = (ints[i] & 1)  >> 0;
    }

    var sigtime = rbisect(-1, 1, bits, bitsLen);
    // Timestamp in TCG time.
    var timestampTcg = asig(sigtime) * timeHashPeriod;
    return utcFromTcg(timestampTcg) * 1000;
  };

  // {coords: {latitude, longitude, altitude}, timestamp in seconds}
  var decode = function(spash) {
    var parts = spash.split('.');
    // FIXME: detect planet.
    var location = parts[1];
    var time = parts[2];  // optional

    var coords = decodeGeoloc(location);
    if (time !== undefined) {
      var timestamp = decodeTime(time);
    } else {
      var timestamp = unixTimestampMs();
    }

    return {
      coords: coords,
      timestamp: timestamp,
    };
  };

  exports.encode = encode;
  exports.encodeTime = encodeTime;
  exports.decode = decode;
  exports.decodeTime = decodeTime;
}));
