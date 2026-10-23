import { magneticValue } from './slider-magnet.js';
let checks = 0;
function check(label, ok) { checks++; if (!ok) throw new Error(label); }
const specs = [{value: 0, tol: .005}, {value: .5, tol: .02}, {value: 1, tol: .005}, {value: 0, tol: .03 * Math.PI}];
for (const snap of specs) {
  const f = x => magneticValue(x, [snap]), c = snap.value, b = snap.tol, a = b / 5;
  check('exact center', f(c) === c);
  for (const side of [-1, 1]) {
    check('exact plateau', f(c + side * a * .99) === c);
    check('identity beyond shoulder', f(c + side * b * 1.1) === c + side * b * 1.1);
    for (const radius of [a, b]) {
      const x = c + side * radius, h = b * 1e-6;
      check('continuous on both sides of boundary', Math.abs(f(x + h) - f(x - h)) < 4 * h);
      const left = (f(x) - f(x - h)) / h, right = (f(x + h) - f(x)) / h;
      check('matching boundary derivatives', Math.abs(left - right) < 2e-5);
    }
  }
  let previous = -Infinity;
  for (let i = 0; i <= 2000; i++) {
    const x = c - 1.1 * b + 2.2 * b * i / 2000, y = f(x);
    check('monotone throughout magnet', y >= previous - 1e-15);
    check('attraction without overshoot', Math.abs(y - c) <= Math.abs(x - c) + 1e-15 && (y - c) * (x - c) >= 0);
    previous = y;
  }
}
const radial = specs.slice(0, 3);
for (const x of [.479, .481, .519, .521]) {
  const h = 1e-7;
  check('old snap boundaries have no jump', Math.abs(magneticValue(x + h, radial) - magneticValue(x - h, radial)) < 4e-7);
}
check('weaker endpoint support', magneticValue(.006, radial) === .006 && magneticValue(.49, radial) !== .49);
console.log('slider magnet: ' + checks + ' checks passed');
