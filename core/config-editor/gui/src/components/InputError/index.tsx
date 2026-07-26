
export function InputError({ children }: { children: React.ReactNode }){
  return (
    <div
      style={{ backgroundColor: "#FAA", padding: "0.5rem", borderRadius: "0.5rem" }}
    >{children}</div>
  )
}