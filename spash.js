(function(exports) {
var base64url = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

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

var spash = function(geo, nchar) {
  var long = geo.coords.longitude;  // degree
  var lat = geo.coords.latitude;  // degree
  var alt = (geo.coords.altitude) || 0;  // metres
  var sigalt = sigmoid(alt / 1e3);  // km
  var timestamp = geo.timestamp;  // seconds

  // Each character is a 6-bit number.
  nchar = +nchar;
  var longBitsLen = nchar * 2, latBitsLen = nchar * 2, altBitsLen = nchar * 2;
  var longBits = new Array(longBitsLen);
  var latBits = new Array(latBitsLen);
  var altBits = new Array(altBitsLen);

  // Generate bits for longitude, latitude, altitude.
  var longRange = bisect(long, -180, 180, longBits, longBitsLen);
  var latRange = bisect(lat, -90, 90, latBits, latBitsLen);
  var altRange = bisect(sigalt, -1, 1, altBits, altBitsLen);
  var longErr = (longRange[1] - longRange[0]) / 2;
  var latErr = (latRange[1] - latRange[0]) / 2;
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
    hash: 'E:' + hash,
    longError: longitudeMeterError(longErr, earthRadius + alt, lat),
    latError: latitudeMeterError(latErr, earthRadius + alt),
    altError: altErr,
  };
};

exports.spash = spash;
}(this));
