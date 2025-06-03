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
exports.updateUserPermissions = exports.createNewUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const defaultPermissions = {
    canAccessTimeLog: true,
    canAccessPolicySearch: true,
    canAccessNextClearedBatch: false,
    canAccessWholeOfMarket: false,
    canAccessIntelligentMessaging: true,
    canAccessVisualisations: false,
    canAccessSummary: true,
    canAccessReports: false,
    canManageAdvisors: false,
    hasTopAccess: true,
};
// Using v2 onCall syntax for createNewUser
exports.createNewUser = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    }
    const callerUid = request.auth.uid;
    const usersCollection = admin.firestore().collection("users");
    const callerProfileDoc = await usersCollection
        .doc(callerUid)
        .get();
    if (!callerProfileDoc.exists ||
        ((_a = callerProfileDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Not authorized.");
    }
    const email = request.data.email;
    if (!(typeof email === "string") || email.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Email required.");
    }
    if (!email.endsWith("@clark.io")) {
        throw new https_1.HttpsError("invalid-argument", "Only @clark.io emails.");
    }
    try {
        const tempPassword = Math.random().toString(36).slice(-8);
        const newUserRecord = await admin.auth().createUser({
            email: email,
            emailVerified: false,
            password: tempPassword,
            disabled: false,
        });
        const newUserProfile = {
            email: newUserRecord.email,
            role: "member", // Line 80: Ensure no trailing space here
            permissions: defaultPermissions,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await usersCollection.doc(newUserRecord.uid).set(newUserProfile);
        return {
            message: `User ${email} created. UID: ${newUserRecord.uid}`,
            uid: newUserRecord.uid,
        };
    }
    catch (error) {
        console.error("Error creating new user:", error);
        if (error.code === "auth/email-already-exists") {
            throw new https_1.HttpsError("already-exists", "Email in use.");
        }
        throw new https_1.HttpsError("internal", "Internal error.");
    }
});
// Using v2 onCall syntax for updateUserPermissions
exports.updateUserPermissions = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Auth required for updating permissions.");
    }
    const callerUid = request.auth.uid;
    const usersCollection = admin.firestore().collection("users");
    const callerProfileDoc = await usersCollection.doc(callerUid).get();
    if (!callerProfileDoc.exists || ((_a = callerProfileDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Caller is not an admin and cannot update permissions.");
    }
    const { targetUid, newRole, newPermissions } = request.data;
    if (!targetUid || typeof targetUid !== "string") {
        throw new https_1.HttpsError("invalid-argument", "targetUid is required.");
    }
    if (!newRole || (newRole !== "admin" && newRole !== "member")) {
        throw new https_1.HttpsError("invalid-argument", "Valid newRole (admin/member) is required.");
    }
    if (typeof newPermissions !== "object" || newPermissions === null) {
        throw new https_1.HttpsError("invalid-argument", "newPermissions object is required.");
    }
    try {
        const targetUserDocRef = usersCollection.doc(targetUid);
        await targetUserDocRef.update({
            role: newRole,
            permissions: newPermissions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            message: `Permissions updated successfully for user ${targetUid}.`,
            uid: targetUid,
        };
    }
    catch (error) {
        console.error(`Error updating permissions for user ${targetUid}:`, error);
        throw new https_1.HttpsError("internal", `Failed to update permissions for user ${targetUid}.`);
    }
});
//# sourceMappingURL=index.js.map