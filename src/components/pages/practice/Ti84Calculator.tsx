
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
    <CalculatorButton className={cn('h-5 w-8 bg-neutral-600', className)}>
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
    <CalculatorButton className={cn('h-7 w-8 bg-neutral-800 border border-neutral-900', className)}>
        {children}
    </CalculatorButton>
);

export const Ti84Calculator: React.FC = () => {
  return (
    <div className="flex h-full w-full select-none flex-col items-center justify-center bg-neutral-200 dark:bg-neutral-900 p-4">
      <div className="flex h-full max-h-[600px] w-full max-w-[320px] flex-col rounded-xl bg-neutral-700 p-4 shadow-2xl ring-2 ring-neutral-800/50">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-sans text-sm font-bold text-yellow-300">
            TI-84 Plus
          </p>
          <p className="font-sans text-xs text-neutral-400">Silver Edition</p>
        </div>

        {/* Screen */}
        <div className="mt-2 flex-grow rounded-md border-4 border-neutral-600 bg-green-100/90 p-2 shadow-inner">
           <div className='w-full h-full border border-neutral-500/50 rounded-sm' />
        </div>

        {/* Buttons */}
        <div className="mt-4 grid grid-cols-5 grid-rows-10 gap-1.5 text-[10px]">
           
            {/* Row 1 */}
            <SmallButton className="bg-blue-500">2nd</SmallButton>
            <SmallButton className="bg-green-600">ALPHA</SmallButton>
            <SmallButton>X,T,&#952;,n</SmallButton>
            <SmallButton>STAT</SmallButton>
            <SmallButton>MATH</SmallButton>
            
            {/* Row 2 */}
            <RectButton>APPS</RectButton>
            <RectButton>PRGM</RectButton>
            <RectButton>VARS</RectButton>
            <RectButton>CLEAR</RectButton>
            <div className="col-start-1 col-end-5 row-start-3 grid grid-cols-4 gap-1.5">
                <RectButton className='bg-neutral-500'>x⁻¹</RectButton>
                <RectButton className='bg-neutral-500'>x²</RectButton>
                <RectButton className='bg-neutral-500'>,</RectButton>
                <RectButton className='bg-neutral-500'>EE</RectButton>
            </div>
            
             {/* Arrow Pad */}
             <div className="col-start-5 row-start-2 row-span-3 grid grid-cols-3 grid-rows-3 place-items-center">
                <div className="col-start-2 row-start-1 h-4 w-4 border-l-4 border-r-4 border-t-8 border-transparent border-t-neutral-800"></div>
                <div className="col-start-1 row-start-2 h-4 w-4 border-b-4 border-t-4 border-r-8 border-transparent border-r-neutral-800"></div>
                <div className="col-start-3 row-start-2 h-4 w-4 border-b-4 border-t-4 border-l-8 border-transparent border-l-neutral-800"></div>
                <div className="col-start-2 row-start-3 h-4 w-4 border-l-4 border-r-4 border-b-8 border-transparent border-b-neutral-800"></div>
            </div>

            {/* Row 3 */}
            <RectButton className='bg-neutral-500'>log</RectButton>
            <RectButton className='bg-neutral-500'>ln</RectButton>
            <RectButton className='bg-neutral-500'>STO▸</RectButton>
            <RectButton className='bg-neutral-500'>ON</RectButton>


            {/* Numpad */}
            <div className="col-span-3 row-start-5 row-span-4 grid grid-cols-3 gap-1.5">
                <RectButton>7</RectButton>
                <RectButton>8</RectButton>
                <RectButton>9</RectButton>
                <RectButton>4</RectButton>
                <RectButton>5</RectButton>
                <RectButton>6</RectButton>
                <RectButton>1</RectButton>
                <RectButton>2</RectButton>
                <RectButton>3</RectButton>
                <RectButton>0</RectButton>
                <RectButton>.</RectButton>
                <RectButton>(-) </RectButton>
            </div>
            
            {/* Operators */}
            <div className="col-start-4 col-span-2 row-start-5 row-span-5 grid grid-cols-2 gap-1.5">
                <RectButton className="h-full bg-blue-500">(</RectButton>
                <RectButton className="h-full bg-blue-500">)</RectButton>
                <RectButton className="h-full bg-blue-500">÷</RectButton>
                <RectButton className="h-full bg-blue-500">×</RectButton>
                <RectButton className="h-full bg-blue-500">-</RectButton>
                <RectButton className="h-full bg-blue-500">+</RectButton>
                <RectButton className="col-span-2 h-full bg-blue-500">ENTER</RectButton>
            </div>


        </div>
      </div>
    </div>
  );
};
