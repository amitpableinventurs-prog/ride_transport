"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesDeclaredType = matchesDeclaredType;
const fs_1 = __importDefault(require("fs"));
// A browser or app sets the MIME type itself, so it can be faked. Check the first bytes of the saved file as well.
const SIGNATURES = {
    'image/jpeg': (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
    'image/png': (h) => h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (h) => h.subarray(0, 4).toString('latin1') === 'RIFF' && h.subarray(8, 12).toString('latin1') === 'WEBP',
    'application/pdf': (h) => h.subarray(0, 5).toString('latin1') === '%PDF-',
};
/** True when the saved file really starts like the type it claims to be. */
function matchesDeclaredType(file) {
    const check = SIGNATURES[file.mimetype];
    if (!check)
        return false;
    const fd = fs_1.default.openSync(file.path, 'r');
    try {
        const head = Buffer.alloc(16);
        fs_1.default.readSync(fd, head, 0, 16, 0);
        return check(head);
    }
    finally {
        fs_1.default.closeSync(fd);
    }
}
//# sourceMappingURL=fileSignature.js.map