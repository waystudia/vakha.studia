/** Provider facade: CRM staff and legacy Supabase retain the same screen contracts. */
import { crmStudioCall } from './crmStudioRepository';
type Legacy = typeof import('./supabaseRepository');
export type { CatalogInstitutionMatch, CatalogIntakeResult } from './supabaseRepository';
const crm = import.meta.env.VITE_CRM_MODE === 'true';

export async function currentUser(...args: Parameters<Legacy['currentUser']>): ReturnType<Legacy['currentUser']> {
  if (crm) return crmStudioCall('currentUser', args);
  return (await import('./supabaseRepository')).currentUser(...args);
}

export async function signIn(...args: Parameters<Legacy['signIn']>): ReturnType<Legacy['signIn']> {
  if (crm) return crmStudioCall('signIn', args);
  return (await import('./supabaseRepository')).signIn(...args);
}

export async function signUp(...args: Parameters<Legacy['signUp']>): ReturnType<Legacy['signUp']> {
  if (crm) return crmStudioCall('signUp', args);
  return (await import('./supabaseRepository')).signUp(...args);
}

export async function signOut(...args: Parameters<Legacy['signOut']>): ReturnType<Legacy['signOut']> {
  if (crm) return crmStudioCall('signOut', args);
  return (await import('./supabaseRepository')).signOut(...args);
}

export async function getProfile(...args: Parameters<Legacy['getProfile']>): ReturnType<Legacy['getProfile']> {
  if (crm) return crmStudioCall('getProfile', args);
  return (await import('./supabaseRepository')).getProfile(...args);
}

export async function updateProfile(...args: Parameters<Legacy['updateProfile']>): ReturnType<Legacy['updateProfile']> {
  if (crm) return crmStudioCall('updateProfile', args);
  return (await import('./supabaseRepository')).updateProfile(...args);
}

export async function ensureDemoData(...args: Parameters<Legacy['ensureDemoData']>): ReturnType<Legacy['ensureDemoData']> {
  if (crm) return crmStudioCall('ensureDemoData', args);
  return (await import('./supabaseRepository')).ensureDemoData(...args);
}

export async function loadSchools(...args: Parameters<Legacy['loadSchools']>): ReturnType<Legacy['loadSchools']> {
  if (crm) return crmStudioCall('loadSchools', args);
  return (await import('./supabaseRepository')).loadSchools(...args);
}

export async function createSchool(...args: Parameters<Legacy['createSchool']>): ReturnType<Legacy['createSchool']> {
  if (crm) return crmStudioCall('createSchool', args);
  return (await import('./supabaseRepository')).createSchool(...args);
}

export async function updateSchool(...args: Parameters<Legacy['updateSchool']>): ReturnType<Legacy['updateSchool']> {
  if (crm) return crmStudioCall('updateSchool', args);
  return (await import('./supabaseRepository')).updateSchool(...args);
}

export async function loadSchool(...args: Parameters<Legacy['loadSchool']>): ReturnType<Legacy['loadSchool']> {
  if (crm) return crmStudioCall('loadSchool', args);
  return (await import('./supabaseRepository')).loadSchool(...args);
}

export async function createClass(...args: Parameters<Legacy['createClass']>): ReturnType<Legacy['createClass']> {
  if (crm) return crmStudioCall('createClass', args);
  return (await import('./supabaseRepository')).createClass(...args);
}

export async function updateClass(...args: Parameters<Legacy['updateClass']>): ReturnType<Legacy['updateClass']> {
  if (crm) return crmStudioCall('updateClass', args);
  return (await import('./supabaseRepository')).updateClass(...args);
}

export async function loadClass(...args: Parameters<Legacy['loadClass']>): ReturnType<Legacy['loadClass']> {
  if (crm) return crmStudioCall('loadClass', args);
  return (await import('./supabaseRepository')).loadClass(...args);
}

export async function createChild(...args: Parameters<Legacy['createChild']>): ReturnType<Legacy['createChild']> {
  if (crm) return crmStudioCall('createChild', args);
  return (await import('./supabaseRepository')).createChild(...args);
}

export async function updateChild(...args: Parameters<Legacy['updateChild']>): ReturnType<Legacy['updateChild']> {
  if (crm) return crmStudioCall('updateChild', args);
  return (await import('./supabaseRepository')).updateChild(...args);
}

export async function importChildren(...args: Parameters<Legacy['importChildren']>): ReturnType<Legacy['importChildren']> {
  if (crm) return crmStudioCall('importChildren', args);
  return (await import('./supabaseRepository')).importChildren(...args);
}

export async function loadCatalog(...args: Parameters<Legacy['loadCatalog']>): ReturnType<Legacy['loadCatalog']> {
  if (crm) return crmStudioCall('loadCatalog', args);
  return (await import('./supabaseRepository')).loadCatalog(...args);
}

export async function importCatalogItems(...args: Parameters<Legacy['importCatalogItems']>): ReturnType<Legacy['importCatalogItems']> {
  if (crm) return crmStudioCall('importCatalogItems', args);
  return (await import('./supabaseRepository')).importCatalogItems(...args);
}

export async function updateCatalogItem(...args: Parameters<Legacy['updateCatalogItem']>): ReturnType<Legacy['updateCatalogItem']> {
  if (crm) return crmStudioCall('updateCatalogItem', args);
  return (await import('./supabaseRepository')).updateCatalogItem(...args);
}

export async function deleteCatalogItems(...args: Parameters<Legacy['deleteCatalogItems']>): ReturnType<Legacy['deleteCatalogItems']> {
  if (crm) return crmStudioCall('deleteCatalogItems', args);
  return (await import('./supabaseRepository')).deleteCatalogItems(...args);
}

export async function loadOrders(...args: Parameters<Legacy['loadOrders']>): ReturnType<Legacy['loadOrders']> {
  if (crm) return crmStudioCall('loadOrders', args);
  return (await import('./supabaseRepository')).loadOrders(...args);
}

export async function loadOrdersWorkspace(...args: Parameters<Legacy['loadOrdersWorkspace']>): ReturnType<Legacy['loadOrdersWorkspace']> {
  if (crm) return crmStudioCall('loadOrdersWorkspace', args);
  return (await import('./supabaseRepository')).loadOrdersWorkspace(...args);
}

export async function loadVisitAnalytics(...args: Parameters<Legacy['loadVisitAnalytics']>): ReturnType<Legacy['loadVisitAnalytics']> {
  if (crm) return crmStudioCall('loadVisitAnalytics', args);
  return (await import('./supabaseRepository')).loadVisitAnalytics(...args);
}

export async function updateOrderStatus(...args: Parameters<Legacy['updateOrderStatus']>): ReturnType<Legacy['updateOrderStatus']> {
  if (crm) return crmStudioCall('updateOrderStatus', args);
  return (await import('./supabaseRepository')).updateOrderStatus(...args);
}

export async function getPublicClass(...args: Parameters<Legacy['getPublicClass']>): ReturnType<Legacy['getPublicClass']> {
  if (crm) return crmStudioCall('getPublicClass', args);
  return (await import('./supabaseRepository')).getPublicClass(...args);
}

export async function getPublicCatalog(...args: Parameters<Legacy['getPublicCatalog']>): ReturnType<Legacy['getPublicCatalog']> {
  if (crm) return crmStudioCall('getPublicCatalog', args);
  return (await import('./supabaseRepository')).getPublicCatalog(...args);
}

export async function searchCatalogInstitutions(...args: Parameters<Legacy['searchCatalogInstitutions']>): ReturnType<Legacy['searchCatalogInstitutions']> {
  if (crm) return crmStudioCall('searchCatalogInstitutions', args);
  return (await import('./supabaseRepository')).searchCatalogInstitutions(...args);
}

export async function submitCatalogIntake(...args: Parameters<Legacy['submitCatalogIntake']>): ReturnType<Legacy['submitCatalogIntake']> {
  if (crm) return crmStudioCall('submitCatalogIntake', args);
  return (await import('./supabaseRepository')).submitCatalogIntake(...args);
}

export async function submitCatalogInquiry(...args: Parameters<Legacy['submitCatalogInquiry']>): ReturnType<Legacy['submitCatalogInquiry']> {
  if (crm) return crmStudioCall('submitCatalogInquiry', args);
  return (await import('./supabaseRepository')).submitCatalogInquiry(...args);
}

export async function getPublicOrder(...args: Parameters<Legacy['getPublicOrder']>): ReturnType<Legacy['getPublicOrder']> {
  if (crm) return crmStudioCall('getPublicOrder', args);
  return (await import('./supabaseRepository')).getPublicOrder(...args);
}

export async function submitPublicOrder(...args: Parameters<Legacy['submitPublicOrder']>): ReturnType<Legacy['submitPublicOrder']> {
  if (crm) return crmStudioCall('submitPublicOrder', args);
  return (await import('./supabaseRepository')).submitPublicOrder(...args);
}

export async function submitPublicCustomRequest(...args: Parameters<Legacy['submitPublicCustomRequest']>): ReturnType<Legacy['submitPublicCustomRequest']> {
  if (crm) return crmStudioCall('submitPublicCustomRequest', args);
  return (await import('./supabaseRepository')).submitPublicCustomRequest(...args);
}

export async function cancelPublicOrder(...args: Parameters<Legacy['cancelPublicOrder']>): ReturnType<Legacy['cancelPublicOrder']> {
  if (crm) return crmStudioCall('cancelPublicOrder', args);
  return (await import('./supabaseRepository')).cancelPublicOrder(...args);
}
export type {StudioInquiry} from './supabaseRepository';
export async function loadInquiries():ReturnType<Legacy['loadInquiries']> {if(crm)return crmStudioCall('loadInquiries',[]);return (await import('./supabaseRepository')).loadInquiries();}
export async function updateInquiryStatus(id:string,status:string):ReturnType<Legacy['updateInquiryStatus']> {if(crm)return crmStudioCall('updateInquiryStatus',[id,status]);return (await import('./supabaseRepository')).updateInquiryStatus(id,status);}
