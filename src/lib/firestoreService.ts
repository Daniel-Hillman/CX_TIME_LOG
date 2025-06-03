
// src/lib/firestoreService.ts
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Advisor, AdvisorPermissions } from "../types";

// Function to get default permissions for a new advisor
export const getDefaultPermissions = (): AdvisorPermissions => ({
  canAccessTimeLog: true,
  canAccessPolicySearch: true,
  canAccessNextClearedBatch: true,
  canAccessWholeOfMarket: true,
  canAccessIntelligentMessaging: true,
  canAccessVisualisations: false,
  canAccessSummary: false,
  canAccessReports: false,
  canManageAdvisors: false,
  hasTopAccess: false, // Default 'hasTopAccess' to false
});

// 1. Fetch an advisor's full document, including permissions
export const getAdvisor = async (advisorId: string): Promise<Advisor | null> => {
  const advisorRef = doc(db, "advisors", advisorId);
  const advisorSnap = await getDoc(advisorRef);
  if (advisorSnap.exists()) {
    const data = advisorSnap.data();
    return {
      id: advisorSnap.id,
      ...data,
      // Ensure permissions object exists, applying defaults if not
      permissions: data.permissions ? { ...getDefaultPermissions(), ...data.permissions } : getDefaultPermissions(),
    } as Advisor;
  } else {
    console.log("No such advisor document!", advisorId);
    return null;
  }
};

// Fetch advisor by firebaseUid
export const getAdvisorByFirebaseUid = async (uid: string): Promise<Advisor | null> => {
  const q = query(collection(db, "advisors"), where("firebaseUid", "==", uid));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      permissions: data.permissions ? { ...getDefaultPermissions(), ...data.permissions } : getDefaultPermissions(),
    } as Advisor;
  }
  return null;
};


// 2. Add a new advisor with initial data and default permissions
export const addAdvisor = async (
  advisorData: Pick<Advisor, 'name' | 'email' | 'addedByAdminUid'>,
  initialPermissions?: Partial<AdvisorPermissions>
): Promise<string> => {
  const newAdvisorRef = collection(db, "advisors");
  const defaultPermissions = getDefaultPermissions();
  let permissions: AdvisorPermissions = {
    ...defaultPermissions,
    ...initialPermissions, // Apply any explicitly passed initial permissions
  };

  // If hasTopAccess is explicitly set to true during creation, grant all.
  // Otherwise, individual permissions or defaults apply.
  if (permissions.hasTopAccess === true) {
    Object.keys(permissions).forEach(key => {
      (permissions as any)[key] = true;
    });
  }

  const newAdvisorDoc = {
    ...advisorData,
    status: 'pending', // Default status
    permissions, // Use the computed permissions
  };
  const docRef = await addDoc(newAdvisorRef, newAdvisorDoc);
  return docRef.id;
};

// 3. Update an advisor's permissions
export const updateAdvisorPermissions = async (
  targetAdvisorId: string,
  newPermissions: Partial<AdvisorPermissions>
): Promise<void> => {
  const advisorRef = doc(db, "advisors", targetAdvisorId);
  const advisor = await getAdvisor(targetAdvisorId); // Fetches current advisor data including permissions

  if (!advisor) {
    throw new Error(`Advisor not found with ID: ${targetAdvisorId}`);
  }

  // Start with existing permissions, then overlay the new ones.
  let updatedPermissions: AdvisorPermissions = {
    ...(advisor.permissions || getDefaultPermissions()), // Ensure existing permissions is an object
    ...newPermissions,
  };


  // Special handling for hasTopAccess:
  // If hasTopAccess is being set to true, grant all other permissions.
  if (newPermissions.hasTopAccess === true) {
    Object.keys(updatedPermissions).forEach(key => {
      (updatedPermissions as any)[key] = true;
    });
  } else if (newPermissions.hasTopAccess === false) {
    // If hasTopAccess is explicitly set to false, ensure it's false.
    // Other permissions retain their values from the merge, or become default if 'hasTopAccess' was true before.
    // This requires careful thought: if unchecking hasTopAccess, should other perms revert to defaults or last individual settings?
    // For now, if hasTopAccess becomes false, other permissions keep their current newPermissions value or existing value.
    // If you want to reset other permissions to default when hasTopAccess is unchecked, that logic needs to be added here.
    // A simpler model might be: if hasTopAccess is false, the other toggles matter. If true, they are all overridden to true.
    updatedPermissions.hasTopAccess = false;
    // To ensure default non-admin permissions apply if hasTopAccess is turned off:
    const defaultPerms = getDefaultPermissions();
    for (const key in defaultPerms) {
        if (key !== 'hasTopAccess' && newPermissions[key as keyof AdvisorPermissions] === undefined) {
             // If a specific permission wasn't part of this update, and hasTopAccess is now false,
             // ensure it's not stuck on 'true' from a previous 'hasTopAccess=true' state.
             // It should revert to its individual toggle state or default.
             // The current merged 'updatedPermissions[key]' would reflect any individual toggles made in the same batch as unchecking hasTopAccess.
             // If no individual toggle was made for 'key', it would retain its value from before 'hasTopAccess' was toggled.
             // This can be complex. The most straightforward is: if newPermissions.hasTopAccess is false,
             // then updatedPermissions will reflect any other specific toggles in newPermissions, or current state for others.
        }
    }
  }
  // If newPermissions.hasTopAccess is undefined, it means the 'Top Access' toggle wasn't changed in this specific update operation.
  // Its value in updatedPermissions will be from advisor.permissions.

  await updateDoc(advisorRef, { permissions: updatedPermissions });
};

// Function to get all advisors (useful for the Manage Advisors tab)
export const getAllAdvisors = async (): Promise<Advisor[]> => {
  const advisorsCol = collection(db, "advisors");
  const advisorSnapshot = await getDocs(advisorsCol);
  const advisorList = advisorSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      permissions: data.permissions ? { ...getDefaultPermissions(), ...data.permissions } : getDefaultPermissions(),
    } as Advisor;
  });
  return advisorList;
};
