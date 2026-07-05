"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Language = exports.PostFormat = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["GUEST"] = "GUEST";
    UserRole["SUBSCRIBER"] = "SUBSCRIBER";
    UserRole["REPORTER"] = "REPORTER";
    UserRole["EDITOR"] = "EDITOR";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["NEWS_DESK"] = "NEWS_DESK";
})(UserRole || (exports.UserRole = UserRole = {}));
var PostFormat;
(function (PostFormat) {
    PostFormat["VERTICAL"] = "9:16";
    PostFormat["HORIZONTAL"] = "16:9";
})(PostFormat || (exports.PostFormat = PostFormat = {}));
var Language;
(function (Language) {
    Language["TELUGU"] = "te";
    Language["ENGLISH"] = "en";
})(Language || (exports.Language = Language = {}));
//# sourceMappingURL=types.js.map