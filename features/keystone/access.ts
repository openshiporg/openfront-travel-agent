export const permissionNames = ['canSeeOtherPeople','canEditOtherPeople','canManagePeople','canManageRoles','canAccessDashboard','canManageOnboarding','canManagePayments','canReadPayments','canIssueRefunds','canReadAudit','canManageTrips','canManageClients','canManageSuppliers','canManageCommissions','canManageDocuments','canManageTasks','canManageSettings'] as const;
export type Permission = typeof permissionNames[number];
export type Session = {itemId:string;listKey:string;data:{name:string;email?:string;role:Record<Permission,boolean>&{id:string;name:string}}};
type AccessArgs={session?:Session};
export const isSignedIn=({session}:AccessArgs)=>Boolean(session?.itemId);
export const permissions=Object.fromEntries(permissionNames.map(name=>[name,({session}:AccessArgs)=>session?.data.role?.[name]===true])) as Record<Permission,(args:AccessArgs)=>boolean> & {canManageOrders:(args:AccessArgs)=>boolean};
// Restaurant payment lineage's order capability maps to invoice collection permission.
permissions.canManageOrders=permissions.canManagePayments;
export const rules={
 canReadPeople:({session}:AccessArgs)=>!session?false:session.data.role?.canSeeOtherPeople?true:{id:{equals:session.itemId}},
 canUpdatePeople:({session}:AccessArgs)=>!session?false:session.data.role?.canEditOtherPeople?true:{id:{equals:session.itemId}},
};
