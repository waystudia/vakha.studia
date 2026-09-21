export type RecordStatus = "active" | "archived";
export type OrderStatus = "new" | "confirmed" | "in_progress" | "ready" | "cancelled";

export interface School {
  id: string;
  owner_id: string;
  name: string;
  city: string;
  address: string;
  contact_name: string;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface SchoolWithStats extends School {
  classes_count: number;
  children_count: number;
  orders_count: number;
}

export interface SchoolClass {
  id: string;
  owner_id: string;
  school_id: string;
  name: string;
  academic_year: string;
  teacher_name: string;
  photo_session_name: string;
  public_token: string;
  public_expires_at: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface ClassWithStats extends SchoolClass {
  children_count: number;
  orders_count: number;
  missing_orders_count: number;
}

export interface Child {
  id: string;
  owner_id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  public_name: string;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  owner_id: string;
  source_id: string;
  name: string;
  description: string;
  short_description: string;
  type: string;
  category: string;
  gender: string;
  price: number;
  preview_url: string;
  preview_video_url: string;
  parent_preview_mode: "auto" | "print" | "digital";
  is_active: boolean;
  sort_order: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SelectedOrderItem {
  id: string;
  name: string;
  price: number;
  type: string;
}

export interface ParentOrder {
  id: string;
  owner_id: string;
  class_id: string;
  child_id: string;
  order_number: string;
  selected_items: SelectedOrderItem[];
  total_amount: number;
  status: OrderStatus;
  parent_note: string;
  request_key: string;
  created_at: string;
  updated_at: string;
  child?: Pick<Child, "first_name" | "last_name" | "public_name">;
  class?: Pick<SchoolClass, "name" | "school_id"> & { school?: Pick<School, "name"> };
}

export interface PublicClassPayload {
  school: { name: string; city: string };
  class: {
    id: string;
    name: string;
    academic_year: string;
    photo_session_name: string;
  };
  children: Array<{ id: string; public_name: string }>;
  catalog: Array<{
    id: string;
    name: string;
    description: string;
    short_description: string;
    type: string;
    category: string;
    gender: string;
    price: number;
    preview_url: string;
    preview_video_url: string;
    parent_preview_mode: "auto" | "print" | "digital";
  }>;
}

export interface PublicOrderResult {
  duplicate: boolean;
  order_number: string;
  status: OrderStatus;
  selected_items: SelectedOrderItem[];
  total_amount: number;
  child_name: string;
  class_name: string;
}

export interface CatalogZipItem {
  sourceId: string;
  name: string;
  price: number;
  shortDescription: string;
  description: string;
  category: string;
  gender: string;
  type: string;
  popular: boolean;
  previewImagePath: string;
  previewVideoPath: string;
  previewImage?: Blob;
  previewVideo?: Blob;
  parentPreviewMode: "auto" | "print" | "digital";
}
