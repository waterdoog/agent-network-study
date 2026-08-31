// Events domain. A conference site whose registration calculator is the ground
// truth: the fee rules live on four different specialists, so no single contact
// can produce a correct calculator.
export default {
  id: 'conference',
  domain: 'events',
  fn: 'registrationTotal',
  fnDoc: 'registrationTotal({ticket, workshops, groupSize}) -> number (EUR, 2dp). ticket is one of "early"|"standard"|"student".',

  spec: `Build a single self-contained HTML page for an academic conference.

REQUIRED STRUCTURE (ids are exact):
  #venue      — a section stating the venue city, the dates, and the seated capacity
  #tracks     — a <ul> with one <li> per parallel track
  #schedule   — a <table> with one <tr> in <tbody> per conference day
  #fees       — a <table> with one <tr> in <tbody> per ticket type
  #access     — a section stating the accessibility provisions
  #visa       — a section stating the invitation-letter lead time in days

REQUIRED SCRIPT:
  A <script> defining a global function registrationTotal({ticket, workshops, groupSize})
  returning a number in EUR rounded to 2 decimals. It must apply the ticket price,
  add the per-workshop add-on price for each workshop, multiply by groupSize, and
  then apply the group discount when groupSize meets or exceeds the threshold.

Output ONE complete HTML document. No external assets, no CDN links.`,

  instances: {
    A: {
      brief: 'ICSR 2027, the 9th International Conference on Systems Research.',
      facts: [
        { id: 'city',      holder: 'venue',    text: 'The 2027 edition is hosted in Lisbon.' },
        { id: 'dates',     holder: 'venue',    text: 'It runs 12-14 April 2027 (three days).' },
        { id: 'capacity',  holder: 'venue',    text: 'The main hall seats 480.' },
        { id: 'tracks',    holder: 'program',  text: 'There are 4 parallel tracks: Systems, Methods, Applications, Doctoral.' },
        { id: 'days',      holder: 'program',  text: 'The schedule spans 3 conference days.' },
        { id: 'fee_early', holder: 'finance',  text: 'Early-bird registration is EUR 240.' },
        { id: 'fee_std',   holder: 'finance',  text: 'Standard registration is EUR 380.' },
        { id: 'fee_stu',   holder: 'finance',  text: 'Student registration is EUR 120.' },
        { id: 'fee_ws',    holder: 'finance',  text: 'Each workshop add-on costs EUR 60.' },
        { id: 'grp_min',   holder: 'sales',    text: 'The group discount applies from 5 registrations upward.' },
        { id: 'grp_pct',   holder: 'sales',    text: 'The group discount is 10 percent off the whole order.' },
        { id: 'access',    holder: 'access',   text: 'Live captioning is provided in every room, and 2 rooms are wheelchair accessible.' },
        { id: 'visa',      holder: 'visa',     text: 'Invitation letters need 45 days lead time before travel.' },
        { id: 'lang',      holder: 'program',  text: 'All sessions are in English.' },
      ],
      distractors: [
        { id: 'x_capacity', holder: 'sales',   text: 'I recall the hall seats about 850.', flips: 'capacity' },
        { id: 'x_fee_stu',  holder: 'program', text: 'Students pay EUR 180 I believe.',    flips: 'fee_stu' },
        { id: 'x_grp_min',  holder: 'venue',   text: 'Group rates kick in at 12 people.',  flips: 'grp_min' },
        { id: 'x_visa',     holder: 'finance', text: 'Visa letters take about 20 days.',   flips: 'visa' },
      ],
      assertions: [
        { id: 'a_city',     kind: 'text', want: 'Lisbon' },
        { id: 'a_capacity', kind: 'text', want: '480' },
        { id: 'a_dates',    kind: 'text', anyOf: ['12-14 April 2027', '12–14 April 2027', '2027-04-12'] },
        { id: 'a_tracks',   kind: 'count', sel: '#tracks li', want: 4 },
        { id: 'a_sched',    kind: 'count', sel: '#schedule tbody tr', want: 3 },
        { id: 'a_fees',     kind: 'count', sel: '#fees tbody tr', want: 3 },
        { id: 'a_venue_s',  kind: 'exists', sel: '#venue' },
        { id: 'a_access_s', kind: 'exists', sel: '#access' },
        { id: 'a_visa_s',   kind: 'exists', sel: '#visa' },
        { id: 'a_access_t', kind: 'text', want: 'captioning' },
        { id: 'a_visa_t',   kind: 'text', want: '45' },
        { id: 'a_early',    kind: 'text', want: '240' },
        { id: 'a_std',      kind: 'text', want: '380' },
        { id: 'a_stu',      kind: 'text', want: '120' },
        { id: 'c_early1',   kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 1 }],    want: 240 },
        { id: 'c_std_ws2',  kind: 'calc', args: [{ ticket: 'standard', workshops: 2, groupSize: 1 }], want: 500 },
        { id: 'c_stu_ws1',  kind: 'calc', args: [{ ticket: 'student', workshops: 1, groupSize: 1 }],  want: 180 },
        { id: 'c_grp4',     kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 4 }],    want: 960 },
        { id: 'c_grp5',     kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 5 }],    want: 1080 },
        { id: 'c_grp6ws1',  kind: 'calc', args: [{ ticket: 'standard', workshops: 1, groupSize: 6 }], want: 2376 },
      ],
      rework: {
        brief: 'Two changes came back from the committee: the student fee is now EUR 90, and the group discount threshold moves from 5 to 8 registrations. Update the page and the calculator.',
        factOverrides: {
          fee_stu: { holder: 'finance', text: 'Student registration is EUR 90 (revised).' },
          grp_min: { holder: 'sales', text: 'The group discount now applies from 8 registrations upward (revised).' },
        },
        assertionOverrides: {
          a_stu: { want: '90' },
          c_stu_ws1: { want: 150 },
          c_grp5: { want: 1200 },
          c_grp6ws1: { want: 2640 },
        },
      },
    },

    B: {
      brief: 'ICSR 2028, the 10th edition. Same series, new host city and revised fees.',
      facts: [
        { id: 'city',      holder: 'venue',   text: 'The 2028 edition is hosted in Tallinn.' },
        { id: 'dates',     holder: 'venue',   text: 'It runs 9-12 May 2028 (four days).' },
        { id: 'capacity',  holder: 'venue',   text: 'The main hall seats 620.' },
        { id: 'tracks',    holder: 'program', text: 'There are 5 parallel tracks: Systems, Methods, Applications, Doctoral, Industry.' },
        { id: 'days',      holder: 'program', text: 'The schedule spans 4 conference days.' },
        { id: 'fee_early', holder: 'finance', text: 'Early-bird registration is EUR 260.' },
        { id: 'fee_std',   holder: 'finance', text: 'Standard registration is EUR 410.' },
        { id: 'fee_stu',   holder: 'finance', text: 'Student registration is EUR 140.' },
        { id: 'fee_ws',    holder: 'finance', text: 'Each workshop add-on costs EUR 75.' },
        { id: 'grp_min',   holder: 'sales',   text: 'The group discount applies from 6 registrations upward.' },
        { id: 'grp_pct',   holder: 'sales',   text: 'The group discount is 15 percent off the whole order.' },
        { id: 'access',    holder: 'access',  text: 'Live captioning is provided in every room, and 3 rooms are wheelchair accessible.' },
        { id: 'visa',      holder: 'visa',    text: 'Invitation letters need 60 days lead time before travel.' },
        { id: 'lang',      holder: 'program', text: 'All sessions are in English.' },
      ],
      distractors: [
        { id: 'x_capacity', holder: 'sales',   text: 'Tallinn hall is around 400 seats.',   flips: 'capacity' },
        { id: 'x_fee_early',holder: 'program', text: 'Early bird was held at EUR 240.',     flips: 'fee_early' },
        { id: 'x_grp_pct',  holder: 'venue',   text: 'Group discount stayed at 10 percent.', flips: 'grp_pct' },
        { id: 'x_visa',     holder: 'finance', text: 'Visa letters still take 45 days.',    flips: 'visa' },
      ],
      assertions: [
        { id: 'a_city',     kind: 'text', want: 'Tallinn' },
        { id: 'a_capacity', kind: 'text', want: '620' },
        { id: 'a_dates',    kind: 'text', anyOf: ['9-12 May 2028', '9–12 May 2028', '2028-05-09'] },
        { id: 'a_tracks',   kind: 'count', sel: '#tracks li', want: 5 },
        { id: 'a_sched',    kind: 'count', sel: '#schedule tbody tr', want: 4 },
        { id: 'a_fees',     kind: 'count', sel: '#fees tbody tr', want: 3 },
        { id: 'a_venue_s',  kind: 'exists', sel: '#venue' },
        { id: 'a_access_s', kind: 'exists', sel: '#access' },
        { id: 'a_visa_s',   kind: 'exists', sel: '#visa' },
        { id: 'a_access_t', kind: 'text', want: 'captioning' },
        { id: 'a_visa_t',   kind: 'text', want: '60' },
        { id: 'a_early',    kind: 'text', want: '260' },
        { id: 'a_std',      kind: 'text', want: '410' },
        { id: 'a_stu',      kind: 'text', want: '140' },
        { id: 'c_early1',   kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 1 }],    want: 260 },
        { id: 'c_std_ws2',  kind: 'calc', args: [{ ticket: 'standard', workshops: 2, groupSize: 1 }], want: 560 },
        { id: 'c_stu_ws1',  kind: 'calc', args: [{ ticket: 'student', workshops: 1, groupSize: 1 }],  want: 215 },
        { id: 'c_grp5',     kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 5 }],    want: 1300 },
        { id: 'c_grp6',     kind: 'calc', args: [{ ticket: 'early', workshops: 0, groupSize: 6 }],    want: 1326 },
        { id: 'c_grp8ws1',  kind: 'calc', args: [{ ticket: 'standard', workshops: 1, groupSize: 8 }], want: 3298 },
      ],
      rework: {
        brief: 'The board revised two things: the workshop add-on is now EUR 50, and the group discount threshold moves from 6 to 4 registrations. Update the page and the calculator.',
        factOverrides: {
          fee_ws:  { holder: 'finance', text: 'Each workshop add-on now costs EUR 50 (revised).' },
          grp_min: { holder: 'sales', text: 'The group discount now applies from 4 registrations upward (revised).' },
        },
        assertionOverrides: {
          c_std_ws2:  { want: 510 },
          c_stu_ws1:  { want: 190 },
          c_grp5:     { want: 1105 },
          c_grp8ws1:  { want: 3128 },
        },
      },
    },
  },
};
