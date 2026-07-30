import Markdown from "react-markdown";
import welcome from "./Welcome.md";

export function AboutPage(){
  return <>
    <Markdown>{welcome}</Markdown>
  </>
}
