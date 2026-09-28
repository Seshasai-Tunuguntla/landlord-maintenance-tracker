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

function detectPriority(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const isUrgent = URGENT_KEYWORDS.some((keyword) => text.includes(keyword));
  return isUrgent ? 'URGENT' : 'NORMAL';
}

module.exports = { detectPriority, URGENT_KEYWORDS };
