// src/historian-calibration-extension.ts
var HISTORIAN_TEMPERATURE_ENV = "MAGIC_CONTEXT_HISTORIAN_TEMPERATURE";
var HISTORIAN_MAX_OUTPUT_TOKENS_ENV = "MAGIC_CONTEXT_HISTORIAN_MAX_OUTPUT_TOKENS";
function finiteNumber(value) {
  if (value === undefined || value.trim().length === 0)
    return;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function calibrateHistorianProviderPayload(payload, temperature, maxOutputTokens) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return payload;
  if (temperature === undefined && maxOutputTokens === undefined)
    return payload;
  const calibrated = { ...payload };
  const generationConfig = calibrated.generationConfig;
  if (typeof generationConfig === "object" && generationConfig !== null && !Array.isArray(generationConfig)) {
    calibrated.generationConfig = {
      ...generationConfig,
      ...temperature !== undefined ? { temperature } : {},
      ...maxOutputTokens !== undefined ? { maxOutputTokens } : {}
    };
    return calibrated;
  }
  const inferenceConfig = calibrated.inferenceConfig;
  if (typeof inferenceConfig === "object" && inferenceConfig !== null && !Array.isArray(inferenceConfig)) {
    calibrated.inferenceConfig = {
      ...inferenceConfig,
      ...temperature !== undefined ? { temperature } : {},
      ...maxOutputTokens !== undefined ? { maxTokens: maxOutputTokens } : {}
    };
    return calibrated;
  }
  if (temperature !== undefined) {
    calibrated.temperature = temperature;
  }
  if (maxOutputTokens !== undefined) {
    if ("max_output_tokens" in calibrated) {
      calibrated.max_output_tokens = maxOutputTokens;
    } else if ("max_completion_tokens" in calibrated) {
      calibrated.max_completion_tokens = maxOutputTokens;
    } else if ("max_tokens" in calibrated) {
      calibrated.max_tokens = maxOutputTokens;
    } else if ("maxTokens" in calibrated) {
      calibrated.maxTokens = maxOutputTokens;
    }
  }
  return calibrated;
}
function historianCalibrationExtension(pi) {
  const temperature = finiteNumber(process.env[HISTORIAN_TEMPERATURE_ENV]);
  const maxOutputTokens = finiteNumber(process.env[HISTORIAN_MAX_OUTPUT_TOKENS_ENV]);
  if (temperature === undefined && maxOutputTokens === undefined)
    return;
  pi.on("before_provider_request", (event) => calibrateHistorianProviderPayload(event.payload, temperature, maxOutputTokens));
}
export {
  HISTORIAN_MAX_OUTPUT_TOKENS_ENV,
  HISTORIAN_TEMPERATURE_ENV,
  calibrateHistorianProviderPayload,
  historianCalibrationExtension as default
};
