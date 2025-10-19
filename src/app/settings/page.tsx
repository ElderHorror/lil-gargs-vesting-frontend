import { SettingsView } from "@/components/sections/SettingsView";
import { AdminShell } from "@/components/layout/AdminShell";

export default function SettingsPage() {
  return (
    <AdminShell>
      <SettingsView />
    </AdminShell>
  );
}
