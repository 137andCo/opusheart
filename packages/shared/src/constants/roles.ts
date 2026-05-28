import type { UserRole } from '../types/user.js';
import { ROLE_HIERARCHY } from '../types/user.js';

export const ALL_ROLES: UserRole[] = ['admin', 'pastor', 'leader', 'member', 'visitor'];

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isAtLeast(userRole: UserRole, minimumRole: UserRole): boolean {
  return hasPermission(userRole, minimumRole);
}

export const ROLE_LABELS: Record<string, Record<UserRole, string>> = {
  church: {
    admin: 'Administrator',
    pastor: 'Pastor',
    leader: 'Ministry Leader',
    member: 'Member',
    visitor: 'Visitor',
  },
  community: {
    admin: 'Administrator',
    pastor: 'Director',
    leader: 'Coordinator',
    member: 'Member',
    visitor: 'Visitor',
  },
  nonprofit: {
    admin: 'Administrator',
    pastor: 'Executive Director',
    leader: 'Program Lead',
    member: 'Volunteer',
    visitor: 'Visitor',
  },
};
