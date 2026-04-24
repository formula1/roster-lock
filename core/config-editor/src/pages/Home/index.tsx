
import { Link } from "react-router-dom";
import { NewRosterConfigPaths  } from "../config-editor";
import { RecentFiles } from "./RecentFiles";
import { OpenFile } from "./OpenFile";

export function HomePage(){

  return (
    <div style={{ padding: '20px' }}>
      <h1>Roster Lock Config</h1>

      <div style={{ marginBottom: '30px' }}>
        <h2>Create New Config</h2>
        <Link to={NewRosterConfigPaths.Root}>
          <button>Create New</button>
        </Link>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Open Existing Config</h2>
        <OpenFile />
      </div>

      <div>
        <RecentFiles />
      </div>
    </div>
  )
}
