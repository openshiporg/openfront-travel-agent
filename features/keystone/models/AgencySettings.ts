import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { storeLogoFields } from "./storeLogoFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const AgencySettings = list({
  graphql: {plural:"AgencySettingsRecords"},
  access: {...domainAccess("canManageSettings", false),},
  fields: {
    name: text(),
    address: text(),
    email: text(),
    phone: text(),
    defaultPlanningFeeCents: cents(),
    refundApprovalThresholdCents: integer({defaultValue:50000,validation:{min:0}}),
    hostAgencySplitBps: bps(),
    currencyCode: currency(),
    ...storeLogoFields,
    ...trackingFields,
  },
});
