declare global {
  // eslint-disable-next-line no-var
  var _jobscopeProcessHandlersRegistered: boolean | undefined;
}

export async function registerNodeInstrumentation() {
  if (global._jobscopeProcessHandlersRegistered) return;
  global._jobscopeProcessHandlersRegistered = true;

  const { errorToLog, logAppEvent } = await import("./lib/app-log");

  process.on("unhandledRejection", (reason) => {
    const details = errorToLog(reason);
    void logAppEvent({
      kind: "error",
      source: "process.unhandledRejection",
      message: details.message,
      stack: details.stack,
    });
  });

  process.on("uncaughtExceptionMonitor", (error) => {
    const details = errorToLog(error);
    void logAppEvent({
      kind: "error",
      source: "process.uncaughtException",
      message: details.message,
      stack: details.stack,
    });
  });
}
