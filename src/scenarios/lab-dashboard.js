// Research domain. Threshold logic is the ground truth: the metric definitions,
// the cutoffs, and the direction of "good" each live with a different owner, and
// the rework inverts one direction — which is exactly the kind of change that
// breaks a page rebuilt from scratch by someone who never saw version one.
export default {
  id: 'lab-dashboard',
  domain: 'research',
  fn: 'statusFor',
  fnDoc: 'statusFor(metricId, value) -> "green"|"amber"|"red". metricId is one of "latency"|"recall"|"drift".',

  spec: `Build a single self-contained HTML page: an experiment results dashboard.

REQUIRED STRUCTURE (ids are exact):
  #runs      — a section stating the number of runs and the dataset size
  #metrics   — a container with one .metric-card per metric
  #cards     — each .metric-card must carry data-metric="<id>" and data-value="<number>"
  #legend    — a section naming the three status bands

REQUIRED SCRIPT:
  A <script> defining a global function statusFor(metricId, value) returning
  "green", "amber" or "red" by comparing the value against that metric's cutoffs
  and respecting whether higher or lower is better for that metric.

Output ONE complete HTML document. No external assets, no CDN links.`,

  instances: {
    A: {
      brief: 'Dashboard for experiment run set RS-114.',
      facts: [
        { id: 'runs',      holder: 'ops',     text: 'RS-114 completed 312 runs.' },
        { id: 'dataset',   holder: 'data',    text: 'The evaluation set holds 18400 examples.' },
        { id: 'm_names',   holder: 'metrics', text: 'Three metrics are tracked: latency, recall, drift.' },
        { id: 'lat_dir',   holder: 'metrics', text: 'For latency, lower is better.' },
        { id: 'lat_cuts',  holder: 'thresh',  text: 'Latency is green below 200, amber from 200 up to 400, red at 400 and above.' },
        { id: 'lat_val',   holder: 'data',    text: 'Measured latency is 173.' },
        { id: 'rec_dir',   holder: 'metrics', text: 'For recall, higher is better.' },
        { id: 'rec_cuts',  holder: 'thresh',  text: 'Recall is green at 0.85 and above, amber from 0.70 up to 0.85, red below 0.70.' },
        { id: 'rec_val',   holder: 'data',    text: 'Measured recall is 0.79.' },
        { id: 'dri_dir',   holder: 'metrics', text: 'For drift, lower is better.' },
        { id: 'dri_cuts',  holder: 'thresh',  text: 'Drift is green below 0.05, amber from 0.05 up to 0.12, red at 0.12 and above.' },
        { id: 'dri_val',   holder: 'data',    text: 'Measured drift is 0.14.' },
        { id: 'bands',     holder: 'thresh',  text: 'The three status bands are named green, amber and red.' },
        { id: 'owner',     holder: 'ops',     text: 'The run set is owned by the Systems group.' },
      ],
      distractors: [
        { id: 'x_runs',    holder: 'metrics', text: 'I think RS-114 was about 180 runs.',        flips: 'runs' },
        { id: 'x_lat_cut', holder: 'data',    text: 'Latency turns amber at 250 I believe.',     flips: 'lat_cuts' },
        { id: 'x_rec_dir', holder: 'ops',     text: 'For recall lower is better, oddly.',        flips: 'rec_dir' },
        { id: 'x_dri_val', holder: 'thresh',  text: 'Drift came out at 0.04 last I checked.',    flips: 'dri_val' },
      ],
      assertions: [
        { id: 'a_runs',   kind: 'text', want: '312' },
        { id: 'a_data',   kind: 'text', anyOf: ['18400', '18,400'] },
        { id: 'a_cards',  kind: 'count', sel: '.metric-card', want: 3 },
        { id: 'a_lat_c',  kind: 'attr', sel: '.metric-card[data-metric="latency"]', at: 'data-value', want: '173' },
        { id: 'a_rec_c',  kind: 'attr', sel: '.metric-card[data-metric="recall"]',  at: 'data-value', want: '0.79' },
        { id: 'a_dri_c',  kind: 'attr', sel: '.metric-card[data-metric="drift"]',   at: 'data-value', want: '0.14' },
        { id: 'a_legend', kind: 'exists', sel: '#legend' },
        { id: 'a_runs_s', kind: 'exists', sel: '#runs' },
        { id: 'a_amber',  kind: 'text', want: 'amber' },
        { id: 'c_lat_g',  kind: 'calc', args: ['latency', 173],  want: 'green' },
        { id: 'c_lat_a',  kind: 'calc', args: ['latency', 260],  want: 'amber' },
        { id: 'c_lat_r',  kind: 'calc', args: ['latency', 400],  want: 'red' },
        { id: 'c_rec_a',  kind: 'calc', args: ['recall', 0.79],  want: 'amber' },
        { id: 'c_rec_g',  kind: 'calc', args: ['recall', 0.85],  want: 'green' },
        { id: 'c_rec_r',  kind: 'calc', args: ['recall', 0.62],  want: 'red' },
        { id: 'c_dri_r',  kind: 'calc', args: ['drift', 0.14],   want: 'red' },
        { id: 'c_dri_g',  kind: 'calc', args: ['drift', 0.02],   want: 'green' },
        { id: 'c_dri_a',  kind: 'calc', args: ['drift', 0.09],   want: 'amber' },
      ],
      rework: {
        brief: 'Two revisions from the metrics owner: drift is now reported as a retention score where HIGHER is better (green at 0.12 and above, amber from 0.05 up to 0.12, red below 0.05), and the measured drift value is restated as 0.14 unchanged. Also latency now turns red at 350 rather than 400.',
        factOverrides: {
          dri_dir:  { holder: 'metrics', text: 'For drift, higher is now better (revised): it is a retention score.' },
          dri_cuts: { holder: 'thresh',  text: 'Drift is green at 0.12 and above, amber from 0.05 up to 0.12, red below 0.05 (revised).' },
          lat_cuts: { holder: 'thresh',  text: 'Latency is green below 200, amber from 200 up to 350, red at 350 and above (revised).' },
        },
        assertionOverrides: {
          c_dri_r: { args: ['drift', 0.14], want: 'green' },
          c_dri_g: { args: ['drift', 0.02], want: 'red' },
          c_lat_r: { args: ['latency', 400], want: 'red' },
        },
        addedAssertions: [
          { id: 'c_lat_r2', kind: 'calc', args: ['latency', 360], want: 'red' },
        ],
      },
    },

    B: {
      brief: 'Dashboard for experiment run set RS-207.',
      facts: [
        { id: 'runs',      holder: 'ops',     text: 'RS-207 completed 488 runs.' },
        { id: 'dataset',   holder: 'data',    text: 'The evaluation set holds 26100 examples.' },
        { id: 'm_names',   holder: 'metrics', text: 'Three metrics are tracked: latency, recall, drift.' },
        { id: 'lat_dir',   holder: 'metrics', text: 'For latency, lower is better.' },
        { id: 'lat_cuts',  holder: 'thresh',  text: 'Latency is green below 150, amber from 150 up to 300, red at 300 and above.' },
        { id: 'lat_val',   holder: 'data',    text: 'Measured latency is 214.' },
        { id: 'rec_dir',   holder: 'metrics', text: 'For recall, higher is better.' },
        { id: 'rec_cuts',  holder: 'thresh',  text: 'Recall is green at 0.90 and above, amber from 0.75 up to 0.90, red below 0.75.' },
        { id: 'rec_val',   holder: 'data',    text: 'Measured recall is 0.93.' },
        { id: 'dri_dir',   holder: 'metrics', text: 'For drift, lower is better.' },
        { id: 'dri_cuts',  holder: 'thresh',  text: 'Drift is green below 0.03, amber from 0.03 up to 0.10, red at 0.10 and above.' },
        { id: 'dri_val',   holder: 'data',    text: 'Measured drift is 0.06.' },
        { id: 'bands',     holder: 'thresh',  text: 'The three status bands are named green, amber and red.' },
        { id: 'owner',     holder: 'ops',     text: 'The run set is owned by the Methods group.' },
      ],
      distractors: [
        { id: 'x_runs',    holder: 'metrics', text: 'RS-207 was closer to 300 runs.',        flips: 'runs' },
        { id: 'x_rec_val', holder: 'ops',     text: 'Recall landed at 0.73 I think.',        flips: 'rec_val' },
        { id: 'x_dri_cut', holder: 'data',    text: 'Drift goes red at 0.20.',               flips: 'dri_cuts' },
        { id: 'x_lat_dir', holder: 'thresh',  text: 'Higher latency is better here.',        flips: 'lat_dir' },
      ],
      assertions: [
        { id: 'a_runs',   kind: 'text', want: '488' },
        { id: 'a_data',   kind: 'text', anyOf: ['26100', '26,100'] },
        { id: 'a_cards',  kind: 'count', sel: '.metric-card', want: 3 },
        { id: 'a_lat_c',  kind: 'attr', sel: '.metric-card[data-metric="latency"]', at: 'data-value', want: '214' },
        { id: 'a_rec_c',  kind: 'attr', sel: '.metric-card[data-metric="recall"]',  at: 'data-value', want: '0.93' },
        { id: 'a_dri_c',  kind: 'attr', sel: '.metric-card[data-metric="drift"]',   at: 'data-value', want: '0.06' },
        { id: 'a_legend', kind: 'exists', sel: '#legend' },
        { id: 'a_runs_s', kind: 'exists', sel: '#runs' },
        { id: 'a_amber',  kind: 'text', want: 'amber' },
        { id: 'c_lat_a',  kind: 'calc', args: ['latency', 214],  want: 'amber' },
        { id: 'c_lat_g',  kind: 'calc', args: ['latency', 120],  want: 'green' },
        { id: 'c_lat_r',  kind: 'calc', args: ['latency', 300],  want: 'red' },
        { id: 'c_rec_g',  kind: 'calc', args: ['recall', 0.93],  want: 'green' },
        { id: 'c_rec_a',  kind: 'calc', args: ['recall', 0.80],  want: 'amber' },
        { id: 'c_rec_r',  kind: 'calc', args: ['recall', 0.60],  want: 'red' },
        { id: 'c_dri_a',  kind: 'calc', args: ['drift', 0.06],   want: 'amber' },
        { id: 'c_dri_g',  kind: 'calc', args: ['drift', 0.01],   want: 'green' },
        { id: 'c_dri_r',  kind: 'calc', args: ['drift', 0.11],   want: 'red' },
      ],
      rework: {
        brief: 'Revisions: recall now turns green only at 0.95 and above (amber from 0.80 up to 0.95, red below 0.80), and the measured recall is restated as 0.93. Also the dataset size is corrected to 25800.',
        factOverrides: {
          rec_cuts: { holder: 'thresh', text: 'Recall is green at 0.95 and above, amber from 0.80 up to 0.95, red below 0.80 (revised).' },
          dataset:  { holder: 'data',   text: 'The evaluation set holds 25800 examples (corrected).' },
        },
        assertionOverrides: {
          a_data:  { anyOf: ['25800', '25,800'] },
          c_rec_g: { args: ['recall', 0.93], want: 'amber' },
          c_rec_a: { args: ['recall', 0.80], want: 'amber' },
          c_rec_r: { args: ['recall', 0.60], want: 'red' },
        },
        addedAssertions: [
          { id: 'c_rec_g2', kind: 'calc', args: ['recall', 0.96], want: 'green' },
        ],
      },
    },
  },
};
