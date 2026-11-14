"""Regenerate with: uv run --no-project --with sympy==1.14.0 python tests/oracles/generate-real-root-fixtures.py
SymPy is a fixture-generation oracle only, never a runtime or test dependency.
"""
import json
import random
from pathlib import Path
import sympy as sp

assert sp.__version__ == '1.14.0'
x = sp.Symbol('x')
rng = random.Random(491857)
# Verify the oracle's closed endpoint convention before deriving our open counts.
assert sp.Poly(x, x).count_roots(0, 1) == 1
assert sp.Poly(x - 1, x).count_roots(0, 1) == 1
assert sp.Poly(x * (x - 1), x).count_roots(0, 1) == 2
expressions = []
for i in range(24):
    degree = rng.randint(1, 6)
    coefficients = [rng.randint(-7, 7) for _ in range(degree)] + [rng.choice([-5, -2, -1, 1, 3, 7])]
    expressions.append(sum(c * x ** j for j, c in enumerate(coefficients)))
expressions += [x**5 - x + 1, x**6 - 3*x**4 + 2, (x-1)**4*(x+2)**3,
                (3*x-1)**2*(2*x+1)*(x*x+1), x**8-1, x**7-x,
                (x*x-2)**2*(x*x-3), (x*x+1)**3]
fixtures = []
for expression in expressions:
    p = sp.Poly(expression, x)
    square_free = p.sqf_part()
    intervals = []
    for _ in range(8):
        lo, hi = sorted([sp.Rational(rng.randint(-12, 12), rng.randint(1, 5)),
                         sp.Rational(rng.randint(-12, 12), rng.randint(1, 5))])
        if lo == hi:
            hi += 1
        count = square_free.count_roots(lo, hi) - int(square_free.eval(lo) == 0) - int(square_free.eval(hi) == 0)
        intervals.append({'lower': str(lo), 'upper': str(hi), 'count': int(count)})
    isolators = [{'lower': str(a), 'upper': str(b)} for (a, b), _ in square_free.intervals(eps=sp.Rational(1, 2**20))]
    fixtures.append({'coefficients': [str(c) for c in reversed(p.all_coeffs())],
                     'total': int(square_free.count_roots(-sp.oo, sp.oo)),
                     'intervals': intervals, 'isolators': isolators})
path = Path(__file__).resolve().parents[1] / 'fixtures' / 'real-roots.json'
path.write_text(json.dumps({'oracle': 'SymPy 1.14.0', 'seed': 491857, 'fixtures': fixtures}, indent=2) + '\n')
print(f'Wrote {len(fixtures)} polynomial fixtures to {path}')
