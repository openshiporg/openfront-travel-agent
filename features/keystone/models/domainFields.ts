import { list, graphql } from "@keystone-6/core";
import { text, integer, select, virtual } from "@keystone-6/core/fields";
import { randomBytes } from "node:crypto";
import { permissions } from "../access";
export const currency = () => text({defaultValue:"USD",validation:{match:{regex:/^[A-Z]{3}$/,explanation:"ISO 4217 currency"}}});
export const cents = () => integer({defaultValue:0});
export const bps = () => integer({defaultValue:0,validation:{min:0,max:10000}});
export const state = (values:string[]) => select({type:"enum",options:values.map(value=>({label:value,value})),defaultValue:values[0],access:{create:()=>false,update:()=>false}});
export const code = (prefix:string) => text({isIndexed:"unique",hooks:{resolveInput:({operation,resolvedData,fieldKey})=> operation==="create" ? `${prefix}-${randomBytes(8).toString("hex").toUpperCase()}`:resolvedData[fieldKey]},access:{update:()=>false}});
export const domainAccess = (permission:keyof typeof permissions, evidence=false) => ({operation:{query:permissions[permission],create:evidence?()=>false:permissions[permission],update:evidence?()=>false:permissions[permission],delete:()=>false}});
export const tripSum = (kind:string) => virtual({field:graphql.field({type:graphql.Int,async resolve(item:any,_args,context:any){
const trip=await context.prisma.trip.findUnique({where:{id:item.id},include:{components:true,invoices:true}});
const sell=(trip?.components||[]).filter((x:any)=>x.bookingStatus!=="cancelled").reduce((n:number,x:any)=>n+x.sellCents,trip?.planningFeeCents||0);
const collected=(trip?.invoices||[]).reduce((n:number,x:any)=>n+x.collectedCents,0);
return kind==="sell"?sell:kind==="collected"?collected:kind==="balance"?sell-collected:(trip?.components||[]).reduce((n:number,x:any)=>n+x.commissionCents,0);
}})});
