const URGENT_KEYWORDS = [
  'no heat',
  'no hot water',
  'gas smell',
  'gas leak',
  'smell of gas',
  'flooding',
  'flood',
  'burst pipe',
  'water leak',
  'ceiling collapse',
  'electrical fire',
  'sparking outlet',
  'no power',
  'carbon monoxide',
  'smoke detector',
  'break-in',
  'broken lock',
];

const SELECTABLE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// Tenant picks LOW/MEDIUM/HIGH; urgent keywords always override to URGENT.
function detectPriority(title, description, requestedPriority) {
  const text = `${title} ${description}`.toLowerCase();
  const isUrgent = URGENT_KEYWORDS.some((keyword) => text.includes(keyword));
  if (isUrgent) return 'URGENT';
  return SELECTABLE_PRIORITIES.includes(requestedPriority) ? requestedPriority : 'MEDIUM';
}

module.exports = { detectPriority, URGENT_KEYWORDS, SELECTABLE_PRIORITIES };
