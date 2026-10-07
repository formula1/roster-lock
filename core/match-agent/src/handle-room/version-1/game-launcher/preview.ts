import { ServerResponse } from "node:http";
import z from "zod";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { PiecePreview } from "@roster-lock/types";
import { V1Env } from "../globals/types";
import { engineCaster, pieceFileInfoCaster } from "../schema/lock";
import { requirePluginName } from "./shared";

const getPreviewBodySchema = z.object({
  engine: engineCaster, pieceType: z.string(), piece: pieceFileInfoCaster,
}).strict();

// Live per-piece preview for the selection screen's hover/focus panel - see
// GameLauncherPlugin["getPreview"]/["useDefaultPreview"]. Unlike every other
// route in this router, this one also needs this.fileDB, to turn the piece
// identity a browser can actually send (engine/pieceType/piece.{version,
// pathVariables}) into the real on-disk folder only match-agent can resolve.
//
// `source` tells the caller which of the two it got back ("piece" from
// getPreview, "default" from useDefaultPreview, null when neither produced
// anything). The plugin type collapses both into one PiecePreview, but a
// selection UI wants them ranked differently: a generic engine silhouette is
// worth *less* than the roster author's own humanInfo.image thumbnail, while
// a real portrait read out of the piece's own assets is worth more.
export const getGameLauncherPreview: HTTPRequestHandler = async function (
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const body = await jsonBody(req);
  const parsed = getPreviewBodySchema.safeParse(body);
  if(!parsed.success) throw new HTTPError(400, "Bad Form", parsed.error);
  const { engine, pieceType, piece } = parsed.data;

  // A piece is selectable before it's downloaded (see PieceTypeSection's own
  // "downloaded"/undefined tri-state) - no folder yet means there's nothing
  // for getPreview to read, so ask the plugin for its generic placeholder
  // instead (useDefaultPreview) rather than surfacing this as an error.
  let folder: string;
  try {
    folder = await this.fileDB.getPieceFolder(engine, pieceType, piece);
  } catch {
    const preview = await this.pluginRuntime.gameLauncher.useDefaultPreview(pluginName, pieceType);
    respond(res, preview ?? null, preview ? "default" : null);
    return;
  }

  const preview = await this.pluginRuntime.gameLauncher.getPreview(pluginName, pieceType, piece.pathVariables, folder);
  respond(res, preview ?? null, preview ? "piece" : null);
}

function respond(res: ServerResponse, preview: PiecePreview | null, source: "piece" | "default" | null): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ preview, source }));
}
