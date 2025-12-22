
'use client';

import { cn } from '@/lib/utils';
import React from 'react';

const CalculatorButton = ({
  children,
  className,
  gridClass,
}: {
  children: React.ReactNode;
  className?: string;
  gridClass?: string;
}) => (
  <div
    className={cn(
      'flex items-center justify-center rounded-sm text-xs font-bold text-white',
      gridClass,
      className
    )}
  >
    {children}
  </div>
);

const SmallButton = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <CalculatorButton className={cn('h-5 w-10 bg-neutral-600', className)}>
        {children}
    </CalculatorButton>
);

const RectButton = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <CalculatorButton className={cn('h-7 w-10 bg-neutral-800 border border-neutral-900', className)}>
        {children}
    </CalculatorButton>
);

export const Ti84Calculator: React.FC = () => {
  return (
    <div className="flex h-full w-full select-none flex-col items-center justify-center bg-neutral-200 dark:bg-neutral-900 p-4 overflow-hidden">
      <div className="flex h-full max-h-[550px] w-full max-w-[300px] flex-col rounded-lg bg-neutral-700 p-3 shadow-2xl ring-2 ring-neutral-800/50">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <p className="font-sans text-xs font-bold text-yellow-300">
            TI-84 Plus
          </p>
          <p className="font-sans text-[10px] text-neutral-400">Silver Edition</p>
        </div>

        {/* Screen */}
        <div className="mt-2 flex-grow rounded-md border-4 border-neutral-600 bg-green-100/90 p-2 shadow-inner">
           <div className='w-full h-full border border-neutral-500/50 rounded-sm' />
        </div>

        {/* Buttons */}
        <div className="mt-4 grid grid-cols-5 gap-y-2 gap-x-1.5 text-[9px] font-sans">
           
            {/* Top row - graphing */}
            <SmallButton className='bg-neutral-500'>Y=</SmallButton>
            <SmallButton className='bg-neutral-500'>WINDOW</SmallButton>
            <SmallButton className='bg-neutral-500'>ZOOM</SmallButton>
            <SmallButton className='bg-neutral-500'>TRACE</SmallButton>
            <SmallButton className='bg-neutral-500'>GRAPH</SmallButton>
            
            {/* Second row */}
            <SmallButton className="bg-blue-500">2nd</SmallButton>
            <SmallButton className="bg-green-600">ALPHA</SmallButton>
            <SmallButton>X,T,&#952;,n</SmallButton>
            <SmallButton>STAT</SmallButton>
            <SmallButton>TEST</SmallButton>

            {/* Third row & Arrow Pad */}
             <RectButton>APPS</RectButton>
             <RectButton>PRGM</RectButton>
             <RectButton>VARS</RectButton>
             <RectButton>CLEAR</RectButton>
             <div className="row-span-3 grid grid-cols-3 grid-rows-3 place-items-center">
                <div className="col-start-2 row-start-1 h-3 w-3 border-l-4 border-r-4 border-t-6 border-transparent border-t-neutral-800"></div>
                <div className="col-start-1 row-start-2 h-3 w-3 border-b-4 border-t-4 border-r-6 border-transparent border-r-neutral-800"></div>
                <div className="col-start-3 row-start-2 h-3 w-3 border-b-4 border-t-4 border-l-6 border-transparent border-l-neutral-800"></div>
                <div className="col-start-2 row-start-3 h-3 w-3 border-l-4 border-r-4 border-b-6 border-transparent border-b-neutral-800"></div>
            </div>

            {/* Fourth row */}
            <RectButton>MATRIX</RectButton>
            <RectButton>x⁻¹</RectButton>
            <RectButton>x²</RectButton>
            <RectButton>,</RectButton>

            {/* Fifth row */}
            <RectButton>log</RectButton>
            <RectButton>ln</RectButton>
            <RectButton>STO▸</RectButton>
            <RectButton className='bg-neutral-900 text-neutral-400'>ON</RectButton>

            {/* Numpad */}
            <div className="col-span-3 row-start-6 row-span-4 grid grid-cols-3 gap-y-2 gap-x-1.5">
                <RectButton className="bg-neutral-500 text-black">7</RectButton>
                <RectButton className="bg-neutral-500 text-black">8</RectButton>
                <RectButton className="bg-neutral-500 text-black">9</RectButton>
                <RectButton className="bg-neutral-500 text-black">4</RectButton>
                <RectButton className="bg-neutral-500 text-black">5</RectButton>
                <RectButton className="bg-neutral-500 text-black">6</RectButton>
                <RectButton className="bg-neutral-500 text-black">1</RectButton>
                <RectButton className="bg-neutral-500 text-black">2</RectButton>
                <RectButton className="bg-neutral-500 text-black">3</RectButton>
                <RectButton className="bg-neutral-500 text-black">0</RectButton>
                <RectButton className="bg-neutral-500 text-black">.</RectButton>
                <RectButton className="bg-neutral-500 text-black">(-)</RectButton>
            </div>
            
            {/* Operators */}
            <div className="col-start-4 col-span-2 row-start-6 row-span-4 grid grid-cols-2 gap-y-2 gap-x-1.5">
                <RectButton className="bg-neutral-600">(</RectButton>
                <RectButton className="bg-neutral-600">)</RectButton>
                <RectButton className="h-full bg-sky-600">÷</RectButton>
                <RectButton className="h-full bg-sky-600">×</RectButton>
                <RectButton className="h-full bg-sky-600">-</RectButton>
                <RectButton className="h-full bg-sky-600">+</RectButton>
            </div>
            
            {/* Enter Button */}
             <RectButton className="col-start-5 row-start-10 h-full bg-sky-600">ENTER</RectButton>


        </div>
      </div>
    </div>
  );
};
