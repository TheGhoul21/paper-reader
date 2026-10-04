import { useReducer } from "react";

export type NotesTab = "notes" | "map" | "guide";
export interface ReaderSession {
  activeId: string | null;
  notesOpen: boolean;
  tab: NotesTab;
  threadOnly: boolean;
  focusClaim: string | null;
  previousId: string | null;
}
type Action =
  | { type: "reveal"; id: string; inThread: boolean }
  | { type: "tab"; tab: NotesTab }
  | { type: "toggle-panel" }
  | { type: "toggle-thread" }
  | { type: "focus-claim"; id: string | null }
  | { type: "clear" }
  | { type: "back"; inThread: boolean };

/** All entrances to a passage share the same reveal rule. */
export function readerSessionReducer(state: ReaderSession, action: Action): ReaderSession {
  switch (action.type) {
    case "reveal":
      return {
        ...state,
        activeId: action.id,
        focusClaim: null,
        previousId: state.activeId !== action.id ? state.activeId : state.previousId,
        notesOpen: true,
        tab: "notes",
        threadOnly: state.threadOnly && action.inThread,
      };
    case "tab":
      return { ...state, tab: action.tab, notesOpen: true };
    case "toggle-panel":
      return { ...state, notesOpen: !state.notesOpen };
    case "toggle-thread":
      return { ...state, threadOnly: !state.threadOnly };
    case "focus-claim":
      return { ...state, focusClaim: action.id, tab: "map", notesOpen: true };
    case "clear":
      return { ...state, activeId: null };
    case "back":
      return state.previousId
        ? {
            ...state,
            activeId: state.previousId,
            focusClaim: null,
            previousId: state.activeId,
            notesOpen: true,
            tab: "notes",
            threadOnly: state.threadOnly && action.inThread,
          }
        : state;
  }
}

export function useReaderSession(notesOpen = true) {
  return useReducer(readerSessionReducer, {
    activeId: null,
    previousId: null,
    notesOpen,
    tab: "notes",
    threadOnly: false,
    focusClaim: null,
  });
}
