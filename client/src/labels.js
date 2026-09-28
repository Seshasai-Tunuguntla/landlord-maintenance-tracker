export const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

export const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
export const STATUS_LABELS = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };

export function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
