"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Users, Phone, MapPin,
  Building2, ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getMasterList,
  createMasterItem,
  updateMasterItem,
  deleteMasterItem,
} from "@/lib/master-data";
import type { Customer, CustomerFormData } from "@/types";
import { cn } from "@/lib/utils";

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────

const schema = z.object({
  name:    z.string().min(1, "Name is required").max(100),
  initial: z.string().min(1, "Initial is required").max(10, "Max 10 characters").toUpperCase(),
  address: z.string().max(255).optional().or(z.literal("")),
  phone:   z.string().max(30).optional().or(z.literal("")),
  city:    z.string().max(100).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

// ─── SORT TYPES ───────────────────────────────────────────────────────────────

type SortKey = "name" | "initial" | "city" | "createdAt";
type SortDir = "asc" | "desc";

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search & sort
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ── Load ───────────────────────────────────────────────────────────────────
  async function load() {
    setLoadingData(true);
    try {
      const data = await getMasterList<Customer>("customers");
      setCustomers(data);
    } catch {
      toast.error("Failed to load customers.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  // ── Open add modal ─────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "", address: "", phone: "", city: "" });
    setModalOpen(true);
  }

  // ── Open edit modal ────────────────────────────────────────────────────────
  function openEdit(c: Customer) {
    setEditTarget(c);
    reset({
      name: c.name,
      initial: c.initial,
      address: c.address ?? "",
      phone: c.phone ?? "",
      city: c.city ?? "",
    });
    setModalOpen(true);
  }

  // ── Save (create or update) ────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload: CustomerFormData = {
        name:    values.name.trim(),
        initial: values.initial.trim().toUpperCase(),
        address: values.address?.trim() || undefined,
        phone:   values.phone?.trim()   || undefined,
        city:    values.city?.trim()    || undefined,
      };

      if (editTarget) {
        await updateMasterItem<Customer>("customers", editTarget.id, payload);
        toast.success(`"${payload.name}" updated.`);
      } else {
        await createMasterItem<Customer>("customers", payload);
        toast.success(`"${payload.name}" added.`);
      }
      setModalOpen(false);
      await load();
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMasterItem("customers", deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Sort toggle ────────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.initial.toLowerCase().includes(q) ||
            (c.city ?? "").toLowerCase().includes(q)
        )
      : customers;

    return [...filtered].sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [customers, search, sort]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc"
      ? <ChevronUp size={12} className="text-brand-400" />
      : <ChevronDown size={12} className="text-brand-400" />;
  }

  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">
        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">
              {loadingData ? "Loading…" : `${customers.length} record${customers.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={15} />
            Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, initial, or city…"
            className="max-w-sm"
          />
        </div>

        {/* Table card */}
        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading customers…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              Icon={Users}
              title={search ? "No results found" : "No customers yet"}
              description={search ? "Try a different search term." : "Add your first customer to get started."}
              action={
                !search ? (
                  <button onClick={openAdd} className="btn-primary">
                    <Plus size={14} /> Add Customer
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {(
                      [
                        { key: "name" as SortKey,      label: "Name",    w: "" },
                        { key: "initial" as SortKey,   label: "Initial", w: "w-28" },
                        { key: "city" as SortKey,      label: "City",    w: "w-36" },
                        { key: null,                   label: "Phone",   w: "w-36" },
                        { key: "createdAt" as SortKey, label: "Created", w: "w-32" },
                        { key: null,                   label: "",        w: "w-20" },
                      ] as { key: SortKey | null; label: string; w: string }[]
                    ).map(({ key, label, w }) => (
                      <th key={label} className={w}>
                        {key ? (
                          <button
                            onClick={() => toggleSort(key)}
                            className="flex items-center gap-1.5 group hover:text-white transition-colors"
                          >
                            {label}
                            <SortIcon col={key} />
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-600/10 border border-brand-600/20 flex items-center justify-center shrink-0">
                            <span className="text-brand-400 text-xs font-bold">{c.initial.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{c.name}</p>
                            {c.address && (
                              <p className="text-slate-500 text-xs truncate max-w-[200px]">{c.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue font-mono">{c.initial}</span>
                      </td>
                      <td>
                        {c.city ? (
                          <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                            <MapPin size={12} className="text-slate-500 shrink-0" />
                            {c.city}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        {c.phone ? (
                          <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                            <Phone size={12} className="text-slate-500 shrink-0" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-slate-500 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(c)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results count */}
        {search && !loadingData && (
          <p className="text-slate-500 text-xs mt-3">
            {displayed.length} of {customers.length} results
          </p>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ─────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Customer" : "Add Customer"}
        description={editTarget ? `Editing: ${editTarget.name}` : "Fill in the details below."}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Row 1: Name + Initial */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                {...register("name")}
                placeholder="PT. Example Indonesia"
                className={cn("input-base", errors.name && "border-red-500")}
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">
                Initial <span className="text-red-400">*</span>
              </label>
              <input
                {...register("initial")}
                placeholder="EXI"
                className={cn("input-base uppercase", errors.initial && "border-red-500")}
                style={{ textTransform: "uppercase" }}
              />
              {errors.initial && <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>}
            </div>
          </div>

          {/* Row 2: City + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">City</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  {...register("city")}
                  placeholder="Jakarta"
                  className="input-base pl-9"
                />
              </div>
            </div>
            <div>
              <label className="form-label">Phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  {...register("phone")}
                  placeholder="+62 21 555 0000"
                  className="input-base pl-9"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Address */}
          <div>
            <label className="form-label">Address</label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
              <textarea
                {...register("address")}
                placeholder="Jl. Sudirman No.1, Jakarta Pusat"
                rows={2}
                className="input-base pl-9 resize-none"
              />
            </div>
          </div>

          {/* ID display when editing (read-only) */}
          {editTarget && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <p className="text-slate-500 text-xs">
                <span className="text-slate-600">ID:</span>{" "}
                <span className="font-mono">{editTarget.id}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {editTarget ? "Save Changes" : "Add Customer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Customer"
      />
    </RouteGuard>
  );
}
