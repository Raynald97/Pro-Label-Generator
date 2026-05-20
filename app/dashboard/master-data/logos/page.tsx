"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Image as ImageIcon, UploadCloud, X,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import { storage } from "@/lib/firebase"; // Pastikan path ini sesuai
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
import type { Logo } from "@/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  initial: z.string().min(1, "Initial is required").max(10, "Max 10 characters").transform((v) => v.toUpperCase()),
});
type FormValues = z.infer<typeof schema>;

type SortKey = "name" | "initial" | "createdAt";
type SortDir = "asc" | "desc";

// MAX FILE SIZE: 3 MB
const MAX_FILE_SIZE = 3 * 1024 * 1024; 

export default function LogosPage() {
  const [logos, setLogos] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // State khusus untuk upload gambar
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function load() {
    setLoadingData(true);
    try {
      setLogos(await getMasterList<any>("logos"));
    } catch {
      toast.error("Failed to load logos.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "" });
    setSelectedFile(null);
    setPreviewUrl(null);
    setModalOpen(true);
  }

  function openEdit(l: any) {
    setEditTarget(l);
    reset({ name: l.name, initial: l.initial });
    setSelectedFile(null);
    setPreviewUrl(l.imageUrl || null); // Load gambar lama jika ada
    setModalOpen(true);
  }

  // Handle pemilihan file
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large! Maximum size is 3MB.");
      e.target.value = ""; // Reset input
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      let finalImageUrl = editTarget?.imageUrl || "";

      // 1. If there is a new file, upload to ImgBB instead of Firebase
      if (selectedFile) {
        toast.info("Uploading image...");
        
        const formData = new FormData();
        formData.append("image", selectedFile);
        
        // PASTE YOUR IMGBB API KEY HERE
        const apiKey = "316aa45467aca59f6394259540ee4511"; 
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: formData,
        });
        
        const data = await response.json();
        
        if (data.success) {
          finalImageUrl = data.data.url; // Get the direct image URL from ImgBB
        } else {
          throw new Error("Failed to upload image to ImgBB.");
        }
      }

      // 2. Save the data (text + image url) to Firestore Database
      const payload = {
        name: values.name.trim(),
        initial: values.initial.trim().toUpperCase(),
        imageUrl: finalImageUrl,
      };

      if (editTarget) {
        await updateMasterItem("logos", editTarget.id, payload);
        toast.success(`"${payload.name}" updated.`);
      } else {
        await createMasterItem("logos", payload);
        toast.success(`"${payload.name}" added.`);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Save failed. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Catatan: Idealnya file gambar di Storage juga ikut dihapus, 
      // tapi untuk simplifikasi kita hapus data di Firestore saja dulu.
      await deleteMasterItem("logos", deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? logos.filter((l) => l.name.toLowerCase().includes(q) || l.initial.toLowerCase().includes(q)) : logos;
    return [...filtered].sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [logos, search, sort]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc" ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />;
  }

  const cols: { key: SortKey | null; label: string; w: string }[] = [
    { key: null, label: "Logo", w: "w-16" }, // Kolom gambar
    { key: "name", label: "Name", w: "" },
    { key: "initial", label: "Initial", w: "w-36" },
    { key: "createdAt", label: "Created", w: "w-36" },
    { key: null, label: "", w: "w-20" },
  ];

  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Logos</h1>
            <p className="page-subtitle">{loadingData ? "Loading…" : `${logos.length} record${logos.length !== 1 ? "s" : ""}`}</p>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Logo</button>
        </div>

        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or initial…" className="max-w-sm" />
        </div>

        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading logos…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState Icon={ImageIcon} title={search ? "No results found" : "No logos yet"} description={search ? "Try a different search term." : "Add your first company/customer logo."} action={!search ? (<button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Logo</button>) : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {cols.map(({ key, label, w }) => (
                      <th key={label || "_actions"} className={w}>
                        {key ? (<button onClick={() => toggleSort(key)} className="flex items-center gap-1.5 hover:text-white transition-colors">{label} <SortIcon col={key} /></button>) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((l) => (
                    <tr key={l.id}>
                      {/* Render Kolom Gambar */}
                      <td>
                        {l.imageUrl ? (
                           <img 
                             src={l.imageUrl} 
                             alt={l.name} 
                             className="w-10 h-10 object-contain rounded bg-white p-1"
                           />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center shrink-0">
                            <span className="text-blue-400 text-[10px] font-bold">No Img</span>
                          </div>
                        )}
                      </td>
                      <td><p className="text-white font-medium text-sm">{l.name}</p></td>
                      <td><span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">{l.initial}</span></td>
                      <td className="text-slate-500 text-xs">{new Date(l.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(l)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteTarget(l)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Logo" : "Add Logo"} description={editTarget ? `Editing: ${editTarget.name}` : "Upload a logo image (Max 3MB)."} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          
          {/* Bagian Upload Gambar */}
          <div>
             <label className="form-label mb-2">Logo Image</label>
             
             {/* Area Preview & Tombol Ganti */}
             {previewUrl ? (
                <div className="relative w-full h-32 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden mb-2 group">
                   <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2" />
                   
                   {/* Tombol Hapus Preview (Tampil saat di-hover) */}
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                         type="button"
                         onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                         className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                         <X size={14} /> Remove Image
                      </button>
                   </div>
                </div>
             ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-300 font-medium">Click to upload image</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG (Max. 3MB)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
             )}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="col-span-2">
              <label className="form-label">Name <span className="text-red-400">*</span></label>
              <input {...register("name")} placeholder="Company Logo" className={cn("input-base", errors.name && "border-red-500")} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">Initial <span className="text-red-400">*</span></label>
              <input {...register("initial")} placeholder="CMP" maxLength={10} className={cn("input-base uppercase", errors.initial && "border-red-500")} style={{ textTransform: "uppercase" }} />
              {errors.initial && <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} {editTarget ? "Save Changes" : "Save Logo"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} loading={deleting} title="Delete Logo" message={`Are you sure you want to delete "${deleteTarget?.name}"?`} confirmLabel="Delete Logo" />
    </RouteGuard>
  );
}