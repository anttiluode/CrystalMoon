# Crystal Moon

A Mexican-hat field condenses into crystal. Where the crystal is dense, its clock runs slow and light bends toward it. The moon is a sphere inversion: inside it, the infinite world beyond is turned inside out, and its horizon becomes the moon's glowing core. Fly in, and the world inside becomes the world outside, and a new world starts growing in the moon.

One HTML page, WebGL2, no libraries. **Live:** https://anttiluode.github.io/CrystalMoon/

**Controls:**
- **W A S D:** fly
- **R / F:** up and down
- **Q / E:** roll
- **Shift:** fast
- **Mouse:** look (click to capture)
- **Click:** seed a crystal
- **M:** face the moon
- **H:** hide the panels

Fly *into* the moon to go a level deeper.

## The mathematics, and where each piece came from

**The crystals: Swift–Hohenberg, the Mexican hat lifted to 3-D.**

```
∂ψ/∂t = M(ψ) · [ ε(x) ψ − (q₀² + ∇²)² ψ + g ψ² − ψ³ ]
```

The operator −(q₀² + ∇²)² is a Mexican hat in Fourier space. It amplifies only waves of wavelength 2π/q₀ and damps everything else, so the field condenses into "atoms" one wavelength apart. With g > 0 in 3-D the lattice is body-centred cubic, the phase-field-crystal family of Elder & Grant (2002).

- **The surface slider** cuts the field at different levels: high shows atoms, lower shows atoms joined by necks, and negative shows the foam of bonds between them.
- **It settles rather than flickers.** It is a gradient flow, so it orders over time.
- **ε(x) sets where crystal can live.** It is positive on islands that crowd around the moon and negative in the open sea. Your flight adds a wake to it, so crystal grows where you have been and melts after the wake fades (~150 s).

**The clock.** M(ψ) = 1 / (1 + Tψ²): dense crystal evolves slower. This is the c² = 1/(1+Tφ²) tension term from `crystal_kingdom.py` (May 2025), the Clockfield idea.

**The lens.** The refractive index is n = 1 + κρ, where ρ is ψ² blurred over a wavelength. Rays follow the ray equation d(n d̂)/ds = ∇n, so light curves toward dense crystal the way it curves around mass. Stars and the moon visibly warp behind crystal clouds.

The clock and the lens are two uses of one idea. They are not derived from one action.

**The moon: antipodal sphere inversion.**

```
Φ(x) = c − R² (x − c) / |x − c|²
```

- **It turns the world inside out.** Φ swaps the inside of the moon with the entire outside and sends infinity to the centre.
- **It is the only kind of map that could.** By Liouville's theorem, the only maps of 3-D space that preserve angles are Möbius maps, built from inversions. A lens that turns outer into inner while keeping crystals locally crystal-shaped has to be one.
- **It is its own inverse and keeps orientation.**
- **On the moon's surface its derivative is a half-turn about the radius.** So you come out the other side turned over. That is not a bug: no orientation-preserving map can turn a ball inside out and leave your frame alone.
- **Inside the moon, the next level's world is drawn through Φ.** Its far distance glows at the centre.
- **Flying through swaps the worlds.** Your position goes through Φ, your frame through the half-turn, the inner world becomes the outer, and a new world (level + 1) starts crystallising inside the moon from a faint memory of the one you left.
- **Each level has its own law,** fixed by a hash of the level number: wavelength, g, clock, lens, which surface you see, and colour.

## Ledger

`node tests/core.test.cjs` checks the CPU reference in `core.js` (8/8):

| test | result |
|---|---|
| T1 one law per level, same every visit; explicit step inside the stability bound | worst dt·\|op\| = 1.50 < 2 |
| T2 strongest law: bounded, no NaN | max \|ψ\| 1.83 |
| T3 islands crystallise; the far sea stays empty | 68% of island voxels crystal; far sea max 0.012 |
| T4 the Mexican hat picks the wavelength | spectrum peaks at \|m\| = n/λ = 4 exactly |
| T5 the clock slows dense crystal | 1550 → 1750 steps to reach \|ψ\| 0.8 at T = 0 → 6 |
| T6 your wake writes crystal into empty sea; it melts when the wake is gone | max 1.38 → 0.002 |
| T7 portal: involution, \|Φx−c\|·\|x−c\| = R², conformal, sphere → antipode, half-turn derivative | all errors < 1e-13 |
| T8 Kelvin transform through the moon keeps harmonic fields harmonic | ∇² 1e-6 vs 0.87 for the naive pull-back |

**The GPU matches the CPU.** Open `index.html?selftest` and the page steps the field on the GPU and in `core.js` from the same start. Over 25 steps, the largest difference is 1.5e-8 (headless SwiftShader).

Found while calibrating: with the open sea at ε = −0.06, the crystal front creeps out and fills ~75% of the sea within 6000 steps. At −0.3 it stays on its island. So the sea is set to −0.3·max(1, g).

## What this is not (yet)

- **Not tested on a real GPU.** It was only run headless in a software renderer, where one frame takes seconds. Frame rate on real hardware is unknown; lower *render scale* or *time speed* if it struggles.
- **The universe repeats every 64 units.** The field is periodic, so you are in one cell of an infinite crystal; fog hides most of the repetition.
- **Crystals grown from noise are polycrystalline:** grains and defects, not perfect lattices. The shapes are the BCC family, not carbon.
- **The descent is one way.** Only two worlds live in memory, so the way back up is gone once you go down.
- **There is no lensing inside the moon,** only the inversion.
- **The Kelvin result (T8) is about harmonic fields.** The crystal field is not harmonic: each level is its own simulation, viewed through the inversion, not derived from the level above.

## Files

- `index.html`: the world (simulation on the GPU, density lens, curved-ray raymarcher, moon portal, flight)
- `core.js`: the laws, the CPU reference field and the portal maths; it is the spec the shaders mirror
- `tests/core.test.cjs`: the ledger

Built with Claude (Opus 5.5), Friday 9 October 2026, from a dream about `crystal_kingdom.py`, AnttisBrain2 and the moon as the lens between outer and inner.
