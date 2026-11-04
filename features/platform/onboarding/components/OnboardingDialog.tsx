'use client';

import React from 'react';
import { Loader2, CircleCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useOnboardingState } from '../hooks/useOnboardingState';
import { useOnboardingApi } from '../hooks/useOnboardingApi';
import { SECTION_DEFINITIONS, TRAVEL_TEMPLATES } from '../config/templates';

interface OnboardingDialogProps { isOpen: boolean; onClose: () => void }

const OnboardingDialog: React.FC<OnboardingDialogProps> = ({ isOpen, onClose }) => {
  const s = useOnboardingState();
  const { runOnboarding } = useOnboardingApi({
    selectedTemplate: s.selectedTemplate, setProgress: s.setProgress, setItemLoading: s.setItemLoading,
    setItemCompleted: s.setItemCompleted, setItemError: s.setItemError, setStep: s.setStep, setError: s.setError,
    setIsLoading: s.setIsLoading, resetOnboardingState: s.resetOnboardingState,
  });
  const close = () => { if (!s.isLoading) { onClose(); if (s.step === 'done') window.location.assign('/dashboard/platform'); } };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
        <DialogHeader><DialogTitle>Agency setup</DialogTitle><DialogDescription className="sr-only">Set up the agency details used across trips and invoices.</DialogDescription></DialogHeader>
        {s.step === 'template' && (
          <div className="space-y-4">
            <RadioGroup value={s.selectedTemplate} onValueChange={(v) => s.setSelectedTemplate(v as any)} className="space-y-2">
              {(Object.keys(TRAVEL_TEMPLATES) as Array<keyof typeof TRAVEL_TEMPLATES>).map((key) => (
                <Label key={key} htmlFor={`tpl-${key}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <RadioGroupItem id={`tpl-${key}`} value={key} className="mt-1" />
                  <span className="space-y-1"><span className="block text-sm font-medium">{TRAVEL_TEMPLATES[key].name}</span><span className="block text-xs font-normal text-muted-foreground">{TRAVEL_TEMPLATES[key].description}</span></span>
                </Label>
              ))}
            </RadioGroup>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={runOnboarding} disabled={!s.currentJsonData}>Start setup</Button></div>
          </div>
        )}
        {s.step !== 'template' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{s.progressMessage}</p>
            <ul className="space-y-1">
              {SECTION_DEFINITIONS.map((sec) => {
                const loading = (s.loadingItems[sec.key] || []).length > 0, done = (s.completedItems[sec.key] || []).length > 0, err = s.itemErrors[sec.key];
                return (
                  <li key={sec.key} className="flex items-center gap-2 text-sm">
                    {err ? <AlertCircle className="h-4 w-4 text-red-600" /> : loading ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CircleCheck className="h-4 w-4 text-green-600" /> : <span className="h-4 w-4" />}
                    <span>{sec.label}</span>
                    {done && <span className="ml-auto text-xs text-muted-foreground">{s.getItemsFromJsonData(s.currentJsonData, sec.key).length}</span>}
                    {err && <span className="ml-auto text-xs text-red-600">{err}</span>}
                  </li>
                );
              })}
            </ul>
            {s.error && <p className="text-sm text-red-600">{s.error}</p>}
            <div className="flex justify-end">{s.step === 'done' || s.error ? <Button onClick={() => (s.error ? s.setStep('template') : close())}>{s.error ? 'Back' : 'Open agency'}</Button> : null}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default OnboardingDialog;
