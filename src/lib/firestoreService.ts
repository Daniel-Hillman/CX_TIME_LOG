// src/lib/firestoreService.ts
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase"; // Assuming this path is correct from src/lib/firestoreService.ts
import type { Advisor, AdvisorPermissions } from "../types"; // Assuming path from src/lib/

// Function to get default permissions for a new advisor
const getDefaultPermissions = (): AdvisorPermissions => ({
  canAccessTimeLog: true,
  canAccessPolicySearch: true,
  canAccessNextClearedBatch: true,
  canAccessWholeOfMarket: true,
  canAccessIntelligentMessaging: true,
  canAccessVisualisations: false,
  canAccessSummary: false,
  canAccessReports: false,
  canManageAdvisors: false,
  hasTopAccess: false,
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
      permissions: data.permissions || getDefaultPermissions(), // Fallback if permissions don't exist
    } as Advisor;
  } else {
    console.log("No such advisor document!", advisorId);
    return null;
  }
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
    ...initialPermissions,
  };

  if (permissions.hasTopAccess) {
    Object.keys(permissions).forEach(key => {
      (permissions as any)[key] = true;
    });
  }

  const newAdvisorDoc = {
    ...advisorData,
    status: 'pending', // Default status
    permissions,
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
  const advisor = await getAdvisor(targetAdvisorId);

  if (!advisor) {
    throw new Error(`Advisor not found with ID: ${targetAdvisorId}`);
  }

  let updatedPermissions: AdvisorPermissions = {
    ...advisor.permissions, // Start with existing permissions
    ...newPermissions,    // Override with any new ones specified
  };

  if (newPermissions.hasTopAccess === true) {
    Object.keys(updatedPermissions).forEach(key => {
      (updatedPermissions as any)[key] = true;
    });
  } else if (newPermissions.hasTopAccess === false) {
    // Only set hasTopAccess to false, other permissions retain their merged values
    updatedPermissions.hasTopAccess = false;
  }
  // If newPermissions.hasTopAccess is undefined, its existing value (potentially changed by individual toggles) is kept.

  await updateDoc(advisorRef, { permissions: updatedPermissions });
};

// Function to get all advisors (useful for the Manage Advisors tab)
export const getAllAdvisors = async (): Promise<Advisor[]> => {
  const advisorsCol = collection(db, "advisors");
  const advisorSnapshot = await getDocs(advisorsCol);
  const advisorList = advisorSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Ensure permissions object exists, applying defaults if not (for backward compatibility)
      permissions: data.permissions ? { ...getDefaultPermissions(), ...data.permissions } : getDefaultPermissions(),
    } as Advisor;
  });
  return advisorList;
};
