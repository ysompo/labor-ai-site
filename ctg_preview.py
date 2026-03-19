"""
CTG preview generator — replicates WaveformGenerator.ts + CTGMonitor.tsx rendering.
Produces ctg_preview.jpg showing FHR (top) + TOCO (bottom) for 10 minutes.
"""
import math, random
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# ── Waveform generation (mirrors WaveformGenerator.ts) ───────────────────────

VARIABILITY_AMP = { 'normal': 10, 'reduced': 4, 'minimal': 1, 'absent': 0.4 }

def clamp(v, lo=60, hi=200):
    return round(max(lo, min(hi, v)))

def generate_fhr(params, t_ms):
    fhr = params['baseline']
    amp = VARIABILITY_AMP.get(params['variability'], 10)
    fhr += amp * (
        math.sin(t_ms * 0.003) * 0.40 +
        math.sin(t_ms * 0.007) * 0.30 +
        math.sin(t_ms * 0.013) * 0.20 +
        (random.random() - 0.5) * 0.30
    )
    # Accelerations every 150 s, lasting 20 s
    if params.get('accelerations'):
        phase = t_ms % 150_000
        if phase < 20_000:
            fhr += (18 + random.random() * 8) * math.sin((phase / 20_000) * math.pi)
    # Decelerations
    dtype = params.get('decelerations', 'none')
    if dtype != 'none':
        freq  = params.get('freq', 3)
        depth = params.get('depth', 30)
        period = (10 * 60_000) / freq
        phase  = (t_ms % period) / period
        if dtype == 'early':
            fhr -= depth * math.exp(-((phase - 0.5)**2) / (2 * 0.1**2))
        elif dtype == 'late':
            if 0.55 <= phase <= 0.88:
                fhr -= depth * math.sin(((phase - 0.55) / 0.33) * math.pi)
        elif dtype in ('variable_mild', 'variable_moderate'):
            d = 20 if dtype == 'variable_mild' else depth
            if 0.28 <= phase <= 0.58:
                local = (phase - 0.28) / 0.30
                nadir = local / 0.4 if local < 0.4 else 1 - (local - 0.4) / 0.6
                fhr -= d * nadir
    return clamp(fhr)

def generate_toco(freq, intensity, t_ms):
    baseline = 8 + (random.random() - 0.5) * 2
    if freq == 0:
        return round(max(0, baseline))
    period   = (10 * 60_000) / freq
    phase    = (t_ms % period) / period
    peak     = {'mild': 29, 'moderate': 49, 'strong': 68}.get(intensity, 49)
    sigma_f  = 15_000 / period
    gaussian = peak * math.exp(-((phase - 0.5)**2) / (2 * sigma_f**2))
    noise_sc = 1 - min(0.85, gaussian / peak)
    noise    = (random.random() - 0.5) * 4 * noise_sc
    return round(max(0, gaussian + baseline + noise))

# ── Scenarios ─────────────────────────────────────────────────────────────────

SCENARIOS = [
    dict(label='Normal — moderate contractions',
         baseline=140, variability='normal', accelerations=True,
         decelerations='none', freq=3, intensity='moderate', depth=30),
    dict(label='Variable decelerations — active labor',
         baseline=135, variability='normal', accelerations=False,
         decelerations='variable_moderate', freq=4, intensity='moderate', depth=40),
    dict(label='Late decelerations — 3 contractions/10 min',
         baseline=145, variability='reduced', accelerations=False,
         decelerations='late', freq=3, intensity='strong', depth=25),
]

SAMPLES_PER_SEC  = 2
DURATION_MIN     = 10
SAMPLE_MS        = 1000 / SAMPLES_PER_SEC
N                = DURATION_MIN * 60 * SAMPLES_PER_SEC
time_sec         = [i * SAMPLE_MS / 1000 for i in range(N)]

# ── Plot ──────────────────────────────────────────────────────────────────────

fig, axes = plt.subplots(
    len(SCENARIOS) * 2, 1,
    figsize=(16, 4.5 * len(SCENARIOS)),
    facecolor='white',
)
fig.subplots_adjust(hspace=0.08, top=0.96, bottom=0.04, left=0.05, right=0.98)

PINK_GRID  = '#ffb3c6'
PINK_MAJOR = '#ff8ca5'

def draw_fhr_panel(ax, fhr_buf, mhr_buf, label):
    ax.set_facecolor('white')
    ax.set_xlim(0, DURATION_MIN * 60)
    ax.set_ylim(60, 200)
    # Normal zone fill 110–160
    ax.axhspan(110, 160, color='#fff0a0', alpha=0.35, zorder=0)
    # Horizontal grid every 20 bpm
    for bpm in range(60, 201, 20):
        ax.axhline(bpm, color=PINK_GRID, lw=0.5, zorder=1)
    # Vertical grid: minor every 10 s, major every 60 s
    for t in time_sec:
        if abs(t % 60) < 0.3:
            ax.axvline(t, color=PINK_MAJOR, lw=0.8, alpha=0.8, zorder=1)
        elif abs(t % 10) < 0.3:
            ax.axvline(t, color=PINK_GRID,  lw=0.4, alpha=0.5, zorder=1)
    # Traces
    ax.plot(time_sec, mhr_buf, color='#22c55e', lw=1.2, zorder=3)
    ax.plot(time_sec, fhr_buf, color='#CC00CC', lw=1.5, zorder=4)
    # Y labels
    ax.set_yticks(range(60, 201, 20))
    ax.set_yticklabels([str(b) for b in range(60, 201, 20)],
                       color='#00aa00', fontsize=7, fontfamily='monospace')
    ax.tick_params(axis='x', bottom=False, labelbottom=False)
    for spine in ax.spines.values(): spine.set_visible(False)
    ax.set_title(label, fontsize=9, color='#334155', loc='left', pad=3)

def draw_toco_panel(ax, toco_buf, last=False):
    ax.set_facecolor('white')
    ax.set_xlim(0, DURATION_MIN * 60)
    ax.set_ylim(0, 100)
    for v in range(0, 101, 20):
        ax.axhline(v, color=PINK_GRID, lw=0.5, zorder=1)
    for t in time_sec:
        if abs(t % 60) < 0.3:
            ax.axvline(t, color=PINK_MAJOR, lw=0.8, alpha=0.8, zorder=1)
    ax.plot(time_sec, toco_buf, color='black', lw=1.5, zorder=4)
    ax.set_yticks(range(20, 101, 20))
    ax.set_yticklabels([str(v) for v in range(20, 101, 20)],
                       color='#00aa00', fontsize=6, fontfamily='monospace')
    if last:
        xticks = [i * 60 for i in range(DURATION_MIN + 1)]
        ax.set_xticks(xticks)
        ax.set_xticklabels([f'{i}:00' for i in xticks],
                           fontsize=7, color='#888')
    else:
        ax.tick_params(axis='x', bottom=False, labelbottom=False)
    for s in ['top', 'right', 'left']: ax.spines[s].set_visible(False)
    ax.spines['bottom'].set_color(PINK_GRID)

random.seed(42)

for idx, sc in enumerate(SCENARIOS):
    fhr_buf, mhr_buf, toco_buf = [], [], []
    for i in range(N):
        t = i * SAMPLE_MS
        fhr_buf.append(generate_fhr(sc, t))
        mhr_buf.append(round(85 + (random.random() - 0.5) * 4))
        toco_buf.append(generate_toco(sc['freq'], sc['intensity'], t))

    ax_fhr  = axes[idx * 2]
    ax_toco = axes[idx * 2 + 1]
    draw_fhr_panel(ax_fhr,  fhr_buf, mhr_buf, sc['label'])
    draw_toco_panel(ax_toco, toco_buf, last=(idx == len(SCENARIOS) - 1))

    # Thin separator between FHR and TOCO
    ax_fhr.spines['bottom'].set_visible(True)
    ax_fhr.spines['bottom'].set_color(PINK_MAJOR)
    ax_fhr.spines['bottom'].set_linewidth(1)

out = 'ctg_preview.jpg'
plt.savefig(out, dpi=150, bbox_inches='tight', facecolor='white')
print(f'Saved {out}')
