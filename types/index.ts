// --- USER & RBAC TYPES --------------------------------------------------------

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

// --- AUTH CONTEXT TYPES -------------------------------------------------------

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
}

// --- FORM TYPES ---------------------------------------------------------------

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

// --- CUSTOMER ----------------------------------------------------------------
export interface Customer extends MasterBase {
  address?: string;
  phone?: string;
  city?: string;
}
export type CustomerFormData = Omit<Customer, "id" | "createdAt" | "updatedAt">;

// --- PROJECT ------------------------------------------------------------------
export interface Project extends MasterBase {}
export type ProjectFormData = Omit<Project, "id" | "createdAt" | "updatedAt">;

// --- GLASS TYPE ---------------------------------------------------------------
export interface GlassType extends MasterBase {
  color?: string;
  thickness?: number; // mm
}
export type GlassTypeFormData = Omit<GlassType, "id" | "createdAt" | "updatedAt">;

// --- KOG (Kind of Glass) ------------------------------------------------------
export interface KoG extends MasterBase {
  isTempered: boolean; // isTempered dipindahkan spesifik HANYA untuk KoG
}
export type KoGFormData = Omit<KoG, "id" | "createdAt" | "updatedAt">;

// --- CUT SHAPE ----------------------------------------------------------------
export interface CutShape extends MasterBase {}
export type CutShapeFormData = Omit<CutShape, "id" | "createdAt" | "updatedAt">;

// --- PVB ----------------------------------------------------------------------
export interface PVB extends MasterBase {}
export type PVBFormData = Omit<PVB, "id" | "createdAt" | "updatedAt">;

// --- CATEGORY -----------------------------------------------------------------
export interface Category extends MasterBase {}
export type CategoryFormData = Omit<Category, "id" | "createdAt" | "updatedAt">;

// --- PROCESS ------------------------------------------------------------------
export interface Process extends MasterBase {}
export type ProcessFormData = Omit<Process, "id" | "createdAt" | "updatedAt">;

// --- FORMULA PROCESS MAPPING --------------------------------------------------
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

// --- EDGE PROCESS -------------------------------------------------------------
export interface EdgeProcess extends MasterBase {}
export type EdgeProcessFormData = Omit<EdgeProcess, "id" | "createdAt" | "updatedAt">;

// --- ALERT --------------------------------------------------------------------
export interface Alert extends MasterBase {
  symbol: string; // Google Material Symbol name
}
export type AlertFormData = Omit<Alert, "id" | "createdAt" | "updatedAt">;

// --- LOGO ---------------------------------------------------------------------
export interface Logo {
  id: string;
  name: string;
  imageUrl: string;    // Firebase Storage download URL
  imagePath: string;   // Storage path (for deletion)
  createdAt: string;
  updatedAt: string;
}
export type LogoFormData = { name: string; file?: File };

// --- MARKING ------------------------------------------------------------------
export interface Marking extends MasterBase {
  imageUrl?: string;
  imagePath?: string;
}
export type MarkingFormData = { name: string; initial: string; file?: File };

// --- MASTER DATA COLLECTION NAMES (Firestore) --------------------------------
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

// --- VARIABLE TOKENS ---------------------------------------------------------
export type VariableToken =
  | "{{so_number}}"
  | "{{cust_name}}"
  | "{{cust_initial}}"
  | "{{project_initial}}"
  | "{{pvb_initial}}"
  | "{{city}}"
  | "{{target_schedule}}"
  | "{{revision}}"
  | "{{label_index}}"      
  | "{{kog_name}}"
  | "{{kog_initial}}"
  | "{{cat_initial}}"
  | "{{thickness_calc}}"   
  | "{{dimensions}}"       
  | "{{cut_shape}}"
  | "{{process_list}}"
  | "{{glass_layers}}"     
  | "{{edge_process}}"     
  | "{{marking_code}}"     
  | "{{qr_code}}"
  | "{{logo}}"
  | "{{marking_image}}"
  | "__static__"
  | "__line__";

export interface VariableDefinition {
  token:       VariableToken;
  label:       string;         
  category:    "order" | "glass" | "production" | "image" | "static";
  description: string;
  isImage:     boolean;
}

// --- CANVAS ELEMENTS (discriminated union) ------------------------------------
export interface BaseElement {
  id:        string;
  type:      "text" | "image" | "line";
  x:         number;    
  y:         number;    
  width:     number;    
  height:    number;    
  locked:    boolean;   
}

export interface TextElement extends BaseElement {
  type:        "text";
  content:     string;           
  variable:    VariableToken | null;
  fontSize:    number;           
  fontFamily:  string;
  fontWeight:  "normal" | "bold";
  fontStyle:   "normal" | "italic";
  color:       string;           
  align:       "left" | "center" | "right";
  lineHeight:  number;           
  background:  string | null;    
  border:      boolean;          
}

export interface ImageElement extends BaseElement {
  type:      "image";
  variable:  VariableToken | null;   
  src:       string | null;          
  objectFit: "contain" | "cover" | "fill";
}

export interface LineElement extends BaseElement {
  type:      "line";
  variable:  null;
  color:     string;    
  direction: "horizontal" | "vertical";
}

export type CanvasElement = TextElement | ImageElement | LineElement;

// --- TEMPLATE ----------------------------------------------------------------
export interface LabelTemplate {
  id:          string;
  name:        string;
  description: string;
  width:       number;    
  height:      number;    
  background:  string;    
  showGrid:    boolean;   
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

// --- DESIGNER UI STATE (not persisted) ---------------------------------------
export interface DesignerState {
  selectedId:   string | null;
  zoom:         number;           
  showGrid:     boolean;
  isDragging:   boolean;
  isResizing:   boolean;
  history:      CanvasElement[][];  
  historyIndex: number;
}

// --- PRESET SIZES ------------------------------------------------------------
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

export interface ThicknessCalc {
  l1: number;            
  l2: number | null;     
  l3: number | null;     
}

export interface GlassLayer {
  glassTypeId:      string;
  glassTypeInitial: string;  
  glassTypeName:    string;  
  thicknessMm:      number;  
}

export type EdgeSide = "B" | "T" | "L" | "R";

// --- LINE ITEM ROW (UI state only) -------------------------------------------
export interface LineItemRow {
  rowId:           string;   
  categoryId:      string;
  categoryInitial: string;   
  kogName:         string;
  kogId:           string;
  kogInitial:      string;   
  cutShapeId:      string;
  cutShapeName:    string;   
  thickness:       ThicknessCalc;
  dimensionW:      number;   
  dimensionH:      number;   
  glassLayers:     GlassLayer[];
  checkedProcessIds: string[];
  edgeProcessId:   string;
  edgeProcessInitial: string;  
  edgeSides:       EdgeSide[];
  markingPosition: string;   
  markingOffset:   number;   
  quantity:        number;   
}

// --- BATCH HEADER (UI state) --------------------------------------------------
export interface BatchHeader {
  soNumber:       string;
  revision:       number;
  targetSchedule: string;    
  customerId:     string;
  customerName:   string;    
  customerInitial:string;    
  city:           string;
  logoId:         string;
  logoUrl:        string;    
  markingId:      string;
  markingName:    string;    
  markingInitial: string;    
  markingImageUrl:string;    
  templateId:     string;
  templateName:   string;    
}

// --- FIRESTORE: LABEL BATCH DOCUMENT -----------------------------------------
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

// --- FIRESTORE: INDIVIDUAL LABEL DOCUMENT -------------------------------------
export interface LabelRecord {
  id:                 string;
  batchId:            string;
  soNumber:           string;
  revision:           number;
  labelIndex:         number;    
  totalLabels:        number;
  rowIndex:           number;    
  pieceIndex:         number;    
  customerInitial:    string;
  city:               string;
  targetSchedule:     string;
  logoUrl:            string | null;
  markingImageUrl:    string | null;
  markingCode:        string | null;   
  templateId:         string;
  categoryInitial:    string | null;
  kogName:            string;
  kogInitial:         string;
  cutShapeName:       string;
  thickness:          ThicknessCalc;
  thicknessFormatted: string;          
  dimensionW:         number;
  dimensionH:         number;
  glassLayers:        GlassLayer[];
  processNames:       string[];
  edgeProcessInitial: string | null;
  edgeSides:          EdgeSide[];
  edgeFormatted:      string | null;   
  markingPosition:    string | null;
  markingOffset:      number | null;
  createdAt:          string;
}

// --- PROCESS MASTER (used in checklist) ---------------------------------------
export interface ProcessWithCheck extends Process {
  checked:       boolean;
  autoChecked:   boolean;  
}