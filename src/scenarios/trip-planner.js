// Consumer domain. Pricing rules, opening hours and a seasonal closure sit with
// three different owners; the rework closes a venue, which forces both the
// itinerary and the budget function to change together.
export default {
  id: 'trip-planner',
  domain: 'consumer',
  fn: 'tripBudget',
  fnDoc: 'tripBudget({adults, children, days}) -> number (EUR, 2dp).',

  spec: `Build a single self-contained HTML page: a city trip plan.

REQUIRED STRUCTURE (ids are exact):
  #overview  — a section stating the city and the number of planned days
  #days      — a container with one .day-plan per planned day
  #stops     — each .day-plan holds a <ul> whose <li> are that day's stops
  #costs     — a <table> with one <tr> in <tbody> per cost line
  #notes     — a section stating any closure or seasonal restriction

REQUIRED SCRIPT:
  A <script> defining a global function tripBudget({adults, children, days})
  returning a number in EUR rounded to 2 decimals: for each day charge every
  traveller a transit pass, plus the museum entry once per adult and once per
  child at the child rate, and apply the family discount when the party matches
  the family rule.

Output ONE complete HTML document. No external assets, no CDN links.`,

  instances: {
    A: {
      brief: 'A three-day plan for Porto in October.',
      facts: [
        { id: 'city',      holder: 'destin',  text: 'The destination is Porto.' },
        { id: 'days',      holder: 'destin',  text: 'The plan covers 3 days.' },
        { id: 'transit',   holder: 'transit', text: 'A one-day transit pass costs EUR 9.60 per traveller.' },
        { id: 'museum_a',  holder: 'tickets', text: 'Museum entry is EUR 14 per adult.' },
        { id: 'museum_c',  holder: 'tickets', text: 'Museum entry is EUR 6 per child.' },
        { id: 'family',    holder: 'tickets', text: 'A family of 2 adults and 2 or more children gets 20 percent off the whole trip total.' },
        { id: 'hours',     holder: 'hours',   text: 'The museum is closed on Mondays.' },
        { id: 'season',    holder: 'hours',   text: 'The riverside tram does not run in October.' },
        { id: 'stops1',    holder: 'destin',  text: 'Day one covers Ribeira, Sao Bento and the Cathedral: 3 stops.' },
        { id: 'stops2',    holder: 'destin',  text: 'Day two covers the Museum, Clerigos and Livraria: 3 stops.' },
        { id: 'stops3',    holder: 'destin',  text: 'Day three covers Foz, the Crystal Palace gardens, Matosinhos and the market: 4 stops.' },
        { id: 'costline',  holder: 'transit', text: 'The cost table has 3 lines: transit passes, adult museum entry, child museum entry.' },
        { id: 'currency',  holder: 'tickets', text: 'All prices are in EUR.' },
        { id: 'walk',      holder: 'destin',  text: 'Day one is entirely walkable.' },
      ],
      distractors: [
        { id: 'x_transit', holder: 'tickets', text: 'The day pass is about EUR 7.50.',        flips: 'transit' },
        { id: 'x_family',  holder: 'transit', text: 'Family discount is 10 percent.',          flips: 'family' },
        { id: 'x_hours',   holder: 'destin',  text: 'The museum closes on Tuesdays.',          flips: 'hours' },
        { id: 'x_museum_c',holder: 'hours',   text: 'Children pay EUR 9 at the museum.',       flips: 'museum_c' },
      ],
      assertions: [
        { id: 'a_city',    kind: 'text', want: 'Porto' },
        { id: 'a_days',    kind: 'count', sel: '.day-plan', want: 3 },
        { id: 'a_d1',      kind: 'count', sel: '.day-plan:nth-of-type(1) li', want: 3 },
        { id: 'a_d3',      kind: 'count', sel: '.day-plan:nth-of-type(3) li', want: 4 },
        { id: 'a_costs',   kind: 'count', sel: '#costs tbody tr', want: 3 },
        { id: 'a_notes',   kind: 'exists', sel: '#notes' },
        { id: 'a_over',    kind: 'exists', sel: '#overview' },
        { id: 'a_monday',  kind: 'text', want: 'Monday' },
        { id: 'a_pass',    kind: 'text', anyOf: ['9.60', '9.6'] },
        { id: 'a_adult',   kind: 'text', want: '14' },
        { id: 'c_1a3d',    kind: 'calc', args: [{ adults: 1, children: 0, days: 3 }], want: 42.80 },
        { id: 'c_2a3d',    kind: 'calc', args: [{ adults: 2, children: 0, days: 3 }], want: 85.60 },
        { id: 'c_2a1c',    kind: 'calc', args: [{ adults: 2, children: 1, days: 3 }], want: 120.40 },
        { id: 'c_fam',     kind: 'calc', args: [{ adults: 2, children: 2, days: 3 }], want: 124.16 },
        { id: 'c_1d',      kind: 'calc', args: [{ adults: 1, children: 0, days: 1 }], want: 23.60 },
        { id: 'c_2a3c',    kind: 'calc', args: [{ adults: 2, children: 3, days: 3 }], want: 152.00 },
      ],
      rework: {
        brief: 'Two changes: the museum is closed for renovation for the whole month, so day two must be replaced by an alternative with 2 stops and the museum entry lines drop out of the cost table; and the transit pass rises to EUR 11.00.',
        factOverrides: {
          hours:    { holder: 'hours',   text: 'The museum is closed all month for renovation (revised): no museum entry at all.' },
          transit:  { holder: 'transit', text: 'A one-day transit pass now costs EUR 11.00 (revised).' },
          stops2:   { holder: 'destin',  text: 'Day two is replaced: Serralves gardens and Casa da Musica, 2 stops.' },
          costline: { holder: 'transit', text: 'The cost table now has 1 line: transit passes.' },
        },
        assertionOverrides: {
          a_costs: { want: 1 },
          a_pass:  { anyOf: ['11.00', '11'] },
          c_1a3d:  { want: 33.00 },
          c_2a3d:  { want: 66.00 },
          c_2a1c:  { want: 99.00 },
          c_fam:   { want: 105.60 },
          c_1d:    { want: 11.00 },
          c_2a3c:  { want: 132.00 },
        },
        addedAssertions: [
          { id: 'a_d2new', kind: 'count', sel: '.day-plan:nth-of-type(2) li', want: 2 },
          { id: 'a_reno',  kind: 'text', want: 'renovation' },
        ],
      },
    },

    B: {
      brief: 'A four-day plan for Ghent in March.',
      facts: [
        { id: 'city',      holder: 'destin',  text: 'The destination is Ghent.' },
        { id: 'days',      holder: 'destin',  text: 'The plan covers 4 days.' },
        { id: 'transit',   holder: 'transit', text: 'A one-day transit pass costs EUR 8.00 per traveller.' },
        { id: 'museum_a',  holder: 'tickets', text: 'Museum entry is EUR 16 per adult.' },
        { id: 'museum_c',  holder: 'tickets', text: 'Museum entry is EUR 5 per child.' },
        { id: 'family',    holder: 'tickets', text: 'A family of 2 adults and 2 or more children gets 25 percent off the whole trip total.' },
        { id: 'hours',     holder: 'hours',   text: 'The belfry is closed on Wednesdays.' },
        { id: 'season',    holder: 'hours',   text: 'Canal boats do not run before April.' },
        { id: 'stops1',    holder: 'destin',  text: 'Day one covers Gravensteen, Korenmarkt and Graslei: 3 stops.' },
        { id: 'stops2',    holder: 'destin',  text: 'Day two covers the Museum, Sint-Baafs and the Design museum: 3 stops.' },
        { id: 'stops3',    holder: 'destin',  text: 'Day three covers Patershol and the Citadelpark: 2 stops.' },
        { id: 'stops4',    holder: 'destin',  text: 'Day four covers Dok Noord, the STAM and the Watersportbaan: 3 stops.' },
        { id: 'costline',  holder: 'transit', text: 'The cost table has 3 lines: transit passes, adult museum entry, child museum entry.' },
        { id: 'currency',  holder: 'tickets', text: 'All prices are in EUR.' },
      ],
      distractors: [
        { id: 'x_transit', holder: 'tickets', text: 'The day pass in Ghent is EUR 6.',        flips: 'transit' },
        { id: 'x_family',  holder: 'transit', text: 'Family discount is 20 percent here.',     flips: 'family' },
        { id: 'x_days',    holder: 'hours',   text: 'The Ghent plan is 3 days.',               flips: 'days' },
        { id: 'x_museum_a',holder: 'hours',   text: 'Adults pay EUR 12 at the museum.',        flips: 'museum_a' },
      ],
      assertions: [
        { id: 'a_city',    kind: 'text', want: 'Ghent' },
        { id: 'a_days',    kind: 'count', sel: '.day-plan', want: 4 },
        { id: 'a_d1',      kind: 'count', sel: '.day-plan:nth-of-type(1) li', want: 3 },
        { id: 'a_d3',      kind: 'count', sel: '.day-plan:nth-of-type(3) li', want: 2 },
        { id: 'a_costs',   kind: 'count', sel: '#costs tbody tr', want: 3 },
        { id: 'a_notes',   kind: 'exists', sel: '#notes' },
        { id: 'a_over',    kind: 'exists', sel: '#overview' },
        { id: 'a_wed',     kind: 'text', want: 'Wednesday' },
        { id: 'a_pass',    kind: 'text', anyOf: ['8.00', '8'] },
        { id: 'a_adult',   kind: 'text', want: '16' },
        { id: 'c_1a4d',    kind: 'calc', args: [{ adults: 1, children: 0, days: 4 }], want: 48.00 },
        { id: 'c_2a4d',    kind: 'calc', args: [{ adults: 2, children: 0, days: 4 }], want: 96.00 },
        { id: 'c_2a1c',    kind: 'calc', args: [{ adults: 2, children: 1, days: 4 }], want: 133.00 },
        { id: 'c_fam',     kind: 'calc', args: [{ adults: 2, children: 2, days: 4 }], want: 127.50 },
        { id: 'c_1d',      kind: 'calc', args: [{ adults: 1, children: 0, days: 1 }], want: 24.00 },
        { id: 'c_2a3c',    kind: 'calc', args: [{ adults: 2, children: 3, days: 4 }], want: 155.25 },
      ],
      rework: {
        brief: 'Two changes: child museum entry rises to EUR 9, and the family discount now needs 3 or more children rather than 2.',
        factOverrides: {
          museum_c: { holder: 'tickets', text: 'Museum entry is now EUR 9 per child (revised).' },
          family:   { holder: 'tickets', text: 'A family of 2 adults and 3 or more children gets 25 percent off the whole trip total (revised).' },
        },
        assertionOverrides: {
          c_2a1c: { want: 137.00 },
          c_fam:  { want: 178.00 },
          c_2a3c: { want: 164.25 },
        },
      },
    },
  },
};
