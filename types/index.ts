// ─── USER & RBAC TYPES ────────────────────────────────────────────────────────

export type AppPage =
  | "master-data"
  | "formula-process"
  | "label-designer"
  | "production"
  | "history"
  | "user-management";

export type UserRole = "admin" | "user";

export interface PagePermission {
  page: AppPage;
  label: string;
  description: string;
  adminOnly?: boolean; // If true, only admins can access regardless of toggle
}

export const APP_PAGES: PagePermission[] = [
  {
    page: "master-data",
    label: "Master Data",
    description: "Manage customers, projects, glass types, and other master records",
  },
  {
    page: "formula-process",
    label: "Formula Process",
    description: "Map KoG types to their associated production processes",
  },
  {
    page: "label-designer",
    label: "Label Designer",
    description: "Design and manage custom-sized label layout templates with drag-and-drop elements",
  },
  {
    page: "production",
    label: "Production",
    description: "Generate batch labels for Sales Orders",
  },
  {
    page: "history",
    label: "History & Reprint",
    description: "View past labels and reprint with revision increment",
  },
  {
    page: "user-management",
    label: "User Management",
    description: "Create users and assign page permissions",
    adminOnly: true,
  },
];

export interface UserPermissions {
  [key: string]: boolean; // AppPage -> boolean
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: UserPermissions;
  createdAt: string; // ISO string
  createdBy: string; // uid of admin who created
  isActive: boolean;
}

// Firestore document (stored under /users/{uid})
export interface UserDocument extends AppUser {}

// ─── AUTH CONTEXT TYPES ───────────────────────────────────────────────────────

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
}

// ─── FORM TYPES ───────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string;
  password: string;
}

export interface CreateUserFormData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  permissions: UserPermissions;
}

export interface UpdateUserPermissionsData {
  uid: string;
  permissions: UserPermissions;
  isActive: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// MASTER DATA TYPES
// Every master document follows the same base shape.
// IDs are auto-generated (nanoid), non-editable after creation.
// ════════════════════════════════════════════════════════════════════════════

export interface MasterBase {
  id: string;          // auto-generated, immutable
  name: string;        // required
  initial: string;     // required (short code used on labels)
  createdAt: string;   // ISO string
  updatedAt: string;   // ISO string
}

// ─── CUSTOMER ────────────────────────────────────────────────────────────────
export interface Customer extends MasterBase {
  address?: string;
  phone?: string;
  city?: string;
}
export type CustomerFormData = Omit<Customer, "id" | "createdAt" | "updatedAt">;

// ─── PROJECT ──────────────────────────────────────────────────────────────────
export interface Project extends MasterBase {}
export type ProjectFormData = Omit<Project, "id" | "createdAt" | "updatedAt">;

// ─── GLASS TYPE ───────────────────────────────────────────────────────────────
export interface GlassType extends MasterBase {
  color?: string;
  thickness?: number; // mm
}
export type GlassTypeFormData = Omit<GlassType, "id" | "createdAt" | "updatedAt">;

// ─── KOG (Kind of Glass) ──────────────────────────────────────────────────────
export interface KoG extends MasterBase {}
export type KoGFormData = Omit<KoG, "id" | "createdAt" | "updatedAt">;

// ─── CUT SHAPE ────────────────────────────────────────────────────────────────
export interface CutShape extends MasterBase {}
export type CutShapeFormData = Omit<CutShape, "id" | "createdAt" | "updatedAt">;

// ─── PVB ──────────────────────────────────────────────────────────────────────
export interface PVB extends MasterBase {}
export type PVBFormData = Omit<PVB, "id" | "createdAt" | "updatedAt">;

// ─── CATEGORY ─────────────────────────────────────────────────────────────────
export interface Category extends MasterBase {}
export type CategoryFormData = Omit<Category, "id" | "createdAt" | "updatedAt">;

// ─── PROCESS ──────────────────────────────────────────────────────────────────
export interface Process extends MasterBase {}
export type ProcessFormData = Omit<Process, "id" | "createdAt" | "updatedAt">;

// ─── FORMULA PROCESS MAPPING ──────────────────────────────────────────────────
// Maps one KoG → N processes. One formula per KoG (enforced in UI + service).
// All name/initial fields are snapshots so historical labels stay readable
// even if the source KoG or Process records are later renamed.

export interface ProcessSnapshot {
  id:      string;
  name:    string;
  initial: string;
}

export interface FormulaProcess {
  id:               string;
  kogId:            string;            // FK → /kogs/{id}
  kogName:          string;            // snapshot — KoG name at save time
  kogInitial:       string;            // snapshot — KoG initial at save time
  processIds:       string[];          // ordered FK array → /processes/{id}
  processSnapshots: ProcessSnapshot[]; // snapshot array at save time
  createdAt:        string;            // ISO
  updatedAt:        string;            // ISO
}

export type FormulaProcessFormData = {
  kogId:      string;
  processIds: string[];
};

// ─── EDGE PROCESS ─────────────────────────────────────────────────────────────
export interface EdgeProcess extends MasterBase {}
export type EdgeProcessFormData = Omit<EdgeProcess, "id" | "createdAt" | "updatedAt">;

// ─── ALERT ────────────────────────────────────────────────────────────────────
export interface Alert extends MasterBase {
  symbol: string; // Google Material Symbol name
}
export type AlertFormData = Omit<Alert, "id" | "createdAt" | "updatedAt">;

// ─── LOGO ─────────────────────────────────────────────────────────────────────
export interface Logo {
  id: string;
  name: string;
  imageUrl: string;    // Firebase Storage download URL
  imagePath: string;   // Storage path (for deletion)
  createdAt: string;
  updatedAt: string;
}
export type LogoFormData = { name: string; file?: File };

// ─── MARKING ──────────────────────────────────────────────────────────────────
export interface Marking extends MasterBase {
  imageUrl?: string;
  imagePath?: string;
}
export type MarkingFormData = { name: string; initial: string; file?: File };

// ─── MASTER DATA COLLECTION NAMES (Firestore) ────────────────────────────────
export type MasterCollection =
  | "customers"
  | "projects"
  | "glassTypes"
  | "kogs"
  | "cutShapes"
  | "pvbs"
  | "categories"
  | "processes"
  | "formulaProcesses"
  | "edgeProcesses"
  | "alerts"
  | "logos"
  | "markings";

// ════════════════════════════════════════════════════════════════════════════
// LABEL DESIGNER TYPES
// ════════════════════════════════════════════════════════════════════════════

// ─── VARIABLE TOKENS ─────────────────────────────────────────────────────────
// These are the placeholder tokens users can drop onto a canvas.
// At print-time the Production module substitutes real values.

export type VariableToken =
  // Sales Order fields
  | "{{so_number}}"
  | "{{cust_name}}"
  | "{{cust_initial}}"
  | "{{city}}"
  | "{{target_schedule}}"
  | "{{revision}}"
  | "{{label_index}}"      // e.g. "1 of 5"
  // Glass / production fields
  | "{{kog_name}}"
  | "{{kog_initial}}"
  | "{{cat_initial}}"
  | "{{thickness_calc}}"   // formatted as (06+1.52+06)
  | "{{dimensions}}"       // e.g. 1500x700
  | "{{cut_shape}}"
  | "{{process_list}}"
  | "{{glass_layers}}"     // e.g. L1:DG06 L2:DG06
  | "{{edge_process}}"     // e.g. FP[B,T,L,R]
  | "{{marking_code}}"     // e.g. M:SNI[BR8]
  // Image tokens
  | "{{qr_code}}"
  | "{{logo}}"
  | "{{marking_image}}"
  // Static text / line (no substitution)
  | "__static__"
  | "__line__";

export interface VariableDefinition {
  token:       VariableToken;
  label:       string;         // human-readable name shown in the panel
  category:    "order" | "glass" | "production" | "image" | "static";
  description: string;
  isImage:     boolean;
}

// ─── CANVAS ELEMENTS (discriminated union) ────────────────────────────────────
// All coordinates and dimensions are stored in mm.
// The renderer multiplies by MM_TO_PX * zoom to get screen pixels.

export interface BaseElement {
  id:        string;
  type:      "text" | "image" | "line";
  x:         number;    // mm from left edge
  y:         number;    // mm from top edge
  width:     number;    // mm
  height:    number;    // mm
  locked:    boolean;   // if true, cannot be dragged/resized in the designer
}

export interface TextElement extends BaseElement {
  type:        "text";
  content:     string;           // raw string for static, token for variable
  variable:    VariableToken | null;
  fontSize:    number;           // pt  (will be converted to mm at render)
  fontFamily:  string;
  fontWeight:  "normal" | "bold";
  fontStyle:   "normal" | "italic";
  color:       string;           // hex
  align:       "left" | "center" | "right";
  lineHeight:  number;           // multiplier, default 1.2
  background:  string | null;    // optional fill hex
  border:      boolean;          // show border box
}

export interface ImageElement extends BaseElement {
  type:      "image";
  variable:  VariableToken | null;   // "{{logo}}" | "{{marking_image}}" | null
  src:       string | null;          // static storage URL when variable is null
  objectFit: "contain" | "cover" | "fill";
}

export interface LineElement extends BaseElement {
  type:      "line";
  variable:  null;
  color:     string;    // hex
  direction: "horizontal" | "vertical";
}

export type CanvasElement = TextElement | ImageElement | LineElement;

// ─── TEMPLATE ────────────────────────────────────────────────────────────────

export interface LabelTemplate {
  id:          string;
  name:        string;
  description: string;
  width:       number;    // mm
  height:      number;    // mm
  background:  string;    // hex, default "#ffffff"
  showGrid:    boolean;   // stored preference, default true
  elements:    CanvasElement[];
  createdAt:   string;
  updatedAt:   string;
}

export type LabelTemplateFormData = {
  name:        string;
  description: string;
  width:       number;
  height:      number;
  background:  string;
};

// ─── DESIGNER UI STATE (not persisted) ───────────────────────────────────────

export interface DesignerState {
  selectedId:   string | null;
  zoom:         number;           // 0.5 – 3.0
  showGrid:     boolean;
  isDragging:   boolean;
  isResizing:   boolean;
  history:      CanvasElement[][];  // undo stack  (last = current)
  historyIndex: number;
}

// ─── PRESET SIZES (quick-select when creating a template) ────────────────────

export interface PresetSize {
  label:  string;
  width:  number;
  height: number;
}

export const PRESET_SIZES: PresetSize[] = [
  { label: "Standard (100×50mm)",  width: 100, height: 50  },
  { label: "Wide (150×50mm)",      width: 150, height: 50  },
  { label: "Square (60×60mm)",     width: 60,  height: 60  },
  { label: "Small (80×40mm)",      width: 80,  height: 40  },
  { label: "Large (200×100mm)",    width: 200, height: 100 },
  { label: "Custom…",              width: 0,   height: 0   },
];

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTION MODULE TYPES
// ════════════════════════════════════════════════════════════════════════════

// ─── SUB-TYPES ────────────────────────────────────────────────────────────────

export interface ThicknessCalc {
  l1: number;            // required, e.g. 6
  l2: number | null;     // optional interlayer, e.g. 1.52
  l3: number | null;     // optional second glass, e.g. 6
}

export interface GlassLayer {
  glassTypeId:      string;
  glassTypeInitial: string;  // snapshot
  glassTypeName:    string;  // snapshot
  thicknessMm:      number;  // nominal thickness for this ply
}

export type EdgeSide = "B" | "T" | "L" | "R";

// ─── LINE ITEM ROW (UI state only — not persisted directly) ──────────────────
// One row in the Header+LineItems form. Gets exploded into N label documents
// on "Generate Batch" where N = quantity.

export interface LineItemRow {
  rowId:           string;   // client-side uuid for React key

  // Glass identity
  categoryId:      string;
  categoryInitial: string;   // snapshot
  kogName:         string;
  kogId:           string;
  kogInitial:      string;   // snapshot
  cutShapeId:      string;
  cutShapeName:    string;   // snapshot

  // Thickness
  thickness:       ThicknessCalc;

  // Dimensions
  dimensionW:      number;   // mm
  dimensionH:      number;   // mm

  // Glass layers (up to 3 plies for laminated)
  glassLayers:     GlassLayer[];

  // Process checklist — array of process IDs that are checked
  checkedProcessIds: string[];

  // Edge process
  edgeProcessId:   string;
  edgeProcessInitial: string;  // snapshot
  edgeSides:       EdgeSide[];

  // Marking override per row
  markingPosition: string;   // "TL"|"TR"|"BL"|"BR"
  markingOffset:   number;   // mm

  // Quantity
  quantity:        number;   // number of pieces = number of labels for this row
}

// ─── BATCH HEADER (UI state) ──────────────────────────────────────────────────

export interface BatchHeader {
  soNumber:       string;
  revision:       number;
  targetSchedule: string;    // "YYYY-MM-DD"
  customerId:     string;
  customerName:   string;    // snapshot
  customerInitial:string;    // snapshot
  city:           string;
  logoId:         string;
  logoUrl:        string;    // snapshot
  markingId:      string;
  markingName:    string;    // snapshot
  markingInitial: string;    // snapshot
  markingImageUrl:string;    // snapshot
  templateId:     string;
  templateName:   string;    // snapshot
}

// ─── FIRESTORE: LABEL BATCH DOCUMENT ─────────────────────────────────────────

export interface LabelBatch {
  id:               string;
  soNumber:         string;
  revision:         number;
  targetSchedule:   string;
  customerId:       string;
  customerName:     string;
  customerInitial:  string;
  city:             string;
  logoId:           string | null;
  logoUrl:          string | null;
  markingId:        string | null;
  markingName:      string | null;
  markingInitial:   string | null;
  markingImageUrl:  string | null;
  templateId:       string;
  templateName:     string;
  totalLabels:      number;
  status:           "draft" | "generated";
  lineItemCount:    number;
  createdAt:        string;
  updatedAt:        string;
  createdBy:        string;
}

// ─── FIRESTORE: INDIVIDUAL LABEL DOCUMENT ─────────────────────────────────────

export interface LabelRecord {
  id:                 string;
  batchId:            string;

  // Denormalised from header (for printing without joins)
  soNumber:           string;
  revision:           number;
  labelIndex:         number;    // global 1-based: 1, 2, 3 … totalLabels
  totalLabels:        number;
  rowIndex:           number;    // which line item row (0-based)
  pieceIndex:         number;    // 1-based within the row

  customerInitial:    string;
  city:               string;
  targetSchedule:     string;
  logoUrl:            string | null;
  markingImageUrl:    string | null;
  markingCode:        string | null;   // "M:SNI[BR8]"
  templateId:         string;

  // Denormalised from line item
  categoryInitial:    string | null;
  kogName:            string;
  kogInitial:         string;
  cutShapeName:       string;
  thickness:          ThicknessCalc;
  thicknessFormatted: string;          // "(06+1.52+06)"
  dimensionW:         number;
  dimensionH:         number;
  glassLayers:        GlassLayer[];
  processNames:       string[];
  edgeProcessInitial: string | null;
  edgeSides:          EdgeSide[];
  edgeFormatted:      string | null;   // "FP[B,T,L,R]"
  markingPosition:    string | null;
  markingOffset:      number | null;

  createdAt:          string;
}

// ─── PROCESS MASTER (used in checklist) ───────────────────────────────────────

export interface ProcessWithCheck extends Process {
  checked:       boolean;
  autoChecked:   boolean;  // was set by formula (shown differently in UI)
}
