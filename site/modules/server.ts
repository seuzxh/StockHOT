// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import type { ServerModule } from "@aihot/backend/modules";
import { IFIND_SERVER_MODULE } from "../../modules/ifind/server.ts";
import { STOCKS_SERVER_MODULE } from "../../modules/stocks/server.ts";

export const SERVER_MODULES: readonly ServerModule[] = [IFIND_SERVER_MODULE, STOCKS_SERVER_MODULE];
