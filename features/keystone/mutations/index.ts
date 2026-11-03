import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import {operators,submitInquiry,viewProposal,acceptProposal,viewItinerary,payInvoice,confirmInvoicePayment} from './travel';
import {GraphQLScalarType,Kind} from 'graphql';
const GraphQLJSON=new GraphQLScalarType({name:'TravelJSON',serialize:(v:any)=>v,parseValue:(v:any)=>v,parseLiteral:function lit(a:any):any{switch(a.kind){case Kind.OBJECT:return Object.fromEntries(a.fields.map((f:any)=>[f.name.value,lit(f.value)]));case Kind.LIST:return a.values.map(lit);case Kind.INT:return Number(a.value);case Kind.FLOAT:return Number(a.value);case Kind.NULL:return null;default:return (a as any).value;}}});

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      scalar TravelJSON
      type Query {
        redirectToInit: Boolean
        viewProposal(token:String!): TravelJSON
        viewItinerary(token:String!): TravelJSON
      }
      type Mutation {
        ${Object.keys(operators).map(name=>`${name}(input:TravelJSON!): TravelJSON`).join('\n')}
        submitInquiry(input:TravelJSON!): TravelJSON
        acceptProposal(token:String!,optionId:ID!,name:String!,idempotencyKey:String!): TravelJSON
        payInvoice(token:String!,idempotencyKey:String!): TravelJSON
        confirmInvoicePayment(token:String!,paymentIntentId:String!): TravelJSON
      }
    `,
    resolvers: {
      TravelJSON: GraphQLJSON,
      Query: {redirectToInit,viewProposal,viewItinerary},
      Mutation: {...Object.fromEntries(Object.entries(operators).map(([name,handler])=>[name,(_root:any,{input}:any,context:any)=>handler(context,input)])),submitInquiry,acceptProposal,payInvoice,confirmInvoicePayment},
    },
  });
}