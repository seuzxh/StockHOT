// The modules this site runs (modules/<name>/, see docs/architecture.md). A module has a line in each list
// it has an entry for: here for its addresses (module.ts), in server.ts for its backend, in web.ts for its
// pages' parts. Each list keeps the order its entries appear in on the site.
import type { ModuleDeclaration } from "@aihot/contracts/modules";
import { IFIND_MODULE } from "../../modules/ifind/module.ts";
import { STOCKS_MODULE } from "../../modules/stocks/module.ts";
import { STOCK_REPORTS_MODULE } from "../../modules/stock-reports/module.ts";

export const MODULES: readonly ModuleDeclaration[] = [IFIND_MODULE, STOCKS_MODULE, STOCK_REPORTS_MODULE];
