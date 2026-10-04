import { useSyncExternalStore } from "react";
import { ANNOTATIONS_PREFIX, LEGACY_REVIEW_KEY, USER_DATA_KEY, UserDataStore } from "./userData.ts";

export const userDataStore = new UserDataStore(() => localStorage);
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      event.key === USER_DATA_KEY ||
      event.key === LEGACY_REVIEW_KEY ||
      event.key?.startsWith(ANNOTATIONS_PREFIX)
    )
      userDataStore.reload();
  });
}
export function useUserData() {
  return useSyncExternalStore(
    userDataStore.subscribe,
    userDataStore.getSnapshot,
    userDataStore.getSnapshot,
  );
}
