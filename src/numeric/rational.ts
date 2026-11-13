export type Sign = -1 | 0 | 1;

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Immutable, normalized exact rational. No implicit floating-point input. */
export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint, denominator = 1n) {
    if (typeof numerator !== "bigint" || typeof denominator !== "bigint") {
      throw new TypeError("Rational requires bigint; use Rational.parse for decimals");
    }
    if (denominator === 0n) throw new RangeError("Zero denominator");
    const divisor = gcd(numerator, denominator);
    const direction = denominator < 0n ? -1n : 1n;
    this.numerator = numerator / divisor * direction;
    this.denominator = denominator / divisor * direction;
    Object.freeze(this);
  }

  /** Accepts signed integers, finite decimal strings and integer fractions. */
  static parse(text: string): Rational {
    const value = text.trim();
    if (/^[+-]?\d+\/[+-]?\d+$/.test(value)) {
      const [n, d] = value.split("/");
      return new Rational(BigInt(n!), BigInt(d!));
    }
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(value)) {
      throw new SyntaxError(`Invalid rational: ${text}`);
    }
    const [whole, fraction = ""] = value.split(".");
    return new Rational(BigInt(whole! + fraction), 10n ** BigInt(fraction.length));
  }

  add(b: Rational): Rational {
    return new Rational(this.numerator * b.denominator + b.numerator * this.denominator,
      this.denominator * b.denominator);
  }
  sub(b: Rational): Rational { return this.add(b.neg()); }
  mul(b: Rational): Rational {
    return new Rational(this.numerator * b.numerator, this.denominator * b.denominator);
  }
  div(b: Rational): Rational {
    if (b.numerator === 0n) throw new RangeError("Division by zero");
    return new Rational(this.numerator * b.denominator, this.denominator * b.numerator);
  }
  neg(): Rational { return new Rational(-this.numerator, this.denominator); }
  sign(): Sign { return this.numerator < 0n ? -1 : this.numerator > 0n ? 1 : 0; }
  compare(b: Rational): Sign {
    const delta = this.numerator * b.denominator - b.numerator * this.denominator;
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  }
  equals(b: Rational): boolean {
    return this.numerator === b.numerator && this.denominator === b.denominator;
  }
  toString(): string {
    return this.denominator === 1n ? `${this.numerator}` : `${this.numerator}/${this.denominator}`;
  }
  toJSON(): string { return this.toString(); }
}
