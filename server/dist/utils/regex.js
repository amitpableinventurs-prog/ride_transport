"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeRegex = escapeRegex;
exports.searchRegex = searchRegex;
const MAX_SEARCH_LENGTH = 100;
/** Escapes text so it can be used inside a RegExp / $regex as plain characters (no regex injection or ReDoS). */
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Search box text turned into a safe $regex value: trimmed, length-capped and escaped. */
function searchRegex(value) {
    return escapeRegex(value.trim().slice(0, MAX_SEARCH_LENGTH));
}
//# sourceMappingURL=regex.js.map