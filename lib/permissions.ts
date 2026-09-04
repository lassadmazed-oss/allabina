/**
 * الأدوار والصلاحيات — مصدر الحقيقة الوحيد.
 * يُستعمل في الخادم (حراسة الصفحات والأفعال) وفي العرض (إخفاء ما لا يُسمح به).
 * لا يستورد شيئاً من Next حتى يبقى صالحاً في الطرفين.
 */

export const ROLES = ['owner', 'admin', 'agent', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'مالك',
  admin: 'مدير',
  agent: 'وكيل',
  viewer: 'مطّلع',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'كلّ الصلاحيات، بما فيها تعيين المدراء وحذفهم.',
  admin: 'المطالب والمعطيات المرجعية والتصدير وإدارة الوكلاء والمطّلعين.',
  agent: 'معالجة المطالب وتغيير حالاتها وتسجيل التفاعلات. لا تصدير ولا إدارة فريق.',
  viewer: 'قراءة فقط: يطالع المطالب دون أيّ تعديل.',
}

export type Permission =
  | 'requests.read'
  | 'requests.update'
  | 'requests.export'
  | 'reference.manage'
  | 'team.read'
  | 'team.manage_members'
  | 'team.manage_admins'

const MATRIX: Record<Role, readonly Permission[]> = {
  owner: [
    'requests.read',
    'requests.update',
    'requests.export',
    'reference.manage',
    'team.read',
    'team.manage_members',
    'team.manage_admins',
  ],
  admin: [
    'requests.read',
    'requests.update',
    'requests.export',
    'reference.manage',
    'team.read',
    'team.manage_members',
  ],
  agent: ['requests.read', 'requests.update'],
  viewer: ['requests.read'],
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission)
}

/** الأدوار التي يحقّ لصاحب هذا الدور إسنادها. */
export function assignableRoles(role: Role): Role[] {
  if (role === 'owner') return ['owner', 'admin', 'agent', 'viewer']
  if (role === 'admin') return ['agent', 'viewer']
  return []
}

/** هل يحقّ لـ actor التصرّف في عضو دوره target؟ */
export function canManageRole(actor: Role, target: Role): boolean {
  return assignableRoles(actor).includes(target)
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
