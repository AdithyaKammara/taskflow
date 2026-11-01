/** Lookups for the fixed reference data (team members, statuses). */
import { STATUSES, TEAM } from '../config';

export const member = (id: unknown) => TEAM.find((m) => m.id === id);

export const nameOf = (id: string) => (member(id) || { name: 'Unassigned' }).name;

export const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label || id;
