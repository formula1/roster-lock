import { useParams } from "react-router-dom";
import { GameLauncherSettingsForm } from "../../components/GameLauncherSettingsForm";

export function GameLauncherDetailPage() {
  const { pluginName = "" } = useParams();
  return (
    <div className="page">
      <h1>{pluginName}</h1>
      <GameLauncherSettingsForm pluginName={pluginName} />
    </div>
  );
}
