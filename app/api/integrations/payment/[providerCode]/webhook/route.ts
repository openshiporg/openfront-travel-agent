import {NextRequest,NextResponse} from 'next/server'
import {keystoneContext} from '@/features/keystone/context'
import {handleTravelPaymentWebhook} from '@/features/keystone/mutations/paymentWebhook'
export const runtime='nodejs'
export async function POST(request:NextRequest,{params}:{params:Promise<{providerCode:string}>}){
 if((await params).providerCode!=='pp_stripe')return NextResponse.json({error:'Unknown provider'},{status:404})
 if(Number(request.headers.get('content-length')||0)>262144)return NextResponse.json({error:'Payload too large'},{status:413})
 const rawBody=await request.text();if(Buffer.byteLength(rawBody)>262144)return NextResponse.json({error:'Payload too large'},{status:413})
 try{const result=await handleTravelPaymentWebhook(keystoneContext,rawBody,Object.fromEntries(request.headers.entries()));return NextResponse.json(result,{status:result.success?200:409})}
 catch{return NextResponse.json({error:'Webhook verification or settlement failed'},{status:400})}
}
