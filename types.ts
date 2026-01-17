import React from 'react';

export interface NavItem {
  label: string;
  href: string;
}

export interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export interface Plan {
  name: string;
  price: string;
  features: string[];
  color: string;
  highlight?: boolean;
}
