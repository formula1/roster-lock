
import { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useHost } from "../../globals/Host";
import "./markdown.css";

export function Markdown(
  { children, className, style }: {
    children: string | null,
    className?: string,
    style?: CSSProperties
  }
){
  const { openUrl } = useHost();

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
                openUrl(href);
              }}
            >{children}</a>
          )
        }}
      >{children}</ReactMarkdown>
    </div>
  )
}
