"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceCallStatus = exports.VoiceCallType = exports.Language = exports.PostFormat = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["GUEST"] = "GUEST";
    UserRole["SUBSCRIBER"] = "SUBSCRIBER";
    UserRole["REPORTER"] = "REPORTER";
    UserRole["REGIONAL_INCHARGE"] = "REGIONAL_INCHARGE";
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
var VoiceCallType;
(function (VoiceCallType) {
    VoiceCallType["INACTIVITY_FOLLOWUP"] = "INACTIVITY_FOLLOWUP";
    VoiceCallType["EVENT_CAMPAIGN"] = "EVENT_CAMPAIGN";
    VoiceCallType["INBOUND_SUPPORT"] = "INBOUND_SUPPORT";
})(VoiceCallType || (exports.VoiceCallType = VoiceCallType = {}));
var VoiceCallStatus;
(function (VoiceCallStatus) {
    VoiceCallStatus["QUEUED"] = "QUEUED";
    VoiceCallStatus["RINGING"] = "RINGING";
    VoiceCallStatus["IN_PROGRESS"] = "IN_PROGRESS";
    VoiceCallStatus["COMPLETED"] = "COMPLETED";
    VoiceCallStatus["BUSY"] = "BUSY";
    VoiceCallStatus["NO_ANSWER"] = "NO_ANSWER";
    VoiceCallStatus["FAILED"] = "FAILED";
})(VoiceCallStatus || (exports.VoiceCallStatus = VoiceCallStatus = {}));
