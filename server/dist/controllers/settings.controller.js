"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
const Settings_1 = require("../models/Settings");
const audit_1 = require("../utils/audit");
const settings_1 = require("../utils/settings");
async function getOrCreateSettings() {
    const existing = await Settings_1.Settings.findOne({ singleton: 'platform' });
    if (existing)
        return existing;
    return Settings_1.Settings.create({ singleton: 'platform' });
}
async function getSettings(_req, res) {
    res.json(await getOrCreateSettings());
}
async function updateSettings(req, res) {
    const settings = await getOrCreateSettings();
    const body = req.body;
    const allowedKeys = [
        'platformName',
        'supportEmail',
        'supportPhone',
        'defaultCurrency',
        'defaultCountry',
        'rideServiceEnabled',
        'transportServiceEnabled',
        'maintenanceMode',
        'otpExpiryMinutes',
        'adminLoginOtpEnabled',
        'accessTokenTtlMinutes',
        'refreshTokenTtlDays',
        'dispatchRadiusKm',
        'riderRequestTimeoutSeconds',
        'maxDispatchAttempts',
        'scheduleLeadMinutes',
        'freeCancellationMinutes',
        'freeWaitingMinutes',
        'selfieCheckIntervalHours',
        'maxCashDues',
        'minWithdrawalAmount',
        'customerAppMinVersion',
        'riderAppMinVersion',
    ];
    const mutableSettings = settings;
    for (const key of allowedKeys) {
        if (body[key] !== undefined) {
            mutableSettings[key] = body[key];
        }
    }
    await settings.save();
    (0, settings_1.invalidateSettingsCache)();
    await (0, audit_1.recordAudit)(req.admin, 'settings.updated', 'PlatformSettings', 'Platform Settings');
    res.json(settings);
}
//# sourceMappingURL=settings.controller.js.map