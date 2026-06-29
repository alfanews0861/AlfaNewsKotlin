"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../.env') });
const genAI = new genai_1.GoogleGenAI({
    apiKey: process.env.FREE_GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || "",
    apiVersion: "v1beta"
});
async function listModels() {
    try {
        // The SDK doesn't have a direct listModels, but we can try to hit the REST endpoint or use a known model.
        console.log("Checking gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-1.5-flash is available");
    }
    catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }
    try {
        console.log("Checking gemini-3.1-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-3.1-flash is available");
    }
    catch (e) {
        console.error("Error with gemini-3.1-flash:", e.message);
    }
}
listModels();
//# sourceMappingURL=list_models.js.map