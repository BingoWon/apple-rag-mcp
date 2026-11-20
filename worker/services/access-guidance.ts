import { PLATFORM_URL as SUBSCRIPTION_URL } from "../../shared/contracts.js";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";

const freeQuota = OAUTH_SUBSCRIPTION_QUOTAS.hobby;
const proQuota = OAUTH_SUBSCRIPTION_QUOTAS.pro;

export const FREE_ACCESS_GUIDANCE = `Register for a free account at ${SUBSCRIPTION_URL}/ and configure your MCP Token to get ${freeQuota.week.toLocaleString("en-US")} tool calls/week and ${freeQuota.minute} tool calls/minute, shared by search, browse, and fetch. If you already have an account, configure its MCP Token instead.`;

export const PRO_UPGRADE_GUIDANCE = `Upgrade to Pro at ${SUBSCRIPTION_URL}/#pricing to get ${proQuota.week.toLocaleString("en-US")} tool calls/week and ${proQuota.minute} tool calls/minute, shared by search, browse, and fetch.`;
