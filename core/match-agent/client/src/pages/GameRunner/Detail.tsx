import { useParams } from "react-router-dom";
import { GameRunnerSettingsForm } from "../../components/GameRunnerSettingsForm";

export function GameRunnerDetailPage() {
  const { pluginName = "" } = useParams();
  return (
    <div className="page">
      <h1>{pluginName}</h1>
      <GameRunnerSettingsForm pluginName={pluginName} />
    </div>
  );
}
