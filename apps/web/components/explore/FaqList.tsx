'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function FaqList({ items }: { items: readonly { question: string; answer: string }[] }) {
  const [open, setOpen] = useState(0);
  return <div className="faq-list">{items.map((item, index) => { const expanded = open === index; const panelId = `faq-panel-${index}`; return <section className={expanded ? 'is-open' : ''} key={item.question}><button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? -1 : index)}><span>{item.question}</span><ChevronDown size={20} aria-hidden="true" /></button><div className="faq-answer" id={panelId} inert={!expanded ? true : undefined}><div><p>{item.answer}</p></div></div></section>; })}</div>;
}
