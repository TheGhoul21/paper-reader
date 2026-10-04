import { useState } from "react";

export function useUndo() {
  const [operation, setOperation] = useState<{ message: string; undo: () => void } | null>(null);
  return {
    operation,
    remember: (message: string, undo: () => void) => setOperation({ message, undo }),
    undo: () => {
      operation?.undo();
      setOperation(null);
    },
  };
}
export default function UndoNotice({ operation, undo }: ReturnType<typeof useUndo>) {
  return operation ? (
    <div className="undo-notice" role="status">
      <span>{operation.message}</span>
      <button onClick={undo}>Annulla</button>
    </div>
  ) : null;
}
