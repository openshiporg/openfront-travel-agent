import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const AuditEvent = list({
  access: {...domainAccess("canReadAudit", true),},
  fields: {
    action: text(),
    targetList: text(),
    targetId: text(),
    reason: text(),
    requestId: text(),
    before: json(),
    after: json(),
    actor: relationship({ ref: "User.auditEvents", many: false }),
    ...trackingFields,
  },
});
