"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_SEED = exports.ALL_PERMISSIONS = void 0;
exports.roleDisplayName = roleDisplayName;
exports.ALL_PERMISSIONS = [
    'dashboard.view',
    'admins.view',
    'admins.manage',
    'roles.view',
    'roles.manage',
    'audit_logs.view',
    'error_logs.view',
    'error_logs.manage',
    'settings.view',
    'settings.manage',
    'bookings.view',
    'bookings.manage',
    'users.view',
    'users.manage',
    'fleet.view',
    'fleet.manage',
    'finance.view',
    'finance.manage',
    'pricing.view',
    'pricing.manage',
    'marketing.view',
    'marketing.manage',
    'support.view',
    'support.manage',
    'reports.view',
];
exports.ROLE_SEED = [
    {
        key: 'super_admin',
        name: 'Super Admin',
        description: 'Full system access, configuration, users, finance and security.',
        permissions: [...exports.ALL_PERMISSIONS],
    },
    {
        key: 'operations_admin',
        name: 'Operations Admin',
        description: 'Bookings, riders, drivers, partners, fleet and live tracking.',
        permissions: ['dashboard.view', 'bookings.view', 'bookings.manage', 'users.view', 'users.manage', 'fleet.view', 'fleet.manage', 'reports.view'],
    },
    {
        key: 'finance_admin',
        name: 'Finance Admin',
        description: 'Payments, wallets, commissions, refunds and settlements.',
        permissions: ['dashboard.view', 'finance.view', 'finance.manage', 'pricing.view', 'reports.view'],
    },
    {
        key: 'support_admin',
        name: 'Support Admin',
        description: 'Customers, complaints, tickets, refunds and communication.',
        permissions: ['dashboard.view', 'users.view', 'support.view', 'support.manage', 'finance.view'],
    },
    {
        key: 'content_admin',
        name: 'Content/Admin Manager',
        description: 'Banners, offers, coupons, CMS and notification templates.',
        permissions: ['dashboard.view', 'marketing.view', 'marketing.manage'],
    },
];
const ROLE_NAME_BY_KEY = Object.fromEntries(exports.ROLE_SEED.map((r) => [r.key, r.name]));
function roleDisplayName(key) {
    return ROLE_NAME_BY_KEY[key] ?? key;
}
//# sourceMappingURL=roles.js.map