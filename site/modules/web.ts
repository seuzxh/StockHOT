// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import { STOCKS_WEB_MODULE } from "../../modules/stocks/web.tsx";

export const WEB_MODULES: readonly WebModule[] = [STOCKS_WEB_MODULE];
