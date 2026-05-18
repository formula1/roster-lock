import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useRunnable, RunnableState } from "../../utils/react/runnable";

type ClicableButtonProps = PropsWithChildren<{
  onClick?: ()=>void,
  disabled?: boolean,
  type?: "button" | "submit" | "reset",
  className?: string,
}>;

export function ClickableButton({
  onClick,
  disabled = false,
  type = "button",
  className = "",
  children,
}: ClicableButtonProps){
  const [toggleError, setToggleError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const clickResult = useRunnable(useCallback(async ()=>{
    if(!onClick) return;
    await onClick();
  }, [onClick]));

  useEffect(()=>{
    if(clickResult.state !== RunnableState.FAILED) setToggleError(false);
    else setToggleError(true);
  }, [clickResult.state]);

  useEffect(()=>{
    if(clickResult.state === RunnableState.SUCCESS) {
      setShowSuccess(true);
      const timer = setTimeout(()=>{
        setShowSuccess(false);
      }, 1000);
      return ()=>clearTimeout(timer);
    }
  }, [clickResult.state]);

  switch(clickResult.state){
    case RunnableState.INACTIVE: return (
      <div>
        <button
          className={className}
          onClick={onClick}
          disabled={disabled}
          type={type}
        >
          <span>{children}</span>
        </button>
      </div>
    );
    case RunnableState.PENDING: return (
      <div>Loading...</div>
    );
    case RunnableState.FAILED: return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div>
          <button
            className={className}
            onClick={onClick}
            disabled={disabled}
            type={type}
          >
            <span>{children}</span>
          </button>
        </div>
        {!toggleError ? null : (
          <article>
            <div>
              <p>Error</p>
              <button
                className="delete" aria-label="delete"
                onClick={()=>{setToggleError(false);}}
                ></button>
            </div>
            <div>
              <p><ErrorText error={clickResult.error} /></p>
              {import.meta.env.NODE_ENV === "development" && (
                <details>
                  <summary>Debug details</summary>
                  <pre>{JSON.stringify(clickResult.error, null, 2)}</pre>
                </details>
              )}
            </div>
          </article>
        )}
      </div>
    );
    case RunnableState.SUCCESS: return (
      <>
        <div>
          <button
            className={className}
            onClick={onClick}
            disabled={disabled}
            type={type}
          >
            <span>{children}</span>
          </button>
          {showSuccess && (
            <div>✓ Success</div>
          )}
        </div>
      </>
    );
    default: return <div>Unknown State</div>;
  }
}

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";
function ErrorText({ error }: { error: any }){
  if(!error) return DEFAULT_ERROR_MESSAGE;
  if(typeof error === "string") return error;
  if(typeof error.message === "string") return error.message;
  return DEFAULT_ERROR_MESSAGE;
}
