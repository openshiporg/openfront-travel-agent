'use client'
import {useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {runOperator} from '../../actions/operators'
export function TravelerEditor({tripId,traveler}:{tripId:string;traveler?:{id:string;firstName:string;lastName:string;nationality:string}}){
 const [open,setOpen]=useState(false),[firstName,setFirst]=useState(traveler?.firstName||''),[lastName,setLast]=useState(traveler?.lastName||''),[nationality,setNationality]=useState(traveler?.nationality||''),[error,setError]=useState(''),[pending,start]=useTransition();const router=useRouter()
 const save=()=>start(async()=>{setError('');const r=await runOperator('saveTripTraveler',{tripId,travelerId:traveler?.id,firstName,lastName,nationality});if(!r.success)return setError(r.error);setOpen(false);router.refresh()})
 return <><Button size="sm" variant="outline" onClick={()=>setOpen(true)}>{traveler?'Edit traveler':'Add traveler'}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]"><DialogHeader><DialogTitle>{traveler?'Edit traveler':'Add traveler'}</DialogTitle></DialogHeader><div className="space-y-3">{[['First name',firstName,setFirst],['Last name',lastName,setLast],['Nationality',nationality,setNationality]].map(([label,value,set]:any)=><div key={label} className="space-y-1"><Label htmlFor={label}>{label}</Label><Input id={label} value={value} maxLength={label==='Nationality'?80:100} onChange={e=>set(e.target.value)}/></div>)}{error?<p role="alert" className="text-sm text-red-600">{error}</p>:null}<Button onClick={save} disabled={pending}>{pending?'Saving':'Save'}</Button></div></DialogContent></Dialog></>
}
