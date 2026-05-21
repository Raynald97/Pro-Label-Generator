"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { 
  Users, UserPlus, Shield, Mail, User, 
  Edit2, Trash2, X, RefreshCw 
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { getUsers, createUser, updateUser, deleteUser, type AppUser } from "@/lib/users";

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function RoleBadge({ role }: { role: AppUser["role"] }) {
  const styles = {
    admin: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    operator: "bg-brand-500/10 border-brand-500/20 text-brand-400",
    viewer: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  };
  return (
    <span className={cn("badge gap-1 capitalize", styles[role] || styles.viewer)}>
      <Shield size={10} /> {role}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function UserSetupPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<AppUser> | null>(null);
  const [saving, setSaving] = useState(false);

  // --- LOAD DATA DARI FIREBASE ------------------------------------------------
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      toast.error("Gagal memuat daftar user dari database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // --- FILTER PENCARIAN -------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.displayName.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // --- FUNGSI SIMPAN & EDIT (FIREBASE) ----------------------------------------
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    try {
      if (editingUser.id) {
        // Edit Mode (Password diabaikan saat edit)
        await updateUser(editingUser.id, {
          displayName: editingUser.displayName,
          email: editingUser.email,
          role: editingUser.role as any,
          status: editingUser.status as any,
        });
        toast.success("User berhasil diperbarui.");
      } else {
        // Create Mode (Kirim semua data, termasuk password)
        await createUser({
          displayName: editingUser.displayName || "",
          email: editingUser.email || "",
          password: (editingUser as any).password || "", // 👈 KITA KIRIM PASSWORD KE FIREBASE AUTH
          role: (editingUser.role as any) || "operator",
          status: (editingUser.status as any) || "active",
        });
        toast.success("User baru beserta akun login berhasil ditambahkan.");
      }
      setModalOpen(false);
      loadUsers(); // Refresh tabel
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error("Email ini sudah terdaftar di Firebase.");
      } else {
        toast.error("Gagal menyimpan user.");
      }
    } finally {
      setSaving(false);
    }
  };

  // --- FUNGSI HAPUS (FIREBASE) ------------------------------------------------
  const handleDeleteUser = async (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus akses untuk ${name}?`)) {
      try {
        await deleteUser(id);
        toast.success(`User ${name} berhasil dihapus.`);
        loadUsers();
      } catch {
        toast.error("Gagal menghapus user.");
      }
    }
  };

  return (
    <RouteGuard requiredPage="users">
      <div className="flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="page-header shrink-0">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Users className="text-brand-500" size={24} /> User Setup
            </h1>
            <p className="page-subtitle text-slate-400 mt-1">Kelola akses dan hak prerogatif pengguna aplikasi</p>
          </div>
          <button 
            onClick={() => { setEditingUser({ role: "operator", status: "active" }); setModalOpen(true); }}
            className="btn-primary py-2.5 text-sm"
          >
            <UserPlus size={16} /> Tambah User
          </button>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <SearchInput 
            value={search} 
            onChange={setSearch} 
            placeholder="Cari nama atau email..." 
            className="max-w-md"
          />
          <button onClick={loadUsers} disabled={loading} className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-slate-800 rounded-lg">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Table Card */}
        <div className="card flex-1 overflow-hidden flex flex-col bg-slate-900/50 border border-slate-800">
          <div className="overflow-auto flex-1">
            <table className="data-table w-full text-left">
              <thead className="bg-slate-900 sticky top-0 z-10">
                <tr className="text-slate-400 text-xs tracking-wider">
                  <th className="p-4 font-semibold w-1/3">USER INFO</th>
                  <th className="p-4 font-semibold text-center w-32">ROLE</th>
                  <th className="p-4 font-semibold text-center w-32">STATUS</th>
                  <th className="p-4 font-semibold w-40 text-center">TGL DIBUAT</th>
                  <th className="p-4 text-right w-24">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center text-slate-500"><RefreshCw className="animate-spin inline-block mr-2" size={18} /> Memuat data user...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState Icon={Users} title="User tidak ditemukan" description={search ? "Coba kata kunci pencarian lain." : "Belum ada user yang ditambahkan."} /></td></tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                            <User size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{u.displayName}</div>
                            <div className="text-slate-500 text-xs flex items-center gap-1.5 truncate mt-0.5"><Mail size={11} /> {u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center"><RoleBadge role={u.role} /></td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border",
                          u.status === "active" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", u.status === "active" ? "bg-emerald-500" : "bg-red-500")} />
                          {u.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-sm font-mono text-center">{fmtDate(u.createdAt)}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingUser(u); setModalOpen(true); }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Edit User"><Edit2 size={15} /></button>
                          <button onClick={() => handleDeleteUser(u.id, u.displayName)} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Hapus User"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL TAMBAH/EDIT USER (CENTERED) ------------------------------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {editingUser?.id ? <Edit2 size={18} className="text-brand-400" /> : <UserPlus size={18} className="text-brand-400" />}
                {editingUser?.id ? "Edit User" : "Tambah User Baru"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
                <input 
                  required
                  type="text" 
                  value={editingUser?.displayName || ""}
                  onChange={e => setEditingUser(p => ({...p!, displayName: e.target.value}))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                  placeholder="Misal: Budi Santoso"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input 
                  required
                  type="email" 
                  value={editingUser?.email || ""}
                  onChange={e => setEditingUser(p => ({...p!, email: e.target.value}))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                  placeholder="name@company.com"
                  disabled={!!editingUser?.id} // Tidak bisa edit email
                />
              </div>

              {/* 👇 INPUT PASSWORD (Hanya tampil jika membuat user baru) 👇 */}
              {!editingUser?.id && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password Baru</label>
                  <input 
                    required
                    type="password" 
                    value={(editingUser as any)?.password || ""}
                    onChange={e => setEditingUser(p => ({...p!, password: e.target.value} as any))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hak Akses (Role)</label>
                  <select 
                    value={editingUser?.role || "operator"}
                    onChange={e => setEditingUser(p => ({...p!, role: e.target.value as any}))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Akun</label>
                  <select 
                    value={editingUser?.status || "active"}
                    onChange={e => setEditingUser(p => ({...p!, status: e.target.value as any}))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="active">Active (Aktif)</option>
                    <option value="inactive">Inactive (Mati)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="btn-secondary flex-1 py-2.5">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
                  {saving ? <RefreshCw size={16} className="animate-spin inline-block" /> : "Simpan User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}