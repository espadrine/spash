# Spash: Spacial Hash

Maps every location in the observable universe to a string of the form:

    <Origin>:<Hash>

(Example: `E:6BLH4goVfxs`.)

- Origin: IAU designation of a celestial object, percent-encoded as per reg-name
  syntax in [RFC 3986][]; eg. `E` for Earth.
- Hash: encoding of latitude, longitude, and distance to the radius of the
  celestial object. With 12 characters, you can encode the precise position of a
  single human in the ISS. With 11, the position of a room anywhere in the
  world.

[RFC 3986]: https://tools.ietf.org/html/rfc3986

The hash is an unpadded [base64url][] string. Each character encodes 6 bits. Two of
them contribute to longitude, two to latitude, two to altitude. They alternate
in this order, similar to [Geohash][]: one longitude bit, one latitude bit, one
altitude bit, one longitude bit, and so on.

[base64url]: https://tools.ietf.org/html/rfc4648

# Geographic coordinates

Extract separately the longitude bits and the latitude bits into two lists.
The range of the latitude goes from -90° (South Pole) to 90°. Longitude goes
from -180° to 180°, with 0° at the [Prime Meridian][] and increasing eastward.

[Prime Meridian]: https://en.wikipedia.org/wiki/Prime_Meridian

Each bit determines whether the intended value is above / on (1) or below (0)
the previously defined range, starting with the full range. For instance, a
starting bit of 1 means that the longitude is between 0° and 180°. That includes
most of Europe, Africa, Asia and Oceania, but excludes America. If the fourth
bit is 0, the longitude is between 0° and 90°.

# Altitude

Extract the altitude bits into its own list. It encodes an adjustment compared
to the radius of the celestial object. For Earth, that radius is sea level, and
that adjustment is the altitude.

The minimum altitude is minus infinity, and the maximum altitude is infinity.
That allows encoding any altitude with arbitrary precision. An altitude lower
than the negative of the radius is treated to correspond to the center of the
celestial object.

Let's introduce the following function, which maps values from -1 to 1 to real
values.

              ⎧ x / (x + 1)   if x < 0
    asig(x) = ⎨
              ⎩ -x / (x - 1)  otherwise

Similarly to what happens with latitude and longitude information, each bit
determines whether the intended value is above / on (1) or below (0) the
previously defined range, starting with a range from -1 to 1. The error range
for the altitude goes from `asig(lower bound)` to `asig(upper bound)`, in
kilometers.

The center point of the spash should be defined as the point at the center of
the error ranges of the latitude, longitude and altitude that were decoded.

# Pros and Cons

Geohash alone cannot distinguish between levels in a building, or between an
underground tunnel and the road above it, or between the ISS and whichever
location it is hovering above. A spash can. It can easily separate rooms in a
building. Note however that most mobile phones have a precision of tens of
meters; unless your device has a precision on the order of the meter, you won't
be able to produce or identify a room from a spash. It would still identify the
difference between a mountain tunnel and the ground, or between rough areas of a
skyscraper.

Spashes allow arbitrary precision. On the flip side, a given spash can describe
a location too precisely: there can be multiple valid spashes for the same
location. When choosing a spash for your location, make it precise enough that
your target location is unambiguous from standing at the center point of the
spash.

A spash's substring describes a less precise location of the same position. That
means that spashes with a common substring are close: they have an upper bound
to their distance. However, two extremely distinct spashes can specify locations
that are extremely close, especially at the poles and way up in space.

Ideally, we would want the error volume associated with a spash to be a ball.
However, it is more like a curved box. However, this design gave good
approximations and maintains simplicity.

# Use-cases

- Universal distributed locator for physical places.
- Travel industry: this locator can be used to specify any station in the
  universe, regardless of type, without needing a central authority to name
  them. Any system for finding a station will simply take the one that is
  closest to the queried station.
- Locators for arbitrary, cross-building or cross-city meeting points. The old
  way of specifying the address and the room number is not as convenient as
  decoding the bits of a spash with a [RFC 2289][]-like 4096 word list,
  producing 6 short words for every room. Besides, if you forgot the last word,
  you will still end up close by.
- Compact transmission of aircraft, rocket or space station location.

[RFC 2289]: http://tools.ietf.org/html/rfc2289

# Contribute

Implement it in your own language. Send me a tweet to your code [@espadrine][].

[@espadrine]: https://twitter.com/espadrine

Here is a list of known implementations:

---

Inspired by [Geohash][].

[Geohash]: http://geohash.org
