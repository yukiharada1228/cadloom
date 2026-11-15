# Exact point charts in portable records

`encodeExactPoint3` now preserves factory-registered rational-function and two-parameter affine charts in addition to the existing affine and independent-coordinate forms. Existing records remain readable. Older readers do not understand the two new tags.

A `rational-map` stores a selected algebraic parameter, three rational-coefficient numerator polynomials and one common denominator. Coefficients are in ascending degree order; an empty coefficient array is the zero polynomial. Reconstruction checks the real-root certificate and rejects a denominator vanishing at that parameter. Coordinates are computed from the stored expressions, never accepted as an additional unchecked coordinate claim.

A `biparametric` stores `origin + u*s + v*t`, with rational vectors and independently certified selected algebraic values. Reconstruction evaluates that expression. No independence or additional algebraic relation between the parameters is assumed.

Only private factory registrations select these forms during encoding. Caller-added fields cannot establish provenance. This preserves computational parameterizations, not a certificate that a point belongs to a particular surface or intersection family. Geometry constructors must still check membership.

The existing point schema is shared by vertex, native-curve endpoint and face-domain records, so these forms apply throughout those records. They are a prerequisite for portable mixed curved BRep boundaries; this change does not yet serialize cylinder SSI curves, import their resulting solids into the common Body, or enable chained curved Booleans.

Validation includes JSON round trips, exact coordinate agreement, selected negative-root preservation, exact cylinder membership, malformed dimensions/certificates and a denominator vanishing only at the selected root. The codec has no new machine-checked refinement proof.
