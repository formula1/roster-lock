import { useState, CSSProperties } from "react";
import "./tabs.css";
import "./varients.css";
import { combineClassNames } from "../../utils/react";

export function PageArrayTabs({
  pages,
  className = '',
  navStyle = {},
  buttonStyle = {},
  contentStyle = {},
}: {
  pages: Array<null | { title: string, content: React.ReactNode }>;
  className?: string;
  navStyle?: CSSProperties;
  buttonStyle?: CSSProperties;
  contentStyle?: CSSProperties;
}){
  const [activePage, setActivePage] = useState(0);

  const page = pages[activePage];
  if(!page) return null;

  return <>
    <nav className={combineClassNames("tabs-nav", className)} style={{...navStyle}}>
      {pages.map((page, i) => (
        !page ? null :
        <button
          key={`${page.title}-${i}`}
          disabled={activePage === i}
          style={{...buttonStyle}}
          onClick={() => setActivePage(i)}
        >{page.title}</button>
      ))}
    </nav>
    <div style={{padding: '1rem 0', ...contentStyle}}>
      {page.content}
    </div>
  </>
}

import { Link, useLocation } from "react-router-dom";

type LocalURL = { pathname: string, search: string, hash: string };
export type Page = (
  & { title: string, isActive?: (location: LocalURL) => boolean }
  & (
    | { href: string }
    | { onClick: ()=>void }
  )
);

export function LinkTabs({
  pages,
  className = '',
  navStyle = {},
  linkStyle = {},
}: {
  pages: Array<null | Page>;
  className?: string;
  navStyle?: CSSProperties;
  linkStyle?: CSSProperties;
}){
  const location = useLocation();

  return (
    <nav className={combineClassNames("tabs-nav", className)} style={{...navStyle}}>
      {pages.map((page, i) => (
        !page ? null :
        "onClick" in page ? (
          <a
            href="#"
            key={`${page.title}-${i}`}
            onClick={(e) => {
              e.preventDefault();
              page.onClick();
            }}
            style={{
              ...linkStyle
            }}
          >{page.title}</a>
        ) : (
          <Link
            className={isActive(page, location) ? 'active' : ''}
            key={`${page.title}-${i}`}
            to={page.href}
            style={{
              ...linkStyle
            }}
          >{page.title}</Link>
        )
      ))}
    </nav>
  )
}

function isActive(page: Page, location: LocalURL){
  if(page.isActive) return page.isActive(location)
  if(!("href" in page)) return false;
  return location.pathname === page.href;
}
