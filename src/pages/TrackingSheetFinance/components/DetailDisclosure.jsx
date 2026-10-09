import React from 'react';
import { ChevronRight } from 'lucide-react';
import './DetailDisclosure.css';

// Native disclosure keeps forms mounted: closing a section never loses a draft.
export default function DetailDisclosure({ title, description, children, defaultOpen = false }) {
  return <details className="finance-detail-disclosure" open={defaultOpen || undefined}>
    <summary><ChevronRight size={17} aria-hidden="true"/><span><strong>{title}</strong>{description && <small>{description}</small>}</span></summary>
    <div className="finance-detail-disclosure-content">{children}</div>
  </details>;
}
