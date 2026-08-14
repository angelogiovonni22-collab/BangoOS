import { OrionCore } from "@/components/labs/orion-core/OrionCore";
import styles from "./orion-core.module.css";

export default function OrionCoreLabPage() {
  return (
    <main className={styles.page}>
      <OrionCore />
    </main>
  );
}
