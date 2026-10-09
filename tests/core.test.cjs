// CrystalMoon ledger. Run: node tests/core.test.cjs   (about a minute)
'use strict';
const CM = require('../core.js');

const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function slabLaw(g = 1, lambda = 8) {
  const L = { ...CM.law(0), g, lambda, q0: 2 * Math.PI / lambda };
  L.dt = 1.5 / Math.pow(12 - L.q0 * L.q0, 2);
  L.epsSea = -0.3 * Math.max(1, g);
  return L;
}

// ------------------------------------------------------------------ T1 laws
{
  const a = CM.law(3), b = CM.law(3), c = CM.law(4);
  let worst = 0;
  for (let k = 0; k < 50; k++) {
    const L = CM.law(k);
    worst = Math.max(worst, L.dt * Math.pow(12 - L.q0 * L.q0, 2));
  }
  ok('T1 each level has one law, the same every visit; explicit step inside the stability bound',
    JSON.stringify(a) === JSON.stringify(b) && a.name !== c.name && worst < 2,
    `level 3: ${a.name}; worst dt·|op|max over 50 levels = ${worst.toFixed(2)} (< 2)`);
}

// --------------------------------------------- T2 stays bounded in the worst law
{
  const L = slabLaw(1.35, 7);
  const f = new CM.Field(L, 28);
  f.seedNoise(0.3, 9);
  for (let s = 0; s < 1500; s++) f.step(L.dt, 0.34);
  const st = f.stats();
  ok('T2 strongest growth and nonlinearity: bounded, no NaN', Number.isFinite(st.max) && st.max < 3, `max |ψ| ${st.max.toFixed(2)}`);
}

// ------------------------------------- T3 islands crystallise, the open sea stays empty
let slab;
{
  const L = slabLaw(1, 8), n = 40;
  const f = new CM.Field(L, n);
  const isl = (x) => x >= 16 && x < 24, far = (x) => x < 6 || x >= 34;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) f.eps[f.idx(x, y, z)] = isl(x) ? 0.26 : L.epsSea;
  f.seedNoise(0.05, 7);
  for (let s = 0; s < 4000; s++) f.step();
  const sel = (pred) => { let a = 0, c = 0, m = 0; for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (!pred(x)) continue; c++; const v = Math.abs(f.psi[f.idx(x, y, z)]); m = Math.max(m, v); if (v > 0.3) a++; } return { frac: a / c, max: m }; };
  const I = sel(isl), F = sel(far);
  ok('T3 island crystallises; open sea far from it stays empty (sea ε = −0.3)', I.frac > 0.5 && F.max < 0.05,
    `island: ${(100 * I.frac).toFixed(0)}% of voxels |ψ|>0.3, max ${I.max.toFixed(2)}; far sea max ${F.max.toFixed(3)}. (At sea ε = −0.06 the front invades: 75% of the sea after 6000 steps — measured during calibration.)`);
  slab = f;
}

// --------------------------------------------- T4 the Mexican hat picks the wavelength
{
  const L = slabLaw(1, 8), n = 32;
  const f = new CM.Field(L, n);
  f.seedNoise(0.05, 11);
  for (let s = 0; s < 1500; s++) f.step(L.dt, 0.26);
  // radial power spectrum by direct DFT over integer wavevectors |m| ≤ 7
  const shell = new Float64Array(9);
  const cos = [], sin = [];
  for (let m = -7; m <= 7; m++) { const c = [], s = []; for (let x = 0; x < n; x++) { c.push(Math.cos(2 * Math.PI * m * x / n)); s.push(Math.sin(2 * Math.PI * m * x / n)); } cos[m + 7] = c; sin[m + 7] = s; }
  for (let mx = 0; mx <= 7; mx++) for (let my = -7; my <= 7; my++) for (let mz = -7; mz <= 7; mz++) {
    const r = Math.hypot(mx, my, mz);
    if (r > 8 || r === 0) continue;
    let re = 0, im = 0;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) {
      // phase of (my,mz) part
      const cyz = cos[my + 7][y] * cos[mz + 7][z] - sin[my + 7][y] * sin[mz + 7][z];
      const syz = sin[my + 7][y] * cos[mz + 7][z] + cos[my + 7][y] * sin[mz + 7][z];
      const base = (z * n + y) * n;
      for (let x = 0; x < n; x++) {
        const p = f.psi[base + x];
        const c = cos[mx + 7][x] * cyz - sin[mx + 7][x] * syz;
        const s = sin[mx + 7][x] * cyz + cos[mx + 7][x] * syz;
        re += p * c; im -= p * s;
      }
    }
    shell[Math.round(r)] += re * re + im * im;
  }
  const peak = shell.indexOf(Math.max(...shell));
  const expect = n / L.lambda;
  ok('T4 Mexican hat selects one wavelength: spectrum peaks at |m| = n/λ', peak === expect,
    `peak shell |m| = ${peak}, expected ${expect}; shell powers ${Array.from(shell).map((v) => v.toExponential(1)).join(' ')}`);
}

// ------------------------------------------------- T5 the clock slows the crystal
{
  const steps = (T) => {
    const L = { ...slabLaw(1, 8), T }, f = new CM.Field(L, 24);
    f.seedNoise(0.05, 13);
    let s = 0, hit = -1, fin;
    for (; s < 4000; s++) { f.step(L.dt, 0.26); if (s % 50 === 0 && hit < 0 && f.stats().max > 0.8) hit = s; }
    fin = f.stats().max;
    return { hit, fin };
  };
  const a = steps(0), b = steps(6);
  ok('T5 clock tension T: dense crystal evolves slower (steps to reach |ψ| 0.8)', b.hit > a.hit && a.hit > 0,
    `T=0: ${a.hit} steps, T=6: ${b.hit} steps`);
}

// -------------------------------------------------- T6 your trail writes crystal
{
  const L = slabLaw(1, 8), n = 32;
  const f = new CM.Field(L, n);
  f.eps.fill(L.epsSea);
  f.seedNoise(0.05, 17);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d2 = (x - 16) ** 2 + (y - 16) ** 2 + (z - 16) ** 2;
    f.trail[f.idx(x, y, z)] = 0.75 * Math.exp(-d2 / (2 * 5 * 5));
  }
  for (let s = 0; s < 2500; s++) f.step();
  const grown = f.stats().max;
  f.trail.fill(0);
  for (let s = 0; s < 2500; s++) f.step();
  const after = f.stats().max;
  ok('T6 flight trail raises ε: crystal grows in empty sea, and melts once the trail is gone',
    grown > 0.5 && after < 0.05, `with trail: max ${grown.toFixed(2)}; trail removed: ${after.toFixed(3)} (memory lasts as long as the trail)`);
}

// ------------------------------------------------------ T7 the portal maths
{
  const R = CM.MOON.R, c = CM.MOON.c;
  let inv = 0, rad = 0, anti = 0, rot = 0, conf = 0;
  for (let k = 0; k < 200; k++) {
    const u = (j) => CM.rnd(k, j);
    const x = [c[0] + 40 * (u(1) - 0.5), c[1] + 40 * (u(2) - 0.5), c[2] + 40 * (u(3) - 0.5)];
    const y = CM.portal(CM.portal(x));
    inv = Math.max(inv, Math.hypot(y[0] - x[0], y[1] - x[1], y[2] - x[2]));
    const rx = Math.hypot(x[0] - c[0], x[1] - c[1], x[2] - c[2]);
    const px = CM.portal(x), rp = Math.hypot(px[0] - c[0], px[1] - c[1], px[2] - c[2]);
    rad = Math.max(rad, Math.abs(rp * rx - R * R));
    // conformal: J Jᵀ = λ² I
    const J = CM.portalJacobian(x);
    const l2 = (R * R / (rx * rx)) ** 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let s = 0; for (let m = 0; m < 3; m++) s += J[i][m] * J[j][m];
      conf = Math.max(conf, Math.abs(s - (i === j ? l2 : 0)) / l2);
    }
    // on the sphere: antipode, and a half-turn about the radius
    const h = [(x[0] - c[0]) / rx, (x[1] - c[1]) / rx, (x[2] - c[2]) / rx];
    const s = [c[0] + R * h[0], c[1] + R * h[1], c[2] + R * h[2]];
    const ps = CM.portal(s);
    anti = Math.max(anti, Math.hypot(ps[0] - (c[0] - R * h[0]), ps[1] - (c[1] - R * h[1]), ps[2] - (c[2] - R * h[2])));
    const Js = CM.portalJacobian(s);
    const det = Js[0][0] * (Js[1][1] * Js[2][2] - Js[1][2] * Js[2][1]) - Js[0][1] * (Js[1][0] * Js[2][2] - Js[1][2] * Js[2][0]) + Js[0][2] * (Js[1][0] * Js[2][1] - Js[1][1] * Js[2][0]);
    const Jh = [0, 1, 2].map((i) => Js[i][0] * h[0] + Js[i][1] * h[1] + Js[i][2] * h[2]);
    rot = Math.max(rot, Math.abs(det - 1), Math.hypot(Jh[0] - h[0], Jh[1] - h[1], Jh[2] - h[2]));
  }
  ok('T7 portal Φ: involution, |Φx−c|·|x−c| = R², conformal, sphere→antipode, derivative on the moon = half-turn about the radius (det +1)',
    inv < 1e-9 && rad < 1e-9 && conf < 1e-9 && anti < 1e-9 && rot < 1e-9,
    `errors: involution ${inv.toExponential(1)}, radius ${rad.toExponential(1)}, conformal ${conf.toExponential(1)}, antipode ${anti.toExponential(1)}, half-turn ${rot.toExponential(1)}`);
}

// ------------------------------------- T8 Kelvin: harmonic fields survive the lens
{
  const R = CM.MOON.R, c = CM.MOON.c;
  const a = [55, 20, 41];
  const u = (p) => 1 / Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) + 0.01 * ((p[0] - 30) ** 2 - (p[1] - 30) ** 2);
  const kelvin = (x) => (R / Math.hypot(x[0] - c[0], x[1] - c[1], x[2] - c[2])) * u(CM.portal(x));
  const naive = (x) => u(CM.portal(x));
  const lapAt = (fn, x) => {
    const h = 1e-3;
    let l = -6 * fn(x);
    for (let d = 0; d < 3; d++) for (const s of [-1, 1]) { const y = x.slice(); y[d] += s * h; l += fn(y); }
    return l / (h * h);
  };
  let k2 = 0, n2 = 0;
  for (let k = 0; k < 40; k++) {
    const r = 4 + 4 * CM.rnd(99, k), th = Math.PI * CM.rnd(98, k), ph = 2 * Math.PI * CM.rnd(97, k);
    const x = [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * Math.cos(th)];
    k2 = Math.max(k2, Math.abs(lapAt(kelvin, x)));
    n2 = Math.max(n2, Math.abs(lapAt(naive, x)));
  }
  ok('T8 Kelvin transform through the moon keeps harmonic fields harmonic (the inner world obeys the outer law)',
    k2 < 1e-3 * n2, `max |∇²| of Kelvin image ${k2.toExponential(1)} vs naive pull-back without the R/|x| factor ${n2.toExponential(1)}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);
