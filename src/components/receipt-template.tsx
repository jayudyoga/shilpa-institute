"use client"

import { format } from 'date-fns';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ReceiptConfig } from '@/lib/types';

interface ReceiptProps {
  receiptNumber: string;
  studentName: string;
  className: string;
  amount: number;
  date: Date;
  recordedBy: string;
}

export function ReceiptTemplate({ receiptNumber, studentName, className, amount, date, recordedBy }: ReceiptProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const configRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'settings', 'receipt_config') : null, 
    [firestore, user]
  );
  const { data: config } = useDoc<ReceiptConfig>(configRef);

  const instituteName = config?.instituteName || "SHILPA HIGHER EDUCATION INSTITUTE";
  const address = [config?.address1, config?.address2].filter(Boolean).join(', ');
  const phone = config?.phone;
  const footer = config?.footerMessage || "Thank you for your payment!";

  return (
    <div className="max-w-[80mm] mx-auto p-6 bg-white text-black font-sans leading-relaxed border border-dashed border-gray-300 shadow-sm">
      <div className="text-center mb-6">
        <h1 className="text-base font-bold uppercase tracking-tight text-primary leading-tight">{instituteName}</h1>
        {address && <p className="text-[10px] text-gray-500 font-medium">{address}</p>}
        {phone && <p className="text-[10px] text-gray-500 font-medium">Tel: {phone}</p>}
        <p className="text-[10px] text-gray-500 font-semibold mt-1">OFFICIAL PAYMENT RECEIPT</p>
      </div>
      
      <div className="space-y-2 border-y border-dashed border-gray-200 py-4 mb-4 text-xs">
        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Receipt No:</span>
          <span className="font-mono font-bold">#{receiptNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Transaction Date:</span>
          <span className="font-medium">{format(date, 'EEE, MMM d, yyyy')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Transaction Time:</span>
          <span className="font-medium">{format(date, 'h:mm a')}</span>
        </div>
      </div>

      <div className="space-y-4 mb-6 text-sm">
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-tighter">Received From</p>
          <p className="text-base font-bold text-gray-900">{studentName}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-tighter">Course / Class</p>
          <p className="font-semibold text-gray-800">{className}</p>
        </div>
        <div className="pt-2 border-t border-gray-50">
          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-tighter">Issued By</p>
          <p className="text-xs font-medium text-gray-700">{recordedBy || 'System Administrator'}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center mb-6 border border-gray-100">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">Total Amount Paid</span>
        <span className="text-2xl font-black text-primary">${amount.toFixed(2)}</span>
      </div>

      <div className="text-center space-y-3">
        <p className="text-[10px] text-gray-400 italic">{footer}</p>
        <div className="pt-2">
          <div className="h-12 w-full flex flex-col items-center justify-center border border-gray-100 rounded-md bg-gray-50/30">
            <span className="text-[8px] uppercase tracking-widest text-gray-300 font-bold">Secure Digital Signature</span>
            <span className="text-[10px] font-mono text-gray-400">SHILPA-{receiptNumber}-{format(date, 'yyyyMMdd')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
