import React from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  isSelected?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  isSelected = false,
  onClick,
  isClickable = false,
}) => {
  const baseClasses = 'bg-white border rounded-lg shadow-sm';
  const selectedClasses = isSelected
    ? 'border-purple-500 bg-purple-50 shadow-md'
    : 'border-gray-200 hover:border-gray-300';
  const clickableClasses = isClickable || onClick
    ? 'cursor-pointer transition-all duration-200 hover:shadow-md'
    : '';

  return (
    <div
      className={clsx(
        baseClasses,
        selectedClasses,
        clickableClasses,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => (
  <div className={clsx('px-6 py-4 border-b border-gray-200', className)}>
    {children}
  </div>
);

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className }) => (
  <div className={clsx('px-6 py-4', className)}>
    {children}
  </div>
);

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => (
  <div className={clsx('px-6 py-4 border-t border-gray-200', className)}>
    {children}
  </div>
);
