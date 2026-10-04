import { userDataStore, useUserData } from "./storage";
import type { UserData } from "./userData";

export type ReadingPosition = NonNullable<UserData["reading"]>[string];
export function saveReadingPosition(slug: string, progress: Omit<ReadingPosition, "updatedAt">) {
  userDataStore.update((data) => ({
    ...data,
    reading: { ...data.reading, [slug]: { ...progress, updatedAt: new Date().toISOString() } },
  }));
}

/** Preferences share the recoverable store and backup with the user's reading work. */
export function useReaderPreferences() {
  const { data } = useUserData();
  const preferences = data.preferences ?? { fontSize: 16, panelWidth: 400 };
  const update = (patch: Partial<typeof preferences>) =>
    userDataStore.update((current) => ({
      ...current,
      preferences: { ...(current.preferences ?? { fontSize: 16, panelWidth: 400 }), ...patch },
    }));
  return {
    ...preferences,
    setFontSize: (fontSize: number) => update({ fontSize }),
    setPanelWidth: (panelWidth: number) => update({ panelWidth }),
  };
}
