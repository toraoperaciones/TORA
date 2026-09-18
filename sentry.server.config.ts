import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry-options";

const options = sentryOptions();
Sentry.init(options);
