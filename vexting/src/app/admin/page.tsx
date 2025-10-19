import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { AdminShell } from "@/components/layout/AdminShell";

export default function AdminPage() {
  return (
    <AdminShell>
      <AdminDashboard />
    </AdminShell>
  );
}
