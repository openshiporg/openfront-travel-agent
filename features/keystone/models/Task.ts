import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Task = list({
  access: {...domainAccess("canManageTasks", false),},
  fields: {
    title: text(),
    taskKey: text({isIndexed:"unique"}),
    dueAt: timestamp(),
    trip: relationship({ ref: "Trip.tasks", many: false }),
    assignee: relationship({ ref: "User.tasks", many: false }),
    type: state(["deposit_due", "final_due", "passport_expiring", "commission_overdue", "follow_up"]),
    status: state(["open", "completed", "cancelled"]),
    completedAt: timestamp({ access: { create: () => false, update: () => false } }),
    completedBy: relationship({ ref: "User", many: false, access: { create: () => false, update: () => false } }),
    completionNote: text({ access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
