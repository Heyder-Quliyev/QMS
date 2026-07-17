export interface PortalGroup {
  id: number;
  name: string;
  slug: string;
  companyId: number;
  createdAt: Date;
}

export interface Document {
  id: number;
  docNumber: string;
  title: string;
  revision: string;
  effectiveDate: Date;
  status: 'active' | 'draft' | 'archived';
}

export interface PortalDocument {
  id: number;
  portalGroupId: number;
  documentId: number;
  addedAt: Date;
  document: Document;
}

export interface PortalUser {
  id: number;
  portalGroupId: number;
  email: string;
  name: string;
  accessToken: string;
  lastAccess?: Date;
  createdAt: Date;
}

export interface PortalAccessLog {
  id: number;
  portalUserId: number;
  documentId: number;
  action: 'view' | 'download';
  accessedAt: Date;
  portalUser?: PortalUser;
  document?: Document;
}
