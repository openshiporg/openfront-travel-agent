import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const SupplierContact = list({
  access: {...domainAccess("canManageSuppliers", false),},
  fields: {
    name: text(),
    email: text(),
    phone: text(),
    title: text(),
    supplier: relationship({ ref: "Supplier.contacts", many: false }),
    ...trackingFields,
  },
});
