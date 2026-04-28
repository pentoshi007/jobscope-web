import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNodeInstrumentation } = await import("./instrumentation-node");
  await registerNodeInstrumentation();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { errorToLog, logAppEvent } = await import("./lib/app-log");
  const details = errorToLog(error);
  await logAppEvent({
    kind: "error",
    source: `next.${context.routeType}`,
    path: request.path,
    message: details.message,
    stack: details.stack,
    meta: {
      method: request.method,
      routePath: context.routePath,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
    },
  });
};
