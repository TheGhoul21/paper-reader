import { useUserData, userDataStore } from "../lib/storage.ts";
import { downloadBackup } from "../lib/backup.ts";

export default function StorageStatus() {
  const { error, readFailed } = useUserData();
  if (!error) return null;
  return (
    <div className="storage-status" role="alert">
      <span>{error}</span>
      <button onClick={userDataStore.retry}>
        {readFailed ? "Riprova a leggere" : "Riprova a salvare"}
      </button>
      {!readFailed && <button onClick={downloadBackup}>Esporta backup</button>}
    </div>
  );
}
