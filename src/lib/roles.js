// Role vocabulary for the hand-written scenarios' holders. Near-miss and noise
// cards in the directory draw from the same terms on purpose: a directory whose
// distractors are obviously irrelevant tests nothing.
//
// This table lives in its own module so that a scenario generator can read it
// without importing directory.js: directory.js imports the scenarios, so a
// scenario importing directory.js back would be a circular import.
export const HOLDER_ROLE = {
  venue:   { name: 'Venue Operations',      tags: ['venue', 'capacity', 'facilities', 'events'] },
  program: { name: 'Programme Committee',   tags: ['programme', 'tracks', 'schedule', 'events'] },
  finance: { name: 'Registration Finance',  tags: ['pricing', 'fees', 'finance', 'billing'] },
  sales:   { name: 'Group Sales',           tags: ['pricing', 'discounts', 'groups', 'sales'] },
  access:  { name: 'Accessibility Lead',    tags: ['accessibility', 'captioning', 'inclusion'] },
  visa:    { name: 'Travel and Visa Desk',  tags: ['visa', 'travel', 'letters', 'logistics'] },
  ops:     { name: 'Run Operations',        tags: ['runs', 'operations', 'experiments'] },
  data:    { name: 'Measurement Data',      tags: ['data', 'measurements', 'datasets'] },
  metrics: { name: 'Metric Definitions',    tags: ['metrics', 'definitions', 'evaluation'] },
  thresh:  { name: 'Threshold Policy',      tags: ['thresholds', 'cutoffs', 'policy', 'metrics'] },
  destin:  { name: 'Destination Research',  tags: ['destination', 'itinerary', 'travel'] },
  transit: { name: 'Transit Pricing',       tags: ['transit', 'pricing', 'passes', 'travel'] },
  tickets: { name: 'Ticketing and Rates',   tags: ['tickets', 'pricing', 'discounts', 'family'] },
  hours:   { name: 'Opening Hours Desk',    tags: ['hours', 'closures', 'seasonal', 'venues'] },
};
