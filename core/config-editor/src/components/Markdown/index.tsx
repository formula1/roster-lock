
import { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open } from '@tauri-apps/plugin-shell';
import "./markdown.css";

export function Markdown(
  { children, className, style }: {
    children: string | null,
    className?: string,
    style?: CSSProperties
  }
){
  return (
    <div className={"markdown" + (!className ? "" : " " + className)} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e)=>{
                e.preventDefault();
                if(!href) return;
                open(href);
              }}
            >{children}</a>
          )
        }}
      >{children}</ReactMarkdown>
    </div>
  )
}
