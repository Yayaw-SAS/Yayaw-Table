"use client";

import { ArrowUpRight, FileText } from "lucide-react";
import {
  type DetailField,
  type DetailLabels,
  type DetailRecord,
  detailDisplay,
} from "../../utils/record-details";

export function DetailValue({
  field,
  value,
  row,
  locale,
  labels,
}: {
  field: DetailField;
  value: unknown;
  row: DetailRecord;
  locale: string;
  labels: DetailLabels;
}) {
  const display = detailDisplay(field, value, row, locale, labels);
  switch (display.kind) {
    case "empty":
      return <span className="yayaw-detail-empty">{display.text}</span>;
    case "code":
      return (
        <pre className="yayaw-detail-code">
          <code>{display.text}</code>
        </pre>
      );
    case "badges":
      return (
        <span className="yayaw-detail-badges">
          {display.items?.map((item) => (
            <span className="yayaw-detail-badge" key={item.id}>
              {item.text}
            </span>
          ))}
        </span>
      );
    case "link":
      return (
        <a
          className="yayaw-detail-link"
          href={display.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {display.text}
          <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      );
    case "image":
      return (
        <a href={display.href} rel="noopener noreferrer" target="_blank">
          <img
            alt={field.label}
            className="yayaw-detail-image"
            height={160}
            loading="lazy"
            src={display.href}
            width={290}
          />
        </a>
      );
    case "items":
      return (
        <ul className="yayaw-detail-items">
          {display.items?.map((item) => (
            <li key={item.id}>
              <FileText aria-hidden="true" size={16} />
              {item.href ? (
                <a href={item.href} rel="noopener noreferrer" target="_blank">
                  {item.text}
                </a>
              ) : (
                <span>{item.text}</span>
              )}
            </li>
          ))}
        </ul>
      );
    default:
      return <span className="yayaw-detail-text">{display.text}</span>;
  }
}
