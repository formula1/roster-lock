import { Link } from "react-router-dom";
import "./breadcrumb.css";

export interface BreadcrumbItem {
  title: string;
  href?: string;
  isActive?: boolean;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb-nav">
      <ol className="breadcrumb-list">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="breadcrumb-item">
            {index > 0 && <span className="breadcrumb-separator">/</span>}
            {item.href && !item.isActive ? (
              <Link to={item.href} className="breadcrumb-link">
                {item.title}
              </Link>
            ) : (
              <span className={`breadcrumb-text ${item.isActive ? 'active' : ''}`}>
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
