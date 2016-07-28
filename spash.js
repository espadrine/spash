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

  var utcEpochSeconds = function() {
    return ((Date.now() / 1000) >>> 0);
  };

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

  var encode = function(geo, nchar) {
    var lat = geo.coords.latitude;  // degree
    var long = geo.coords.longitude;  // degree
    var alt = (geo.coords.altitude) || 0;  // metres
    var sigalt = sigmoid(alt / 1e3);  // km
    var timestamp = geo.timestamp;  // seconds

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
      // FIXME: detect planet.
      hash: 'E:' + hash,
      latError: latitudeMeterError(latErr, earthRadius + alt),
      longError: longitudeMeterError(longErr, earthRadius + alt, lat),
      altError: altErr,
    };
  };

  // {coords: {latitude, longitude, altitude}, timestamp in seconds}
  var decode = function(spash) {
    var parts = spash.split(':');
    // FIXME: detect planet.
    var location = parts[1];

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
    console.log(ints.map(i => i.toString(2)))
    console.log(longBits)

    // Extract longitude, latitude, altitude.
    var lat = rbisect(-90, 90, latBits, locBitsLen);
    var long = rbisect(-180, 180, longBits, locBitsLen);
    var sigalt = rbisect(-1, 1, altBits, locBitsLen);
    var alt = asig(sigalt) * 1e3;  // metres

    return {
      coords: {
        latitude: lat,
        longitude: long,
        altitude: alt,
      },
      timestamp: utcEpochSeconds(),
    };
  };

  exports.encode = encode;
  exports.decode = decode;
}));
