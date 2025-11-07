var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/lib/openai.ts
import OpenAI from "openai";
var requiredEnvVars, missingVars, openai, MODEL;
var init_openai = __esm({
  "server/lib/openai.ts"() {
    "use strict";
    console.log("\u{1F527} Configuring Azure OpenAI...");
    requiredEnvVars = [
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_DEPLOYMENT_NAME"
    ];
    missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error("\u274C Missing required Azure OpenAI environment variables:");
      missingVars.forEach((varName) => console.error(`   - ${varName}`));
      console.error("\nPlease set the following environment variables in your .env file:");
      console.error("AZURE_OPENAI_API_KEY=your_azure_openai_api_key");
      console.error("AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com");
      console.error("AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name");
      console.error("AZURE_OPENAI_API_VERSION=2024-02-15-preview (optional)");
      throw new Error("Azure OpenAI configuration is missing. Please set the required environment variables.");
    }
    openai = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: {
        "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview"
      },
      defaultHeaders: {
        "api-key": process.env.AZURE_OPENAI_API_KEY
      }
    });
    MODEL = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    console.log("\u2705 Azure OpenAI configured successfully");
    console.log(`   Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
    console.log(`   Deployment: ${MODEL}`);
    console.log(`   API Version: ${process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview"}`);
  }
});

// server/lib/chartGenerator.ts
var chartGenerator_exports = {};
__export(chartGenerator_exports, {
  processChartData: () => processChartData
});
function toNumber(value) {
  if (value === null || value === void 0 || value === "") return NaN;
  const cleaned = String(value).replace(/[%,]/g, "").trim();
  return Number(cleaned);
}
function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const mmmYyMatch = str.match(/^([A-Za-z]{3})[-/]?(\d{2,4})$/);
  if (mmmYyMatch) {
    const monthNames = {
      "jan": 0,
      "feb": 1,
      "mar": 2,
      "apr": 3,
      "may": 4,
      "jun": 5,
      "jul": 6,
      "aug": 7,
      "sep": 8,
      "oct": 9,
      "nov": 10,
      "dec": 11
    };
    const month = monthNames[mmmYyMatch[1].toLowerCase().substring(0, 3)];
    if (month !== void 0) {
      let year = parseInt(mmmYyMatch[2]);
      if (year < 100) {
        year = year <= 30 ? 2e3 + year : 1900 + year;
      }
      return new Date(year, month, 1);
    }
  }
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }
  return null;
}
function compareValues(a, b) {
  const aStr = String(a);
  const bStr = String(b);
  const aDate = parseDate(aStr);
  const bDate = parseDate(bStr);
  if (aDate && bDate) {
    return aDate.getTime() - bDate.getTime();
  }
  return aStr.localeCompare(bStr);
}
function processChartData(data, chartSpec) {
  const { type, x, y, y2, aggregate = "none" } = chartSpec;
  console.log(`\u{1F50D} Processing chart: "${chartSpec.title}"`);
  console.log(`   Type: ${type}, X: "${x}", Y: "${y}", Aggregate: ${aggregate}`);
  if (!data || data.length === 0) {
    console.warn(`\u274C No data provided for chart: ${chartSpec.title}`);
    return [];
  }
  console.log(`   Data rows available: ${data.length}`);
  const firstRow = data[0];
  if (!firstRow) {
    console.warn(`\u274C No rows in data for chart: ${chartSpec.title}`);
    return [];
  }
  const availableColumns = Object.keys(firstRow);
  console.log(`   Available columns: [${availableColumns.join(", ")}]`);
  if (!firstRow.hasOwnProperty(x)) {
    console.warn(`\u274C Column "${x}" not found in data for chart: ${chartSpec.title}`);
    console.log(`   Available columns: [${availableColumns.join(", ")}]`);
    return [];
  }
  if (!firstRow.hasOwnProperty(y)) {
    console.warn(`\u274C Column "${y}" not found in data for chart: ${chartSpec.title}`);
    console.log(`   Available columns: [${availableColumns.join(", ")}]`);
    return [];
  }
  if (y2 && !firstRow.hasOwnProperty(y2)) {
    console.warn(`\u274C Column "${y2}" not found in data for secondary series of chart: ${chartSpec.title}`);
  }
  const xValues = data.map((row) => row[x]).filter((v) => v !== null && v !== void 0 && v !== "");
  const yValues = data.map((row) => row[y]).filter((v) => v !== null && v !== void 0 && v !== "");
  console.log(`   X column "${x}": ${xValues.length} valid values (sample: ${xValues.slice(0, 3).join(", ")})`);
  console.log(`   Y column "${y}": ${yValues.length} valid values (sample: ${yValues.slice(0, 3).join(", ")})`);
  if (xValues.length === 0) {
    console.warn(`\u274C No valid X values in column "${x}" for chart: ${chartSpec.title}`);
    console.log(`   Trying to find alternative X column...`);
    const alternativeX = availableColumns.find(
      (col) => col.toLowerCase().includes(x.toLowerCase().split(" ")[0]) || x.toLowerCase().split(" ")[0].includes(col.toLowerCase())
    );
    if (alternativeX) {
      console.log(`   Using alternative X column: "${alternativeX}"`);
      const newXValues = data.map((row) => row[alternativeX]).filter((v) => v !== null && v !== void 0 && v !== "");
      if (newXValues.length > 0) {
        console.log(`   Alternative X column has ${newXValues.length} valid values`);
        chartSpec.x = alternativeX;
        return processChartData(data, chartSpec);
      }
    }
    return [];
  }
  if (yValues.length === 0) {
    console.warn(`\u274C No valid Y values in column "${y}" for chart: ${chartSpec.title}`);
    console.log(`   Trying to find alternative Y column...`);
    const alternativeY = availableColumns.find(
      (col) => col.toLowerCase().includes(y.toLowerCase().split(" ")[0]) || y.toLowerCase().split(" ")[0].includes(col.toLowerCase())
    );
    if (alternativeY) {
      console.log(`   Using alternative Y column: "${alternativeY}"`);
      const newYValues = data.map((row) => row[alternativeY]).filter((v) => v !== null && v !== void 0 && v !== "");
      if (newYValues.length > 0) {
        console.log(`   Alternative Y column has ${newYValues.length} valid values`);
        chartSpec.y = alternativeY;
        return processChartData(data, chartSpec);
      }
    }
    return [];
  }
  if (type === "scatter") {
    let scatterData = data.map((row) => ({
      [x]: toNumber(row[x]),
      [y]: toNumber(row[y])
    })).filter((row) => !isNaN(row[x]) && !isNaN(row[y]));
    console.log(`   Scatter plot: ${scatterData.length} valid numeric points`);
    if (scatterData.length > 1e3) {
      const step = Math.floor(scatterData.length / 1e3);
      scatterData = scatterData.filter((_, idx) => idx % step === 0).slice(0, 1e3);
      console.log(`   Sampled to ${scatterData.length} points for performance`);
    }
    return scatterData;
  }
  if (type === "pie") {
    console.log(`   Processing pie chart with aggregation: ${aggregate || "sum"}`);
    const aggregated = aggregateData(data, x, y, aggregate || "sum");
    console.log(`   Aggregated data points: ${aggregated.length}`);
    const result = aggregated.sort((a, b) => toNumber(b[y]) - toNumber(a[y])).slice(0, 5);
    console.log(`   Pie chart result: ${result.length} segments`);
    return result;
  }
  if (type === "bar") {
    console.log(`   Processing bar chart with aggregation: ${aggregate || "sum"}`);
    const aggregated = aggregateData(data, x, y, aggregate || "sum");
    console.log(`   Aggregated data points: ${aggregated.length}`);
    const result = aggregated.sort((a, b) => toNumber(b[y]) - toNumber(a[y])).slice(0, 10);
    console.log(`   Bar chart result: ${result.length} bars`);
    return result;
  }
  if (type === "line" || type === "area") {
    console.log(`   Processing ${type} chart`);
    if (aggregate && aggregate !== "none") {
      console.log(`   Using aggregation: ${aggregate}`);
      const aggregated = aggregateData(data, x, y, aggregate);
      console.log(`   Aggregated data points: ${aggregated.length}`);
      const result2 = aggregated.sort((a, b) => compareValues(a[x], b[x]));
      console.log(`   ${type} chart result: ${result2.length} points (sorted chronologically)`);
      return result2;
    }
    const result = data.map((row) => ({
      [x]: row[x],
      [y]: toNumber(row[y]),
      ...y2 ? { [y2]: toNumber(row[y2]) } : {}
    })).filter((row) => !isNaN(row[y]) && (!y2 || !isNaN(row[y2]))).sort((a, b) => compareValues(a[x], b[x]));
    console.log(`   ${type} chart result: ${result.length} points (sorted chronologically)`);
    return result;
  }
  console.warn(`\u274C Unknown chart type: ${type} for chart: ${chartSpec.title}`);
  return [];
}
function aggregateData(data, groupBy, valueColumn, aggregateType) {
  console.log(`     Aggregating by "${groupBy}" with "${aggregateType}" of "${valueColumn}"`);
  const grouped = /* @__PURE__ */ new Map();
  let validValues = 0;
  let invalidValues = 0;
  for (const row of data) {
    const key = String(row[groupBy]);
    const value = toNumber(row[valueColumn]);
    if (!isNaN(value)) {
      validValues++;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(value);
    } else {
      invalidValues++;
    }
  }
  console.log(`     Valid values: ${validValues}, Invalid values: ${invalidValues}`);
  console.log(`     Unique groups: ${grouped.size}`);
  const result = [];
  for (const [key, values] of Array.from(grouped.entries())) {
    let aggregatedValue;
    switch (aggregateType) {
      case "sum":
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case "mean":
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case "count":
        aggregatedValue = values.length;
        break;
      default:
        aggregatedValue = values[0];
    }
    result.push({
      [groupBy]: key,
      [valueColumn]: aggregatedValue
    });
  }
  console.log(`     Aggregation result: ${result.length} groups`);
  return result;
}
var init_chartGenerator = __esm({
  "server/lib/chartGenerator.ts"() {
    "use strict";
  }
});

// server/lib/insightGenerator.ts
var insightGenerator_exports = {};
__export(insightGenerator_exports, {
  generateChartInsights: () => generateChartInsights
});
async function generateChartInsights(chartSpec, chartData, summary) {
  if (!chartData || chartData.length === 0) {
    return {
      keyInsight: "No data available for analysis",
      recommendation: "Please check your data source and try again"
    };
  }
  const isDualAxis = chartSpec.type === "line" && !!chartSpec.y2;
  const y2Variable = chartSpec.y2;
  const y2Label = chartSpec.y2Label || y2Variable;
  const xValues = chartData.map((row) => row[chartSpec.x]).filter((v) => v !== null && v !== void 0);
  const yValues = chartData.map((row) => row[chartSpec.y]).filter((v) => v !== null && v !== void 0);
  const y2Values = isDualAxis ? chartData.map((row) => row[y2Variable]).filter((v) => v !== null && v !== void 0) : [];
  const numericX = xValues.map((v) => Number(String(v).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
  const numericY = yValues.map((v) => Number(String(v).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
  const numericY2 = isDualAxis ? y2Values.map((v) => Number(String(v).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v)) : [];
  const maxY = numericY.length > 0 ? Math.max(...numericY) : 0;
  const minY = numericY.length > 0 ? Math.min(...numericY) : 0;
  const avgY = numericY.length > 0 ? numericY.reduce((a, b) => a + b, 0) / numericY.length : 0;
  const percentile = (arr, p) => {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const roundSmart = (v) => {
    if (!isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1);
    if (abs >= 1) return v.toFixed(2);
    return v.toFixed(3);
  };
  const maxY2 = numericY2.length > 0 ? Math.max(...numericY2) : 0;
  const minY2 = numericY2.length > 0 ? Math.min(...numericY2) : 0;
  const avgY2 = numericY2.length > 0 ? numericY2.reduce((a, b) => a + b, 0) / numericY2.length : 0;
  const yIsPercent = yValues.some((v) => typeof v === "string" && v.includes("%"));
  const y2IsPercent = isDualAxis ? y2Values.some((v) => typeof v === "string" && v.includes("%")) : false;
  const formatY = (val) => yIsPercent ? `${roundSmart(val)}%` : roundSmart(val);
  const formatY2 = (val) => y2IsPercent ? `${roundSmart(val)}%` : roundSmart(val);
  const stdDev = (arr) => {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };
  const findTopPerformers = (data, yKey, limit = 3) => {
    return data.map((row) => ({ x: row[chartSpec.x], y: Number(String(row[yKey]).replace(/[%,,]/g, "")) })).filter((item) => !isNaN(item.y)).sort((a, b) => b.y - a.y).slice(0, limit);
  };
  const findBottomPerformers = (data, yKey, limit = 3) => {
    return data.map((row) => ({ x: row[chartSpec.x], y: Number(String(row[yKey]).replace(/[%,,]/g, "")) })).filter((item) => !isNaN(item.y)).sort((a, b) => a.y - b.y).slice(0, limit);
  };
  const yP25 = percentile(numericY, 0.25);
  const yP50 = percentile(numericY, 0.5);
  const yP75 = percentile(numericY, 0.75);
  const yP90 = percentile(numericY, 0.9);
  const yStdDev = stdDev(numericY);
  const yMedian = yP50;
  const y2P25 = isDualAxis && numericY2.length > 0 ? percentile(numericY2, 0.25) : NaN;
  const y2P50 = isDualAxis && numericY2.length > 0 ? percentile(numericY2, 0.5) : NaN;
  const y2P75 = isDualAxis && numericY2.length > 0 ? percentile(numericY2, 0.75) : NaN;
  const y2P90 = isDualAxis && numericY2.length > 0 ? percentile(numericY2, 0.9) : NaN;
  const y2StdDev = isDualAxis ? stdDev(numericY2) : 0;
  const y2Median = y2P50;
  const y2CV = isDualAxis && avgY2 !== 0 ? y2StdDev / Math.abs(avgY2) * 100 : 0;
  const y2Variability = isDualAxis ? y2CV > 30 ? "high" : y2CV > 15 ? "moderate" : "low" : "";
  const pearsonR = (xs, ys) => {
    const n = Math.min(xs.length, ys.length);
    if (n < 3) return NaN;
    const x = xs.slice(0, n);
    const y = ys.slice(0, n);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const mx = mean(x);
    const my = mean(y);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx;
      const dy = y[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const den = Math.sqrt(dx2 * dy2);
    return den === 0 ? NaN : num / den;
  };
  const isCorrelationChart = chartSpec._isCorrelationChart === true;
  const targetVariable = chartSpec._targetVariable || chartSpec.y;
  const factorVariable = chartSpec._factorVariable || chartSpec.x;
  const bothNumeric = numericX.length > 0 && numericY.length > 0;
  if (bothNumeric && !isCorrelationChart) {
    const yP80 = percentile(numericY, 0.8);
    const yP902 = percentile(numericY, 0.9);
    const yP752 = percentile(numericY, 0.75);
    const pairs = chartData.map((r2) => [Number(String(r2[chartSpec.x]).replace(/[%,,]/g, "")), Number(String(r2[chartSpec.y]).replace(/[%,,]/g, ""))]).filter(([vx, vy]) => !isNaN(vx) && !isNaN(vy));
    const top20Pairs = pairs.filter(([, vy]) => vy >= yP80);
    const top10Pairs = pairs.filter(([, vy]) => vy >= yP902);
    const xInTop20 = top20Pairs.map(([vx]) => vx);
    const xInTop10 = top10Pairs.map(([vx]) => vx);
    const xLow20 = percentile(xInTop20.length ? xInTop20 : numericX, 0.1);
    const xHigh20 = percentile(xInTop20.length ? xInTop20 : numericX, 0.9);
    const xLow10 = percentile(xInTop10.length ? xInTop10 : numericX, 0.1);
    const xHigh10 = percentile(xInTop10.length ? xInTop10 : numericX, 0.9);
    const avgXTop20 = xInTop20.length > 0 ? xInTop20.reduce((a, b) => a + b, 0) / xInTop20.length : NaN;
    const avgXTop10 = xInTop10.length > 0 ? xInTop10.reduce((a, b) => a + b, 0) / xInTop10.length : NaN;
    const r = pearsonR(numericX, numericY);
    const trend = isNaN(r) ? "" : r > 0.15 ? "positive" : r < -0.15 ? "negative" : "weak";
    const strength = isNaN(r) ? "" : Math.abs(r) > 0.7 ? "strong" : Math.abs(r) > 0.4 ? "moderate" : "weak";
    const keyInsight = isNaN(r) ? `${chartSpec.y} spans ${formatY(minY)}\u2013${formatY(maxY)} (avg ${formatY(avgY)}). Top 20% outcomes are \u2265${formatY(yP80)}.` : `${strength} ${trend} correlation (r=${roundSmart(r)}) between ${chartSpec.x} and ${chartSpec.y}. ${chartSpec.y} ranges ${formatY(minY)}\u2013${formatY(maxY)} (avg ${formatY(avgY)}).`;
    let recommendation = "";
    if (xInTop20.length > 0) {
      const xLow = isNaN(xLow20) ? roundSmart(percentile(numericX, 0.25)) : roundSmart(xLow20);
      const xHigh = isNaN(xHigh20) ? roundSmart(percentile(numericX, 0.75)) : roundSmart(xHigh20);
      recommendation = `To reach \u2265P80 ${chartSpec.y} (${formatY(yP80)}), keep ${chartSpec.x} in ${xLow}\u2013${xHigh}; current avg \u2248${roundSmart(avgXTop20)}.`;
    } else {
      const xP25Str = roundSmart(percentile(numericX, 0.25));
      const xP75Str = roundSmart(percentile(numericX, 0.75));
      recommendation = `Aim for ${chartSpec.y} \u2265P75 (${formatY(yP752)}); adjust ${chartSpec.x} toward ${xP25Str}\u2013${xP75Str}.`;
    }
    return { keyInsight, recommendation };
  }
  const topPerformers = findTopPerformers(chartData, chartSpec.y, 3);
  const bottomPerformers = findBottomPerformers(chartData, chartSpec.y, 3);
  const topPerformerStr = topPerformers.length > 0 ? topPerformers.map((p) => `${p.x} (${formatY(p.y)})`).join(", ") : "N/A";
  const bottomPerformerStr = bottomPerformers.length > 0 ? bottomPerformers.map((p) => `${p.x} (${formatY(p.y)})`).join(", ") : "N/A";
  const topPerformersY2 = isDualAxis ? findTopPerformers(chartData, y2Variable, 3) : [];
  const bottomPerformersY2 = isDualAxis ? findBottomPerformers(chartData, y2Variable, 3) : [];
  const topPerformerStrY2 = isDualAxis && topPerformersY2.length > 0 ? topPerformersY2.map((p) => `${p.x} (${formatY2(p.y)})`).join(", ") : "N/A";
  const bottomPerformerStrY2 = isDualAxis && bottomPerformersY2.length > 0 ? bottomPerformersY2.map((p) => `${p.x} (${formatY2(p.y)})`).join(", ") : "N/A";
  const cv = avgY !== 0 ? yStdDev / Math.abs(avgY) * 100 : 0;
  const variability = cv > 30 ? "high" : cv > 15 ? "moderate" : "low";
  const isCategoricalX = numericX.length === 0;
  let topCategories = "";
  if (isCategoricalX && chartData.length > 0) {
    const categoryStats = chartData.map((row) => ({ x: row[chartSpec.x], y: Number(String(row[chartSpec.y]).replace(/[%,,]/g, "")) })).filter((item) => !isNaN(item.y)).sort((a, b) => b.y - a.y).slice(0, 3);
    topCategories = categoryStats.map((c) => `${c.x} (${formatY(c.y)})`).join(", ");
  }
  const numericXValues = chartData.map((row) => Number(String(row[chartSpec.x]).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
  const xP25 = numericXValues.length > 0 ? percentile(numericXValues, 0.25) : NaN;
  const xP50 = numericXValues.length > 0 ? percentile(numericXValues, 0.5) : NaN;
  const xP75 = numericXValues.length > 0 ? percentile(numericXValues, 0.75) : NaN;
  const xP90 = numericXValues.length > 0 ? percentile(numericXValues, 0.9) : NaN;
  const avgX = numericXValues.length > 0 ? numericXValues.reduce((a, b) => a + b, 0) / numericXValues.length : NaN;
  const minX = numericXValues.length > 0 ? Math.min(...numericXValues) : NaN;
  const maxX = numericXValues.length > 0 ? Math.max(...numericXValues) : NaN;
  const topYIndices = chartData.map((row, idx) => ({ idx, y: Number(String(row[chartSpec.y]).replace(/[%,,]/g, "")) })).filter((item) => !isNaN(item.y)).sort((a, b) => b.y - a.y).slice(0, Math.min(10, Math.floor(chartData.length * 0.2))).map((item) => item.idx);
  const xValuesForTopY = topYIndices.map((idx) => Number(String(chartData[idx][chartSpec.x]).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
  const avgXForTopY = xValuesForTopY.length > 0 ? xValuesForTopY.reduce((a, b) => a + b, 0) / xValuesForTopY.length : NaN;
  const xRangeForTopY = xValuesForTopY.length > 0 ? {
    min: Math.min(...xValuesForTopY),
    max: Math.max(...xValuesForTopY),
    p25: percentile(xValuesForTopY, 0.25),
    p75: percentile(xValuesForTopY, 0.75)
  } : null;
  const xIsPercent = chartData.some((row) => {
    const xVal = row[chartSpec.x];
    return typeof xVal === "string" && xVal.includes("%");
  });
  const formatX = (val) => {
    if (isNaN(val)) return "N/A";
    if (xIsPercent) return `${roundSmart(val)}%`;
    return roundSmart(val);
  };
  const correlationContext = isCorrelationChart ? `
CRITICAL: This is a CORRELATION/IMPACT ANALYSIS chart.
- Y-axis (${chartSpec.y}) = TARGET VARIABLE we want to IMPROVE (${targetVariable})
- X-axis (${chartSpec.x}) = FACTOR VARIABLE we can CHANGE (${factorVariable})
- Recommendations MUST focus on: "How to change ${factorVariable} to improve ${targetVariable}"

X-AXIS STATISTICS (${factorVariable} - what we can change):
- Range: ${formatX(minX)} to ${formatX(maxX)}
- Average: ${formatX(avgX)}
- Median (P50): ${formatX(xP50)}
- Percentiles: P25=${formatX(xP25)}, P75=${formatX(xP75)}, P90=${formatX(xP90)}
${xRangeForTopY ? `- Optimal ${factorVariable} range for top Y performers: ${formatX(xRangeForTopY.min)}-${formatX(xRangeForTopY.max)} (avg: ${formatX(avgXForTopY)}, P25-P75: ${formatX(xRangeForTopY.p25)}-${formatX(xRangeForTopY.p75)})` : ""}

RECOMMENDATION FORMAT:
- Must explain how to CHANGE ${factorVariable} (X-axis) to IMPROVE ${targetVariable} (Y-axis)
- Use specific X-axis values/ranges from statistics above
- Example: "To improve ${targetVariable} to ${formatY(yP75)} or higher, adjust ${factorVariable} to ${formatX(xRangeForTopY?.p75 || xP75)}"
- Focus on actionable steps: "Adjust ${factorVariable} from current average of ${formatX(avgX)} to target range of ${formatX(xRangeForTopY?.p25 || xP25)}-${formatX(xRangeForTopY?.p75 || xP75)}"

` : "";
  const prompt = `Return JSON with exactly two short fields for this chart: keyInsight and recommendation. Each must be 1\u20132 sentences (\u2264220 chars), chart-specific, and include concrete numbers. No bullets.

CHART CONTEXT
- Type: ${chartSpec.type}
- Title: ${chartSpec.title}
- X: ${chartSpec.x}${isCorrelationChart ? " (FACTOR)" : ""}
- Y: ${chartSpec.y}${isCorrelationChart ? " (TARGET)" : ""}${isDualAxis ? ` | Y2: ${y2Label}` : ""}
- Points: ${chartData.length}
- Y stats: ${formatY(minY)}\u2013${formatY(maxY)} (avg ${formatY(avgY)}, P75 ${formatY(yP75)})${isDualAxis ? ` | Y2: ${formatY2(minY2)}\u2013${formatY2(maxY2)} (avg ${formatY2(avgY2)})` : ""}

${correlationContext}

OUTPUT JSON (exact keys only):
{
  "keyInsight": "1\u20132 sentences, chart-specific with numbers",
  "recommendation": "1\u20132 sentences with a numeric target/range on ${chartSpec.x} or ${chartSpec.y}"
}`;
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a precise data analyst. Output JSON with exactly two short fields: keyInsight and recommendation. Each must be 1\u20132 sentences (\u2264220 chars), chart-specific, include numbers, and be actionable. No bullets."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 220
    });
    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);
    if (result.insights && Array.isArray(result.insights) && result.insights.length > 0) {
      if (isDualAxis) {
        const insightsText = result.insights.map(
          (i) => `${i.title || ""} ${i.observation || ""} ${i.text || ""}`.toLowerCase()
        ).join(" ");
        const mentionsY = insightsText.includes(chartSpec.y.toLowerCase());
        const mentionsY2 = insightsText.includes(y2Label.toLowerCase()) || insightsText.includes(y2Variable.toLowerCase());
        if (mentionsY && !mentionsY2) {
          console.warn(`\u26A0\uFE0F Dual-axis chart insights only mention ${chartSpec.y}, missing ${y2Label}. Adding fallback insight.`);
          const y2TopPerformer = topPerformersY2.length > 0 ? topPerformersY2[0] : null;
          const y2BottomPerformer = bottomPerformersY2.length > 0 ? bottomPerformersY2[0] : null;
          let observationParts = [];
          observationParts.push(`${y2Label} ranges from ${formatY2(minY2)} to ${formatY2(maxY2)} (average: ${formatY2(avgY2)}, median: ${formatY2(y2Median)})`);
          if (!isNaN(y2CV)) {
            observationParts.push(`demonstrates ${y2Variability} variability (CV: ${roundSmart(y2CV)}%)`);
          }
          if (!isNaN(y2P90) && !isNaN(y2P25)) {
            observationParts.push(`with 90th percentile at ${formatY2(y2P90)} and 25th percentile at ${formatY2(y2P25)}`);
          }
          if (y2TopPerformer) {
            observationParts.push(`Peak performance observed at ${y2TopPerformer.x} (${formatY2(y2TopPerformer.y)})`);
          }
          if (y2BottomPerformer) {
            observationParts.push(`lowest value recorded at ${y2BottomPerformer.x} (${formatY2(y2BottomPerformer.y)})`);
          }
          const fallbackObservation = observationParts.join(". ") + ".";
          let recommendationParts = [];
          if (!isNaN(y2P75)) {
            recommendationParts.push(`Target ${y2Label} above the 75th percentile threshold of ${formatY2(y2P75)} to align with top-performing periods`);
          }
          if (topPerformersY2.length > 0) {
            const topPeriods = topPerformersY2.slice(0, 2).map((p) => `${p.x} (${formatY2(p.y)})`).join(" and ");
            recommendationParts.push(`Focus on replicating strategies from top-performing periods like ${topPeriods}`);
          }
          if (y2BottomPerformer && !isNaN(y2P75)) {
            const improvement = ((y2P75 - y2BottomPerformer.y) / y2BottomPerformer.y * 100).toFixed(0);
            recommendationParts.push(`Increase values in underperforming periods such as ${y2BottomPerformer.x} (${formatY2(y2BottomPerformer.y)}) by at least ${improvement}% to reach the median of ${formatY2(y2Median)}`);
          }
          const fallbackRecommendation = recommendationParts.join(". ") + ".";
          result.insights.push({
            title: `**${y2Label} Performance Analysis**`,
            observation: fallbackObservation,
            whyItMatters: `Monitoring ${y2Label} performance is critical for understanding overall business trends and identifying optimization opportunities. Consistent performance above benchmark levels indicates strong operational efficiency.`,
            recommendation: fallbackRecommendation
          });
        } else if (!mentionsY && mentionsY2) {
          console.warn(`\u26A0\uFE0F Dual-axis chart insights only mention ${y2Label}, missing ${chartSpec.y}. Adding fallback insight.`);
          const yTopPerformer = topPerformers.length > 0 ? topPerformers[0] : null;
          const yBottomPerformer = bottomPerformers.length > 0 ? bottomPerformers[0] : null;
          let observationParts = [];
          observationParts.push(`${chartSpec.y} ranges from ${formatY(minY)} to ${formatY(maxY)} (average: ${formatY(avgY)}, median: ${formatY(yMedian)})`);
          if (!isNaN(cv)) {
            observationParts.push(`demonstrates ${variability} variability (CV: ${roundSmart(cv)}%)`);
          }
          if (!isNaN(yP90) && !isNaN(yP25)) {
            observationParts.push(`with 90th percentile at ${formatY(yP90)} and 25th percentile at ${formatY(yP25)}`);
          }
          if (yTopPerformer) {
            observationParts.push(`Peak performance observed at ${yTopPerformer.x} (${formatY(yTopPerformer.y)})`);
          }
          if (yBottomPerformer) {
            observationParts.push(`lowest value recorded at ${yBottomPerformer.x} (${formatY(yBottomPerformer.y)})`);
          }
          const fallbackObservation = observationParts.join(". ") + ".";
          let recommendationParts = [];
          if (!isNaN(yP75)) {
            recommendationParts.push(`Target ${chartSpec.y} above the 75th percentile threshold of ${formatY(yP75)} to align with top-performing periods`);
          }
          if (topPerformers.length > 0) {
            const topPeriods = topPerformers.slice(0, 2).map((p) => `${p.x} (${formatY(p.y)})`).join(" and ");
            recommendationParts.push(`Focus on replicating strategies from top-performing periods like ${topPeriods}`);
          }
          if (yBottomPerformer && !isNaN(yP75)) {
            const improvement = ((yP75 - yBottomPerformer.y) / yBottomPerformer.y * 100).toFixed(0);
            recommendationParts.push(`Increase values in underperforming periods such as ${yBottomPerformer.x} (${formatY(yBottomPerformer.y)}) by at least ${improvement}% to reach the median of ${formatY(yMedian)}`);
          }
          const fallbackRecommendation = recommendationParts.join(". ") + ".";
          result.insights.unshift({
            title: `**${chartSpec.y} Performance Analysis**`,
            observation: fallbackObservation,
            whyItMatters: `Monitoring ${chartSpec.y} performance is critical for understanding overall business trends and identifying optimization opportunities. Consistent performance above benchmark levels indicates strong operational efficiency.`,
            recommendation: fallbackRecommendation
          });
        }
      }
      const take2 = (s) => (s || "").replace(/\s+/g, " ").trim();
      const cap2 = (s, n = 220) => s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;
      const first = result.insights[0] || {};
      const title = take2(first.title || "Insight");
      const observation = take2(first.observation || first.text || "");
      const recText = take2(first.recommendation || "");
      const conciseInsight = cap2([title, observation].filter(Boolean).join(": "));
      const conciseRecommendation = cap2(recText.length ? recText : "Consider an actionable adjustment based on the observed pattern.");
      return {
        keyInsight: conciseInsight,
        recommendation: conciseRecommendation
      };
    }
    const take = (s) => (s || "").replace(/\s+/g, " ").trim();
    const cap = (s, n = 220) => s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;
    return {
      keyInsight: cap(take(result.keyInsight || "Data shows interesting patterns worth investigating")),
      recommendation: cap(take(result.recommendation || "Consider further analysis to understand the underlying factors"))
    };
  } catch (error) {
    console.error("Error generating chart insights:", error);
    return {
      keyInsight: `This ${chartSpec.type} chart shows ${chartData.length} data points with values ranging from ${minY.toFixed(2)} to ${maxY.toFixed(2)}`,
      recommendation: "Review the data patterns and consider how they align with your business objectives"
    };
  }
}
var init_insightGenerator = __esm({
  "server/lib/insightGenerator.ts"() {
    "use strict";
    init_openai();
  }
});

// server/lib/correlationAnalyzer.ts
function toNumber2(value) {
  if (value === null || value === void 0 || value === "") return NaN;
  const cleaned = String(value).replace(/[%,]/g, "").trim();
  return Number(cleaned);
}
function linearRegression(xValues, yValues) {
  const n = Math.min(xValues.length, yValues.length);
  if (n === 0) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xValues[i];
    const y = yValues[i];
    if (isNaN(x) || isNaN(y)) continue;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
async function analyzeCorrelations(data, targetVariable, numericColumns, filter = "all") {
  console.log("=== CORRELATION ANALYSIS DEBUG ===");
  console.log("Target variable:", targetVariable);
  console.log("Numeric columns to analyze:", numericColumns);
  console.log("Data rows:", data.length);
  const correlations = calculateCorrelations(data, targetVariable, numericColumns);
  console.log("Correlations calculated:", correlations);
  console.log("=== RAW CORRELATION VALUES DEBUG ===");
  correlations.forEach((corr, idx) => {
    console.log(`RAW ${idx + 1}. ${corr.variable}: ${corr.correlation} (${corr.correlation > 0 ? "POSITIVE" : "NEGATIVE"})`);
  });
  console.log("=== END RAW CORRELATION DEBUG ===");
  if (correlations.length === 0) {
    console.error("No correlations found!");
    return { charts: [], insights: [] };
  }
  let filteredCorrelations = correlations;
  if (filter === "positive") {
    filteredCorrelations = correlations.filter((c) => c.correlation > 0);
    console.log(`Filtering: Showing only POSITIVE correlations (${filteredCorrelations.length} of ${correlations.length})`);
  } else if (filter === "negative") {
    filteredCorrelations = correlations.filter((c) => c.correlation < 0);
    console.log(`Filtering: Showing only NEGATIVE correlations (${filteredCorrelations.length} of ${correlations.length})`);
  }
  if (filteredCorrelations.length === 0) {
    const filterMessage = filter === "positive" ? "No positive correlations found." : filter === "negative" ? "No negative correlations found." : "No correlations found.";
    console.warn(filterMessage);
    return {
      charts: [],
      insights: [{
        id: 1,
        text: `**No ${filter === "positive" ? "positive" : "negative"} correlations found:** ${filterMessage} All correlations with ${targetVariable} are ${filter === "positive" ? "negative" : "positive"}.`
      }]
    };
  }
  const sortedCorrelations = filteredCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  const topCorrelations = sortedCorrelations.slice(0, 12);
  const scatterCharts = topCorrelations.slice(0, 3).map((corr, idx) => {
    const scatterData = data.map((row) => ({
      [corr.variable]: toNumber2(row[corr.variable]),
      [targetVariable]: toNumber2(row[targetVariable])
    })).filter((row) => !isNaN(row[corr.variable]) && !isNaN(row[targetVariable])).slice(0, 1e3);
    const xAxis = corr.variable;
    const yAxis = targetVariable;
    let xDomain;
    let yDomain;
    let trendLine;
    if (scatterData.length > 0) {
      const xValues = scatterData.map((row) => row[xAxis]);
      const yValues = scatterData.map((row) => row[yAxis]);
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      const xRange = xMax - xMin;
      const yRange = yMax - yMin;
      const xPadding = xRange > 0 ? xRange * 0.1 : 1;
      const yPadding = yRange > 0 ? yRange * 0.1 : 1;
      if (isFinite(xMin) && isFinite(xMax)) {
        xDomain = [xMin - xPadding, xMax + xPadding];
      }
      if (isFinite(yMin) && isFinite(yMax)) {
        yDomain = [yMin - yPadding, yMax + yPadding];
      }
      const regression = linearRegression(xValues, yValues);
      if (regression) {
        const xMinForLine = xDomain ? xDomain[0] : xMin;
        const xMaxForLine = xDomain ? xDomain[1] : xMax;
        const yAtMin = regression.slope * xMinForLine + regression.intercept;
        const yAtMax = regression.slope * xMaxForLine + regression.intercept;
        trendLine = [
          { [xAxis]: xMinForLine, [yAxis]: yAtMin },
          { [xAxis]: xMaxForLine, [yAxis]: yAtMax }
        ];
      }
    }
    console.log(`Scatter chart ${idx}: ${corr.variable} (X-axis, factor) vs ${targetVariable} (Y-axis, target), data points: ${scatterData.length}${xDomain ? `, xDomain: [${xDomain[0].toFixed(1)}, ${xDomain[1].toFixed(1)}]` : ""}${yDomain ? `, yDomain: [${yDomain[0].toFixed(1)}, ${yDomain[1].toFixed(1)}]` : ""}${trendLine ? ", trend line: yes" : ", trend line: no"}`);
    return {
      type: "scatter",
      title: `${corr.variable} vs ${targetVariable} (r=${corr.correlation.toFixed(2)})`,
      x: xAxis,
      // Factor variable (what we can change)
      y: yAxis,
      // Target variable (what we want to improve)
      xLabel: xAxis,
      yLabel: yAxis,
      data: scatterData,
      ...xDomain && { xDomain },
      ...yDomain && { yDomain },
      ...trendLine && { trendLine },
      // Mark this as a correlation chart for insight generation
      _isCorrelationChart: true,
      _targetVariable: targetVariable,
      _factorVariable: corr.variable
    };
  });
  const charts = [...scatterCharts];
  if (topCorrelations.length > 1) {
    console.log("=== BAR CHART CORRELATION VALUES DEBUG ===");
    topCorrelations.forEach((corr, idx) => {
      console.log(`${idx + 1}. ${corr.variable}: ${corr.correlation} (${corr.correlation > 0 ? "POSITIVE" : "NEGATIVE"})`);
    });
    console.log("=== END BAR CHART DEBUG ===");
    const correlationBarChart = {
      type: "bar",
      title: `Factors Affecting ${targetVariable}`,
      x: "variable",
      y: "correlation",
      xLabel: "variable",
      yLabel: "correlation",
      data: topCorrelations.map((corr) => ({
        variable: corr.variable,
        correlation: corr.correlation
        // CRITICAL: Keep original sign (positive/negative)
      }))
    };
    console.log("=== FINAL BAR CHART DATA DEBUG ===");
    console.log("Bar chart data being sent to frontend:");
    const barData = correlationBarChart.data || [];
    barData.forEach((item, idx) => {
      const corrVal = Number(item.correlation);
      console.log(`FINAL ${idx + 1}. ${item.variable}: ${corrVal} (${corrVal > 0 ? "POSITIVE" : "NEGATIVE"})`);
    });
    console.log("=== END FINAL BAR CHART DEBUG ===");
    charts.push(correlationBarChart);
  }
  console.log("Total charts generated:", charts.length);
  console.log("=== END CORRELATION DEBUG ===");
  try {
    const summaryStub2 = {
      rowCount: data.length,
      columnCount: Object.keys(data[0] || {}).length,
      columns: Object.keys(data[0] || {}).map((name) => ({ name, type: typeof (data[0] || {})[name], sampleValues: [] })),
      numericColumns,
      dateColumns: []
    };
    const chartsWithInsights = await Promise.all(
      charts.map(async (c) => {
        const chartInsights = await generateChartInsights(c, c.data || [], summaryStub2);
        return { ...c, keyInsight: chartInsights.keyInsight, recommendation: chartInsights.recommendation };
      })
    );
    charts.splice(0, charts.length, ...chartsWithInsights);
  } catch (e) {
    console.error("Failed to enrich correlation charts with insights:", e);
  }
  const summaryStub = {
    rowCount: data.length,
    columnCount: Object.keys(data[0] || {}).length,
    columns: Object.keys(data[0] || {}).map((name) => ({ name, type: typeof (data[0] || {})[name], sampleValues: [] })),
    numericColumns,
    dateColumns: []
  };
  const insights = await generateCorrelationInsights(targetVariable, sortedCorrelations, data, summaryStub, filter);
  return { charts, insights };
}
function calculateCorrelations(data, targetVariable, numericColumns) {
  const correlations = [];
  const targetValuesAllRows = data.map((row) => toNumber2(row[targetVariable]));
  const hasAnyTarget = targetValuesAllRows.some((v) => !isNaN(v));
  if (!hasAnyTarget) return [];
  for (const col of numericColumns) {
    if (col === targetVariable) continue;
    const x = [];
    const y = [];
    for (let i = 0; i < data.length; i++) {
      const tv = targetValuesAllRows[i];
      const cv = toNumber2(data[i][col]);
      if (!isNaN(tv) && !isNaN(cv)) {
        x.push(tv);
        y.push(cv);
      }
    }
    if (x.length === 0) continue;
    const correlation = pearsonCorrelation(x, y);
    if (!isNaN(correlation)) {
      correlations.push({ variable: col, correlation, nPairs: x.length });
    }
  }
  return correlations;
}
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return NaN;
  const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
  const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
  const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denominator === 0 ? NaN : numerator / denominator;
}
async function generateCorrelationInsights(targetVariable, correlations, data, summary, filter = "all") {
  const correlationFilter = filter || "all";
  let quantifiedStats = "";
  if (data && data.length > 0 && summary) {
    const top3Correlations = correlations.slice(0, 3);
    quantifiedStats = "\n\nQUANTIFIED STATISTICS FOR TOP FACTORS:\n";
    for (const corr of top3Correlations) {
      const factorValues = data.map((row) => Number(String(row[corr.variable]).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
      const targetValues = data.map((row) => Number(String(row[targetVariable]).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
      if (factorValues.length > 0 && targetValues.length > 0) {
        const factorAvg = factorValues.reduce((a, b) => a + b, 0) / factorValues.length;
        const factorMin = Math.min(...factorValues);
        const factorMax = Math.max(...factorValues);
        const factorP25 = factorValues.sort((a, b) => a - b)[Math.floor(factorValues.length * 0.25)];
        const factorP75 = factorValues.sort((a, b) => a - b)[Math.floor(factorValues.length * 0.75)];
        const targetAvg = targetValues.reduce((a, b) => a + b, 0) / targetValues.length;
        const targetMin = Math.min(...targetValues);
        const targetMax = Math.max(...targetValues);
        const targetP75 = targetValues.sort((a, b) => a - b)[Math.floor(targetValues.length * 0.75)];
        const targetP90 = targetValues.sort((a, b) => a - b)[Math.floor(targetValues.length * 0.9)];
        const pairs = data.map((row) => ({
          factor: Number(String(row[corr.variable]).replace(/[%,,]/g, "")),
          target: Number(String(row[targetVariable]).replace(/[%,,]/g, ""))
        })).filter((p) => !isNaN(p.factor) && !isNaN(p.target));
        const topTargetPairs = pairs.sort((a, b) => b.target - a.target).slice(0, Math.min(10, Math.floor(pairs.length * 0.2)));
        const optimalFactorRange = topTargetPairs.length > 0 ? {
          min: Math.min(...topTargetPairs.map((p) => p.factor)),
          max: Math.max(...topTargetPairs.map((p) => p.factor)),
          avg: topTargetPairs.reduce((sum, p) => sum + p.factor, 0) / topTargetPairs.length
        } : null;
        const formatValue = (val, isPercent = false) => {
          if (!isFinite(val)) return "N/A";
          const abs = Math.abs(val);
          const fmt = abs >= 100 ? val.toFixed(0) : abs >= 10 ? val.toFixed(1) : abs >= 1 ? val.toFixed(2) : val.toFixed(3);
          return isPercent ? `${fmt}%` : fmt;
        };
        const factorIsPercent = data.some((row) => typeof row[corr.variable] === "string" && row[corr.variable].includes("%"));
        const targetIsPercent = data.some((row) => typeof row[targetVariable] === "string" && row[targetVariable].includes("%"));
        quantifiedStats += `
${corr.variable} (r=${corr.correlation.toFixed(2)}):
- Factor range: ${formatValue(factorMin, factorIsPercent)} to ${formatValue(factorMax, factorIsPercent)} (avg: ${formatValue(factorAvg, factorIsPercent)}, P25-P75: ${formatValue(factorP25, factorIsPercent)}-${formatValue(factorP75, factorIsPercent)})
- Target range: ${formatValue(targetMin, targetIsPercent)} to ${formatValue(targetMax, targetIsPercent)} (avg: ${formatValue(targetAvg, targetIsPercent)}, P75: ${formatValue(targetP75, targetIsPercent)}, P90: ${formatValue(targetP90, targetIsPercent)})
${optimalFactorRange ? `- Optimal ${corr.variable} range for top ${targetVariable} performers: ${formatValue(optimalFactorRange.min, factorIsPercent)}-${formatValue(optimalFactorRange.max, factorIsPercent)} (avg: ${formatValue(optimalFactorRange.avg, factorIsPercent)})` : ""}
`;
      }
    }
  }
  const filterContext = correlationFilter === "positive" ? "\nIMPORTANT: The user specifically requested ONLY POSITIVE correlations. All correlations shown are positive. Focus your insights on these positive relationships only." : correlationFilter === "negative" ? "\nIMPORTANT: The user specifically requested ONLY NEGATIVE correlations. All correlations shown are negative. Focus your insights on these negative relationships only." : "";
  const prompt = `Analyze these correlations with ${targetVariable}.${filterContext}

DATA HANDLING RULES (must follow exactly):
- Pearson correlation using pairwise deletion: if either value is NA on a row, exclude that row; do not impute.
- Use the EXACT signed correlation values provided; never change the sign.
- Cover ALL variables at least once in the insights (do not omit any listed below).
${correlationFilter === "positive" ? "- All correlations shown are POSITIVE (user filtered out negative ones)." : ""}
${correlationFilter === "negative" ? "- All correlations shown are NEGATIVE (user filtered out positive ones)." : ""}

VALUES (variable: r, nPairs):
${correlations.map((c) => `- ${c.variable}: ${c.correlation.toFixed(3)}, n=${c.nPairs ?? "NA"}`).join("\n")}
${quantifiedStats}

CRITICAL CONTEXT:
- ${targetVariable} is the TARGET VARIABLE we want to IMPROVE (Y-axis)
- The listed variables are FACTOR VARIABLES we can CHANGE (X-axis)
- Recommendations MUST explain: "How to change [FACTOR] to improve [TARGET]"

Write 5-7 insights. Each must include:
1. **Bold headline** with the key finding
2. Exact r and nPairs values
3. Interpretation of the relationship
4. **Actionable recommendation** that includes:
   - Keep the current contextual recommendation (explaining the relationship)
   - ADD a quantified recommendation with specific targets: "To improve ${targetVariable} to [target value], adjust [factor variable] to [specific value/range]"
   - Use specific numbers from the quantified statistics above (optimal ranges, percentiles, averages)
   - Example format: "**Current recommendation:** [explain relationship]. **Quantified Action:** To improve ${targetVariable} to P75 level ([target value]), adjust [factor] from current average ([current]) to optimal range ([optimal range]) or target value ([target value])."
5. Reminder that correlation != causation

Output JSON only: {"insights":[{"text":"..."}]}`;
  const response = await openai.chat.completions.create({
    model: MODEL || "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a senior data analyst providing detailed correlation insights. Be specific, use correlation values, and provide actionable recommendations. Output valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 2e3
  });
  const content = response.choices[0].message.content || "{}";
  try {
    const parsed = JSON.parse(content);
    const insightArray = parsed.insights || [];
    return insightArray.slice(0, 7).map((item, index) => ({
      id: index + 1,
      text: item.text || item.insight || String(item)
    }));
  } catch (error) {
    console.error("Error parsing correlation insights:", error);
    return [];
  }
}
var init_correlationAnalyzer = __esm({
  "server/lib/correlationAnalyzer.ts"() {
    "use strict";
    init_openai();
    init_insightGenerator();
  }
});

// server/lib/ragService.ts
function getVectorStore(sessionId) {
  if (!vectorStores.has(sessionId)) {
    vectorStores.set(sessionId, new VectorStore());
  }
  return vectorStores.get(sessionId);
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    console.error("Note: Make sure you have an embeddings deployment in Azure OpenAI");
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }
}
function chunkData(data, summary, sessionId) {
  const chunks = [];
  const store = getVectorStore(sessionId);
  summary.columns.forEach((col, idx) => {
    const sampleValues = data.slice(0, 10).map((row) => row[col.name]).filter((v) => v !== null && v !== void 0).slice(0, 5);
    const chunk = {
      id: `column_${idx}_${col.name}`,
      type: "column",
      content: `Column "${col.name}" (${col.type}): ${col.type === "numeric" ? "Numeric values" : "Categorical values"}. Sample values: ${sampleValues.join(", ")}. ${summary.numericColumns.includes(col.name) ? "This is a numeric column suitable for calculations and correlations." : ""}`,
      metadata: {
        columnName: col.name,
        columnType: col.type,
        isNumeric: summary.numericColumns.includes(col.name),
        isDate: summary.dateColumns.includes(col.name)
      }
    };
    chunks.push(chunk);
  });
  summary.numericColumns.slice(0, 5).forEach((col) => {
    const values = data.map((row) => Number(row[col])).filter((v) => !isNaN(v) && isFinite(v));
    if (values.length === 0) return;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const chunk = {
      id: `stat_${col}`,
      type: "statistical",
      content: `Statistical summary for "${col}": Range from ${min.toFixed(2)} to ${max.toFixed(2)}, average ${avg.toFixed(2)}, median ${median.toFixed(2)}. Total ${values.length} valid data points.`,
      metadata: {
        columnName: col,
        min,
        max,
        avg,
        median,
        count: values.length
      }
    };
    chunks.push(chunk);
  });
  const chunkSize = 50;
  for (let i = 0; i < Math.min(data.length, 200); i += chunkSize) {
    const chunkRows = data.slice(i, i + chunkSize);
    const rowDescriptions = chunkRows.slice(0, 3).map((row) => {
      const keyValues = Object.entries(row).slice(0, 5).map(([key, value]) => `${key}: ${value}`).join(", ");
      return `{${keyValues}}`;
    }).join("; ");
    const chunk = {
      id: `rows_${i}_${i + chunkSize}`,
      type: "row_group",
      content: `Data rows ${i + 1} to ${Math.min(i + chunkSize, data.length)}: Sample rows - ${rowDescriptions}. This represents ${chunkRows.length} data points from the dataset.`,
      metadata: {
        startIndex: i,
        endIndex: Math.min(i + chunkSize, data.length),
        rowCount: chunkRows.length
      }
    };
    chunks.push(chunk);
  }
  chunks.forEach((chunk) => store.addChunk(chunk));
  return chunks;
}
async function generateChunkEmbeddings(sessionId) {
  const store = getVectorStore(sessionId);
  const chunks = store.getAllChunks();
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (chunk) => {
        if (!chunk.embedding) {
          const embedding = await generateEmbedding(chunk.content);
          chunk.embedding = embedding;
          store.addChunk(chunk);
        }
      })
    );
    if (i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
async function retrieveRelevantContext(question, data, summary, chatHistory, sessionId, topK = 5) {
  const store = getVectorStore(sessionId);
  if (store.size() === 0) {
    chunkData(data, summary, sessionId);
    await generateChunkEmbeddings(sessionId);
  }
  const questionEmbedding = await generateEmbedding(question);
  const semanticResults = store.search(questionEmbedding, topK * 2);
  const questionLower = question.toLowerCase();
  const keywordResults = [];
  store.getAllChunks().forEach((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    const keywords = questionLower.split(/\s+/).filter((w) => w.length > 3);
    const matches = keywords.filter((kw) => contentLower.includes(kw)).length;
    if (matches > 0) {
      keywordResults.push({
        ...chunk,
        score: matches / keywords.length
        // Normalize by keyword count
      });
    }
  });
  const combined = /* @__PURE__ */ new Map();
  semanticResults.forEach((chunk) => {
    combined.set(chunk.id, {
      ...chunk,
      score: (chunk.score || 0) * 0.7
    });
  });
  keywordResults.forEach((chunk) => {
    const existing = combined.get(chunk.id);
    if (existing) {
      existing.score = (existing.score || 0) + (chunk.score || 0) * 0.3;
    } else {
      combined.set(chunk.id, {
        ...chunk,
        score: (chunk.score || 0) * 0.3
      });
    }
  });
  return Array.from(combined.values()).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, topK);
}
function clearVectorStore(sessionId) {
  vectorStores.delete(sessionId);
}
async function retrieveSimilarPastQA(question, chatHistory, topK = 2) {
  if (chatHistory.length < 2) return [];
  const qaPairs = [];
  for (let i = 0; i < chatHistory.length - 1; i++) {
    if (chatHistory[i].role === "user" && chatHistory[i + 1].role === "assistant") {
      qaPairs.push({
        question: chatHistory[i].content,
        answer: chatHistory[i + 1].content
      });
    }
  }
  if (qaPairs.length === 0) return [];
  const questionEmbedding = await generateEmbedding(question);
  const similarities = [];
  for (const qa of qaPairs) {
    const pastQEmbedding = await generateEmbedding(qa.question);
    const similarity = cosineSimilarity(questionEmbedding, pastQEmbedding);
    similarities.push({ qa, score: similarity });
  }
  return similarities.sort((a, b) => b.score - a.score).slice(0, topK).map(({ qa, score }) => ({
    id: `past_qa_${qa.question.substring(0, 20)}`,
    type: "past_qa",
    content: `Previous similar question: "${qa.question}"
Answer: "${qa.answer.substring(0, 200)}..."`,
    metadata: {
      originalQuestion: qa.question,
      originalAnswer: qa.answer
    },
    score
  }));
}
var EMBEDDING_MODEL, EMBEDDING_DIMENSION, VectorStore, vectorStores;
var init_ragService = __esm({
  "server/lib/ragService.ts"() {
    "use strict";
    init_openai();
    EMBEDDING_MODEL = "text-embedding-ada-002";
    EMBEDDING_DIMENSION = 1536;
    VectorStore = class {
      chunks = /* @__PURE__ */ new Map();
      embeddings = /* @__PURE__ */ new Map();
      addChunk(chunk) {
        this.chunks.set(chunk.id, chunk);
        if (chunk.embedding) {
          this.embeddings.set(chunk.id, chunk.embedding);
        }
      }
      getChunk(id) {
        return this.chunks.get(id);
      }
      getAllChunks() {
        return Array.from(this.chunks.values());
      }
      // Cosine similarity search
      search(queryEmbedding, topK = 5) {
        const results = [];
        for (const [id, embedding] of Array.from(this.embeddings.entries())) {
          const chunk = this.chunks.get(id);
          if (!chunk) continue;
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          results.push({ chunk, score: similarity });
        }
        return results.sort((a, b) => b.score - a.score).slice(0, topK).map((r) => ({ ...r.chunk, score: r.score }));
      }
      clear() {
        this.chunks.clear();
        this.embeddings.clear();
      }
      size() {
        return this.chunks.size;
      }
    };
    vectorStores = /* @__PURE__ */ new Map();
  }
});

// server/lib/agents/models.ts
function getModelForTask(task) {
  return MODELS[task];
}
var MODELS;
var init_models = __esm({
  "server/lib/agents/models.ts"() {
    "use strict";
    MODELS = {
      // Intent classification - faster and cheaper
      intent: process.env.AZURE_OPENAI_INTENT_MODEL || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
      // Text generation - more powerful
      generation: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      // Embeddings
      embeddings: "text-embedding-ada-002"
    };
  }
});

// server/lib/agents/intentClassifier.ts
import { z } from "zod";
function removeNulls(obj) {
  if (obj === null || obj === void 0) {
    return void 0;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeNulls).filter((item) => item !== void 0);
  }
  if (typeof obj === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = removeNulls(value);
      if (cleanedValue !== void 0) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : void 0;
  }
  return obj;
}
async function classifyIntent(question, chatHistory, summary, maxRetries = 2) {
  const recentHistory = chatHistory.slice(-10).filter((msg) => msg.content && msg.content.length < 500).map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  const historyContext = recentHistory ? `

CONVERSATION HISTORY:
${recentHistory}` : "";
  const allColumns = summary.columns.map((c) => c.name).join(", ");
  const numericColumns = (summary.numericColumns || []).join(", ");
  const dateColumns = (summary.dateColumns || []).join(", ");
  const prompt = `You are an intent classifier for a data analysis AI assistant. Analyze the user's question and extract their intent.

QUESTION: ${question}
${historyContext}

AVAILABLE DATA:
- Total rows: ${summary.rowCount}
- Total columns: ${summary.columnCount}
- All columns: ${allColumns}
- Numeric columns: ${numericColumns}
${dateColumns ? `- Date columns: ${dateColumns}` : ""}

CLASSIFICATION RULES:
1. "correlation" - User asks about relationships, what affects/influences something, or correlation between variables
2. "chart" - User explicitly requests a chart/visualization (line, bar, scatter, pie, area)
3. "statistical" - User asks for statistics (mean, median, average, sum, count, max, min, highest, lowest, best, worst) OR asks "which month/row/period has the [highest/lowest/best/worst] [variable]" - these are statistical queries, NOT comparison queries
4. "comparison" - User wants to compare variables, find "best" option, rank items, or asks "which is better/best" (vs, and, between, best competitor/product/brand, ranking)
5. "conversational" - Greetings, thanks, casual chat, questions about the bot
6. "custom" - Doesn't fit other categories

IMPORTANT: Questions like "what is the best competitor to X?" or "which product is best for Y?" should be classified as "comparison", NOT "correlation" or "custom".

IMPORTANT: Questions like "which month had the highest X?", "which was the best month for X?", "what is the maximum value of X?", or "which month had the best X?" should be classified as "statistical", NOT "correlation" or "comparison". The word "best" in the context of "which month/row/period" means highest/maximum value, which is a statistical query.

EXTRACTION RULES (GENERAL-PURPOSE - NO DOMAIN ASSUMPTIONS):
- Extract targetVariable: Any entity/variable the user wants to analyze (extract from natural language, don't assume domain)
- Extract variables array: Any related entities/variables mentioned
- Extract chartType: If user explicitly requests a chart type
- Extract filters (GENERAL constraint system):
  * correlationSign: "positive" if user wants only positive relationships (any phrasing: "only positive", "don't include negative", "exclude negative", "no negative impact", etc.)
  * correlationSign: "negative" if user wants only negative relationships
  * excludeVariables: ANY variables user wants to exclude (extract from phrases like "don't include X", "exclude Y", "not Z", "don't want X", etc.)
  * includeOnly: ANY variables user only wants to see (extract from "only show X", "just Y", "only X", etc.)
  * exceptions: Variables to exclude from "all" (extract from "all except X", "everything but Y", etc.)
  * minCorrelation/maxCorrelation: If user mentions correlation strength thresholds
- Extract relationships (GENERAL - works for ANY domain):
  * Primary entity: Extract from patterns like "X is my [entity]", "X is the [entity]", "X is [entity]" (entity can be brand, company, product, category, etc. - AI learns from context)
  * Related entities: Extract from patterns like "Y, Z are [relationship] [entities]", "Y and Z are [relationship]" (relationship can be sister, competitor, category, etc. - AI learns from context)
  * Relationship constraints: If user says "don't want [relationship] to have negative impact", extract:
    - The relationship type (sister, competitor, category, etc.)
    - The constraint (exclude negative correlations for those entities)
    - Store in excludeVariables with constraint metadata
- Extract constraints (GENERAL boolean logic):
  * Conditional filters: "if X is negative", "where Y > threshold", "above average"
  * Temporal filters: "last N months", "rolling average", "month-over-month"
  * Grouping filters: Any grouping the user defines (learned from context, not hardcoded)
- Extract axisMapping if user specifies axis assignments:
  * x: Column for X-axis (time, date, category, etc.)
  * y: Column for primary Y-axis (left axis)
  * y2: Column for secondary Y-axis (right axis) - extract from phrases like "add X on secondary Y axis", "X on secondary Y axis", "secondary Y axis: X", "add X to secondary axis"
- Set confidence: 0.9+ if clear intent, 0.7-0.9 if somewhat clear, <0.7 if ambiguous
- Set requiresClarification: true if confidence < 0.5

CRITICAL: Do NOT assume domain-specific terminology. Extract relationships and constraints GENERALLY. The AI should understand "X is my brand" and "X is my company" the same way - as defining a primary entity.

OUTPUT FORMAT (JSON only, no markdown):
{
  "type": "correlation" | "chart" | "statistical" | "conversational" | "comparison" | "custom",
  "confidence": 0.0-1.0,
  "targetVariable": "column_name" | null,
  "variables": ["col1", "col2"] | null,
  "chartType": "line" | "bar" | "scatter" | "pie" | "area" | null,
  "filters": {
    "correlationSign": "positive" | "negative" | "all" | null,
    "excludeVariables": ["col1"] | null,
    "includeOnly": ["col2"] | null,
    "exceptions": ["col3"] | null,
    "minCorrelation": 0.5 | null,
    "maxCorrelation": 0.9 | null
  } | null,
  "axisMapping": {
    "x": "col1" | null,
    "y": "col2" | null,
    "y2": "col3" | null  // Secondary Y-axis (right axis) - extract from "add X on secondary Y axis", "X on secondary axis", etc.
  } | null,
  "customRequest": "original question" | null,
  "requiresClarification": true | false
}`;
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getModelForTask("intent");
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are an intent classifier. Output only valid JSON. Be precise and extract all relevant information from the user query."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        // Lower temperature for more consistent classification
        max_tokens: 500
      });
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from LLM");
      }
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw parseError;
        }
      }
      const cleaned = removeNulls(parsed);
      if (!cleaned || typeof cleaned !== "object") {
        throw new Error("Cleaned parsed result is invalid");
      }
      if (!cleaned.type || typeof cleaned.confidence !== "number") {
        throw new Error("Missing required fields: type or confidence");
      }
      console.log("\u{1F9F9} Cleaned parsed result (removed nulls):", JSON.stringify(cleaned, null, 2));
      const validated = analysisIntentSchema.parse(cleaned);
      console.log(`\u2705 Intent classified: ${validated.type} (confidence: ${validated.confidence.toFixed(2)})`);
      return validated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`\u26A0\uFE0F Intent classification attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < maxRetries - 1) {
        console.log(`\u{1F504} Retrying with enhanced prompt...`);
      }
    }
  }
  console.error("\u274C Intent classification failed after retries, using fallback");
  const questionLower = question.toLowerCase();
  let fallbackType = "custom";
  if (questionLower.match(/\b(hi|hello|hey|thanks|thank you|bye)\b/)) {
    fallbackType = "conversational";
  } else if (questionLower.match(/\b(what affects|correlation|relationship|influence)\b/)) {
    fallbackType = "correlation";
  } else if (questionLower.match(/\b(chart|graph|plot|visualize|show)\b/)) {
    fallbackType = "chart";
  }
  return {
    type: fallbackType,
    confidence: 0.3,
    // Low confidence for fallback
    requiresClarification: fallbackType !== "conversational",
    // Don't ask for clarification on greetings
    customRequest: question
  };
}
var analysisIntentSchema;
var init_intentClassifier = __esm({
  "server/lib/agents/intentClassifier.ts"() {
    "use strict";
    init_openai();
    init_models();
    analysisIntentSchema = z.object({
      type: z.enum(["correlation", "chart", "statistical", "conversational", "comparison", "custom"]),
      confidence: z.number().min(0).max(1),
      targetVariable: z.string().optional(),
      variables: z.array(z.string()).optional(),
      chartType: z.enum(["line", "bar", "scatter", "pie", "area"]).optional(),
      filters: z.object({
        correlationSign: z.enum(["positive", "negative", "all"]).optional(),
        excludeVariables: z.array(z.string()).optional(),
        includeOnly: z.array(z.string()).optional(),
        exceptions: z.array(z.string()).optional(),
        minCorrelation: z.number().optional(),
        maxCorrelation: z.number().optional()
      }).optional(),
      axisMapping: z.object({
        x: z.string().optional(),
        y: z.string().optional(),
        y2: z.string().optional()
      }).optional(),
      customRequest: z.string().optional(),
      requiresClarification: z.boolean().optional()
    });
  }
});

// server/lib/agents/contextResolver.ts
function resolveContextReferences(question, chatHistory) {
  const questionLower = question.toLowerCase();
  const contextPatterns = [
    /\bthat\b/gi,
    /\bit\b/gi,
    /\bthe\s+previous\s+one\b/gi,
    /\bthe\s+last\s+one\b/gi,
    /\bthe\s+above\b/gi,
    /\bthe\s+chart\b/gi,
    /\bthat\s+chart\b/gi
  ];
  const hasContextReference = contextPatterns.some((pattern) => pattern.test(question));
  if (!hasContextReference || chatHistory.length === 0) {
    return question;
  }
  let resolvedQuestion = question;
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const message = chatHistory[i];
    if (message.role === "assistant" && message.charts && message.charts.length > 0) {
      const lastChart = message.charts[message.charts.length - 1];
      const chartRef = `the "${lastChart.title}" chart`;
      resolvedQuestion = resolvedQuestion.replace(/\bthat\s+chart\b/gi, chartRef);
      resolvedQuestion = resolvedQuestion.replace(/\bthe\s+chart\b/gi, chartRef);
      resolvedQuestion = resolvedQuestion.replace(/\bthat\b/gi, chartRef);
      resolvedQuestion = resolvedQuestion.replace(/\bit\b/gi, chartRef);
      resolvedQuestion = resolvedQuestion.replace(/\bthe\s+previous\s+one\b/gi, chartRef);
      resolvedQuestion = resolvedQuestion.replace(/\bthe\s+last\s+one\b/gi, chartRef);
      console.log(`\u2705 Resolved context reference: "${question}" \u2192 "${resolvedQuestion}"`);
      return resolvedQuestion;
    }
  }
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const message = chatHistory[i];
    if (message.role === "assistant" && message.insights && message.insights.length > 0) {
      const lastInsight = message.insights[message.insights.length - 1];
      const insightRef = `the "${lastInsight.text.substring(0, 50)}..." insight`;
      resolvedQuestion = resolvedQuestion.replace(/\bthat\b/gi, insightRef);
      resolvedQuestion = resolvedQuestion.replace(/\bit\b/gi, insightRef);
      console.log(`\u2705 Resolved context reference to insight: "${question}" \u2192 "${resolvedQuestion}"`);
      return resolvedQuestion;
    }
  }
  return question;
}
var init_contextResolver = __esm({
  "server/lib/agents/contextResolver.ts"() {
    "use strict";
  }
});

// server/lib/agents/contextRetriever.ts
async function retrieveContext(question, data, summary, chatHistory, sessionId) {
  try {
    const relevantChunks = await retrieveRelevantContext(
      question,
      data,
      summary,
      chatHistory,
      sessionId,
      5
      // Top 5 most relevant chunks
    );
    const similarQA = await retrieveSimilarPastQA(question, chatHistory, 2);
    const mentionedColumns = extractMentionedColumns(question, summary);
    const dataChunks = relevantChunks.map((chunk) => chunk.content);
    const pastQueries = similarQA.map((chunk) => chunk.content).filter(Boolean);
    return {
      dataChunks,
      pastQueries,
      mentionedColumns
    };
  } catch (error) {
    console.error("RAG retrieval error, using fallback:", error);
    return {
      dataChunks: [
        `Dataset has ${summary.rowCount} rows and ${summary.columnCount} columns`,
        `Numeric columns: ${summary.numericColumns.join(", ")}`,
        `Date columns: ${summary.dateColumns.join(", ") || "none"}`
      ],
      pastQueries: [],
      mentionedColumns: extractMentionedColumns(question, summary)
    };
  }
}
function extractMentionedColumns(question, summary) {
  const mentioned = [];
  const questionLower = question.toLowerCase();
  for (const col of summary.columns) {
    const colLower = col.name.toLowerCase();
    if (questionLower.includes(colLower) || colLower.includes(questionLower.split(" ")[0])) {
      mentioned.push(col.name);
    }
  }
  return mentioned;
}
var init_contextRetriever = __esm({
  "server/lib/agents/contextRetriever.ts"() {
    "use strict";
    init_ragService();
  }
});

// server/lib/agents/utils/errorRecovery.ts
function createErrorResponse(error, intent, summary, suggestions) {
  const errorMessage = error instanceof Error ? error.message : error;
  let answer = "I encountered an issue processing your request. ";
  if (errorMessage.includes("column") || errorMessage.includes("Column")) {
    answer += "It looks like there might be an issue with the column names. ";
    if (summary && suggestions && suggestions.length > 0) {
      answer += `Did you mean: ${suggestions.slice(0, 3).join(", ")}?`;
    } else if (summary) {
      answer += `Available columns: ${summary.columns.map((c) => c.name).slice(0, 5).join(", ")}${summary.columns.length > 5 ? "..." : ""}`;
    }
  } else if (errorMessage.includes("data") || errorMessage.includes("Data")) {
    answer += "There seems to be an issue with the data. ";
    if (suggestions && suggestions.length > 0) {
      answer += `Suggestions: ${suggestions.join(", ")}`;
    }
  } else if (intent.confidence < 0.5) {
    answer = "I'm not entirely sure what you're asking for. Could you rephrase your question? ";
    if (summary) {
      answer += `I can help you analyze: ${summary.numericColumns.slice(0, 5).join(", ")}${summary.numericColumns.length > 5 ? "..." : ""}`;
    }
  } else {
    answer += "Let me try a different approach. Could you rephrase your question?";
  }
  return {
    answer,
    requiresClarification: intent.confidence < 0.5,
    error: errorMessage,
    suggestions: suggestions || []
  };
}
function getFallbackSuggestions(intent, summary) {
  const suggestions = [];
  if (intent.type === "correlation" && summary.numericColumns.length > 0) {
    suggestions.push(`What affects ${summary.numericColumns[0]}?`);
    if (summary.numericColumns.length > 1) {
      suggestions.push(`Show correlations for ${summary.numericColumns[1]}`);
    }
  } else if (intent.type === "chart" && summary.numericColumns.length > 0) {
    suggestions.push(`Show me a chart of ${summary.numericColumns[0]}`);
    if (summary.dateColumns.length > 0) {
      suggestions.push(`Show ${summary.numericColumns[0]} over time`);
    }
  } else {
    suggestions.push(`What affects ${summary.numericColumns[0] || "the data"}?`);
    suggestions.push(`Show me trends in the data`);
    suggestions.push(`Analyze correlations`);
  }
  return suggestions;
}
var init_errorRecovery = __esm({
  "server/lib/agents/utils/errorRecovery.ts"() {
    "use strict";
  }
});

// server/lib/agents/utils/clarification.ts
async function askClarifyingQuestion(intent, summary) {
  const allColumns = summary.columns.map((c) => c.name).join(", ");
  const numericColumns = summary.numericColumns.slice(0, 10).join(", ");
  const prompt = `The user asked a question that I'm not entirely sure about. Generate a helpful clarifying question.

USER QUESTION: ${intent.customRequest || "Unknown"}
INTENT TYPE: ${intent.type}
CONFIDENCE: ${intent.confidence.toFixed(2)}

AVAILABLE DATA:
- ${summary.rowCount} rows, ${summary.columnCount} columns
- Numeric columns: ${numericColumns}${summary.numericColumns.length > 10 ? "..." : ""}

Generate a friendly, helpful clarifying question that:
1. Acknowledges uncertainty
2. Suggests specific things they can ask about
3. Shows available columns/options
4. Is conversational and helpful

Keep it SHORT (2-3 sentences max).`;
  try {
    const model = getModelForTask("generation");
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a helpful data analyst assistant. Generate friendly clarifying questions when you need more information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    const answer = response.choices[0].message.content?.trim() || `I'm not entirely sure what you're asking. Could you rephrase? I can help you analyze: ${numericColumns}${summary.numericColumns.length > 10 ? "..." : ""}`;
    return { answer };
  } catch (error) {
    console.error("Error generating clarifying question:", error);
    const suggestions = [
      `What affects ${summary.numericColumns[0] || "the data"}?`,
      `Show me trends in the data`,
      `Analyze correlations`
    ];
    return {
      answer: `I'm not entirely sure what you're asking. Could you rephrase? Here are some things I can help with:

${suggestions.map((s) => `- ${s}`).join("\n")}`
    };
  }
}
var init_clarification = __esm({
  "server/lib/agents/utils/clarification.ts"() {
    "use strict";
    init_openai();
    init_models();
  }
});

// server/lib/agents/orchestrator.ts
function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();
  }
  return orchestratorInstance;
}
var AgentOrchestrator, orchestratorInstance;
var init_orchestrator = __esm({
  "server/lib/agents/orchestrator.ts"() {
    "use strict";
    init_intentClassifier();
    init_contextResolver();
    init_contextRetriever();
    init_errorRecovery();
    init_clarification();
    AgentOrchestrator = class {
      handlers = [];
      /**
       * Get handler count (for initialization check)
       */
      getHandlerCount() {
        return this.handlers.length;
      }
      /**
       * Register a handler
       */
      registerHandler(handler) {
        this.handlers.push(handler);
      }
      /**
       * Process a user query
       * Implements the complete flow: intent classification → validation → routing → response
       */
      async processQuery(question, chatHistory, data, summary, sessionId) {
        try {
          console.log(`
\u{1F50D} Processing query: "${question}"`);
          const enrichedQuestion = resolveContextReferences(question, chatHistory);
          if (enrichedQuestion !== question) {
            console.log(`\u{1F4DD} Enriched question: "${enrichedQuestion}"`);
          }
          const intent = await classifyIntent(enrichedQuestion, chatHistory, summary);
          console.log(`\u{1F3AF} Intent: ${intent.type} (confidence: ${intent.confidence.toFixed(2)})`);
          if (intent.type === "conversational") {
            console.log(`\u{1F4AC} Conversational query detected, skipping clarification check`);
          } else if (intent.requiresClarification || intent.confidence < 0.5) {
            console.log(`\u2753 Low confidence (${intent.confidence.toFixed(2)}) or clarification required, asking for clarification`);
            return askClarifyingQuestion(intent, summary);
          }
          const context = await retrieveContext(
            enrichedQuestion,
            data,
            summary,
            chatHistory,
            sessionId
          );
          const handlerContext = {
            data,
            summary,
            context,
            chatHistory,
            sessionId
          };
          const handler = this.findHandler(intent);
          if (!handler) {
            console.log(`\u26A0\uFE0F No handler found for intent type: ${intent.type}`);
            return this.handleFallback(intent, handlerContext);
          }
          console.log(`\u2705 Routing to handler: ${handler.constructor.name}`);
          try {
            const intentWithQuestion = { ...intent, originalQuestion: enrichedQuestion };
            const response = await handler.handle(intentWithQuestion, handlerContext);
            if (response.error) {
              console.log(`\u26A0\uFE0F Handler returned error: ${response.error}`);
              return this.handleError(response.error, intent, handlerContext);
            }
            if (response.requiresClarification) {
              return askClarifyingQuestion(intent, summary);
            }
            if (!response.answer || response.answer.trim().length === 0) {
              console.error("\u274C Handler returned empty answer");
              throw new Error("Handler returned empty answer");
            }
            console.log(`\u2705 Handler returned answer (${response.answer.length} chars)`);
            return {
              answer: response.answer,
              charts: response.charts,
              insights: response.insights
            };
          } catch (handlerError) {
            console.error(`\u274C Handler execution failed:`, handlerError);
            return this.recoverFromError(handlerError, enrichedQuestion, intent, handlerContext);
          }
        } catch (error) {
          console.error(`\u274C Orchestrator error:`, error);
          return this.recoverFromError(
            error,
            question,
            { type: "custom", confidence: 0.3, customRequest: question },
            { data, summary, context: { dataChunks: [], pastQueries: [], mentionedColumns: [] }, chatHistory, sessionId }
          );
        }
      }
      /**
       * Find appropriate handler for intent
       */
      findHandler(intent) {
        for (const handler of this.handlers) {
          if (handler.canHandle(intent)) {
            return handler;
          }
        }
        return null;
      }
      /**
       * Handle fallback when no specific handler found
       */
      async handleFallback(intent, context) {
        const generalHandler = this.handlers.find((h) => h.canHandle(intent));
        if (generalHandler) {
          try {
            const response = await generalHandler.handle(intent, context);
            return {
              answer: response.answer,
              charts: response.charts,
              insights: response.insights
            };
          } catch (error) {
          }
        }
        const suggestions = getFallbackSuggestions(intent, context.summary);
        return {
          answer: `I'm not sure how to handle that request. Here are some things I can help with:

${suggestions.map((s) => `- ${s}`).join("\n")}`
        };
      }
      /**
       * Handle errors with recovery
       */
      handleError(error, intent, context) {
        const suggestions = getFallbackSuggestions(intent, context.summary);
        return createErrorResponse(new Error(error), intent, context.summary, suggestions);
      }
      /**
       * Recover from errors with fallback chain
       */
      async recoverFromError(error, question, intent, context) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`\u{1F504} Error recovery: ${errorMessage}`);
        const generalHandler = this.handlers.find((h) => h.canHandle(intent));
        if (generalHandler) {
          try {
            console.log(`\u{1F504} Trying general handler as fallback...`);
            const response = await generalHandler.handle(intent, context);
            if (!response.error) {
              return {
                answer: response.answer,
                charts: response.charts,
                insights: response.insights
              };
            }
          } catch (fallbackError) {
            console.log(`\u26A0\uFE0F General handler also failed`);
          }
        }
        if (intent.confidence < 0.5 && intent.type !== "conversational") {
          return askClarifyingQuestion(intent, context.summary);
        }
        if (intent.type === "conversational") {
          const userMessage = intent.customRequest || question || "";
          const questionLower = userMessage.toLowerCase();
          if (questionLower.match(/\b(hi|hello|hey)\b/)) {
            return { answer: "Hi there! \u{1F44B} I'm here to help you explore your data. What would you like to know?" };
          }
          return { answer: "I'm here to help! What would you like to know about your data?" };
        }
        const suggestions = getFallbackSuggestions(intent, context.summary);
        return createErrorResponse(
          error instanceof Error ? error : new Error(errorMessage),
          intent,
          context.summary,
          suggestions
        );
      }
    };
    orchestratorInstance = null;
  }
});

// server/lib/agents/handlers/baseHandler.ts
var BaseHandler;
var init_baseHandler = __esm({
  "server/lib/agents/handlers/baseHandler.ts"() {
    "use strict";
    init_errorRecovery();
    BaseHandler = class {
      /**
       * Validate data before processing
       * Override in subclasses for specific validation
       */
      validateData(intent, context) {
        const errors = [];
        const warnings = [];
        const suggestions = [];
        if (!context.data || context.data.length === 0) {
          errors.push("No data available");
          return { valid: false, errors, warnings, suggestions };
        }
        if (context.data.length < 2) {
          warnings.push("Very small dataset (less than 2 rows)");
        }
        if (intent.targetVariable) {
          const allColumnNames = context.summary.columns.map((c) => c.name);
          const normalizedTarget = intent.targetVariable.toLowerCase().trim();
          const colExists = allColumnNames.some(
            (col) => col.toLowerCase().trim() === normalizedTarget || col.toLowerCase().trim().includes(normalizedTarget) || normalizedTarget.includes(col.toLowerCase().trim())
          );
          if (!colExists && normalizedTarget.length >= 3) {
            const similar = this.findSimilarColumns(
              intent.targetVariable,
              context.summary
            );
            if (similar.length === 0) {
              warnings.push(`Target variable "${intent.targetVariable}" may not match any columns`);
            }
          }
        }
        if (intent.variables && intent.variables.length > 0) {
          const allColumnNames = context.summary.columns.map((c) => c.name);
          for (const variable of intent.variables) {
            const normalizedVar = variable.toLowerCase().trim();
            const colExists = allColumnNames.some(
              (col) => col.toLowerCase().trim() === normalizedVar || col.toLowerCase().trim().includes(normalizedVar) || normalizedVar.includes(col.toLowerCase().trim())
            );
            if (!colExists && normalizedVar.length >= 3) {
              warnings.push(`Variable "${variable}" may not match any columns`);
            }
          }
        }
        return {
          valid: errors.length === 0,
          errors,
          warnings,
          suggestions
        };
      }
      /**
       * Find similar column names (fuzzy matching)
       */
      findSimilarColumns(searchName, summary, maxResults = 3) {
        const normalized = searchName.toLowerCase().replace(/[\s_-]/g, "");
        const matches = [];
        for (const col of summary.columns) {
          const colNormalized = col.name.toLowerCase().replace(/[\s_-]/g, "");
          if (colNormalized === normalized) {
            return [col.name];
          }
          if (colNormalized.includes(normalized) || normalized.includes(colNormalized)) {
            const score = Math.min(
              normalized.length / colNormalized.length,
              colNormalized.length / normalized.length
            );
            matches.push({ name: col.name, score });
          }
        }
        return matches.sort((a, b) => b.score - a.score).slice(0, maxResults).map((m) => m.name);
      }
      /**
       * Create standardized error response
       */
      createErrorResponse(error, intent, suggestions) {
        return createErrorResponse(error, intent, void 0, suggestions);
      }
      /**
       * Build conversational answer with context
       */
      buildAnswer(baseAnswer, intent, context) {
        let answer = baseAnswer;
        if (context.context.dataChunks.length > 0) {
        }
        if (context.context.mentionedColumns.length > 0) {
        }
        return answer;
      }
    };
  }
});

// server/lib/agents/handlers/conversationalHandler.ts
var ConversationalHandler;
var init_conversationalHandler = __esm({
  "server/lib/agents/handlers/conversationalHandler.ts"() {
    "use strict";
    init_baseHandler();
    init_openai();
    init_models();
    ConversationalHandler = class extends BaseHandler {
      canHandle(intent) {
        return intent.type === "conversational";
      }
      async handle(intent, context) {
        console.log("\u{1F4AC} ConversationalHandler processing intent:", intent.type);
        const validation = this.validateData(intent, context);
        if (!validation.valid && validation.errors.length > 0) {
          console.log("\u26A0\uFE0F Validation warnings (continuing anyway):", validation.warnings);
        }
        const recentHistory = context.chatHistory.slice(-5).filter((msg) => msg.content && msg.content.length < 500).map((msg) => `${msg.role}: ${msg.content}`).join("\n");
        const historyContext = recentHistory ? `

CONVERSATION HISTORY:
${recentHistory}` : "";
        const userMessage = intent.originalQuestion || intent.customRequest || "something";
        console.log("\u{1F4AC} User message:", userMessage);
        const prompt = `You are a friendly, helpful data analyst assistant. The user just said: "${userMessage}"
${historyContext}

Respond naturally and conversationally. Be warm, friendly, and engaging. If they're greeting you, greet them back enthusiastically. If they're thanking you, acknowledge it warmly. If they're asking what you can do, briefly explain you help with data analysis.

Keep it SHORT (1-2 sentences max) and natural. Don't be robotic. Use emojis sparingly (1 max).
Just respond conversationally - no data analysis needed here.`;
        try {
          const model = getModelForTask("generation");
          const response = await openai.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content: "You are a friendly, conversational data analyst assistant. Respond naturally and warmly to casual conversation. Keep responses brief and engaging."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.9,
            // Higher temperature for more natural, varied responses
            max_tokens: 100
            // Short responses for casual chat
          });
          const answer = response.choices[0].message.content?.trim() || "Hi! I'm here to help you explore your data. What would you like to know?";
          console.log("\u{1F4AC} Generated conversational response:", answer.substring(0, 100));
          if (!answer || answer.trim().length === 0) {
            console.error("\u274C Empty answer from OpenAI, using fallback");
            throw new Error("Empty answer from OpenAI");
          }
          return {
            answer
          };
        } catch (error) {
          console.error("Conversational response error:", error);
          const userMessage2 = intent.originalQuestion || intent.customRequest || "";
          const questionLower = userMessage2.toLowerCase();
          if (questionLower.match(/\b(hi|hello|hey)\b/)) {
            return { answer: "Hi there! \u{1F44B} I'm here to help you explore your data. What would you like to know?" };
          } else if (questionLower.match(/\b(thanks|thank you)\b/)) {
            return { answer: "You're welcome! Happy to help. Anything else you'd like to explore?" };
          } else if (questionLower.match(/\b(bye|goodbye)\b/)) {
            return { answer: "Goodbye! Feel free to come back if you have more questions about your data." };
          }
          return {
            answer: "I'm here to help! What would you like to know about your data?"
          };
        }
      }
    };
  }
});

// server/lib/agents/utils/columnMatcher.ts
var columnMatcher_exports = {};
__export(columnMatcher_exports, {
  findMatchingColumn: () => findMatchingColumn
});
function findMatchingColumn(searchName, availableColumns) {
  if (!searchName) return null;
  const trimmedSearch = searchName.trim();
  const normalized = trimmedSearch.toLowerCase().replace(/[\s_-]/g, "");
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    const colNormalized = colTrimmed.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized === normalized) {
      return colTrimmed;
    }
  }
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    if (colTrimmed.toLowerCase() === trimmedSearch.toLowerCase()) {
      return colTrimmed;
    }
  }
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    const colNormalized = colTrimmed.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized.startsWith(normalized) && normalized.length >= 3) {
      return colTrimmed;
    }
  }
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    const colNormalized = colTrimmed.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized.includes(normalized) && normalized.length >= 3) {
      return colTrimmed;
    }
  }
  const searchWords = trimmedSearch.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    const colLower = colTrimmed.toLowerCase();
    let allWordsMatch = true;
    for (const word of searchWords) {
      const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!wordRegex.test(colLower)) {
        allWordsMatch = false;
        break;
      }
    }
    if (allWordsMatch && searchWords.length > 0) {
      return colTrimmed;
    }
  }
  for (const col of availableColumns) {
    const colTrimmed = col.trim();
    const colNormalized = colTrimmed.toLowerCase().replace(/[\s_-]/g, "");
    if (normalized.includes(colNormalized) && colNormalized.length >= 3) {
      return colTrimmed;
    }
  }
  return null;
}
var init_columnMatcher = __esm({
  "server/lib/agents/utils/columnMatcher.ts"() {
    "use strict";
  }
});

// server/lib/agents/handlers/statisticalHandler.ts
var StatisticalHandler;
var init_statisticalHandler = __esm({
  "server/lib/agents/handlers/statisticalHandler.ts"() {
    "use strict";
    init_baseHandler();
    init_columnMatcher();
    StatisticalHandler = class extends BaseHandler {
      canHandle(intent) {
        return intent.type === "statistical";
      }
      async handle(intent, context) {
        console.log("\u{1F4CA} StatisticalHandler processing intent:", intent.type);
        const validation = this.validateData(intent, context);
        if (!validation.valid) {
          return this.createErrorResponse(
            validation.errors.join(", "),
            intent,
            validation.suggestions
          );
        }
        const question = intent.originalQuestion || intent.customRequest || "";
        const questionLower = question.toLowerCase();
        const targetVariable = intent.targetVariable;
        if (!targetVariable) {
          const allColumns2 = context.summary.columns.map((c) => c.name);
          for (const col of allColumns2) {
            if (questionLower.includes(col.toLowerCase())) {
              const matched = findMatchingColumn(col, allColumns2);
              if (matched) {
                return this.analyzeStatisticalQuery(matched, question, context);
              }
            }
          }
          return {
            answer: "I need to know which variable you'd like to analyze. For example: 'Which month had the highest revenue?'",
            requiresClarification: true
          };
        }
        const allColumns = context.summary.columns.map((c) => c.name);
        const targetCol = findMatchingColumn(targetVariable, allColumns);
        if (!targetCol) {
          const suggestions = this.findSimilarColumns(targetVariable, context.summary);
          return {
            answer: `I couldn't find a column matching "${targetVariable}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(", ")}?` : `Available columns: ${allColumns.slice(0, 5).join(", ")}${allColumns.length > 5 ? "..." : ""}`}`,
            requiresClarification: true,
            suggestions
          };
        }
        return this.analyzeStatisticalQuery(targetCol, question, context);
      }
      async analyzeStatisticalQuery(targetCol, question, context) {
        const questionLower = question.toLowerCase();
        const data = context.data;
        const summary = context.summary;
        const isNumeric = summary.numericColumns.includes(targetCol);
        const dateColumn = summary.dateColumns[0] || findMatchingColumn("Month", summary.columns.map((c) => c.name)) || findMatchingColumn("Date", summary.columns.map((c) => c.name)) || findMatchingColumn("Week", summary.columns.map((c) => c.name)) || null;
        const isBestWorstQuery = questionLower.includes("best") || questionLower.includes("worst");
        const isWhichQuery = questionLower.includes("which") && (questionLower.includes("month") || questionLower.includes("row") || questionLower.includes("period") || dateColumn);
        const isMaxMinQuery = questionLower.includes("highest") || questionLower.includes("max") || questionLower.includes("maximum") || questionLower.includes("lowest") || questionLower.includes("min") || questionLower.includes("minimum");
        if (isWhichQuery && (isMaxMinQuery || isBestWorstQuery)) {
          if (!isNumeric) {
            return {
              answer: `The column "${targetCol}" is not numeric. I can only find the highest/lowest values for numeric columns.`,
              requiresClarification: true
            };
          }
          const isMax = questionLower.includes("highest") || questionLower.includes("max") || questionLower.includes("maximum") || questionLower.includes("best") && !questionLower.includes("worst");
          let bestRow = null;
          let bestValue = null;
          for (const row of data) {
            const value = this.parseNumericValue(row[targetCol]);
            if (value !== null && !isNaN(value)) {
              if (bestValue === null || (isMax ? value > bestValue : value < bestValue)) {
                bestValue = value;
                bestRow = row;
              }
            }
          }
          if (!bestRow || bestValue === null) {
            return {
              answer: `I couldn't find any valid numeric values in the "${targetCol}" column.`
            };
          }
          let identifier = "that row";
          if (dateColumn && bestRow[dateColumn]) {
            identifier = String(bestRow[dateColumn]);
          } else {
            for (const col of summary.columns.map((c) => c.name)) {
              if (col !== targetCol && !summary.numericColumns.includes(col) && bestRow[col]) {
                identifier = String(bestRow[col]);
                break;
              }
            }
          }
          const valueStr = isNumeric && bestValue % 1 !== 0 ? bestValue.toFixed(2) : String(bestValue);
          const answer = `The ${isMax ? "highest" : "lowest"} value for **${targetCol}** is **${valueStr}**, which occurs in **${identifier}**.`;
          const charts = [];
          if (dateColumn) {
            charts.push({
              type: "line",
              title: `${targetCol} Over Time`,
              x: dateColumn,
              y: targetCol,
              xLabel: dateColumn,
              yLabel: targetCol,
              aggregate: "none"
            });
          }
          return {
            answer,
            charts: charts.length > 0 ? charts : void 0
          };
        }
        if (isNumeric) {
          const values = data.map((row) => this.parseNumericValue(row[targetCol])).filter((v) => v !== null && !isNaN(v));
          if (values.length === 0) {
            return {
              answer: `I couldn't find any valid numeric values in the "${targetCol}" column.`
            };
          }
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const sorted = [...values].sort((a, b) => a - b);
          const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
          const min = Math.min(...values);
          const max = Math.max(...values);
          let answer = `Here are the statistics for **${targetCol}**:

`;
          answer += `- **Count**: ${values.length} values
`;
          answer += `- **Average**: ${avg.toFixed(2)}
`;
          answer += `- **Median**: ${median.toFixed(2)}
`;
          answer += `- **Minimum**: ${min.toFixed(2)}
`;
          answer += `- **Maximum**: ${max.toFixed(2)}
`;
          answer += `- **Sum**: ${sum.toFixed(2)}
`;
          return { answer };
        }
        return {
          answer: `I can provide statistics for numeric columns. The column "${targetCol}" is not numeric. Available numeric columns: ${summary.numericColumns.slice(0, 5).join(", ")}${summary.numericColumns.length > 5 ? "..." : ""}`,
          requiresClarification: true
        };
      }
      parseNumericValue(value) {
        if (value === null || value === void 0 || value === "") return null;
        if (typeof value === "number") return isNaN(value) ? null : value;
        const cleaned = String(value).replace(/[%,]/g, "").trim();
        const parsed = Number(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      findSimilarColumns(searchName, summary) {
        const allColumns = summary.columns.map((c) => c.name);
        const suggestions = [];
        const searchLower = searchName.toLowerCase();
        for (const col of allColumns) {
          const colLower = col.toLowerCase();
          if (colLower.includes(searchLower) || searchLower.includes(colLower)) {
            suggestions.push(col);
            if (suggestions.length >= 5) break;
          }
        }
        return suggestions;
      }
      createErrorResponse(error, intent, suggestions) {
        const errorMessage = error instanceof Error ? error.message : error;
        return {
          answer: `I encountered an issue analyzing "${intent.targetVariable || "the data"}": ${errorMessage}. ${suggestions && suggestions.length > 0 ? `Did you mean: ${suggestions.join(", ")}?` : ""}`,
          error: errorMessage,
          requiresClarification: true,
          suggestions
        };
      }
    };
  }
});

// server/lib/agents/handlers/comparisonHandler.ts
var ComparisonHandler;
var init_comparisonHandler = __esm({
  "server/lib/agents/handlers/comparisonHandler.ts"() {
    "use strict";
    init_baseHandler();
    init_columnMatcher();
    init_correlationAnalyzer();
    ComparisonHandler = class extends BaseHandler {
      canHandle(intent) {
        return intent.type === "comparison";
      }
      async handle(intent, context) {
        console.log("\u{1F4CA} ComparisonHandler processing intent:", intent.type);
        const validation = this.validateData(intent, context);
        if (!validation.valid && validation.errors.some((e) => e.includes("No data"))) {
          return this.createErrorResponse(
            validation.errors.join(", "),
            intent,
            validation.suggestions
          );
        }
        const question = intent.originalQuestion || intent.customRequest || "";
        const questionLower = question.toLowerCase();
        const bestMatch = questionLower.match(/best\s+(competitor|product|brand|company|category|option|choice|variable)\s+(?:to|for|of|with)\s+(\w+)/i);
        const bestSimpleMatch = questionLower.match(/best\s+(\w+)\s+(?:to|for|of|with)\s+(\w+)/i);
        if (bestMatch || bestSimpleMatch) {
          const match = bestMatch || bestSimpleMatch;
          const targetEntity = match[2];
          const relationshipType = bestMatch ? bestMatch[1] : "option";
          console.log(`\u{1F3AF} Detected "best ${relationshipType}" query for target: ${targetEntity}`);
          return this.findBestOption(targetEntity, question, intent, context, relationshipType);
        }
        if (questionLower.includes(" vs ") || questionLower.includes(" versus ") || questionLower.includes(" compare ") && questionLower.includes(" and ")) {
          return this.compareVariables(question, intent, context);
        }
        console.log("\u26A0\uFE0F Comparison query not recognized, using general handler");
        const { generateGeneralAnswer: generateGeneralAnswer2 } = await Promise.resolve().then(() => (init_dataAnalyzer(), dataAnalyzer_exports));
        const result = await generateGeneralAnswer2(
          context.data,
          question,
          context.chatHistory,
          context.summary,
          context.sessionId
        );
        return {
          answer: result.answer,
          charts: result.charts,
          insights: result.insights
        };
      }
      /**
       * Find the "best" option (competitor, product, etc.) based on correlation with target
       */
      async findBestOption(targetEntity, question, intent, context, relationshipType) {
        const allColumns = context.summary.columns.map((c) => c.name);
        let targetCol = findMatchingColumn(targetEntity, allColumns);
        if (!targetCol) {
          const candidates = this.discoverColumnPatterns(allColumns, targetEntity);
          if (candidates.length > 0) {
            const exactMatch = candidates.find(
              (c) => c.toLowerCase().includes(targetEntity.toLowerCase())
            );
            targetCol = exactMatch || candidates[0];
          }
        }
        if (!targetCol) {
          return {
            answer: `I couldn't find a column matching "${targetEntity}". Available columns: ${allColumns.slice(0, 5).join(", ")}${allColumns.length > 5 ? "..." : ""}`,
            requiresClarification: true
          };
        }
        if (!context.summary.numericColumns.includes(targetCol)) {
          return {
            answer: `The column "${targetCol}" is not numeric. I need numeric data to compare ${relationshipType}s.`,
            requiresClarification: true
          };
        }
        let optionsToCompare = [];
        const optionsMatch = question.match(/(?:focus|narrow|these|mentioned|discussed|we've|narrowed).*?([A-Z][A-Za-z\s,]+(?:and|,)[A-Z][A-Za-z\s,]+)/i);
        if (optionsMatch) {
          const optionsText = optionsMatch[1];
          const options = optionsText.split(/,|\sand\s/i).map((o) => o.trim()).filter((o) => o.length > 0);
          optionsToCompare = options.map((opt) => {
            const matched = findMatchingColumn(opt, allColumns);
            return matched || null;
          }).filter((opt) => opt !== null);
          console.log(`\u{1F4DD} Extracted options from question:`, optionsToCompare);
        }
        if (optionsToCompare.length === 0 && context.chatHistory.length > 0) {
          const recentMessages = context.chatHistory.slice(-5).map((m) => m.content).join(" ");
          const listPattern = /\b([A-Z][A-Za-z\s]+(?:\s+[A-Z][A-Za-z\s]+)?)(?:\s*,\s*|\s+and\s+)([A-Z][A-Za-z\s]+(?:\s+[A-Z][A-Za-z\s]+)?)(?:\s*,\s*|\s+and\s+)?([A-Z][A-Za-z\s]+(?:\s+[A-Z][A-Za-z\s]+)?)?/g;
          const matches = Array.from(recentMessages.matchAll(listPattern));
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const potentialOptions = [lastMatch[1], lastMatch[2], lastMatch[3]].filter(Boolean).map((o) => o.trim());
            optionsToCompare = potentialOptions.map((opt) => findMatchingColumn(opt, allColumns)).filter((opt) => opt !== null && opt !== targetCol);
            if (optionsToCompare.length > 0) {
              console.log(`\u{1F4DD} Extracted options from chat history:`, optionsToCompare);
            }
          }
        }
        if (optionsToCompare.length === 0 && intent.variables && intent.variables.length > 0) {
          optionsToCompare = intent.variables.map((v) => findMatchingColumn(v, allColumns)).filter((v) => v !== null && v !== targetCol);
          console.log(`\u{1F4DD} Extracted options from intent variables:`, optionsToCompare);
        }
        if (optionsToCompare.length === 0) {
          const targetLower = targetCol.toLowerCase();
          optionsToCompare = context.summary.numericColumns.filter(
            (col) => {
              const colLower = col.toLowerCase();
              if (col === targetCol) return false;
              if (targetLower.split(/\s+/)[0] === colLower.split(/\s+/)[0] && (colLower.includes("tom") || targetLower.includes("tom"))) {
                return false;
              }
              return true;
            }
          );
          console.log(`\u{1F4DD} Using all available numeric columns (${optionsToCompare.length} options)`);
        }
        if (optionsToCompare.length === 0) {
          return {
            answer: `I couldn't find any ${relationshipType}s to compare with "${targetCol}".`,
            requiresClarification: true
          };
        }
        console.log(`\u{1F4CA} Comparing ${optionsToCompare.length} ${relationshipType}s against ${targetCol}`);
        console.log(`\u{1F4CB} Options:`, optionsToCompare);
        try {
          const correlations = await this.calculateCorrelationsForRanking(
            context.data,
            targetCol,
            optionsToCompare
          );
          console.log(`\u{1F4CA} Calculated ${correlations.length} correlations for ranking`);
          const { charts, insights } = await analyzeCorrelations(
            context.data,
            targetCol,
            optionsToCompare,
            "all"
            // Get all correlations (positive and negative)
          );
          console.log(`\u{1F4CA} Correlation analyzer returned ${charts?.length || 0} charts and ${insights?.length || 0} insights`);
          const positiveCorrelations = correlations.filter((c) => c.correlation > 0).sort((a, b) => b.correlation - a.correlation);
          if (positiveCorrelations.length === 0) {
            return {
              answer: `I analyzed the ${relationshipType}s, but none of them show a positive correlation with "${targetCol}". This means they don't move together in the same direction.`,
              charts,
              insights
            };
          }
          const best = positiveCorrelations[0];
          const bestName = best.variable;
          const bestCorrelation = best.correlation;
          let answer = `Based on my analysis, **${bestName}** is the best ${relationshipType} to "${targetCol}" `;
          answer += `with a positive correlation of **${bestCorrelation.toFixed(3)}**. `;
          if (positiveCorrelations.length > 1) {
            answer += `Here's how all ${relationshipType}s rank:

`;
            positiveCorrelations.slice(0, 5).forEach((corr, idx) => {
              answer += `${idx + 1}. **${corr.variable}**: ${corr.correlation.toFixed(3)}
`;
            });
          }
          answer += `
This means when ${bestName} increases, ${targetCol} tends to increase as well, indicating a strong positive relationship.`;
          const filteredCharts = charts?.filter((chart) => {
            if (chart.type === "scatter" && chart.x === bestName) {
              return true;
            }
            if (chart.type === "bar" && chart.data) {
              const data = chart.data;
              return data.some(
                (item) => (item.variable || item[chart.x]) === bestName
              );
            }
            return false;
          }) || [];
          const rankingData = positiveCorrelations.slice(0, 5).map((corr) => ({
            variable: corr.variable,
            correlation: corr.correlation
          }));
          const rankingChart = {
            type: "bar",
            title: `Top ${relationshipType}s by Correlation with ${targetCol}`,
            x: "variable",
            y: "correlation",
            xLabel: relationshipType,
            yLabel: "Correlation",
            aggregate: "none",
            data: rankingData
          };
          let finalInsights = insights || [];
          if (finalInsights.length === 0) {
            finalInsights = [
              {
                id: 1,
                text: `**Best ${relationshipType}**: ${bestName} has the strongest positive correlation (${bestCorrelation.toFixed(3)}) with ${targetCol}, indicating the best alignment.`
              },
              {
                id: 2,
                text: `**Recommendation**: Focus on ${bestName} as it shows the strongest positive relationship with ${targetCol}. When ${bestName} increases, ${targetCol} tends to increase as well.`
              }
            ];
          }
          console.log(`\u2705 Comparison complete: Best ${relationshipType} is ${bestName} (correlation: ${bestCorrelation.toFixed(3)})`);
          console.log(`\u{1F4CA} Returning ${[rankingChart, ...filteredCharts].length} charts and ${finalInsights.length} insights`);
          return {
            answer,
            charts: [rankingChart, ...filteredCharts],
            insights: finalInsights
          };
        } catch (error) {
          console.error("Comparison analysis error:", error);
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error)),
            intent
          );
        }
      }
      /**
       * Compare two or more variables directly
       */
      async compareVariables(question, intent, context) {
        const variables = intent.variables || [];
        if (variables.length < 2) {
          return {
            answer: "I need at least two variables to compare. Please specify which variables you'd like to compare.",
            requiresClarification: true
          };
        }
        const { generateGeneralAnswer: generateGeneralAnswer2 } = await Promise.resolve().then(() => (init_dataAnalyzer(), dataAnalyzer_exports));
        const result = await generateGeneralAnswer2(
          context.data,
          question,
          context.chatHistory,
          context.summary,
          context.sessionId
        );
        return {
          answer: result.answer,
          charts: result.charts,
          insights: result.insights
        };
      }
      /**
       * Calculate correlations for ranking purposes
       */
      async calculateCorrelationsForRanking(data, targetVariable, comparisonColumns) {
        const correlations = [];
        const targetValues = data.map((row) => this.parseNumericValue(row[targetVariable])).filter((v) => v !== null && !isNaN(v));
        for (const col of comparisonColumns) {
          const colValues = data.map((row) => this.parseNumericValue(row[col])).filter((v) => v !== null && !isNaN(v));
          if (colValues.length === 0 || targetValues.length === 0) continue;
          const correlation = this.pearsonCorrelation(targetValues, colValues);
          if (!isNaN(correlation)) {
            correlations.push({ variable: col, correlation });
          }
        }
        return correlations;
      }
      parseNumericValue(value) {
        if (value === null || value === void 0 || value === "") return null;
        if (typeof value === "number") return isNaN(value) ? null : value;
        const cleaned = String(value).replace(/[%,]/g, "").trim();
        const parsed = Number(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      pearsonCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        if (n === 0) return NaN;
        const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
        const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
        const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        return denominator === 0 ? NaN : numerator / denominator;
      }
      /**
       * Discover column patterns (same as correlation handler)
       */
      discoverColumnPatterns(columns, searchTerm) {
        const candidates = [];
        const searchLower = searchTerm.toLowerCase().trim();
        const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 0);
        for (const col of columns) {
          const colLower = col.toLowerCase().trim();
          if (colLower.includes(searchLower)) {
            candidates.push(col);
          }
        }
        if (searchWords.length > 1) {
          for (const col of columns) {
            const colLower = col.toLowerCase().trim();
            if (candidates.includes(col)) continue;
            let allWordsFound = true;
            for (const word of searchWords) {
              if (!colLower.includes(word)) {
                allWordsFound = false;
                break;
              }
            }
            if (allWordsFound) {
              candidates.push(col);
            }
          }
        }
        if (searchWords.length > 0) {
          const firstWord = searchWords[0];
          for (const col of columns) {
            const colLower = col.toLowerCase().trim();
            if (candidates.includes(col)) continue;
            if (colLower.startsWith(firstWord) && colLower.length > firstWord.length) {
              candidates.push(col);
            }
          }
        }
        return Array.from(new Set(candidates)).slice(0, 10);
      }
    };
  }
});

// server/lib/agents/handlers/correlationHandler.ts
var CorrelationHandler;
var init_correlationHandler = __esm({
  "server/lib/agents/handlers/correlationHandler.ts"() {
    "use strict";
    init_baseHandler();
    init_correlationAnalyzer();
    init_columnMatcher();
    CorrelationHandler = class extends BaseHandler {
      canHandle(intent) {
        return intent.type === "correlation";
      }
      async handle(intent, context) {
        const validation = this.validateData(intent, context);
        if (!validation.valid && validation.errors.some((e) => e.includes("No data"))) {
          return this.createErrorResponse(
            validation.errors.join(", "),
            intent,
            validation.suggestions
          );
        }
        let targetVariable = intent.targetVariable;
        if (!targetVariable) {
          const question = intent.originalQuestion || intent.customRequest || "";
          const brandMatch = question.match(/(\w+)\s+is\s+(?:my|the|our)\s+brand/i);
          if (brandMatch && brandMatch[1]) {
            targetVariable = brandMatch[1];
            console.log(`\u{1F4DD} Extracted target brand from question: ${targetVariable}`);
          }
        }
        if (!targetVariable) {
          return {
            answer: "I need to know which variable you'd like to analyze. For example: 'What affects revenue?' or 'PA is my brand, what affects it?'",
            requiresClarification: true
          };
        }
        const allColumns = context.summary.columns.map((c) => c.name);
        console.log(`\u{1F50D} Looking for target variable: "${targetVariable}"`);
        console.log(`\u{1F4CB} Available columns (first 10):`, allColumns.slice(0, 10));
        let targetCol = findMatchingColumn(targetVariable, allColumns);
        console.log(`\u{1F3AF} Direct match result:`, targetCol || "NOT FOUND");
        if (!targetCol) {
          console.log(`\u{1F50D} No direct match, trying pattern discovery...`);
          const candidateColumns = this.discoverColumnPatterns(allColumns, targetVariable);
          console.log(`\u{1F4CA} Discovered candidate columns:`, candidateColumns);
          const searchLower = targetVariable.toLowerCase().trim();
          for (const candidate of candidateColumns) {
            const candidateLower = candidate.toLowerCase().trim();
            if (candidateLower.includes(searchLower)) {
              targetCol = candidate;
              console.log(`\u2705 Matched target via pattern discovery (exact phrase): ${candidate}`);
              break;
            }
          }
          if (!targetCol && candidateColumns.length > 0) {
            targetCol = candidateColumns[0];
            console.log(`\u2705 Matched target via pattern discovery (best candidate): ${targetCol}`);
          }
        }
        console.log(`\u2705 Final target column:`, targetCol || "NOT FOUND");
        if (!targetCol) {
          const suggestions = this.findSimilarColumns(targetVariable || "", context.summary);
          return {
            answer: `I couldn't find a column matching "${targetVariable}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(", ")}?` : `Available columns: ${allColumns.slice(0, 5).join(", ")}${allColumns.length > 5 ? "..." : ""}`}`,
            requiresClarification: true,
            suggestions
          };
        }
        if (!context.summary.numericColumns.includes(targetCol)) {
          return {
            answer: `The column "${targetCol}" is not numeric. Correlation analysis requires numeric data. Available numeric columns: ${context.summary.numericColumns.slice(0, 5).join(", ")}${context.summary.numericColumns.length > 5 ? "..." : ""}`,
            requiresClarification: true,
            suggestions: context.summary.numericColumns.slice(0, 5)
          };
        }
        const filter = intent.filters?.correlationSign === "positive" ? "positive" : intent.filters?.correlationSign === "negative" ? "negative" : "all";
        const comparisonColumns = context.summary.numericColumns.filter(
          (col) => col !== targetCol
        );
        if (comparisonColumns.length === 0) {
          return {
            answer: `I need at least one other numeric column to compare with "${targetCol}". Your dataset only has one numeric column.`
          };
        }
        let filteredComparisonColumns = comparisonColumns;
        if (intent.filters?.excludeVariables && intent.filters.excludeVariables.length > 0) {
          filteredComparisonColumns = filteredComparisonColumns.filter(
            (col) => !intent.filters.excludeVariables.some((exclude) => {
              const matched = findMatchingColumn(exclude, [col]);
              return matched === col || matched === col.trim();
            })
          );
        }
        const variablesToFilterNegative = intent.filters?.excludeVariables || [];
        if (intent.filters?.includeOnly && intent.filters.includeOnly.length > 0) {
          filteredComparisonColumns = filteredComparisonColumns.filter(
            (col) => intent.filters.includeOnly.some((include) => {
              const matched = findMatchingColumn(include, [col]);
              return matched === col || matched === col.trim();
            })
          );
        }
        if (intent.variables && intent.variables.length > 0) {
          const matchedVariables = intent.variables.map((v) => findMatchingColumn(v, allColumns)).filter((v) => v !== null && v !== targetCol);
          if (matchedVariables.length > 0) {
            filteredComparisonColumns = filteredComparisonColumns.filter(
              (col) => matchedVariables.includes(col) || matchedVariables.includes(col.trim())
            );
          }
        }
        if (filteredComparisonColumns.length === 0) {
          return {
            answer: `After applying filters, there are no columns left to compare with "${targetCol}".`,
            requiresClarification: true
          };
        }
        console.log(`\u{1F4CA} Analyzing correlations for "${targetCol}" with ${filteredComparisonColumns.length} comparison columns`);
        console.log(`\u{1F4CB} Comparison columns:`, filteredComparisonColumns);
        const firstRow = context.data[0];
        if (firstRow) {
          const actualColumns = Object.keys(firstRow);
          const missingColumns = filteredComparisonColumns.filter(
            (col) => !actualColumns.includes(col) && !actualColumns.includes(col.trim())
          );
          if (missingColumns.length > 0) {
            console.warn(`\u26A0\uFE0F Some columns not found in data:`, missingColumns);
            const matchedColumns = filteredComparisonColumns.map((col) => {
              if (actualColumns.includes(col) || actualColumns.includes(col.trim())) {
                return actualColumns.find((ac) => ac === col || ac.trim() === col.trim()) || col;
              }
              const match = findMatchingColumn(col, actualColumns);
              return match || null;
            }).filter((col) => col !== null);
            if (matchedColumns.length === 0) {
              return {
                answer: `I couldn't find the columns to compare. The extracted column names don't match the actual data columns. Please try rephrasing your question.`,
                requiresClarification: true,
                suggestions: actualColumns.slice(0, 5)
              };
            }
            filteredComparisonColumns = matchedColumns;
            console.log(`\u2705 Matched columns:`, filteredComparisonColumns);
          }
        }
        try {
          let { charts, insights } = await analyzeCorrelations(
            context.data,
            targetCol,
            filteredComparisonColumns,
            filter
          );
          const originalQuestion = intent.originalQuestion || intent.customRequest || "";
          const mentionsNegativeImpact = /don'?t\s+want.*negative|no\s+negative\s+impact|exclude.*negative.*impact/i.test(originalQuestion);
          const variablesToFilterNegative2 = intent.filters?.excludeVariables || [];
          if (mentionsNegativeImpact && variablesToFilterNegative2.length > 0) {
            console.log(`\u{1F50D} Filtering out negative correlations for specified variables: ${variablesToFilterNegative2.join(", ")}`);
            const allColumns2 = context.summary.columns.map((c) => c.name);
            charts = charts.filter((chart) => {
              if (chart.type === "scatter" && chart.x) {
                const shouldFilter = variablesToFilterNegative2.some((variable) => {
                  const matched = findMatchingColumn(variable, [chart.x]);
                  return matched === chart.x || matched === chart.x.trim();
                });
                if (shouldFilter) {
                  return false;
                }
              }
              return true;
            });
            charts = charts.map((chart) => {
              if (chart.type === "bar" && chart.data) {
                const filteredData = chart.data.filter((item) => {
                  const variable = item.variable || item[chart.x];
                  if (!variable) return true;
                  const shouldFilter = variablesToFilterNegative2.some((filterVar) => {
                    const matched = findMatchingColumn(filterVar, [variable]);
                    return matched === variable || matched === variable.trim();
                  });
                  if (shouldFilter) {
                    const correlation = item.correlation || item[chart.y];
                    return correlation > 0;
                  }
                  return true;
                });
                return { ...chart, data: filteredData };
              }
              return chart;
            });
          }
          let answer = `I've analyzed what affects **${targetCol}**. `;
          if (filter === "positive") {
            answer += `I've filtered to show only positive correlations as requested. `;
          } else if (filter === "negative") {
            answer += `I've filtered to show only negative correlations as requested. `;
          }
          if (mentionsNegativeImpact && variablesToFilterNegative2.length > 0) {
            answer += `As requested, I've excluded negative correlations for the specified variables (${variablesToFilterNegative2.join(", ")}). `;
          }
          if (charts.length > 0) {
            answer += `I've created ${charts.length} visualization${charts.length > 1 ? "s" : ""} showing the key relationships. `;
          }
          if (insights.length > 0) {
            answer += `Here are the key insights:`;
          }
          return {
            answer,
            charts,
            insights
          };
        } catch (error) {
          console.error("Correlation analysis error:", error);
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error)),
            intent,
            this.findSimilarColumns(targetVariable || "", context.summary)
          );
        }
      }
      /**
       * Discover column patterns from data structure (general-purpose, no hardcoding)
       * Returns columns that might match the search term (for use with findMatchingColumn)
       */
      discoverColumnPatterns(columns, searchTerm) {
        const candidates = [];
        const searchLower = searchTerm.toLowerCase().trim();
        const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 0);
        for (const col of columns) {
          const colLower = col.toLowerCase().trim();
          if (colLower.includes(searchLower)) {
            candidates.push(col);
          }
        }
        if (searchWords.length > 1) {
          for (const col of columns) {
            const colLower = col.toLowerCase().trim();
            if (candidates.includes(col)) continue;
            let allWordsFound = true;
            for (const word of searchWords) {
              if (!colLower.includes(word)) {
                allWordsFound = false;
                break;
              }
            }
            if (allWordsFound) {
              candidates.push(col);
            }
          }
        }
        if (searchWords.length > 0) {
          const firstWord = searchWords[0];
          for (const col of columns) {
            const colLower = col.toLowerCase().trim();
            if (candidates.includes(col)) continue;
            if (colLower.startsWith(firstWord) && colLower.length > firstWord.length) {
              candidates.push(col);
            }
          }
        }
        return Array.from(new Set(candidates)).slice(0, 10);
      }
    };
  }
});

// server/lib/agents/handlers/generalHandler.ts
var GeneralHandler;
var init_generalHandler = __esm({
  "server/lib/agents/handlers/generalHandler.ts"() {
    "use strict";
    init_baseHandler();
    init_dataAnalyzer();
    GeneralHandler = class extends BaseHandler {
      canHandle(intent) {
        return ["chart", "statistical", "comparison", "custom"].includes(intent.type);
      }
      async handle(intent, context) {
        const validation = this.validateData(intent, context);
        if (!validation.valid && validation.errors.length > 0) {
          console.log("\u26A0\uFE0F Validation warnings:", validation.warnings);
          if (validation.errors.some((e) => e.includes("not found"))) {
            return this.createErrorResponse(
              validation.errors.join(", "),
              intent,
              validation.suggestions
            );
          }
        }
        if (intent.axisMapping?.y2) {
          console.log("\u{1F4CA} Secondary Y-axis detected in intent:", intent.axisMapping);
          return this.handleSecondaryYAxis(intent, context);
        }
        let question = intent.customRequest || intent.originalQuestion || "";
        if (intent.targetVariable) {
          question = question || `analyze ${intent.targetVariable}`;
        }
        if (intent.variables && intent.variables.length > 0) {
          question = question || `analyze ${intent.variables.join(" and ")}`;
        }
        if (!question) {
          question = "Please analyze the data";
        }
        try {
          const result = await generateGeneralAnswer(
            context.data,
            question,
            context.chatHistory,
            context.summary,
            context.sessionId
          );
          return {
            answer: result.answer,
            charts: result.charts,
            insights: result.insights
          };
        } catch (error) {
          console.error("General handler error:", error);
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error)),
            intent,
            this.findSimilarColumns(intent.targetVariable || "", context.summary)
          );
        }
      }
      /**
       * Handle secondary Y-axis requests intelligently (AI-first, no regex)
       */
      async handleSecondaryYAxis(intent, context) {
        const { findMatchingColumn: findMatchingColumn3 } = await Promise.resolve().then(() => (init_columnMatcher(), columnMatcher_exports));
        const { processChartData: processChartData2 } = await Promise.resolve().then(() => (init_chartGenerator(), chartGenerator_exports));
        const { generateChartInsights: generateChartInsights2 } = await Promise.resolve().then(() => (init_insightGenerator(), insightGenerator_exports));
        const allColumns = context.summary.columns.map((c) => c.name);
        const y2Variable = intent.axisMapping.y2;
        const y2Column = findMatchingColumn3(y2Variable, allColumns);
        if (!y2Column) {
          return {
            answer: `I couldn't find a column matching "${y2Variable}" for the secondary Y-axis. Available columns: ${allColumns.slice(0, 5).join(", ")}${allColumns.length > 5 ? "..." : ""}`,
            requiresClarification: true,
            suggestions: allColumns.slice(0, 5)
          };
        }
        console.log("\u{1F50D} Looking for previous chart in chat history to add secondary Y-axis...");
        let previousChart = null;
        for (let i = context.chatHistory.length - 1; i >= 0; i--) {
          const msg = context.chatHistory[i];
          if (msg.role === "assistant" && msg.charts && msg.charts.length > 0) {
            previousChart = msg.charts.find((c) => c.type === "line") || msg.charts[0];
            if (previousChart) {
              console.log("\u2705 Found previous chart:", previousChart.title);
              break;
            }
          }
        }
        if (previousChart && previousChart.type === "line") {
          console.log("\u{1F504} Adding secondary Y-axis to existing chart...");
          const updatedChart = {
            ...previousChart,
            y2: y2Column,
            y2Label: y2Column,
            title: previousChart.title?.replace(/over.*$/i, "") || `${previousChart.y} and ${y2Column} Trends`
          };
          const chartData = processChartData2(context.data, updatedChart);
          console.log(`\u2705 Dual-axis line data: ${chartData.length} points`);
          if (chartData.length === 0) {
            return {
              answer: `No valid data points found. Please check that column "${y2Column}" exists and contains numeric data.`,
              requiresClarification: true
            };
          }
          const insights = await generateChartInsights2(updatedChart, chartData, context.summary);
          return {
            answer: `I've added ${y2Column} on the secondary Y-axis. The chart now shows ${previousChart.y} on the left axis and ${y2Column} on the right axis.`,
            charts: [{
              ...updatedChart,
              data: chartData,
              keyInsight: insights.keyInsight,
              recommendation: insights.recommendation
            }]
          };
        }
        const primaryY = intent.axisMapping?.y ? findMatchingColumn3(intent.axisMapping.y, allColumns) : context.summary.numericColumns[0];
        const xAxis = intent.axisMapping?.x ? findMatchingColumn3(intent.axisMapping.x, allColumns) : context.summary.dateColumns[0] || findMatchingColumn3("Month", allColumns) || findMatchingColumn3("Date", allColumns) || allColumns[0];
        if (primaryY && y2Column && xAxis) {
          console.log("\u{1F4CA} Creating new dual-axis chart:", { x: xAxis, y: primaryY, y2: y2Column });
          const dualAxisSpec = {
            type: "line",
            title: `${primaryY} and ${y2Column} Trends Over Time`,
            x: xAxis,
            y: primaryY,
            y2: y2Column,
            xLabel: xAxis,
            yLabel: primaryY,
            y2Label: y2Column,
            aggregate: "none"
          };
          const chartData = processChartData2(context.data, dualAxisSpec);
          if (chartData.length > 0) {
            const insights = await generateChartInsights2(dualAxisSpec, chartData, context.summary);
            return {
              answer: `I've created a line chart with ${primaryY} on the left axis and ${y2Column} on the right axis.`,
              charts: [{
                ...dualAxisSpec,
                data: chartData,
                keyInsight: insights.keyInsight,
                recommendation: insights.recommendation
              }]
            };
          }
        }
        return {
          answer: `I detected a request to add ${y2Column} on the secondary Y-axis, but I couldn't find a previous chart to modify. Could you create a chart first, or specify which variable should be on the primary Y-axis?`,
          requiresClarification: true
        };
      }
    };
  }
});

// server/lib/agents/index.ts
var agents_exports = {};
__export(agents_exports, {
  classifyIntent: () => classifyIntent,
  getInitializedOrchestrator: () => getInitializedOrchestrator,
  getOrchestrator: () => getOrchestrator,
  initializeAgents: () => initializeAgents,
  resolveContextReferences: () => resolveContextReferences,
  retrieveContext: () => retrieveContext
});
function initializeAgents() {
  const orchestrator = getOrchestrator();
  orchestrator.registerHandler(new ConversationalHandler());
  orchestrator.registerHandler(new StatisticalHandler());
  orchestrator.registerHandler(new ComparisonHandler());
  orchestrator.registerHandler(new CorrelationHandler());
  orchestrator.registerHandler(new GeneralHandler());
  console.log("\u2705 Agent system initialized with handlers");
  return orchestrator;
}
function getInitializedOrchestrator() {
  if (!isInitialized) {
    initializeAgents();
    isInitialized = true;
  }
  return getOrchestrator();
}
var isInitialized;
var init_agents = __esm({
  "server/lib/agents/index.ts"() {
    "use strict";
    init_orchestrator();
    init_conversationalHandler();
    init_statisticalHandler();
    init_comparisonHandler();
    init_correlationHandler();
    init_generalHandler();
    init_orchestrator();
    init_intentClassifier();
    init_contextResolver();
    init_contextRetriever();
    isInitialized = false;
  }
});

// server/lib/dataAnalyzer.ts
var dataAnalyzer_exports = {};
__export(dataAnalyzer_exports, {
  analyzeUpload: () => analyzeUpload,
  answerQuestion: () => answerQuestion,
  generateGeneralAnswer: () => generateGeneralAnswer
});
async function analyzeUpload(data, summary, fileName) {
  console.log("\u{1F4CA} Using AI chart generation for all file types");
  const chartSpecs = await generateChartSpecs(summary);
  const charts = await Promise.all(chartSpecs.map(async (spec) => {
    const processedData = processChartData(data, spec);
    const chartInsights = await generateChartInsights(spec, processedData, summary);
    return {
      ...spec,
      xLabel: spec.x,
      yLabel: spec.y,
      data: processedData,
      keyInsight: chartInsights.keyInsight,
      recommendation: chartInsights.recommendation
    };
  }));
  const insights = await generateInsights(data, summary);
  return { charts, insights };
}
function findMatchingColumn2(searchName, availableColumns) {
  if (!searchName) return null;
  const normalized = searchName.toLowerCase().replace(/[\s_-]/g, "");
  for (const col of availableColumns) {
    const colNormalized = col.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized === normalized) {
      return col;
    }
  }
  for (const col of availableColumns) {
    const colNormalized = col.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized.startsWith(normalized) && normalized.length >= 3) {
      return col;
    }
  }
  for (const col of availableColumns) {
    const colNormalized = col.toLowerCase().replace(/[\s_-]/g, "");
    if (colNormalized.includes(normalized)) {
      return col;
    }
  }
  const searchWords = searchName.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  for (const col of availableColumns) {
    const colLower = col.toLowerCase();
    let allWordsMatch = true;
    for (const word of searchWords) {
      const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!wordRegex.test(colLower)) {
        allWordsMatch = false;
        break;
      }
    }
    if (allWordsMatch && searchWords.length > 0) {
      return col;
    }
  }
  for (const col of availableColumns) {
    const colNormalized = col.toLowerCase().replace(/[\s_-]/g, "");
    if (normalized.includes(colNormalized)) {
      return col;
    }
  }
  return null;
}
async function answerQuestion(data, question, chatHistory, summary, sessionId) {
  console.log("\u{1F680} answerQuestion() CALLED with question:", question);
  console.log("\u{1F4CB} SessionId:", sessionId);
  console.log("\u{1F4CA} Data rows:", data?.length);
  console.log("\u{1F50D} Attempting to use new agent system for query:", question);
  try {
    console.log("\u{1F4E6} Importing agent system...");
    let agentModule;
    try {
      agentModule = await Promise.resolve().then(() => (init_agents(), agents_exports));
    } catch (importError) {
      console.error("\u274C Failed to import agent module:", importError);
      throw importError;
    }
    console.log("\u2705 Agent module imported, exports:", Object.keys(agentModule));
    const { getInitializedOrchestrator: getInitializedOrchestrator2 } = agentModule;
    console.log("\u{1F4DE} Getting initialized orchestrator...");
    let orchestrator;
    try {
      orchestrator = getInitializedOrchestrator2();
    } catch (initError) {
      console.error("\u274C Failed to initialize orchestrator:", initError);
      throw initError;
    }
    console.log("\u2705 Orchestrator obtained");
    console.log("\u{1F916} Using new agent system");
    const result = await orchestrator.processQuery(
      question,
      chatHistory,
      data,
      summary,
      sessionId || "unknown"
    );
    console.log("\u{1F4E4} Agent system result:", {
      hasAnswer: !!result?.answer,
      answerLength: result?.answer?.length,
      hasCharts: !!result?.charts,
      chartsCount: result?.charts?.length
    });
    if (result && result.answer && result.answer.trim().length > 0) {
      console.log("\u2705 Agent system returned response");
      return result;
    } else {
      console.warn("\u26A0\uFE0F Agent system returned empty response, falling back");
      console.warn("\u26A0\uFE0F Result:", JSON.stringify(result, null, 2));
      throw new Error("Empty response from agent system");
    }
  } catch (agentError) {
    console.error("\u274C Agent system error, falling back to legacy system");
    console.error("Error type:", agentError?.constructor?.name);
    console.error("Error message:", agentError instanceof Error ? agentError.message : String(agentError));
    if (agentError instanceof Error && agentError.stack) {
      console.error("Stack trace (first 500 chars):", agentError.stack.substring(0, 500));
    }
  }
  const detectTwoSeriesLine = (q) => {
    console.log("\u{1F50D} detectTwoSeriesLine - checking query:", q);
    const ql = q.toLowerCase();
    const wantsScatter = /\b(scatter\s+plot|scatterplot|scatter)\b/i.test(q);
    if (wantsScatter) {
      console.log("\u274C detectTwoSeriesLine - user wants scatter plot, skipping line chart detection");
      return null;
    }
    const mentionsLine = /\bline\b|\bline\s*chart\b|\bover\s+(?:time|months?|weeks?|days?)\b|\bplot\b|\bgraph\b/.test(ql);
    const hasAnd = /\sand\s+/.test(ql);
    const hasVs = /\s+vs\s+/.test(ql);
    const wantsDualAxis = /\b(two\s+separates?\s+axes?|separates?\s+axes?|dual\s+axis|dual\s+y)\b/i.test(q);
    console.log("\u{1F50D} detectTwoSeriesLine - flags:", { mentionsLine, hasAnd, hasVs, wantsDualAxis });
    if (!mentionsLine && !hasAnd && !hasVs && !wantsDualAxis) {
      console.log("\u274C detectTwoSeriesLine - does not match criteria");
      return null;
    }
    let parts = [];
    if (ql.includes(" vs ")) parts = q.split(/\s+vs\s+/i);
    else if (ql.includes(" and ")) parts = q.split(/\s+and\s+/i);
    if (parts.length < 2) return null;
    const candidates = parts.map(
      (p) => p.replace(/over\s+(?:time|months?|weeks?|days?|.*)/i, "").replace(/\b(line\s*chart|plot|graph|show|display|create)\b/gi, "").replace(/\bon\s+(?:two\s+)?(?:separates?\s+)?axes?\b/gi, "").replace(/\s+axes?\s*$/i, "").trim()
    ).filter(Boolean);
    if (candidates.length < 2) return null;
    const allCols = summary.columns.map((c) => c.name);
    const a = findMatchingColumn2(candidates[0], allCols);
    const b = findMatchingColumn2(candidates[1], allCols);
    console.log("\u{1F50D} detectTwoSeriesLine - candidates:", candidates);
    console.log("\u{1F50D} detectTwoSeriesLine - matched columns:", { a, b });
    if (!a || !b) {
      console.log("\u274C detectTwoSeriesLine - could not match columns");
      return null;
    }
    const aNum = summary.numericColumns.includes(a);
    const bNum = summary.numericColumns.includes(b);
    if (!aNum || !bNum) {
      console.log("\u274C detectTwoSeriesLine - columns not both numeric");
      return null;
    }
    const x = summary.dateColumns[0] || findMatchingColumn2("Month", allCols) || findMatchingColumn2("Date", allCols) || findMatchingColumn2("Week", allCols) || summary.columns[0].name;
    console.log("\u2705 detectTwoSeriesLine - detected:", { x, y: a, y2: b });
    return { x, y: a, y2: b };
  };
  const detectAgainstQuery = (q) => {
    const ql = q.toLowerCase();
    if (!/\bagainst\b/i.test(ql)) return null;
    const match = q.match(/(.+?)\s+against\s+(.+)/i);
    if (!match) return null;
    let yRaw = match[1].trim();
    let xRaw = match[2].trim();
    yRaw = yRaw.replace(/^(?:can\s+you\s+)?(?:please\s+)?(?:plot|graph|chart|show|display)\s+/i, "").trim();
    xRaw = xRaw.replace(/\s+(?:on|with|using|separate|axes|axis|chart|graph|plot).*$/i, "").trim();
    const allCols = summary.columns.map((c) => c.name);
    const yVar = findMatchingColumn2(yRaw, allCols);
    const xVar = findMatchingColumn2(xRaw, allCols);
    if (!yVar || !xVar) return null;
    if (!summary.numericColumns.includes(yVar) || !summary.numericColumns.includes(xVar)) return null;
    return { yVar, xVar };
  };
  const detectVsEarly = (q) => {
    console.log("\u{1F50D} Early vs detection for:", q);
    const ql = q.toLowerCase();
    if (!ql.includes(" vs ")) {
      console.log('\u274C No "vs" found in question');
      return null;
    }
    const allCols = summary.columns.map((c) => c.name);
    const vsMatch = q.match(/(.+?)\s+vs\s+(.+)/i);
    if (!vsMatch) {
      console.log("\u274C No vs match pattern found");
      return null;
    }
    let var1Raw = vsMatch[1].trim();
    let var2Raw = vsMatch[2].trim();
    console.log("\u{1F4DD} Raw extracted:", { var1Raw, var2Raw });
    var1Raw = var1Raw.replace(/^(?:can\s+you\s+)?(?:plot|graph|chart|show|display)\s+/i, "").trim();
    var2Raw = var2Raw.replace(/\s+(?:on|with|using|separate|axes|axis|chart|graph|plot).*$/i, "").trim();
    console.log("\u{1F9F9} Cleaned variables:", { var1Raw, var2Raw });
    console.log("\u{1F4CA} Available columns:", allCols);
    console.log("\u{1F522} Numeric columns:", summary.numericColumns);
    const var1 = findMatchingColumn2(var1Raw, allCols);
    const var2 = findMatchingColumn2(var2Raw, allCols);
    console.log("\u{1F3AF} Column matches:", { var1, var2 });
    if (!var1 || !var2) {
      console.log("\u274C Could not match columns. var1:", var1, "var2:", var2);
      return null;
    }
    const bothNumeric = summary.numericColumns.includes(var1) && summary.numericColumns.includes(var2);
    if (!bothNumeric) {
      console.log("\u274C Not both numeric. var1 numeric:", summary.numericColumns.includes(var1), "var2 numeric:", summary.numericColumns.includes(var2));
      return null;
    }
    console.log("\u2705 Valid vs query detected early:", { var1, var2 });
    return { var1, var2 };
  };
  const detectScatterPlotQuery = (q) => {
    console.log("\u{1F50D} detectScatterPlotQuery - checking query:", q);
    const ql = q.toLowerCase();
    const scatterPatterns = [
      /\bscatter\s+chart\b/i,
      /\bscatter\s+plot\b/i,
      /\bscatterplot\b/i,
      /\bscatter\b/i
    ];
    const hasScatterKeyword = scatterPatterns.some((pattern) => pattern.test(q));
    if (!hasScatterKeyword) {
      console.log("\u274C No scatter plot keyword found");
      return null;
    }
    console.log("\u2705 Scatter keyword detected, extracting variables...");
    const allCols = summary.columns.map((c) => c.name);
    console.log("\u{1F4CA} Available columns:", allCols);
    let cleanedQuery = q;
    cleanedQuery = cleanedQuery.replace(/\b(?:scatter\s+chart|scatter\s+plot|scatterplot|scatter)\b/gi, "");
    cleanedQuery = cleanedQuery.replace(/^(?:can\s+you\s+)?(?:please\s+)?(?:plot|graph|chart|show|display|create|draw|generate)\s+/i, "");
    cleanedQuery = cleanedQuery.replace(/\s+(?:between|of|for|with|using|as)\s+/gi, " ");
    cleanedQuery = cleanedQuery.replace(/\s+(?:in\s+a\s+)?(?:scatter|plot|chart|graph).*$/i, "");
    cleanedQuery = cleanedQuery.trim();
    console.log("\u{1F9F9} Cleaned query:", cleanedQuery);
    let parts = [];
    if (cleanedQuery.includes(" and ")) {
      parts = cleanedQuery.split(/\s+and\s+/i).map((p) => p.trim()).filter((p) => p.length > 0);
      console.log("\u{1F4DD} Strategy 1 (and):", parts);
    } else if (cleanedQuery.includes(" vs ")) {
      parts = cleanedQuery.split(/\s+vs\s+/i).map((p) => p.trim()).filter((p) => p.length > 0);
      console.log("\u{1F4DD} Strategy 2 (vs):", parts);
    } else if (cleanedQuery.includes(",")) {
      parts = cleanedQuery.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
      console.log("\u{1F4DD} Strategy 3 (comma):", parts);
    } else {
      const tokens = cleanedQuery.split(/\s+/).filter((t) => t.trim().length > 0);
      console.log("\u{1F4DD} Strategy 4 (tokens):", tokens);
      if (tokens.length >= 2) {
        for (let i = 1; i < tokens.length; i++) {
          const part1 = tokens.slice(0, i).join(" ");
          const part2 = tokens.slice(i).join(" ");
          const match1 = findMatchingColumn2(part1, allCols);
          const match2 = findMatchingColumn2(part2, allCols);
          if (match1 && match2) {
            parts = [part1, part2];
            console.log("\u{1F4DD} Strategy 4 found match:", parts);
            break;
          }
        }
        if (parts.length < 2 && tokens.length >= 2) {
          const firstToken = tokens[0];
          const restTokens = tokens.slice(1).join(" ");
          const match1 = findMatchingColumn2(firstToken, allCols);
          const match2 = findMatchingColumn2(restTokens, allCols);
          if (match1 && match2) {
            parts = [firstToken, restTokens];
            console.log("\u{1F4DD} Strategy 4 fallback match:", parts);
          }
        }
      }
    }
    if (parts.length < 2) {
      console.log("\u274C Could not extract two variables from query");
      console.log("   Cleaned query:", cleanedQuery);
      return null;
    }
    const candidates = parts.slice(0, 2).map(
      (p) => p.replace(/^(?:the\s+)?(?:column\s+)?/i, "").replace(/\s+(?:column|variable|field|data).*$/i, "").replace(/[,\s]+$/g, "").trim()
    ).filter((p) => p.length > 0);
    if (candidates.length < 2) {
      console.log("\u274C Could not clean variables properly. Candidates:", candidates);
      return null;
    }
    console.log("\u{1F4DD} Final candidates:", candidates);
    let var1 = findMatchingColumn2(candidates[0], allCols);
    let var2 = findMatchingColumn2(candidates[1], allCols);
    if (!var1) {
      console.log("\u26A0\uFE0F First variable not matched, trying aggressive matching for:", candidates[0]);
      for (const col of allCols) {
        const colLower = col.toLowerCase().replace(/[\s_-]/g, "");
        const candLower = candidates[0].toLowerCase().replace(/[\s_-]/g, "");
        if (colLower.startsWith(candLower) && candLower.length >= 3) {
          var1 = col;
          console.log("\u2705 Prefix match found:", col);
          break;
        }
      }
    }
    if (!var2) {
      console.log("\u26A0\uFE0F Second variable not matched, trying aggressive matching for:", candidates[1]);
      for (const col of allCols) {
        const colLower = col.toLowerCase().replace(/[\s_-]/g, "");
        const candLower = candidates[1].toLowerCase().replace(/[\s_-]/g, "");
        if (colLower.startsWith(candLower) && candLower.length >= 3) {
          var2 = col;
          console.log("\u2705 Prefix match found:", col);
          break;
        }
      }
    }
    console.log("\u{1F3AF} Column matches (scatter):", {
      var1,
      var2,
      search1: candidates[0],
      search2: candidates[1]
    });
    if (!var1 || !var2) {
      console.log("\u274C Could not match columns for scatter plot");
      console.log("   Available columns:", allCols);
      console.log("   Searched for:", candidates);
      return null;
    }
    const bothNumeric = summary.numericColumns.includes(var1) && summary.numericColumns.includes(var2);
    if (!bothNumeric) {
      console.log("\u274C Not both numeric for scatter plot. var1 numeric:", summary.numericColumns.includes(var1), "var2 numeric:", summary.numericColumns.includes(var2));
      return null;
    }
    console.log("\u2705 Valid scatter plot query detected:", { var1, var2 });
    return { var1, var2 };
  };
  const detectCorrelationBetween = (q) => {
    console.log("\u{1F50D} detectCorrelationBetween - checking query:", q);
    const ql = q.toLowerCase();
    const correlationPatterns = [
      /\bcorrelation\s+between\s+(.+?)\s+and\s+(.+)/i,
      /\bcorrelation\s+of\s+(.+?)\s+and\s+(.+)/i,
      /\bcorrelation\s+between\s+(.+?)\s+with\s+(.+)/i
    ];
    for (const pattern of correlationPatterns) {
      const match = q.match(pattern);
      if (match && match.length >= 3) {
        const allCols = summary.columns.map((c) => c.name);
        let var1Raw = match[1].trim();
        let var2Raw = match[2].trim();
        var1Raw = var1Raw.replace(/^(?:the\s+)?/i, "").trim();
        var2Raw = var2Raw.replace(/\s+(?:and|with|versus|vs).*$/i, "").trim();
        console.log("\u{1F4DD} Raw extracted (correlation between):", { var1Raw, var2Raw });
        const var1 = findMatchingColumn2(var1Raw, allCols);
        const var2 = findMatchingColumn2(var2Raw, allCols);
        console.log("\u{1F3AF} Column matches (correlation between):", { var1, var2 });
        if (var1 && var2 && summary.numericColumns.includes(var1) && summary.numericColumns.includes(var2)) {
          console.log("\u2705 Valid correlation between query detected:", { var1, var2 });
          return { var1, var2 };
        }
      }
    }
    console.log("\u274C No correlation between pattern found");
    return null;
  };
  console.log("\u{1F50D} Starting detection for question:", question);
  const correlationBetween = detectCorrelationBetween(question);
  if (correlationBetween && correlationBetween.var1 && correlationBetween.var2) {
    console.log("\u2705 Correlation between query detected:", correlationBetween);
    const firstRow = data[0];
    if (!firstRow) {
      console.error("\u274C No data rows available");
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(correlationBetween.var1)) {
      console.error(`\u274C Column "${correlationBetween.var1}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${correlationBetween.var1}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    if (!firstRow.hasOwnProperty(correlationBetween.var2)) {
      console.error(`\u274C Column "${correlationBetween.var2}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${correlationBetween.var2}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    const scatterSpec = {
      type: "scatter",
      title: `Correlation: ${correlationBetween.var1} vs ${correlationBetween.var2}`,
      x: correlationBetween.var1,
      y: correlationBetween.var2,
      xLabel: correlationBetween.var1,
      yLabel: correlationBetween.var2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing correlation scatter plot data...");
    const scatterData = processChartData(data, scatterSpec);
    console.log(`\u2705 Scatter data: ${scatterData.length} points`);
    if (scatterData.length === 0) {
      const allCols = summary.columns.map((c) => c.name);
      return {
        answer: `No valid data points found for scatter plot. Please check that columns "${correlationBetween.var1}" and "${correlationBetween.var2}" exist and contain numeric data. Available columns: ${allCols.join(", ")}`
      };
    }
    const scatterInsights = await generateChartInsights(scatterSpec, scatterData, summary);
    return {
      answer: `Created a scatter plot showing the correlation between ${correlationBetween.var1} and ${correlationBetween.var2}: X = ${correlationBetween.var1}, Y = ${correlationBetween.var2}.`,
      charts: [{ ...scatterSpec, data: scatterData, keyInsight: scatterInsights.keyInsight, recommendation: scatterInsights.recommendation }]
    };
  }
  const scatterPlot = detectScatterPlotQuery(question);
  if (scatterPlot && scatterPlot.var1 && scatterPlot.var2) {
    console.log("\u2705 Explicit scatter plot request detected:", scatterPlot);
    const firstRow = data[0];
    if (!firstRow) {
      console.error("\u274C No data rows available");
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(scatterPlot.var1)) {
      console.error(`\u274C Column "${scatterPlot.var1}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${scatterPlot.var1}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    if (!firstRow.hasOwnProperty(scatterPlot.var2)) {
      console.error(`\u274C Column "${scatterPlot.var2}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${scatterPlot.var2}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    const scatterSpec = {
      type: "scatter",
      title: `Scatter Chart: ${scatterPlot.var1} vs ${scatterPlot.var2}`,
      x: scatterPlot.var1,
      y: scatterPlot.var2,
      xLabel: scatterPlot.var1,
      yLabel: scatterPlot.var2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing scatter plot data...");
    const scatterData = processChartData(data, scatterSpec);
    console.log(`\u2705 Scatter data: ${scatterData.length} points`);
    if (scatterData.length === 0) {
      const allCols = summary.columns.map((c) => c.name);
      return {
        answer: `No valid data points found for scatter plot. Please check that columns "${scatterPlot.var1}" and "${scatterPlot.var2}" exist and contain numeric data. Available columns: ${allCols.join(", ")}`
      };
    }
    const scatterInsights = await generateChartInsights(scatterSpec, scatterData, summary);
    return {
      answer: `Created a scatter plot: X = ${scatterPlot.var1}, Y = ${scatterPlot.var2}.`,
      charts: [{ ...scatterSpec, data: scatterData, keyInsight: scatterInsights.keyInsight, recommendation: scatterInsights.recommendation }]
    };
  }
  const twoSeries = detectTwoSeriesLine(question);
  if (twoSeries) {
    console.log("\u2705 detectTwoSeriesLine matched! Result:", twoSeries);
    const firstRow = data[0];
    if (!firstRow) {
      console.error("\u274C No data rows available");
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(twoSeries.y)) {
      console.error(`\u274C Column "${twoSeries.y}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${twoSeries.y}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    if (!firstRow.hasOwnProperty(twoSeries.y2)) {
      console.error(`\u274C Column "${twoSeries.y2}" not found in data`);
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Column "${twoSeries.y2}" not found in the data. Available columns: ${allCols.join(", ")}` };
    }
    const wantsDualAxis = /\b(two\s+separates?\s+axes?|separates?\s+axes?|dual\s+axis|dual\s+y)\b/i.test(question);
    const spec = {
      type: "line",
      title: `${twoSeries.y} and ${twoSeries.y2} over ${twoSeries.x}`,
      x: twoSeries.x,
      y: twoSeries.y,
      y2: twoSeries.y2,
      xLabel: twoSeries.x,
      yLabel: twoSeries.y,
      y2Label: twoSeries.y2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing dual-axis line chart data...");
    const processed = processChartData(data, spec);
    console.log(`\u2705 Dual-axis line data: ${processed.length} points`);
    if (processed.length === 0) {
      const allCols = summary.columns.map((c) => c.name);
      return {
        answer: `No valid data points found. Please check that columns "${twoSeries.y}" and "${twoSeries.y2}" exist and contain numeric data. Available columns: ${allCols.join(", ")}`
      };
    }
    const insights = await generateChartInsights(spec, processed, summary);
    const chart = {
      ...spec,
      data: processed,
      keyInsight: insights.keyInsight,
      recommendation: insights.recommendation
    };
    const answer = wantsDualAxis ? `I've created a line chart with ${twoSeries.y} on the left axis and ${twoSeries.y2} on the right axis, plotted over ${twoSeries.x}.` : `Plotted two lines over ${twoSeries.x} with ${twoSeries.y} on the left axis and ${twoSeries.y2} on the right axis.`;
    return { answer, charts: [chart] };
  }
  const against = detectAgainstQuery(question);
  if (against && against.xVar && against.yVar) {
    const firstRow = data[0];
    if (!firstRow) {
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(against.xVar) || !firstRow.hasOwnProperty(against.yVar)) {
      const allCols = summary.columns.map((c) => c.name);
      return { answer: `Columns not found. Available columns: ${allCols.join(", ")}` };
    }
    const mentionsTime = /\b(time|trend|over\s+(?:time|months?|weeks?|days?))\b/i.test(question);
    const hasDate = summary.dateColumns && summary.dateColumns.length > 0;
    if (mentionsTime && hasDate) {
      const xTime = summary.dateColumns[0] || findMatchingColumn2("Month", summary.columns.map((c) => c.name)) || summary.columns[0].name;
      const spec = {
        type: "line",
        title: `${against.yVar} against ${against.xVar} over ${xTime}`,
        x: xTime,
        y: against.yVar,
        y2: against.xVar,
        xLabel: xTime,
        yLabel: against.yVar,
        y2Label: against.xVar,
        aggregate: "none"
      };
      const dataProcessed = processChartData(data, spec);
      if (dataProcessed.length === 0) {
        return { answer: `No valid data points found for line chart using ${xTime}.` };
      }
      const insights = await generateChartInsights(spec, dataProcessed, summary);
      return {
        answer: `Created a dual-axis line chart: X = ${xTime}, left Y = ${against.yVar}, right Y = ${against.xVar}.`,
        charts: [{ ...spec, data: dataProcessed, keyInsight: insights.keyInsight, recommendation: insights.recommendation }]
      };
    }
    const scatter = {
      type: "scatter",
      title: `Scatter: ${against.yVar} vs ${against.xVar}`,
      x: against.xVar,
      y: against.yVar,
      xLabel: against.xVar,
      yLabel: against.yVar,
      aggregate: "none"
    };
    const scatterData = processChartData(data, scatter);
    if (scatterData.length === 0) {
      return { answer: `No valid data points found for scatter plot with X=${against.xVar}, Y=${against.yVar}.` };
    }
    const scatterInsights = await generateChartInsights(scatter, scatterData, summary);
    return {
      answer: `Created a scatter plot: X = ${against.xVar}, Y = ${against.yVar}.`,
      charts: [{ ...scatter, data: scatterData, keyInsight: scatterInsights.keyInsight, recommendation: scatterInsights.recommendation }]
    };
  }
  const vsEarly = detectVsEarly(question);
  if (vsEarly && vsEarly.var1 && vsEarly.var2) {
    console.log("\u{1F3AF} Early vs detection triggered:", vsEarly);
    const wantsDualAxis = /\b(two\s+separates?\s+axes?|separates?\s+axes?|dual\s+axis|dual\s+y)\b/i.test(question);
    const wantsLineChart = /\b(line\s*chart|plot|graph)\b/i.test(question);
    const firstRow = data[0];
    if (!firstRow) {
      console.error("\u274C No data rows available");
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(vsEarly.var1)) {
      console.error(`\u274C Column "${vsEarly.var1}" not found in data`);
      const allCols2 = summary.columns.map((c) => c.name);
      return { answer: `Column "${vsEarly.var1}" not found in the data. Available columns: ${allCols2.join(", ")}` };
    }
    if (!firstRow.hasOwnProperty(vsEarly.var2)) {
      console.error(`\u274C Column "${vsEarly.var2}" not found in data`);
      const allCols2 = summary.columns.map((c) => c.name);
      return { answer: `Column "${vsEarly.var2}" not found in the data. Available columns: ${allCols2.join(", ")}` };
    }
    const allCols = summary.columns.map((c) => c.name);
    const lineChartX = summary.dateColumns[0] || findMatchingColumn2("Month", allCols) || findMatchingColumn2("Date", allCols) || findMatchingColumn2("Week", allCols) || allCols[0];
    console.log("\u{1F4C8} Line chart X-axis:", lineChartX);
    console.log("\u{1F4CA} Wants dual axis:", wantsDualAxis, "Wants line chart:", wantsLineChart);
    if (wantsDualAxis || wantsLineChart) {
      const dualAxisLineSpec = {
        type: "line",
        title: `${vsEarly.var1} and ${vsEarly.var2} over ${lineChartX}`,
        x: lineChartX,
        y: vsEarly.var1,
        y2: vsEarly.var2,
        xLabel: lineChartX,
        yLabel: vsEarly.var1,
        y2Label: vsEarly.var2,
        aggregate: "none"
      };
      console.log("\u{1F504} Processing dual-axis line chart data...");
      const dualAxisLineData = processChartData(data, dualAxisLineSpec);
      console.log(`\u2705 Dual-axis line data: ${dualAxisLineData.length} points`);
      if (dualAxisLineData.length === 0) {
        return {
          answer: `No valid data points found. Please check that columns "${vsEarly.var1}" and "${vsEarly.var2}" exist and contain numeric data. Available columns: ${allCols.join(", ")}`
        };
      }
      const dualAxisInsights = await generateChartInsights(dualAxisLineSpec, dualAxisLineData, summary);
      const charts2 = [{
        ...dualAxisLineSpec,
        data: dualAxisLineData,
        keyInsight: dualAxisInsights.keyInsight,
        recommendation: dualAxisInsights.recommendation
      }];
      const answer2 = `I've created a line chart with ${vsEarly.var1} on the left axis and ${vsEarly.var2} on the right axis, plotted over ${lineChartX}.`;
      return { answer: answer2, charts: charts2 };
    }
    const scatterSpec = {
      type: "scatter",
      title: `Scatter Plot of ${vsEarly.var1} vs ${vsEarly.var2}`,
      x: vsEarly.var1,
      y: vsEarly.var2,
      xLabel: vsEarly.var1,
      yLabel: vsEarly.var2,
      aggregate: "none"
    };
    const lineSpec1 = {
      type: "line",
      title: `${vsEarly.var1} over ${lineChartX}`,
      x: lineChartX,
      y: vsEarly.var1,
      xLabel: lineChartX,
      yLabel: vsEarly.var1,
      aggregate: "none"
    };
    const lineSpec2 = {
      type: "line",
      title: `${vsEarly.var2} over ${lineChartX}`,
      x: lineChartX,
      y: vsEarly.var2,
      xLabel: lineChartX,
      yLabel: vsEarly.var2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing scatter chart data...");
    const scatterData = processChartData(data, scatterSpec);
    console.log(`\u2705 Scatter data: ${scatterData.length} points`);
    console.log("\u{1F504} Processing line chart 1 data...");
    const lineData1 = processChartData(data, lineSpec1);
    console.log(`\u2705 Line chart 1 data: ${lineData1.length} points`);
    console.log("\u{1F504} Processing line chart 2 data...");
    const lineData2 = processChartData(data, lineSpec2);
    console.log(`\u2705 Line chart 2 data: ${lineData2.length} points`);
    if (scatterData.length === 0 && lineData1.length === 0 && lineData2.length === 0) {
      return {
        answer: `No valid data points found. Please check that columns "${vsEarly.var1}" and "${vsEarly.var2}" exist and contain numeric data. Available columns: ${allCols.join(", ")}`
      };
    }
    const scatterInsights = await generateChartInsights(scatterSpec, scatterData, summary);
    const lineInsights1 = await generateChartInsights(lineSpec1, lineData1, summary);
    const lineInsights2 = await generateChartInsights(lineSpec2, lineData2, summary);
    const charts = [];
    if (scatterData.length > 0) {
      charts.push({
        ...scatterSpec,
        data: scatterData,
        keyInsight: scatterInsights.keyInsight,
        recommendation: scatterInsights.recommendation
      });
    }
    if (lineData1.length > 0) {
      charts.push({
        ...lineSpec1,
        data: lineData1,
        keyInsight: lineInsights1.keyInsight,
        recommendation: lineInsights1.recommendation
      });
    }
    if (lineData2.length > 0) {
      charts.push({
        ...lineSpec2,
        data: lineData2,
        keyInsight: lineInsights2.keyInsight,
        recommendation: lineInsights2.recommendation
      });
    }
    const answer = `I've created a scatter plot comparing ${vsEarly.var1} and ${vsEarly.var2}, plus two separate line charts showing each variable over ${lineChartX}.`;
    return { answer, charts };
  }
  const parseExplicitAxes = (q) => {
    const result = {};
    const axisRegex = /(.*?)\(([^\)]*)\)/g;
    const lower = q.toLowerCase();
    let m;
    while ((m = axisRegex.exec(q)) !== null) {
      const rawName = m[1].trim();
      const axisText = m[2].toLowerCase().replace(/\s+/g, "");
      if (!rawName) continue;
      if (axisText.includes("x-axis") || axisText.includes("xaxis") || axisText === "x") {
        result.x = rawName;
      } else if (axisText.includes("y-axis") || axisText.includes("yaxis") || axisText === "y") {
        result.y = rawName;
      }
    }
    const xMatch = lower.match(/x\s*-?\s*axis\s*[:=]\s*([^,;\n]+)/);
    if (xMatch && !result.x) result.x = xMatch[1].trim();
    const yMatch = lower.match(/y\s*-?\s*axis\s*[:=]\s*([^,;\n]+)/);
    if (yMatch && !result.y) result.y = yMatch[1].trim();
    return result;
  };
  const questionLower = question.toLowerCase();
  const wantsOnlyPositive = /\b(only\s+positive|positive\s+only|just\s+positive|dont\s+include\s+negative|don't\s+include\s+negative|no\s+negative|exclude\s+negative|filter\s+positive|show\s+only\s+positive)\b/i.test(question);
  const wantsOnlyNegative = /\b(only\s+negative|negative\s+only|just\s+negative|dont\s+include\s+positive|don't\s+include\s+positive|no\s+positive|exclude\s+positive|filter\s+negative|show\s+only\s+negative)\b/i.test(question);
  const correlationFilter = wantsOnlyPositive ? "positive" : wantsOnlyNegative ? "negative" : "all";
  const allColumns = summary.columns.map((c) => c.name);
  const classification = await classifyQuestion(question, summary.numericColumns);
  if (classification.type === "correlation" && classification.targetVariable) {
    console.log("=== QUESTION CLASSIFICATION DEBUG ===");
    console.log("Classification:", classification);
    console.log("Available numeric columns:", summary.numericColumns);
    console.log("All available columns:", allColumns);
    const targetCol = findMatchingColumn2(classification.targetVariable, allColumns);
    console.log(`Target column match: "${classification.targetVariable}" -> "${targetCol}"`);
    if (!targetCol) {
      return {
        answer: `I couldn't find a column matching "${classification.targetVariable}". Available columns: ${allColumns.join(", ")}`
      };
    }
    const targetIsNumeric = summary.numericColumns.includes(targetCol);
    if (classification.specificVariable) {
      const { x: explicitXRaw, y: explicitYRaw } = parseExplicitAxes(question);
      const explicitX = explicitXRaw ? findMatchingColumn2(explicitXRaw, allColumns) : null;
      const explicitY = explicitYRaw ? findMatchingColumn2(explicitYRaw, allColumns) : null;
      const specificCol = findMatchingColumn2(classification.specificVariable, allColumns);
      console.log(`Specific column match: "${classification.specificVariable}" -> "${specificCol}"`);
      if (!specificCol) {
        return {
          answer: `I couldn't find a column matching "${classification.specificVariable}". Available columns: ${allColumns.join(", ")}`
        };
      }
      const specificIsNumeric = summary.numericColumns.includes(specificCol);
      console.log(`Target "${targetCol}" is ${targetIsNumeric ? "numeric" : "categorical"}`);
      console.log(`Specific "${specificCol}" is ${specificIsNumeric ? "numeric" : "categorical"}`);
      const sampleRows = data.slice(0, 5);
      console.log(`Sample "${targetCol}" values:`, sampleRows.map((row) => row[targetCol]));
      console.log(`Sample "${specificCol}" values:`, sampleRows.map((row) => row[specificCol]));
      console.log("=== END CLASSIFICATION DEBUG ===");
      if (targetIsNumeric && specificIsNumeric) {
        const xVar = explicitX && (explicitX === specificCol || explicitX === targetCol) ? explicitX : specificCol;
        const yVar = explicitY && (explicitY === specificCol || explicitY === targetCol) ? explicitY : targetCol;
        const { charts, insights } = await analyzeCorrelations(
          data,
          yVar,
          [xVar],
          correlationFilter
        );
        const filterNote = correlationFilter === "positive" ? " (showing only positive correlations)" : correlationFilter === "negative" ? " (showing only negative correlations)" : "";
        const answer = `I've analyzed the correlation between ${specificCol} and ${targetCol}${filterNote}. The scatter plot is oriented with X = ${xVar} and Y = ${yVar} as requested.`;
        return { answer, charts, insights };
      } else if (targetIsNumeric && !specificIsNumeric) {
        const chartSpec = {
          type: "bar",
          title: `${explicitY ? explicitY : targetCol} by ${explicitX ? explicitX : specificCol}`,
          x: explicitX || specificCol,
          y: explicitY || targetCol,
          aggregate: "mean"
        };
        const charts = [{
          ...chartSpec,
          data: processChartData(data, chartSpec)
        }];
        const answer = `I've created a bar chart showing how ${chartSpec.y} varies across ${chartSpec.x} categories (X=${chartSpec.x}, Y=${chartSpec.y}).`;
        return { answer, charts };
      } else if (!targetIsNumeric && specificIsNumeric) {
        const chartSpec = {
          type: "bar",
          title: `${explicitY ? explicitY : specificCol} by ${explicitX ? explicitX : targetCol}`,
          x: explicitX || targetCol,
          y: explicitY || specificCol,
          aggregate: "mean"
        };
        const charts = [{
          ...chartSpec,
          data: processChartData(data, chartSpec)
        }];
        const answer = `I've created a bar chart showing how ${chartSpec.y} varies across ${chartSpec.x} categories (X=${chartSpec.x}, Y=${chartSpec.y}).`;
        return { answer, charts };
      } else {
        return {
          answer: `Both "${targetCol}" and "${specificCol}" are categorical columns. I cannot perform numerical correlation analysis on categorical data. Try asking for a different visualization, such as a pie chart or bar chart.`
        };
      }
    } else {
      console.log(`Analyzing general correlation for: ${targetCol}`);
      console.log("=== END CLASSIFICATION DEBUG ===");
      if (!targetIsNumeric) {
        return {
          answer: `"${targetCol}" is a categorical column. Correlation analysis requires a numeric target variable. Try asking about a numeric column like: ${summary.numericColumns.slice(0, 3).join(", ")}`
        };
      }
      const comparisonColumns = summary.numericColumns.filter((col) => col !== targetCol);
      const { charts, insights } = await analyzeCorrelations(
        data,
        targetCol,
        comparisonColumns,
        correlationFilter
      );
      let enrichedCharts = charts;
      try {
        const needsEnrichment = Array.isArray(charts) && charts.some((c) => !("keyInsight" in c) || !("recommendation" in c));
        if (needsEnrichment) {
          enrichedCharts = await Promise.all(
            charts.map(async (c) => {
              const chartInsights = await generateChartInsights(c, c.data || [], summary);
              return { ...c, keyInsight: c.keyInsight ?? chartInsights.keyInsight, recommendation: c.recommendation ?? chartInsights.recommendation };
            })
          );
        }
      } catch (e) {
        console.error("Fallback enrichment failed for chat correlation charts:", e);
      }
      const filterNote = correlationFilter === "positive" ? " I've filtered to show only positive correlations as requested." : correlationFilter === "negative" ? " I've filtered to show only negative correlations as requested." : "";
      const answer = `I've analyzed what affects ${targetCol}.${filterNote} The correlation analysis shows the relationship strength between different variables and ${targetCol}. Scatter plots show the actual relationships, and the bar chart ranks variables by correlation strength.`;
      return { answer, charts: enrichedCharts, insights };
    }
  }
  return await generateGeneralAnswer(data, question, chatHistory, summary, sessionId);
}
async function generateChartSpecs(summary) {
  console.log("\u{1F916} Using AI to generate charts for all file types...");
  const prompt = `Analyze this dataset and generate EXACTLY 4-6 chart specifications. You MUST return multiple charts to provide comprehensive insights.

DATA SUMMARY:
- Rows: ${summary.rowCount}
- Columns: ${summary.columnCount}
- Numeric columns: ${summary.numericColumns.join(", ")}
- Date columns: ${summary.dateColumns.join(", ")}
- All columns: ${summary.columns.map((c) => `${c.name} (${c.type})`).join(", ")}

CRITICAL: You MUST use ONLY the exact column names listed above. Do NOT make up or modify column names.

Generate 4-6 diverse chart specifications that reveal different insights. Each chart should analyze different aspects of the data. Output ONLY a valid JSON array with objects containing:
- type: "line"|"bar"|"scatter"|"pie"|"area"
- title: descriptive title
- x: column name (string, not array) - MUST be from the available columns list
- y: column name (string, not array) - MUST be from the available columns list
- aggregate: "sum"|"mean"|"count"|"none" (use "none" for scatter plots, choose appropriate for others)

IMPORTANT: 
- x and y must be EXACT column names from the available columns list above
- Generate EXACTLY 4-6 charts, not just 1
- Each chart should use different column combinations
- Choose diverse chart types that work well with the data
- Use only the exact column names provided - do not modify them

Chart type preferences:
- Line/area charts for time series (if date columns exist) - use DATE columns on X-axis
- Bar charts for categorical comparisons (top 10) - use CATEGORICAL columns (like Product, Brand, Category) on X-axis, NOT date columns
- Scatter plots for relationships between numeric columns - use NUMERIC columns on both axes
- Pie charts for proportions (top 5) - use CATEGORICAL columns (like Product, Brand, Category, Region) on X-axis, NOT date columns like Month or Date

CRITICAL RULES FOR PIE CHARTS:
- X-axis MUST be a categorical column (Product, Brand, Category, Region, etc.)
- NEVER use date columns (Month, Date, Week, Year) as X-axis for pie charts
- Y-axis should be a numeric column (sum, mean, count)
- Example: "Product" (x-axis) vs "Revenue" (y-axis) = pie chart showing revenue by product

Output format: [{"type": "...", "title": "...", "x": "...", "y": "...", "aggregate": "..."}, ...]`;
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are a data visualization expert. Output only valid JSON array. Column names (x, y) must be strings, not arrays. Always return a complete, valid JSON array of chart specifications."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2e3
  });
  const content = response.choices[0].message.content;
  if (!content || content.trim() === "") {
    console.error("Empty response from OpenAI for chart generation");
    return [];
  }
  console.log("\u{1F916} AI Response for chart generation:");
  console.log("Raw content length:", content.length);
  console.log("First 500 chars:", content.substring(0, 500));
  let parsed;
  try {
    parsed = JSON.parse(content);
    let charts = parsed.charts || parsed.specifications || parsed.data || parsed;
    if (!Array.isArray(charts)) {
      if (typeof charts === "object" && charts.type) {
        charts = [charts];
      } else {
        return [];
      }
    }
    const availableColumns = summary.columns.map((c) => c.name);
    const numericColumns = summary.numericColumns;
    const dateColumns = summary.dateColumns;
    const categoricalColumns = availableColumns.filter(
      (col) => !numericColumns.includes(col) && !dateColumns.includes(col)
    );
    const sanitized = charts.slice(0, 6).map((spec) => {
      let x = spec.x;
      let y = spec.y;
      if (Array.isArray(x)) x = x[0];
      if (Array.isArray(y)) y = y[0];
      if (typeof x === "object" && x !== null) x = x.name || x.value || String(x);
      if (typeof y === "object" && y !== null) y = y.name || y.value || String(y);
      x = String(x || "");
      y = String(y || "");
      if (!availableColumns.includes(x)) {
        console.warn(`\u26A0\uFE0F Invalid X column "${x}" not found in data. Available: ${availableColumns.join(", ")}`);
        let similarX = availableColumns.find(
          (col) => col.toLowerCase() === x.toLowerCase()
        );
        if (!similarX) {
          similarX = availableColumns.find(
            (col) => col.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(col.toLowerCase())
          );
        }
        if (!similarX) {
          const xWords = x.toLowerCase().split(/[\s_-]+/);
          similarX = availableColumns.find((col) => {
            const colWords = col.toLowerCase().split(/[\s_-]+/);
            return xWords.some((word) => word.length > 2 && colWords.some((cWord) => cWord.includes(word) || word.includes(cWord)));
          });
        }
        if (!similarX) {
          const fuzzyMatches = {
            "nGRP": "GRP",
            "Adstocked": "Adstock",
            "Reach": "Reach",
            "TOM": "TOM",
            "Max": "Max"
          };
          for (const [key, value] of Object.entries(fuzzyMatches)) {
            if (x.includes(key)) {
              similarX = availableColumns.find((col) => col.includes(value));
              if (similarX) break;
            }
          }
        }
        x = similarX || availableColumns[0];
        console.log(`   Fixed X column to: "${x}"`);
      }
      if (!availableColumns.includes(y)) {
        console.warn(`\u26A0\uFE0F Invalid Y column "${y}" not found in data. Available: ${availableColumns.join(", ")}`);
        let similarY = availableColumns.find(
          (col) => col.toLowerCase() === y.toLowerCase()
        );
        if (!similarY) {
          similarY = availableColumns.find(
            (col) => col.toLowerCase().includes(y.toLowerCase()) || y.toLowerCase().includes(col.toLowerCase())
          );
        }
        if (!similarY) {
          const yWords = y.toLowerCase().split(/[\s_-]+/);
          similarY = availableColumns.find((col) => {
            const colWords = col.toLowerCase().split(/[\s_-]+/);
            return yWords.some((word) => word.length > 2 && colWords.some((cWord) => cWord.includes(word) || word.includes(cWord)));
          });
        }
        if (!similarY) {
          const fuzzyMatches = {
            "nGRP": "GRP",
            "Adstocked": "Adstock",
            "Reach": "Reach",
            "TOM": "TOM",
            "Max": "Max"
          };
          for (const [key, value] of Object.entries(fuzzyMatches)) {
            if (y.includes(key)) {
              similarY = availableColumns.find((col) => col.includes(value));
              if (similarY) break;
            }
          }
        }
        y = similarY || (numericColumns[0] || availableColumns[1]);
        console.log(`   Fixed Y column to: "${y}"`);
      }
      if (spec.type === "pie" && dateColumns.includes(x)) {
        console.warn(`\u26A0\uFE0F Pie chart "${spec.title}" incorrectly uses date column "${x}" on X-axis. Finding categorical alternative...`);
        const alternativeX = categoricalColumns.find(
          (col) => col.toLowerCase().includes("product") || col.toLowerCase().includes("brand") || col.toLowerCase().includes("category") || col.toLowerCase().includes("region") || col.toLowerCase().includes("name")
        ) || categoricalColumns[0];
        if (alternativeX) {
          console.log(`   Replacing "${x}" with "${alternativeX}" for pie chart`);
          x = alternativeX;
        } else {
          console.warn(`   No categorical column found, skipping this pie chart`);
          return null;
        }
      }
      return {
        type: spec.type,
        title: spec.title || "Untitled Chart",
        x,
        y,
        aggregate: spec.aggregate || "none"
      };
    }).filter(
      (spec) => spec && // Remove null entries (filtered pie charts)
      spec.type && spec.x && spec.y && ["line", "bar", "scatter", "pie", "area"].includes(spec.type) && // Additional validation: pie charts should not use date columns
      !(spec.type === "pie" && dateColumns.includes(spec.x))
    );
    console.log("Generated charts:", sanitized.length);
    console.log(sanitized);
    return sanitized;
  } catch (error) {
    console.error("Error parsing chart specs:", error);
    console.error("Raw AI response (first 500 chars):", content?.substring(0, 500));
    return [];
  }
}
async function generateInsights(data, summary) {
  const stats = {};
  const isPercent = {};
  const percentile = (arr, p) => {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const stdDev = (arr) => {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };
  const formatValue = (col, v) => {
    if (!isFinite(v)) return String(v);
    const abs = Math.abs(v);
    const fmt = (n) => {
      if (abs >= 100) return n.toFixed(0);
      if (abs >= 10) return n.toFixed(1);
      if (abs >= 1) return n.toFixed(2);
      return n.toFixed(3);
    };
    return isPercent[col] ? `${fmt(v)}%` : fmt(v);
  };
  for (const col of summary.numericColumns.slice(0, 5)) {
    const rawHasPercent = data.slice(0, 200).map((row) => row[col]).filter((v) => v !== null && v !== void 0).some((v) => typeof v === "string" && v.includes("%"));
    isPercent[col] = rawHasPercent;
    const values = data.map((row) => Number(String(row[col]).replace(/[%,,]/g, ""))).filter((v) => !isNaN(v));
    if (values.length > 0) {
      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const p25 = percentile(values, 0.25);
      const p50 = percentile(values, 0.5);
      const p75 = percentile(values, 0.75);
      const p90 = percentile(values, 0.9);
      const std = stdDev(values);
      const cv = avg !== 0 ? std / Math.abs(avg) * 100 : 0;
      stats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg,
        total: values.reduce((a, b) => a + b, 0),
        median: p50,
        p25,
        p75,
        p90,
        stdDev: std,
        cv,
        variability: cv > 30 ? "high" : cv > 15 ? "moderate" : "low",
        count: values.length
      };
    }
  }
  const topBottomStats = {};
  for (const col of summary.numericColumns.slice(0, 5)) {
    const valuesWithIndex = data.map((row, idx) => ({ value: Number(String(row[col]).replace(/[%,,]/g, "")), row: idx })).filter((item) => !isNaN(item.value));
    if (valuesWithIndex.length > 0) {
      topBottomStats[col] = {
        top: valuesWithIndex.sort((a, b) => b.value - a.value).slice(0, 3),
        bottom: valuesWithIndex.sort((a, b) => a.value - b.value).slice(0, 3)
      };
    }
  }
  const prompt = `Analyze this dataset and provide 5-7 specific, actionable business insights with QUANTIFIED recommendations.

DATA SUMMARY:
- ${summary.rowCount} rows, ${summary.columnCount} columns
- Numeric columns: ${summary.numericColumns.join(", ")}

COMPREHENSIVE STATISTICS:
${Object.entries(stats).map(([col, s]) => {
    const topBottom = topBottomStats[col];
    const topStr = topBottom?.top.map((t) => `${formatValue(col, t.value)}`).join(", ") || "N/A";
    const bottomStr = topBottom?.bottom.map((t) => `${formatValue(col, t.value)}`).join(", ") || "N/A";
    return `${col}:
  - Range: ${formatValue(col, s.min)} to ${formatValue(col, s.max)}
  - Average: ${formatValue(col, s.avg)}
  - Median (P50): ${formatValue(col, s.median)}
  - Percentiles: P25=${formatValue(col, s.p25)}, P75=${formatValue(col, s.p75)}, P90=${formatValue(col, s.p90)}
  - Total: ${formatValue(col, s.total)}
  - Standard Deviation: ${formatValue(col, s.stdDev)}
  - Coefficient of Variation: ${s.cv.toFixed(1)}% (${s.variability} variability)
  - Top 3 values: ${topStr}
  - Bottom 3 values: ${bottomStr}
  - Data points: ${s.count}`;
  }).join("\n\n")}

Each insight MUST include:
1. A bold headline with the key finding (e.g., **High Marketing Efficiency:**)
2. Specific numbers, percentages, or metrics from the statistics above (use actual percentiles, averages, top/bottom values)
3. Explanation of WHY this matters to the business
4. Actionable recommendation starting with "**Actionable Recommendation:**" that includes:
   - Explicit numeric targets or thresholds (e.g., "target ${summary.numericColumns[0]} above P75 value of X", "maintain between P25-P75 range")
   - Specific improvement goals (e.g., "increase by X%", "reduce by Y units", "achieve P90 level of Z")
   - Quantified benchmarks (e.g., "reach top 10% performance of ${topBottomStats[summary.numericColumns[0]]?.top[0]?.value.toFixed(2) || "target"}")
   - Measurable action items with specific numbers

Format each insight as a complete paragraph with the structure:
**[Insight Title]:** [Finding with specific metrics from statistics]. **Why it matters:** [Business impact]. **Actionable Recommendation:** [Quantified recommendation with specific targets, thresholds, and improvement goals].

CRITICAL REQUIREMENTS:
- Use ACTUAL numbers from the statistics above (percentiles, averages, top/bottom values)
- Recommendations must be measurable and quantifiable with specific targets
- Include specific improvement percentages or absolute values
- Reference actual percentile values (P75, P90) as targets
- No vague language - use specific numbers like "increase to ${formatValue(summary.numericColumns[0] || "", stats[summary.numericColumns[0] || ""]?.p75 || 0)}" or "maintain between ${formatValue(summary.numericColumns[0] || "", stats[summary.numericColumns[0] || ""]?.p25 || 0)}-${formatValue(summary.numericColumns[0] || "", stats[summary.numericColumns[0] || ""]?.p75 || 0)}"

Example:
**Revenue Concentration Risk:** The top 3 products account for 78% of total revenue ($2.4M out of $3.1M), indicating high dependency. Average revenue per product is $X, with top performer at $Y (P90=${stats.revenue?.p90.toFixed(2) || "Z"}). **Why it matters:** Over-reliance on few products creates vulnerability to market shifts or competitive pressure. **Actionable Recommendation:** Diversify revenue streams by investing in product development for the remaining portfolio. Target: Increase bottom 50% products' revenue by 25% to reach P50 level (${stats.revenue?.median.toFixed(2) || "target"}) within 12 months, aiming for 60/40 split between top and bottom performers.

Output as JSON array:
{
  "insights": [
    { "text": "**Insight Title:** Full insight text here with quantified recommendation..." },
    ...
  ]
}`;
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are a senior business analyst. Provide detailed, quantitative insights with specific metrics and actionable recommendations. Output valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
    max_tokens: 2500
  });
  const content = response.choices[0].message.content || "{}";
  try {
    const parsed = JSON.parse(content);
    const insightArray = parsed.insights || [];
    return insightArray.slice(0, 7).map((item, index) => ({
      id: index + 1,
      text: item.text || item.insight || String(item)
    }));
  } catch (error) {
    console.error("Error parsing insights:", error);
    return [];
  }
}
async function classifyQuestion(question, numericColumns) {
  const prompt = `Classify this question:

QUESTION: ${question}
NUMERIC COLUMNS: ${numericColumns.join(", ")}

IMPORTANT: Only classify as "correlation" if the question specifically asks about correlations, relationships, or what affects/influences something.

If the question:
- Requests a SPECIFIC chart type (pie chart, bar chart, line chart, etc.) \u2192 type: "general"
- Mentions specific chart visualization \u2192 type: "general"
- Asks about correlations/relationships WITHOUT specifying a chart type \u2192 type: "correlation"
- Asks "what affects" or "what influences" \u2192 type: "correlation"

For correlation questions:
- SPECIFIC: identifies two variables (e.g., "correlation between X and Y")
- GENERAL: asks what affects one variable (e.g., "what affects Y")

Output JSON:
{
  "type": "correlation" or "general",
  "isSpecific": true or false,
  "targetVariable": "column_name" or null,
  "specificVariable": "column_name" or null (only for specific correlations)
}

Examples:
- "pie chart between product type and revenue" \u2192 {"type": "general", "targetVariable": null, "specificVariable": null}
- "show me a bar chart of sales by region" \u2192 {"type": "general", "targetVariable": null, "specificVariable": null}
- "correlation between lead times and revenue" \u2192 {"type": "correlation", "isSpecific": true, "specificVariable": "lead times", "targetVariable": "revenue"}
- "what affects revenue" \u2192 {"type": "correlation", "isSpecific": false, "targetVariable": "revenue", "specificVariable": null}`;
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: 'You are a question classifier. Chart requests should be classified as "general", not "correlation". Output only valid JSON.'
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 200
  });
  const content = response.choices[0].message.content || '{"type": "general", "targetVariable": null}';
  try {
    const result = JSON.parse(content);
    return {
      type: result.type === "correlation" ? "correlation" : "general",
      targetVariable: result.targetVariable || null,
      specificVariable: result.specificVariable || null
    };
  } catch {
    return { type: "general", targetVariable: null };
  }
}
async function generateGeneralAnswer(data, question, chatHistory, summary, sessionId) {
  const parseExplicitAxes = (q) => {
    const result = {};
    const axisRegex = /(.*?)\(([^\)]*)\)/g;
    let m;
    while ((m = axisRegex.exec(q)) !== null) {
      const rawName = m[1].trim();
      const axisText = m[2].toLowerCase().replace(/\s+/g, "");
      if (!rawName) continue;
      if (axisText.includes("x-axis") || axisText.includes("xaxis") || axisText === "x") {
        result.x = rawName;
      } else if (axisText.includes("y-axis") || axisText.includes("yaxis") || axisText === "y") {
        result.y = rawName;
      }
    }
    const lower = q.toLowerCase();
    const xMatch = lower.match(/x\s*-?\s*axis\s*[:=]\s*([^,;\n]+)/);
    if (xMatch && !result.x) result.x = xMatch[1].trim();
    const yMatch = lower.match(/y\s*-?\s*axis\s*[:=]\s*([^,;\n]+)/);
    if (yMatch && !result.y) result.y = yMatch[1].trim();
    const secondaryYMatch = lower.match(/(?:add\s+)?(.+?)\s+on\s+(?:the\s+)?secondary\s+y\s*axis(?:\s+please)?/i);
    if (secondaryYMatch) {
      let y2Var = secondaryYMatch[1].trim();
      y2Var = y2Var.replace(/\s+(please|now|then)$/i, "").trim();
      result.y2 = y2Var;
      console.log("\u2705 Detected secondary Y-axis request:", result.y2);
    }
    const secondaryYColonMatch = lower.match(/secondary\s+y\s*axis\s*[:=]\s*([^,;\n]+)/);
    if (secondaryYColonMatch && !result.y2) {
      result.y2 = secondaryYColonMatch[1].trim();
      console.log("\u2705 Detected secondary Y-axis (colon format):", result.y2);
    }
    return result;
  };
  const { x: explicitXRaw, y: explicitYRaw, y2: explicitY2Raw } = parseExplicitAxes(question);
  const availableColumns = summary.columns.map((c) => c.name);
  const explicitX = explicitXRaw ? findMatchingColumn2(explicitXRaw, availableColumns) : null;
  const explicitY = explicitYRaw ? findMatchingColumn2(explicitYRaw, availableColumns) : null;
  const explicitY2 = explicitY2Raw ? findMatchingColumn2(explicitY2Raw, availableColumns) : null;
  console.log("\u{1F4CA} Parsed explicit axes:", { x: explicitX, y: explicitY, y2: explicitY2 });
  if (explicitY2) {
    console.log("\u{1F50D} Secondary Y-axis detected, looking for previous chart in chat history...");
    let previousChart = null;
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === "assistant" && msg.charts && msg.charts.length > 0) {
        previousChart = msg.charts.find((c) => c.type === "line") || msg.charts[0];
        if (previousChart) {
          console.log("\u2705 Found previous chart:", previousChart.title);
          break;
        }
      }
    }
    if (previousChart && previousChart.type === "line") {
      console.log("\u{1F504} Adding secondary Y-axis to existing chart...");
      const updatedChart = {
        ...previousChart,
        y2: explicitY2,
        y2Label: explicitY2,
        title: previousChart.title?.replace(/over.*$/i, "") || `${previousChart.y} and ${explicitY2} Trends`
      };
      const chartData = processChartData(data, updatedChart);
      console.log(`\u2705 Dual-axis line data: ${chartData.length} points`);
      if (chartData.length === 0) {
        return { answer: `No valid data points found. Please check that column "${explicitY2}" exists and contains numeric data.` };
      }
      const insights = await generateChartInsights(updatedChart, chartData, summary);
      return {
        answer: `I've added ${explicitY2} on the secondary Y-axis. The chart now shows ${previousChart.y} on the left axis and ${explicitY2} on the right axis.`,
        charts: [{
          ...updatedChart,
          data: chartData,
          keyInsight: insights.keyInsight,
          recommendation: insights.recommendation
        }]
      };
    }
    if (!previousChart && explicitY2) {
      console.log("\u26A0\uFE0F No previous chart found, trying to create new dual-axis chart...");
      const primaryY = explicitY || summary.numericColumns[0];
      const xAxis = summary.dateColumns[0] || findMatchingColumn2("Month", availableColumns) || findMatchingColumn2("Date", availableColumns) || availableColumns[0];
      if (primaryY && explicitY2 && xAxis) {
        const dualAxisSpec = {
          type: "line",
          title: `${primaryY} and ${explicitY2} Trends Over Time`,
          x: xAxis,
          y: primaryY,
          y2: explicitY2,
          xLabel: xAxis,
          yLabel: primaryY,
          y2Label: explicitY2,
          aggregate: "none"
        };
        const chartData = processChartData(data, dualAxisSpec);
        if (chartData.length > 0) {
          const insights = await generateChartInsights(dualAxisSpec, chartData, summary);
          return {
            answer: `I've created a line chart with ${primaryY} on the left axis and ${explicitY2} on the right axis.`,
            charts: [{
              ...dualAxisSpec,
              data: chartData,
              keyInsight: insights.keyInsight,
              recommendation: insights.recommendation
            }]
          };
        }
      }
    }
  }
  const detectVsQuery = (q) => {
    console.log("\u{1F50D} Detecting vs query in:", q);
    const vsMatch = q.match(/(.+?)\s+vs\s+(.+?)(?:\s+on\s+|$)/i) || q.match(/(.+?)\s+vs\s+(.+)/i);
    if (!vsMatch) {
      console.log("\u274C No vs match found");
      return null;
    }
    let var1Raw = vsMatch[1].trim();
    let var2Raw = vsMatch[2].trim();
    console.log("\u{1F4DD} Raw variables:", { var1Raw, var2Raw });
    var1Raw = var1Raw.replace(/^(?:can\s+you\s+)?(?:plot|graph|chart|show|display)\s+/i, "").trim();
    var2Raw = var2Raw.replace(/\s+(?:on|with|using|separate|axes|axis|chart|graph|plot).*$/i, "").trim();
    console.log("\u{1F9F9} Cleaned variables:", { var1Raw, var2Raw });
    console.log("\u{1F4CA} Available columns:", availableColumns);
    console.log("\u{1F522} Numeric columns:", summary.numericColumns);
    const var1 = findMatchingColumn2(var1Raw, availableColumns);
    const var2 = findMatchingColumn2(var2Raw, availableColumns);
    console.log("\u{1F3AF} Matched columns:", { var1, var2 });
    if (!var1 || !var2) {
      console.log("\u274C Could not match columns");
      return null;
    }
    const bothNumeric = summary.numericColumns.includes(var1) && summary.numericColumns.includes(var2);
    if (!bothNumeric) {
      console.log("\u274C Not both numeric. var1 numeric:", summary.numericColumns.includes(var1), "var2 numeric:", summary.numericColumns.includes(var2));
      return null;
    }
    console.log("\u2705 Valid vs query detected:", { var1, var2 });
    return { var1, var2 };
  };
  const detectAndQuery = (q) => {
    console.log('\u{1F50D} Detecting "and" query in generateGeneralAnswer:', q);
    const ql = q.toLowerCase();
    if (!ql.includes(" and ")) {
      console.log('\u274C No "and" found');
      return null;
    }
    const wantsChart = /\b(two\s+separates?\s+axes?|separates?\s+axes?|dual\s+axis|plot|graph|chart|line)\b/i.test(q);
    if (!wantsChart) {
      console.log("\u274C Does not want chart");
      return null;
    }
    const andMatch = q.match(/(.+?)\s+and\s+(.+)/i);
    if (!andMatch) {
      console.log("\u274C No and match pattern found");
      return null;
    }
    let var1Raw = andMatch[1].trim();
    let var2Raw = andMatch[2].trim();
    var1Raw = var1Raw.replace(/^(?:can\s+you\s+)?(?:plot|graph|chart|show|display)\s+/i, "").trim();
    var2Raw = var2Raw.replace(/\s+(?:on|with|using|separate|axes|axis|chart|graph|plot|over.*).*$/i, "").trim();
    console.log('\u{1F4DD} Cleaned "and" variables:', { var1Raw, var2Raw });
    const var1 = findMatchingColumn2(var1Raw, availableColumns);
    const var2 = findMatchingColumn2(var2Raw, availableColumns);
    console.log('\u{1F3AF} Matched "and" columns:', { var1, var2 });
    if (!var1 || !var2) {
      console.log('\u274C Could not match "and" columns');
      return null;
    }
    const bothNumeric = summary.numericColumns.includes(var1) && summary.numericColumns.includes(var2);
    if (!bothNumeric) {
      console.log('\u274C "And" columns not both numeric');
      return null;
    }
    console.log('\u2705 Valid "and" query detected:', { var1, var2 });
    return { var1, var2 };
  };
  const andQuery = detectAndQuery(question);
  if (andQuery && andQuery.var1 && andQuery.var2) {
    console.log('\u{1F680} Processing "and" query with dual-axis line chart:', andQuery);
    const lineChartX = summary.dateColumns[0] || findMatchingColumn2("Month", availableColumns) || findMatchingColumn2("Date", availableColumns) || findMatchingColumn2("Week", availableColumns) || availableColumns[0];
    const wantsDualAxis = /\b(two\s+separates?\s+axes?|separates?\s+axes?|dual\s+axis)\b/i.test(question);
    const lineSpec = {
      type: "line",
      title: `${andQuery.var1} and ${andQuery.var2} over ${lineChartX}`,
      x: lineChartX,
      y: andQuery.var1,
      y2: andQuery.var2,
      xLabel: lineChartX,
      yLabel: andQuery.var1,
      y2Label: andQuery.var2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing dual-axis line chart data...");
    const lineData = processChartData(data, lineSpec);
    console.log(`\u2705 Dual-axis line data: ${lineData.length} points`);
    if (lineData.length === 0) {
      return { answer: `No valid data points found for line chart. Please check that columns "${andQuery.var1}" and "${andQuery.var2}" contain numeric data.` };
    }
    const lineInsights = await generateChartInsights(lineSpec, lineData, summary);
    const charts = [{
      ...lineSpec,
      data: lineData,
      keyInsight: lineInsights.keyInsight,
      recommendation: lineInsights.recommendation
    }];
    const answer = wantsDualAxis ? `I've created a line chart with ${andQuery.var1} on the left axis and ${andQuery.var2} on the right axis, plotted over ${lineChartX}.` : `I've created a line chart showing ${andQuery.var1} and ${andQuery.var2} over ${lineChartX}.`;
    return { answer, charts };
  }
  const vsQuery = detectVsQuery(question);
  if (vsQuery && vsQuery.var1 && vsQuery.var2) {
    console.log("\u{1F680} Processing vs query with variables:", vsQuery);
    const firstRow = data[0];
    if (!firstRow) {
      console.error("\u274C No data rows available");
      return { answer: "No data available to create charts. Please upload a data file first." };
    }
    if (!firstRow.hasOwnProperty(vsQuery.var1)) {
      console.error(`\u274C Column "${vsQuery.var1}" not found in data`);
      return { answer: `Column "${vsQuery.var1}" not found in the data. Available columns: ${availableColumns.join(", ")}` };
    }
    if (!firstRow.hasOwnProperty(vsQuery.var2)) {
      console.error(`\u274C Column "${vsQuery.var2}" not found in data`);
      return { answer: `Column "${vsQuery.var2}" not found in the data. Available columns: ${availableColumns.join(", ")}` };
    }
    const lineChartX = summary.dateColumns[0] || findMatchingColumn2("Month", availableColumns) || findMatchingColumn2("Date", availableColumns) || findMatchingColumn2("Week", availableColumns) || availableColumns[0];
    console.log("\u{1F4C8} Line chart X-axis:", lineChartX);
    const scatterX = explicitX || vsQuery.var1;
    const scatterY = explicitY || vsQuery.var2;
    console.log("\u{1F4CA} Scatter chart axes:", { scatterX, scatterY });
    const scatterSpec = {
      type: "scatter",
      title: `Scatter Plot of ${scatterX} vs ${scatterY}`,
      x: scatterX,
      y: scatterY,
      xLabel: scatterX,
      yLabel: scatterY,
      aggregate: "none"
    };
    const lineSpec = {
      type: "line",
      title: `${vsQuery.var1} and ${vsQuery.var2} over ${lineChartX}`,
      x: lineChartX,
      y: vsQuery.var1,
      y2: vsQuery.var2,
      xLabel: lineChartX,
      yLabel: vsQuery.var1,
      y2Label: vsQuery.var2,
      aggregate: "none"
    };
    console.log("\u{1F504} Processing scatter chart data...");
    const scatterData = processChartData(data, scatterSpec);
    console.log(`\u2705 Scatter data: ${scatterData.length} points`);
    console.log("\u{1F504} Processing line chart data...");
    const lineData = processChartData(data, lineSpec);
    console.log(`\u2705 Line data: ${lineData.length} points`);
    if (scatterData.length === 0) {
      console.error("\u274C Scatter chart has no data");
      return { answer: `No valid data points found for scatter plot. Please check that columns "${scatterX}" and "${scatterY}" contain numeric data.` };
    }
    if (lineData.length === 0) {
      console.error("\u274C Line chart has no data");
      return { answer: `No valid data points found for line chart. Please check that columns "${vsQuery.var1}" and "${vsQuery.var2}" contain numeric data.` };
    }
    const scatterInsights = await generateChartInsights(scatterSpec, scatterData, summary);
    const lineInsights = await generateChartInsights(lineSpec, lineData, summary);
    const charts = [
      {
        ...scatterSpec,
        data: scatterData,
        keyInsight: scatterInsights.keyInsight,
        recommendation: scatterInsights.recommendation
      },
      {
        ...lineSpec,
        data: lineData,
        keyInsight: lineInsights.keyInsight,
        recommendation: lineInsights.recommendation
      }
    ];
    console.log("\u2705 Successfully created both charts");
    const answer = `I've created both a scatter plot and a line chart comparing ${vsQuery.var1} and ${vsQuery.var2}. The scatter plot shows the relationship between the two variables, while the line chart shows their trends over ${lineChartX}.`;
    return { answer, charts };
  }
  const recentHistory = chatHistory.slice(-15).filter((msg) => msg.content && msg.content.length < 500).map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  const historyContext = recentHistory;
  const questionLower = question.trim().toLowerCase();
  const conversationalPatterns = [
    // Greetings
    /^(hi|hello|hey|hiya|howdy|greetings|sup|what's up|whats up|wassup)$/i,
    /^(hi|hello|hey)\s+(there|you|everyone|all)$/i,
    /^how\s+(are\s+you|you\s+doing|is\s+it\s+going|things\s+going)/i,
    /^what's?\s+(up|new|good|happening)/i,
    /^how\s+(do\s+you\s+do|goes\s+it)/i,
    // Thanks
    /^(thanks?|thank\s+you|thx|ty|appreciate\s+it|much\s+appreciated)/i,
    /^(thanks?|thank\s+you)\s+(so\s+much|a\s+lot|very\s+much|tons)/i,
    // Casual responses
    /^(ok|okay|sure|yep|yeah|yup|alright|all\s+right|got\s+it|understood|perfect|great|awesome|cool|nice|good|sounds\s+good|sounds\s+great)$/i,
    /^(yes|no|nope|nah)\s*$/i,
    // Farewells
    /^(bye|goodbye|see\s+ya|see\s+you|later|talk\s+to\s+you\s+later|catch\s+you\s+later|gotta\s+go)/i,
    /^(have\s+a\s+good|have\s+a\s+nice)\s+(day|one|weekend)/i,
    // Politeness
    /^(please|pls|plz)$/i,
    /^(sorry|my\s+bad|oops|whoops)/i,
    // Questions about the bot
    /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|what\s+do\s+you\s+do)/i,
    /^(help|what\s+can\s+you\s+help|how\s+can\s+you\s+help)/i
  ];
  const isPureConversation = conversationalPatterns.some((pattern) => pattern.test(questionLower));
  if (isPureConversation) {
    try {
      const conversationalPrompt = `You are a friendly, helpful data analyst assistant. The user just said: "${question}"

${historyContext ? `CONVERSATION HISTORY:
${historyContext}

Use this to respond naturally and contextually.` : ""}

Respond naturally and conversationally. Be warm, friendly, and engaging. If they're greeting you, greet them back enthusiastically. If they're thanking you, acknowledge it warmly. If they're asking what you can do, briefly explain you help with data analysis.

Keep it SHORT (1-2 sentences max) and natural. Don't be robotic. Use emojis sparingly (1 max).

Just respond conversationally - no data analysis needed here.`;
      const response2 = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are a friendly, conversational data analyst assistant. Respond naturally and warmly to casual conversation. Keep responses brief and engaging."
          },
          {
            role: "user",
            content: conversationalPrompt
          }
        ],
        temperature: 0.9,
        // Higher temperature for more natural, varied responses
        max_tokens: 100
        // Short responses for casual chat
      });
      const answer = response2.choices[0].message.content?.trim() || "Hi! I'm here to help you explore your data. What would you like to know?";
      return { answer };
    } catch (error) {
      console.error("Conversational response error, using fallback:", error);
      const fallbackResponses = {
        "hi": "Hi there! \u{1F44B} I'm here to help you explore your data. What would you like to know?",
        "hello": "Hello! \u{1F44B} Ready to dive into your data? Ask me anything!",
        "hey": "Hey! \u{1F44B} What can I help you discover in your data today?",
        "how are you": "I'm doing great, thanks for asking! Ready to help you analyze your data. What would you like to explore?",
        "what's up": "Not much! Just here waiting to help you with your data analysis. What can I show you?",
        "thanks": "You're welcome! Happy to help. Anything else you'd like to explore?",
        "thank you": "You're very welcome! Feel free to ask if you need anything else."
      };
      const response2 = fallbackResponses[questionLower] || "I'm here to help! What would you like to know about your data?";
      return { answer: response2 };
    }
  }
  let retrievedContext = "";
  if (sessionId) {
    try {
      const relevantChunks = await retrieveRelevantContext(
        question,
        data,
        summary,
        chatHistory,
        sessionId,
        5
        // Top 5 most relevant chunks
      );
      const similarQA = await retrieveSimilarPastQA(question, chatHistory, 2);
      if (relevantChunks.length > 0 || similarQA.length > 0) {
        retrievedContext = "\n\nRETRIEVED RELEVANT DATA CONTEXT:\n";
        if (relevantChunks.length > 0) {
          retrievedContext += "Relevant data patterns and information:\n";
          relevantChunks.forEach((chunk, idx) => {
            retrievedContext += `${idx + 1}. [${chunk.type}] ${chunk.content}
`;
          });
        }
        if (similarQA.length > 0) {
          retrievedContext += "\nSimilar past questions and answers:\n";
          similarQA.forEach((qa, idx) => {
            retrievedContext += `${idx + 1}. ${qa.content}
`;
          });
        }
      }
    } catch (error) {
      console.error("RAG retrieval error (continuing without RAG):", error);
    }
  }
  const conversationTopics = chatHistory.slice(-10).map((msg) => msg.content).join(" ").toLowerCase();
  const mentionedColumns = summary.columns.map((c) => c.name).filter((col) => conversationTopics.includes(col.toLowerCase()));
  const prompt = `You are a friendly, conversational data analyst assistant. You're having a natural, flowing conversation with the user about their data. Be warm, helpful, and engaging - like talking to a colleague over coffee.

CURRENT QUESTION: ${question}

${historyContext ? `CONVERSATION HISTORY:
${historyContext}

IMPORTANT - Use this history to:
- Understand context and references (when user says "that", "it", "the chart", "the previous one", "the last thing", etc.)
- Remember what columns/variables were discussed: ${mentionedColumns.length > 0 ? mentionedColumns.join(", ") : "none yet"}
- Maintain conversation flow and continuity - respond naturally to follow-ups
- Reference previous answers naturally ("As I mentioned before...", "Building on what we discussed...")
- Show you remember what was discussed before
- If they're asking a follow-up, acknowledge it naturally ("Sure!", "Absolutely!", "Let me show you that...")
- Match their tone - if they're casual, be casual; if they're formal, be professional` : ""}

DATA CONTEXT:
- ${summary.rowCount} rows, ${summary.columnCount} columns
- All columns: ${summary.columns.map((c) => `${c.name} (${c.type})`).join(", ")}
- Numeric columns: ${summary.numericColumns.join(", ")}
${retrievedContext}

CONVERSATION STYLE - CRITICAL:
- Be NATURALLY conversational - like you're talking to a friend, not a robot
- Use contractions: "I've", "you're", "that's", "it's" - makes it feel human
- Vary your responses - don't use the same phrases repeatedly
- Show personality: be enthusiastic, helpful, and genuinely interested
- Reference previous parts naturally: "As we saw earlier...", "Remember when we looked at...", "Building on that..."
- If they ask a follow-up, acknowledge it: "Sure!", "Absolutely!", "Great question!", "Let me show you..."
- Use natural transitions: "So...", "Now...", "Here's the thing...", "Actually..."
- Ask clarifying questions if needed: "Are you looking for...?", "Do you mean...?"
- Match their energy - if they're excited, be excited; if they're casual, be casual
- Don't be overly formal - use everyday language

If the question requests a chart or visualization, generate appropriate chart specifications. Otherwise, provide a helpful, conversational answer.

CHART GUIDELINES:
- You can use ANY column (categorical or numeric) for x or y
- Pie charts: Use categorical column for x, numeric column for y, aggregate "sum" or "count"
- Bar charts: Can use categorical or numeric for x, numeric for y
- Line/Area: Typically numeric or date for x, numeric for y
- Scatter: Numeric for both x and y
- x and y must be single column names (strings), NOT arrays

CRITICAL FOR CORRELATION CHARTS:
- If generating correlation charts, NEVER modify correlation values
- Use EXACT correlation values as calculated (positive/negative)
- Do NOT convert negative correlations to positive or vice versa
- Correlation values must preserve their original sign

CONVERSATION MEMORY:
${mentionedColumns.length > 0 ? `- Previously discussed columns: ${mentionedColumns.join(", ")}` : ""}
- Remember user's interests and preferences from the conversation
- If user asks about something mentioned before, show you remember

Output JSON:
{
  "answer": "your detailed, conversational answer that references previous topics when relevant",
  "charts": [{"type": "...", "title": "...", "x": "...", "y": "...", "aggregate": "..."}] or null,
  "generateInsights": true or false
}`;
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a friendly, conversational data analyst assistant. You're having a natural, flowing conversation with the user about their data.
        
CRITICAL CONVERSATION RULES:
- Be NATURALLY conversational - like talking to a friend, not a robot
- Use contractions and everyday language: "I've", "you're", "that's", "it's", "here's"
- Vary your responses - don't repeat the same phrases
- Show personality: be enthusiastic, helpful, genuinely interested
- Reference previous conversation naturally: "As we saw...", "Remember when...", "Building on that..."
- Acknowledge follow-ups warmly: "Sure!", "Absolutely!", "Great question!", "Let me show you..."
- Use natural transitions: "So...", "Now...", "Here's the thing...", "Actually..."
- Match their tone - casual or formal, match it
- Ask clarifying questions when needed: "Are you looking for...?", "Do you mean...?"
- Don't be overly formal - use everyday, natural language

TECHNICAL RULES:
- Column names (x, y) must be strings, not arrays
- Never modify correlation values - preserve their original positive/negative signs
- If the user is just chatting, respond naturally without forcing charts`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.85,
    // Higher temperature for more natural, varied, human-like responses
    max_tokens: 1200
    // Increased for more detailed conversational responses
  });
  const content = response.choices[0].message.content || '{"answer": "I cannot answer that question."}';
  try {
    const result = JSON.parse(content);
    let processedCharts;
    if (result.charts && Array.isArray(result.charts)) {
      const sanitized = result.charts.map((spec) => {
        let x = spec.x;
        let y = spec.y;
        if (Array.isArray(x)) x = x[0];
        if (Array.isArray(y)) y = y[0];
        if (typeof x === "object" && x !== null) x = x.name || x.value || String(x);
        if (typeof y === "object" && y !== null) y = y.name || y.value || String(y);
        const finalX = explicitX || String(x || "");
        const finalY = explicitY || String(y || "");
        return {
          type: spec.type,
          title: spec.title || "Chart",
          x: finalX,
          y: finalY,
          aggregate: spec.aggregate || "none"
        };
      }).filter(
        (spec) => spec.type && spec.x && spec.y && ["line", "bar", "scatter", "pie", "area"].includes(spec.type)
      );
      processedCharts = await Promise.all(sanitized.map(async (spec) => {
        const processedData = processChartData(data, spec);
        const chartInsights = await generateChartInsights(spec, processedData, summary);
        return {
          ...spec,
          xLabel: spec.x,
          yLabel: spec.y,
          data: processedData,
          keyInsight: chartInsights.keyInsight,
          recommendation: chartInsights.recommendation
        };
      }));
      console.log("Chat charts generated:", processedCharts?.length || 0);
      const wantsSingleCombined = /\b(one|single)\s+line\s*chart\b|\bin\s+one\s+chart\b|\btogether\b/i.test(question);
      if (wantsSingleCombined && processedCharts && processedCharts.length >= 2) {
        const c1 = processedCharts.find((c) => c.type === "line" && Array.isArray(c.data));
        const c2 = processedCharts.find((c) => c !== c1 && c.type === "line" && Array.isArray(c.data));
        if (c1 && c2 && c1.x === c2.x) {
          const xKey = c1.x;
          const y1Key = c1.y;
          const y2Key = c2.y;
          const map = /* @__PURE__ */ new Map();
          c1.data.forEach((row) => {
            const k = row[xKey];
            map.set(k, { [xKey]: k, [y1Key]: row[y1Key] });
          });
          c2.data.forEach((row) => {
            const k = row[xKey];
            const existing = map.get(k) || { [xKey]: k };
            existing[y2Key] = row[y2Key];
            map.set(k, existing);
          });
          const mergedData = Array.from(map.values()).sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey])));
          const merged = {
            type: "line",
            title: c1.title || `${y1Key} and ${y2Key} over ${xKey}`,
            x: xKey,
            y: y1Key,
            y2: y2Key,
            xLabel: c1.xLabel || xKey,
            yLabel: c1.yLabel || y1Key,
            y2Label: c2.yLabel || y2Key,
            aggregate: "none",
            data: mergedData,
            keyInsight: c1.keyInsight,
            recommendation: c1.recommendation
          };
          processedCharts = [merged];
        }
      }
    }
    let overallInsights = Array.isArray(result.insights) ? result.insights : void 0;
    if ((!overallInsights || overallInsights.length === 0) && Array.isArray(processedCharts) && processedCharts.length > 0) {
      overallInsights = [];
      processedCharts.forEach((c, idx) => {
        if (c.keyInsight) {
          overallInsights.push({ id: overallInsights.length + 1, text: c.keyInsight });
        }
        if (c.recommendation && c.recommendation !== c.keyInsight) {
          overallInsights.push({ id: overallInsights.length + 1, text: `**Recommendation:** ${c.recommendation}` });
        }
      });
      if (overallInsights.length === 0) {
        overallInsights = [{ id: 1, text: `Generated ${processedCharts.length} chart(s) based on your question. Review the charts for detailed insights.` }];
      }
    }
    return {
      answer: result.answer,
      charts: processedCharts,
      insights: overallInsights
    };
  } catch {
    return { answer: "I apologize, but I had trouble processing your question. Please try rephrasing it." };
  }
}
var init_dataAnalyzer = __esm({
  "server/lib/dataAnalyzer.ts"() {
    "use strict";
    init_openai();
    init_chartGenerator();
    init_correlationAnalyzer();
    init_insightGenerator();
    init_ragService();
  }
});

// server/lib/cosmosDB.ts
var cosmosDB_exports = {};
__export(cosmosDB_exports, {
  addChartToDashboard: () => addChartToDashboard,
  addMessageToChat: () => addMessageToChat,
  addMessagesBySessionId: () => addMessagesBySessionId,
  createChatDocument: () => createChatDocument,
  createDashboard: () => createDashboard,
  deleteChatDocument: () => deleteChatDocument,
  deleteDashboard: () => deleteDashboard,
  generateColumnStatistics: () => generateColumnStatistics,
  getAllSessions: () => getAllSessions,
  getAllSessionsPaginated: () => getAllSessionsPaginated,
  getChatBySessionIdEfficient: () => getChatBySessionIdEfficient,
  getChatDocument: () => getChatDocument,
  getDashboardById: () => getDashboardById,
  getSessionStatistics: () => getSessionStatistics,
  getSessionsWithFilters: () => getSessionsWithFilters,
  getUserChats: () => getUserChats,
  getUserDashboards: () => getUserDashboards,
  initializeCosmosDB: () => initializeCosmosDB,
  removeChartFromDashboard: () => removeChartFromDashboard,
  updateChatDocument: () => updateChatDocument,
  updateDashboard: () => updateDashboard
});
import { CosmosClient } from "@azure/cosmos";
var COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE_ID, COSMOS_CONTAINER_ID, COSMOS_DASHBOARDS_CONTAINER_ID, client, database, container, dashboardsContainer, initializeCosmosDB, createChatDocument, getChatDocument, updateChatDocument, addMessageToChat, addMessagesBySessionId, getUserChats, getChatBySessionIdEfficient, deleteChatDocument, createDashboard, getUserDashboards, getDashboardById, updateDashboard, deleteDashboard, addChartToDashboard, removeChartFromDashboard, generateColumnStatistics, getAllSessions, getAllSessionsPaginated, getSessionsWithFilters, getSessionStatistics;
var init_cosmosDB = __esm({
  "server/lib/cosmosDB.ts"() {
    "use strict";
    COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || "";
    COSMOS_KEY = process.env.COSMOS_KEY || "";
    COSMOS_DATABASE_ID = process.env.COSMOS_DATABASE_ID || "marico-insights";
    COSMOS_CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || "chats";
    COSMOS_DASHBOARDS_CONTAINER_ID = process.env.COSMOS_DASHBOARDS_CONTAINER_ID || "dashboards";
    client = new CosmosClient({
      endpoint: COSMOS_ENDPOINT,
      key: COSMOS_KEY
    });
    initializeCosmosDB = async () => {
      try {
        if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
          throw new Error("CosmosDB endpoint or key not configured");
        }
        const { database: db } = await client.databases.createIfNotExists({
          id: COSMOS_DATABASE_ID
        });
        database = db;
        const { container: cont } = await database.containers.createIfNotExists({
          id: COSMOS_CONTAINER_ID,
          partitionKey: "/fsmrora"
          // Partition by username for better performance
        });
        container = cont;
        const { container: dashCont } = await database.containers.createIfNotExists({
          id: COSMOS_DASHBOARDS_CONTAINER_ID,
          partitionKey: "/username"
        });
        dashboardsContainer = dashCont;
        console.log("CosmosDB initialized successfully");
      } catch (error) {
        console.error("Failed to initialize CosmosDB:", error);
        throw error;
      }
    };
    createChatDocument = async (username, fileName, sessionId, dataSummary, initialCharts = [], rawData = [], sampleRows = [], columnStatistics = {}, blobInfo, analysisMetadata, insights = []) => {
      const timestamp = Date.now();
      const chatId = `${fileName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;
      const chatDocument = {
        id: chatId,
        username,
        fileName,
        uploadedAt: timestamp,
        createdAt: timestamp,
        lastUpdatedAt: timestamp,
        dataSummary,
        messages: [],
        charts: initialCharts,
        insights,
        sessionId,
        rawData,
        sampleRows,
        columnStatistics,
        blobInfo,
        analysisMetadata: analysisMetadata || {
          totalProcessingTime: 0,
          aiModelUsed: "gpt-4o",
          fileSize: 0,
          analysisVersion: "1.0.0"
        }
      };
      try {
        if (!container) {
          throw new Error("CosmosDB container not initialized. Make sure initializeCosmosDB() was called successfully.");
        }
        const { resource } = await container.items.create(chatDocument);
        return resource;
      } catch (error) {
        console.error("Failed to create chat document:", error);
        throw error;
      }
    };
    getChatDocument = async (chatId, username) => {
      try {
        if (!container) {
          return null;
        }
        const { resource } = await container.item(chatId, username).read();
        return resource;
      } catch (error) {
        if (error.code === 404) {
          return null;
        }
        console.error("Failed to get chat document:", error);
        throw error;
      }
    };
    updateChatDocument = async (chatDocument) => {
      try {
        chatDocument.lastUpdatedAt = Date.now();
        const { resource } = await container.items.upsert(chatDocument);
        console.log(`\u2705 Updated chat document: ${chatDocument.id}`);
        return resource;
      } catch (error) {
        console.error("\u274C Failed to update chat document:", error);
        throw error;
      }
    };
    addMessageToChat = async (chatId, username, message) => {
      try {
        const chatDocument = await getChatDocument(chatId, username);
        if (!chatDocument) {
          throw new Error("Chat document not found");
        }
        chatDocument.messages.push(message);
        if (message.charts) {
          message.charts.forEach((chart) => {
            const existingChart = chatDocument.charts.find(
              (c) => c.title === chart.title && c.type === chart.type
            );
            if (!existingChart) {
              chatDocument.charts.push(chart);
            }
          });
        }
        return await updateChatDocument(chatDocument);
      } catch (error) {
        console.error("\u274C Failed to add message to chat:", error);
        throw error;
      }
    };
    addMessagesBySessionId = async (sessionId, messages) => {
      try {
        console.log("\u{1F4DD} addMessagesBySessionId - sessionId:", sessionId, "messages:", messages.map((m) => m.role));
        const chatDocumentAny = await getChatBySessionIdEfficient(sessionId);
        const chatDocument = chatDocumentAny;
        if (!chatDocument) {
          throw new Error("Chat document not found for sessionId");
        }
        console.log("\u{1F5C2}\uFE0F Appending to doc:", chatDocument.id, "partition:", chatDocument.username, "existing messages:", chatDocument.messages?.length || 0);
        chatDocument.messages.push(...messages);
        messages.forEach((msg) => {
          if (msg.charts && msg.charts.length > 0) {
            msg.charts.forEach((chart) => {
              const exists = chatDocument.charts.find(
                (c) => c.title === chart.title && c.type === chart.type
              );
              if (!exists) {
                chatDocument.charts.push(chart);
              }
            });
          }
        });
        const updated = await updateChatDocument(chatDocument);
        console.log("\u2705 Upserted chat doc:", updated.id, "messages now:", updated.messages?.length || 0);
        return updated;
      } catch (error) {
        console.error("\u274C Failed to add messages by sessionId:", error);
        throw error;
      }
    };
    getUserChats = async (username) => {
      try {
        const query = "SELECT * FROM c WHERE c.username = @username ORDER BY c.createdAt DESC";
        const { resources } = await container.items.query({
          query,
          parameters: [{ name: "@username", value: username }]
        }).fetchAll();
        return resources;
      } catch (error) {
        console.error("\u274C Failed to get user chats:", error);
        throw error;
      }
    };
    getChatBySessionIdEfficient = async (sessionId) => {
      try {
        const query = "SELECT * FROM c WHERE c.sessionId = @sessionId";
        const { resources } = await container.items.query({
          query,
          parameters: [{ name: "@sessionId", value: sessionId }]
        }).fetchAll();
        const doc = resources && resources.length > 0 ? resources[0] : null;
        if (!doc) {
          console.warn("\u26A0\uFE0F No chat document found for sessionId:", sessionId);
        } else {
          console.log("\u{1F50E} Found chat document by sessionId:", doc.id, "username:", doc.username);
        }
        return doc;
      } catch (error) {
        console.error("\u274C Failed to get chat by session ID:", error);
        throw error;
      }
    };
    deleteChatDocument = async (chatId, username) => {
      try {
        await container.item(chatId, username).delete();
        console.log(`\u2705 Deleted chat document: ${chatId}`);
      } catch (error) {
        console.error("\u274C Failed to delete chat document:", error);
        throw error;
      }
    };
    createDashboard = async (username, name, charts = []) => {
      if (!dashboardsContainer) {
        throw new Error("CosmosDB dashboards container not initialized.");
      }
      const timestamp = Date.now();
      const id = `${name.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;
      const dashboard = {
        id,
        username,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        charts
      };
      const { resource } = await dashboardsContainer.items.create(dashboard);
      return resource;
    };
    getUserDashboards = async (username) => {
      if (!dashboardsContainer) {
        return [];
      }
      const { resources } = await dashboardsContainer.items.query({
        query: "SELECT * FROM c WHERE c.username = @username ORDER BY c.createdAt DESC",
        parameters: [{ name: "@username", value: username }]
      }).fetchAll();
      return resources;
    };
    getDashboardById = async (id, username) => {
      try {
        const { resource } = await dashboardsContainer.item(id, username).read();
        return resource;
      } catch (error) {
        if (error.code === 404) return null;
        throw error;
      }
    };
    updateDashboard = async (dashboard) => {
      dashboard.updatedAt = Date.now();
      const { resource } = await dashboardsContainer.items.upsert(dashboard);
      return resource;
    };
    deleteDashboard = async (id, username) => {
      await dashboardsContainer.item(id, username).delete();
    };
    addChartToDashboard = async (id, username, chart) => {
      const dashboard = await getDashboardById(id, username);
      if (!dashboard) throw new Error("Dashboard not found");
      dashboard.charts.push(chart);
      return updateDashboard(dashboard);
    };
    removeChartFromDashboard = async (id, username, predicate) => {
      const dashboard = await getDashboardById(id, username);
      if (!dashboard) throw new Error("Dashboard not found");
      if (typeof predicate.index === "number") {
        dashboard.charts.splice(predicate.index, 1);
      } else if (predicate.title || predicate.type) {
        dashboard.charts = dashboard.charts.filter((c) => {
          const titleMatch = predicate.title ? c.title !== predicate.title : true;
          const typeMatch = predicate.type ? c.type !== predicate.type : true;
          return titleMatch || typeMatch;
        });
      }
      return updateDashboard(dashboard);
    };
    generateColumnStatistics = (data, numericColumns) => {
      const stats = {};
      for (const column of numericColumns) {
        const values = data.map((row) => Number(row[column])).filter((v) => !isNaN(v));
        if (values.length > 0) {
          const sortedValues = [...values].sort((a, b) => a - b);
          const sum = values.reduce((a, b) => a + b, 0);
          const mean = sum / values.length;
          const mid = Math.floor(sortedValues.length / 2);
          const median = sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
          const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
          const standardDeviation = Math.sqrt(variance);
          const q1Index = Math.floor(sortedValues.length * 0.25);
          const q3Index = Math.floor(sortedValues.length * 0.75);
          const q1 = sortedValues[q1Index];
          const q3 = sortedValues[q3Index];
          stats[column] = {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            sum,
            mean: Number(mean.toFixed(2)),
            median: Number(median.toFixed(2)),
            standardDeviation: Number(standardDeviation.toFixed(2)),
            q1: Number(q1.toFixed(2)),
            q3: Number(q3.toFixed(2)),
            range: Math.max(...values) - Math.min(...values),
            variance: Number(variance.toFixed(2))
          };
        }
      }
      return stats;
    };
    getAllSessions = async (username) => {
      try {
        let query = "SELECT * FROM c";
        const parameters = [];
        if (username) {
          query += " WHERE c.username = @username";
          parameters.push({ name: "@username", value: username });
        }
        query += " ORDER BY c.createdAt DESC";
        const queryOptions = parameters.length > 0 ? { parameters } : {};
        const { resources } = await container.items.query({
          query,
          ...queryOptions
        }).fetchAll();
        console.log(`\u2705 Retrieved ${resources.length} sessions from CosmosDB${username ? ` for user: ${username}` : ""}`);
        return resources;
      } catch (error) {
        console.error("\u274C Failed to get all sessions:", error);
        throw error;
      }
    };
    getAllSessionsPaginated = async (pageSize = 10, continuationToken, username) => {
      try {
        let query = "SELECT * FROM c";
        const parameters = [];
        if (username) {
          query += " WHERE c.username = @username";
          parameters.push({ name: "@username", value: username });
        }
        query += " ORDER BY c.createdAt DESC";
        const queryOptions = {
          maxItemCount: pageSize,
          continuationToken,
          ...parameters.length > 0 && { parameters }
        };
        const { resources, continuationToken: nextToken, hasMoreResults } = await container.items.query({
          query
        }, queryOptions).fetchNext();
        console.log(`\u2705 Retrieved ${resources.length} sessions (page size: ${pageSize})${username ? ` for user: ${username}` : ""}`);
        return {
          sessions: resources,
          continuationToken: nextToken,
          hasMoreResults: hasMoreResults || false
        };
      } catch (error) {
        console.error("\u274C Failed to get paginated sessions:", error);
        throw error;
      }
    };
    getSessionsWithFilters = async (options) => {
      try {
        let query = "SELECT * FROM c WHERE 1=1";
        const parameters = [];
        if (options.username) {
          query += " AND c.username = @username";
          parameters.push({ name: "@username", value: options.username });
        }
        if (options.fileName) {
          query += " AND CONTAINS(c.fileName, @fileName)";
          parameters.push({ name: "@fileName", value: options.fileName });
        }
        if (options.dateFrom) {
          query += " AND c.createdAt >= @dateFrom";
          parameters.push({ name: "@dateFrom", value: options.dateFrom });
        }
        if (options.dateTo) {
          query += " AND c.createdAt <= @dateTo";
          parameters.push({ name: "@dateTo", value: options.dateTo });
        }
        const orderBy = options.orderBy || "createdAt";
        const orderDirection = options.orderDirection || "DESC";
        query += ` ORDER BY c.${orderBy} ${orderDirection}`;
        if (options.limit) {
          query += ` OFFSET 0 LIMIT ${options.limit}`;
        }
        const queryOptions = options.limit ? { maxItemCount: options.limit } : {};
        const { resources } = await container.items.query({
          query,
          parameters
        }, queryOptions).fetchAll();
        console.log(`\u2705 Retrieved ${resources.length} sessions with filters`);
        return resources;
      } catch (error) {
        console.error("\u274C Failed to get filtered sessions:", error);
        throw error;
      }
    };
    getSessionStatistics = async () => {
      try {
        const allSessions = await getAllSessions();
        const totalSessions = allSessions.length;
        const uniqueUsers = new Set(allSessions.map((s) => s.username));
        const totalUsers = uniqueUsers.size;
        const totalMessages = allSessions.reduce((sum, session) => sum + session.messages.length, 0);
        const totalCharts = allSessions.reduce((sum, session) => sum + session.charts.length, 0);
        const sessionsByUser = {};
        allSessions.forEach((session) => {
          sessionsByUser[session.username] = (sessionsByUser[session.username] || 0) + 1;
        });
        const sessionsByDate = {};
        allSessions.forEach((session) => {
          const date = new Date(session.createdAt).toISOString().split("T")[0];
          sessionsByDate[date] = (sessionsByDate[date] || 0) + 1;
        });
        console.log(`\u2705 Generated session statistics: ${totalSessions} sessions, ${totalUsers} users`);
        return {
          totalSessions,
          totalUsers,
          totalMessages,
          totalCharts,
          sessionsByUser,
          sessionsByDate
        };
      } catch (error) {
        console.error("\u274C Failed to get session statistics:", error);
        throw error;
      }
    };
  }
});

// server/lib/blobStorage.ts
var blobStorage_exports = {};
__export(blobStorage_exports, {
  deleteFileFromBlob: () => deleteFileFromBlob,
  generateSasUrl: () => generateSasUrl,
  getFileFromBlob: () => getFileFromBlob,
  initializeBlobStorage: () => initializeBlobStorage,
  listUserFiles: () => listUserFiles,
  uploadFileToBlob: () => uploadFileToBlob
});
import { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } from "@azure/storage-blob";
var AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONTAINER_NAME, sharedKeyCredential, blobServiceClient, containerClient, initializeBlobStorage, uploadFileToBlob, getFileFromBlob, deleteFileFromBlob, listUserFiles, getContentTypeFromFileName, generateSasUrl;
var init_blobStorage = __esm({
  "server/lib/blobStorage.ts"() {
    "use strict";
    AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
    AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY || "";
    AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || "maricoinsight";
    sharedKeyCredential = new StorageSharedKeyCredential(
      AZURE_STORAGE_ACCOUNT_NAME,
      AZURE_STORAGE_ACCOUNT_KEY
    );
    blobServiceClient = new BlobServiceClient(
      `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      sharedKeyCredential
    );
    containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
    initializeBlobStorage = async () => {
      try {
        await containerClient.createIfNotExists();
        console.log("\u2705 Azure Blob Storage initialized successfully");
        console.log(`\u{1F4C1} Container: ${AZURE_STORAGE_CONTAINER_NAME}`);
      } catch (error) {
        console.error("\u274C Failed to initialize Azure Blob Storage:", error);
        throw error;
      }
    };
    uploadFileToBlob = async (fileBuffer, fileName, username, contentType) => {
      try {
        const timestamp = Date.now();
        const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, "_");
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const blobName = `${sanitizedUsername}/${timestamp}/${sanitizedFileName}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const uploadOptions = {
          blobHTTPHeaders: {
            blobContentType: contentType || getContentTypeFromFileName(fileName)
          },
          metadata: {
            originalFileName: fileName,
            uploadedBy: username,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        };
        const uploadResult = await blockBlobClient.upload(
          fileBuffer,
          fileBuffer.length,
          uploadOptions
        );
        const blobUrl = blockBlobClient.url;
        console.log(`\u2705 File uploaded to blob storage: ${blobName}`);
        console.log(`\u{1F517} Blob URL: ${blobUrl}`);
        return {
          blobUrl,
          blobName
        };
      } catch (error) {
        console.error("\u274C Failed to upload file to blob storage:", error);
        throw error;
      }
    };
    getFileFromBlob = async (blobName) => {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const downloadResponse = await blockBlobClient.download();
        if (!downloadResponse.readableStreamBody) {
          throw new Error("No readable stream body found");
        }
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch (error) {
        console.error("\u274C Failed to get file from blob storage:", error);
        throw error;
      }
    };
    deleteFileFromBlob = async (blobName) => {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        console.log(`\u2705 File deleted from blob storage: ${blobName}`);
      } catch (error) {
        console.error("\u274C Failed to delete file from blob storage:", error);
        throw error;
      }
    };
    listUserFiles = async (username) => {
      try {
        const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, "_");
        const files = [];
        for await (const blob of containerClient.listBlobsFlat({
          prefix: `${sanitizedUsername}/`
        })) {
          const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
          files.push({
            blobName: blob.name,
            blobUrl: blockBlobClient.url,
            lastModified: blob.properties.lastModified || /* @__PURE__ */ new Date(),
            size: blob.properties.contentLength || 0,
            metadata: blob.metadata || {}
          });
        }
        return files;
      } catch (error) {
        console.error("\u274C Failed to list user files:", error);
        throw error;
      }
    };
    getContentTypeFromFileName = (fileName) => {
      const extension = fileName.toLowerCase().split(".").pop();
      switch (extension) {
        case "csv":
          return "text/csv";
        case "xlsx":
          return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        case "xls":
          return "application/vnd.ms-excel";
        case "json":
          return "application/json";
        case "txt":
          return "text/plain";
        default:
          return "application/octet-stream";
      }
    };
    generateSasUrl = async (blobName, expiresInMinutes = 60) => {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const sasUrl = await blockBlobClient.generateSasUrl({
          permissions: BlobSASPermissions.parse("r"),
          // Read permission
          expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1e3)
        });
        return sasUrl;
      } catch (error) {
        console.error("\u274C Failed to generate SAS URL:", error);
        throw error;
      }
    };
  }
});

// server/index.ts
import "dotenv/config";
import express from "express";

// server/middleware/cors.ts
import cors from "cors";
var getAllowedOrigins = () => {
  const origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3004"
  ];
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.NODE_ENV === "production") {
    origins.push("https://marico-insight.vercel.app");
    origins.push("https://marico-insighting-tool2.vercel.app");
    origins.push("https://marico-insighting-tool2-fdll.vercel.app");
    origins.push("https://marico-insighting-tool2-git-dev-sameers-projects-c785670d.vercel.app");
    origins.push("https://marico-insight.netlify.app");
    origins.push("https://vocal-toffee-30f0ce.netlify.app");
  }
  return origins;
};
var corsConfig = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    console.log("CORS Origin check:", origin);
    console.log("Allowed origins:", allowedOrigins);
    if (!origin) {
      console.log("Request with no origin - allowing");
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      console.log("Origin allowed:", origin);
      return callback(null, true);
    }
    if (process.env.NODE_ENV === "production" && origin && origin.includes(".netlify.app")) {
      console.log("Allowing Netlify domain:", origin);
      return callback(null, true);
    }
    if (process.env.NODE_ENV === "production" && origin && origin.includes(".vercel.app")) {
      console.log("Allowing Vercel domain:", origin);
      return callback(null, true);
    }
    if (process.env.NODE_ENV === "production" && origin && origin.includes(".onrender.com")) {
      console.log("Allowing Render domain:", origin);
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== "production" && origin && origin.includes("localhost")) {
      console.log("Allowing localhost in development:", origin);
      return callback(null, true);
    }
    console.log("CORS blocked origin:", origin);
    console.log("Allowed origins:", allowedOrigins);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "X-User-Email",
    // Allow custom user email header
    "x-user-email",
    // Allow lowercase version too
    "X-User-Name",
    // Allow custom user name header
    "x-user-name"
    // Allow lowercase version too
  ],
  exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
  optionsSuccessStatus: 200,
  preflightContinue: false
});

// server/routes/index.ts
import { createServer } from "http";

// server/routes/upload.ts
import { Router } from "express";
import multer from "multer";

// server/lib/fileParser.ts
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
async function parseFile(buffer, filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return parseCsv(buffer);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(buffer);
  } else {
    throw new Error("Unsupported file format. Please upload CSV or Excel files.");
  }
}
function parseCsv(buffer) {
  const content = buffer.toString("utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
    cast_date: true
  });
  return records;
}
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });
  return data;
}
function createDataSummary(data) {
  if (data.length === 0) {
    throw new Error("No data found in file");
  }
  const columns = Object.keys(data[0]);
  const numericColumns = [];
  const dateColumns = [];
  const columnInfo = columns.map((col) => {
    const values = data.slice(0, 100).map((row) => row[col]);
    const nonNullValues = values.filter((v) => v !== null && v !== void 0 && v !== "");
    let type = "string";
    const isNumeric = nonNullValues.every((v) => {
      if (v === "") return false;
      const cleaned = String(v).replace(/[%,]/g, "").trim();
      return !isNaN(Number(cleaned)) && cleaned !== "";
    });
    const isDate = nonNullValues.some((v) => {
      const date = new Date(v);
      return !isNaN(date.getTime()) && typeof v === "string" && v.match(/\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}/);
    });
    if (isNumeric) {
      type = "number";
      numericColumns.push(col);
    } else if (isDate) {
      type = "date";
      dateColumns.push(col);
    }
    const sampleValues = values.slice(0, 3).map((v) => {
      if (v instanceof Date) {
        return v.toISOString();
      }
      return v;
    });
    return {
      name: col,
      type,
      sampleValues
    };
  });
  return {
    rowCount: data.length,
    columnCount: columns.length,
    columns: columnInfo,
    numericColumns,
    dateColumns
  };
}

// server/controllers/uploadController.ts
init_dataAnalyzer();

// shared/schema.ts
import { z as z2 } from "zod";
var chartSpecSchema = z2.object({
  type: z2.enum(["line", "bar", "scatter", "pie", "area"]),
  title: z2.string(),
  x: z2.string(),
  y: z2.string(),
  // Optional secondary Y series for dual-axis line charts
  y2: z2.string().optional(),
  xLabel: z2.string().optional(),
  yLabel: z2.string().optional(),
  y2Label: z2.string().optional(),
  aggregate: z2.enum(["sum", "mean", "count", "none"]).optional(),
  data: z2.array(z2.record(z2.union([z2.string(), z2.number()]))).optional(),
  xDomain: z2.tuple([z2.number(), z2.number()]).optional(),
  // [min, max] for X-axis
  yDomain: z2.tuple([z2.number(), z2.number()]).optional(),
  // [min, max] for Y-axis
  trendLine: z2.array(z2.record(z2.union([z2.string(), z2.number()]))).optional(),
  // Two points defining the trend line: [{ [x]: min, [y]: y1 }, { [x]: max, [y]: y2 }]
  keyInsight: z2.string().optional(),
  // Key insight about the chart
  recommendation: z2.string().optional()
  // Actionable recommendation based on the chart
});
var insightSchema = z2.object({
  id: z2.number(),
  text: z2.string()
});
var messageSchema = z2.object({
  role: z2.enum(["user", "assistant"]),
  content: z2.string(),
  charts: z2.array(chartSpecSchema).optional(),
  insights: z2.array(insightSchema).optional(),
  timestamp: z2.number()
});
var dataSummarySchema = z2.object({
  rowCount: z2.number(),
  columnCount: z2.number(),
  columns: z2.array(z2.object({
    name: z2.string(),
    type: z2.string(),
    sampleValues: z2.array(z2.union([z2.string(), z2.number(), z2.null()]))
  })),
  numericColumns: z2.array(z2.string()),
  dateColumns: z2.array(z2.string())
});
var columnStatisticsSchema = z2.object({
  count: z2.number(),
  min: z2.number(),
  max: z2.number(),
  sum: z2.number(),
  mean: z2.number(),
  median: z2.number(),
  standardDeviation: z2.number(),
  q1: z2.number(),
  q3: z2.number(),
  range: z2.number(),
  variance: z2.number()
});
var analysisMetadataSchema = z2.object({
  totalProcessingTime: z2.number(),
  aiModelUsed: z2.string(),
  fileSize: z2.number(),
  analysisVersion: z2.string()
});
var completeAnalysisDataSchema = z2.object({
  id: z2.string(),
  fileName: z2.string(),
  uploadedAt: z2.number(),
  createdAt: z2.number(),
  lastUpdatedAt: z2.number(),
  dataSummary: dataSummarySchema,
  rawData: z2.array(z2.record(z2.union([z2.string(), z2.number(), z2.null()]))),
  sampleRows: z2.array(z2.record(z2.union([z2.string(), z2.number(), z2.null()]))),
  columnStatistics: z2.record(z2.string(), columnStatisticsSchema),
  charts: z2.array(chartSpecSchema),
  insights: z2.array(insightSchema),
  messages: z2.array(messageSchema),
  // ✅ New nested chat storage format
  chatThread: z2.array(z2.object({
    charts: z2.array(z2.object({
      chart: chartSpecSchema,
      keyInsight: z2.string().optional(),
      recommendation: z2.string().optional()
    })),
    messageInsight: z2.string().optional()
  })).optional(),
  blobInfo: z2.object({
    blobUrl: z2.string(),
    blobName: z2.string()
  }).optional(),
  analysisMetadata: analysisMetadataSchema,
  sessionId: z2.string()
});
var analysisSessionSummarySchema = z2.object({
  id: z2.string(),
  fileName: z2.string(),
  uploadedAt: z2.number(),
  createdAt: z2.number(),
  lastUpdatedAt: z2.number(),
  dataSummary: dataSummarySchema,
  chartsCount: z2.number(),
  insightsCount: z2.number(),
  messagesCount: z2.number(),
  blobInfo: z2.object({
    blobUrl: z2.string(),
    blobName: z2.string()
  }).optional(),
  analysisMetadata: analysisMetadataSchema,
  sessionId: z2.string()
});
var uploadResponseSchema = z2.object({
  sessionId: z2.string(),
  summary: dataSummarySchema,
  charts: z2.array(chartSpecSchema),
  insights: z2.array(insightSchema),
  sampleRows: z2.array(z2.record(z2.union([z2.string(), z2.number(), z2.null()]))).optional(),
  chatId: z2.string().optional(),
  // CosmosDB chat document ID
  blobInfo: z2.object({
    blobUrl: z2.string(),
    blobName: z2.string()
  }).optional()
  // Azure Blob Storage info
});
var chatResponseSchema = z2.object({
  answer: z2.string(),
  charts: z2.array(chartSpecSchema).optional(),
  insights: z2.array(insightSchema).optional()
});
var userAnalysisSessionsResponseSchema = z2.object({
  sessions: z2.array(analysisSessionSummarySchema),
  totalCount: z2.number()
});
var columnStatisticsResponseSchema = z2.object({
  chatId: z2.string(),
  fileName: z2.string(),
  columnStatistics: z2.record(z2.string(), columnStatisticsSchema),
  numericColumns: z2.array(z2.string()),
  totalNumericColumns: z2.number()
});
var rawDataResponseSchema = z2.object({
  chatId: z2.string(),
  fileName: z2.string(),
  data: z2.array(z2.record(z2.union([z2.string(), z2.number(), z2.null()]))),
  pagination: z2.object({
    page: z2.number(),
    limit: z2.number(),
    totalRows: z2.number(),
    totalPages: z2.number(),
    hasNextPage: z2.boolean(),
    hasPrevPage: z2.boolean()
  })
});
var dashboardSchema = z2.object({
  id: z2.string(),
  username: z2.string(),
  name: z2.string(),
  createdAt: z2.number(),
  updatedAt: z2.number(),
  charts: z2.array(chartSpecSchema)
});
var createDashboardRequestSchema = z2.object({
  name: z2.string().min(1),
  charts: z2.array(chartSpecSchema).optional()
});
var addChartToDashboardRequestSchema = z2.object({
  chart: chartSpecSchema
});
var removeChartFromDashboardRequestSchema = z2.object({
  index: z2.number().optional(),
  title: z2.string().optional(),
  type: z2.enum(["line", "bar", "scatter", "pie", "area"]).optional()
}).refine((data) => data.index !== void 0 || data.title !== void 0 || data.type !== void 0, {
  message: "Provide index or title/type to remove a chart"
});

// server/controllers/uploadController.ts
init_cosmosDB();
init_blobStorage();
init_ragService();
var uploadFile = async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    let blobInfo;
    try {
      blobInfo = await uploadFileToBlob(
        req.file.buffer,
        req.file.originalname,
        username,
        req.file.mimetype
      );
    } catch (blobError) {
      console.error("Failed to upload file to blob storage:", blobError);
    }
    const data = await parseFile(req.file.buffer, req.file.originalname);
    if (data.length === 0) {
      return res.status(400).json({ error: "No data found in file" });
    }
    const summary = createDataSummary(data);
    console.log("\u{1F916} Starting AI analysis...");
    const { charts, insights } = await analyzeUpload(data, summary, req.file.originalname);
    console.log("\u{1F4CA} === CHART GENERATION RESULTS ===");
    console.log(`Generated ${charts.length} charts:`);
    charts.forEach((chart, index) => {
      console.log(`Chart ${index + 1}: "${chart.title}"`);
      console.log(`  Type: ${chart.type}`);
      console.log(`  X: "${chart.x}", Y: "${chart.y}"`);
      console.log(`  Data points: ${chart.data?.length || 0}`);
      if (chart.data && chart.data.length > 0) {
        console.log(`  Sample data:`, chart.data.slice(0, 2));
      } else {
        console.log(`  \u26A0\uFE0F  NO DATA - This chart will appear empty!`);
      }
    });
    console.log("\u{1F9F9} Sanitizing charts...");
    const sanitizedCharts = charts.map((chart, index) => {
      const originalLength = chart.data?.length || 0;
      const sanitizedData = chart.data?.filter((row) => {
        return !Object.values(row).some((value) => typeof value === "number" && isNaN(value));
      }) || [];
      console.log(`Chart ${index + 1} sanitization: ${originalLength} \u2192 ${sanitizedData.length} data points`);
      return {
        ...chart,
        data: sanitizedData
      };
    });
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      clearVectorStore(sessionId);
      console.log("\u{1F4DA} Initializing RAG for semantic search...");
      chunkData(data, summary, sessionId);
      generateChunkEmbeddings(sessionId).catch((err) => {
        console.error("RAG embedding generation error (non-critical):", err);
      });
      console.log("\u2705 RAG initialized - embeddings will be generated in background");
    } catch (ragError) {
      console.error("RAG initialization error (continuing without RAG):", ragError);
    }
    const columnStatistics = generateColumnStatistics(data, summary.numericColumns);
    const sampleRows = data.slice(0, 10).map((row) => {
      const serializedRow = {};
      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          serializedRow[key] = value.toISOString();
        } else {
          serializedRow[key] = value;
        }
      }
      return serializedRow;
    });
    const processingTime = Date.now() - startTime;
    let chatDocument;
    try {
      chatDocument = await createChatDocument(
        username,
        req.file.originalname,
        sessionId,
        summary,
        sanitizedCharts,
        data,
        // Raw data
        sampleRows,
        // Sample rows
        columnStatistics,
        // Column statistics
        blobInfo ? {
          blobUrl: blobInfo.blobUrl,
          blobName: blobInfo.blobName
        } : void 0,
        // Blob info
        {
          totalProcessingTime: processingTime,
          aiModelUsed: "gpt-4o",
          fileSize: req.file.size,
          analysisVersion: "1.0.0"
        },
        // Analysis metadata
        insights
        // AI-generated insights
      );
    } catch (cosmosError) {
      console.error("Failed to create chat document in CosmosDB:", cosmosError);
    }
    console.log("\u2705 Chart processing complete");
    const response = {
      sessionId,
      summary,
      charts: sanitizedCharts,
      insights,
      sampleRows,
      // Use the sampleRows we already created
      chatId: chatDocument?.id,
      // Include chat document ID if created
      blobInfo: blobInfo ? {
        blobUrl: blobInfo.blobUrl,
        blobName: blobInfo.blobName
      } : void 0
      // Include blob storage info if uploaded
    };
    const validated = uploadResponseSchema.parse(response);
    res.json(validated);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process file"
    });
  }
};

// server/routes/upload.ts
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload CSV or Excel files."));
    }
  }
});
var router = Router();
router.post("/upload", upload.single("file"), uploadFile);
var upload_default = router;

// server/routes/chat.ts
import { Router as Router2 } from "express";

// server/controllers/chatController.ts
init_dataAnalyzer();
init_chartGenerator();
init_insightGenerator();
init_cosmosDB();
var chatWithAI = async (req, res) => {
  try {
    console.log("\u{1F4E8} chatWithAI() called");
    const { sessionId, message, chatHistory } = req.body;
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    console.log("\u{1F4E5} Request body:", { sessionId, message: message?.substring(0, 50), chatHistoryLength: chatHistory?.length });
    if (!sessionId || !message) {
      console.log("\u274C Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }
    console.log("\u{1F50D} Fetching chat document for sessionId:", sessionId);
    const chatDocument = await getChatBySessionIdEfficient(sessionId);
    if (!chatDocument) {
      console.log("\u274C Chat document not found");
      return res.status(404).json({ error: "Session not found. Please upload a file first." });
    }
    console.log("\u2705 Chat document found, calling answerQuestion()");
    const result = await answerQuestion(
      chatDocument.rawData,
      // Use the actual data stored in CosmosDB
      message,
      chatHistory || [],
      chatDocument.dataSummary,
      sessionId
      // Pass sessionId for RAG
    );
    if (result.charts && Array.isArray(result.charts)) {
      try {
        result.charts = await Promise.all(
          result.charts.map(async (c) => {
            const dataForChart = c.data && Array.isArray(c.data) ? c.data : processChartData(chatDocument.rawData, c);
            const insights = !("keyInsight" in c) || !("recommendation" in c) ? await generateChartInsights(c, dataForChart, chatDocument.dataSummary) : null;
            return {
              ...c,
              data: dataForChart,
              keyInsight: c.keyInsight ?? insights?.keyInsight,
              recommendation: c.recommendation ?? insights?.recommendation
            };
          })
        );
      } catch (e) {
        console.error("Final enrichment of chat charts failed:", e);
      }
    }
    if (!result || !result.answer || result.answer.trim().length === 0) {
      console.error("\u274C Empty answer from answerQuestion:", result);
      return res.status(500).json({
        error: "Failed to generate response. Please try again.",
        answer: "I'm sorry, I couldn't generate a response. Please try rephrasing your question."
      });
    }
    console.log("\u2705 Answer generated:", result.answer.substring(0, 100));
    console.log("\u{1F4E4} Response being sent:", {
      answerLength: result.answer?.length,
      hasCharts: !!result.charts,
      chartsCount: result.charts?.length || 0,
      hasInsights: !!result.insights,
      insightsCount: result.insights?.length || 0
    });
    let validated = chatResponseSchema.parse(result);
    console.log("\u2705 Response validated successfully");
    if ((!validated.insights || validated.insights.length === 0) && Array.isArray(validated.charts) && validated.charts.length > 0) {
      try {
        const derived = validated.charts.map((c, idx) => {
          const text = c?.keyInsight || (c?.title ? `Insight: ${c.title}` : null);
          return text ? { id: idx + 1, text } : null;
        }).filter(Boolean);
        if (derived.length > 0) {
          validated = { ...validated, insights: derived };
        }
      } catch {
      }
    }
    try {
      await addMessagesBySessionId(sessionId, [
        {
          role: "user",
          content: message,
          timestamp: Date.now()
        },
        {
          role: "assistant",
          content: validated.answer,
          charts: validated.charts,
          insights: validated.insights,
          timestamp: Date.now()
        }
      ]);
      console.log(`\u2705 Messages saved to chat: ${chatDocument.id}`);
    } catch (cosmosError) {
      console.error("\u26A0\uFE0F Failed to save messages to CosmosDB:", cosmosError);
    }
    console.log("\u{1F4E8} Sending response to client:", {
      answerLength: validated.answer.length,
      chartsCount: validated.charts?.length || 0,
      insightsCount: validated.insights?.length || 0
    });
    res.json(validated);
    console.log("\u2705 Response sent successfully");
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process message";
    res.status(500).json({
      error: errorMessage,
      answer: `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your question.`,
      charts: [],
      insights: []
    });
  }
};

// server/routes/chat.ts
var router2 = Router2();
router2.post("/chat", chatWithAI);
var chat_default = router2;

// server/routes/chatManagement.ts
import { Router as Router3 } from "express";

// server/controllers/chatManagementController.ts
init_cosmosDB();
var getUserChatHistory = async (req, res) => {
  try {
    const username = req.params.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chats = await getUserChats(username);
    const chatList = chats.map((chat) => ({
      id: chat.id,
      fileName: chat.fileName,
      uploadedAt: chat.uploadedAt,
      createdAt: chat.createdAt,
      lastUpdatedAt: chat.lastUpdatedAt,
      messageCount: chat.messages.length,
      chartCount: chat.charts.length
    }));
    res.json({ chats: chatList });
  } catch (error) {
    console.error("Get user chats error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get user chats"
    });
  }
};
var getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;
    const username = req.query.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chat = await getChatDocument(chatId, username);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    res.json({ chat });
  } catch (error) {
    console.error("Get chat details error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get chat details"
    });
  }
};
var deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const username = req.body.username || req.headers["x-user-email"];
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    await deleteChatDocument(chatId, username);
    res.json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete chat"
    });
  }
};
var getChatStatistics = async (req, res) => {
  try {
    const username = req.params.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chats = await getUserChats(username);
    const stats = {
      totalChats: chats.length,
      totalMessages: chats.reduce((sum, chat) => sum + chat.messages.length, 0),
      totalCharts: chats.reduce((sum, chat) => sum + chat.charts.length, 0),
      totalFiles: new Set(chats.map((chat) => chat.fileName)).size,
      lastActivity: chats.length > 0 ? Math.max(...chats.map((chat) => chat.lastUpdatedAt)) : null
    };
    res.json({ statistics: stats });
  } catch (error) {
    console.error("Get chat statistics error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get chat statistics"
    });
  }
};

// server/routes/chatManagement.ts
var router3 = Router3();
router3.get("/chats/user/:username", getUserChatHistory);
router3.get("/chats/user", getUserChatHistory);
router3.get("/chats/:chatId", getChatDetails);
router3.delete("/chats/:chatId", deleteChat);
router3.get("/chats/user/:username/statistics", getChatStatistics);
router3.get("/chats/user/statistics", getChatStatistics);
var chatManagement_default = router3;

// server/routes/blobStorage.ts
import { Router as Router4 } from "express";

// server/controllers/blobController.ts
init_blobStorage();
var getUserFiles = async (req, res) => {
  try {
    const username = req.params.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const files = await listUserFiles(username);
    res.json({ files });
  } catch (error) {
    console.error("Get user files error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get user files"
    });
  }
};
var downloadFile = async (req, res) => {
  try {
    const { blobName } = req.params;
    const username = req.query.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!blobName.startsWith(username.replace(/[^a-zA-Z0-9]/g, "_"))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const fileBuffer = await getFileFromBlob(blobName);
    const fileName = blobName.split("/").pop() || "file";
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(fileBuffer);
  } catch (error) {
    console.error("Download file error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to download file"
    });
  }
};
var deleteFile = async (req, res) => {
  try {
    const { blobName } = req.params;
    const username = req.body.username || req.headers["x-user-email"];
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!blobName.startsWith(username.replace(/[^a-zA-Z0-9]/g, "_"))) {
      return res.status(403).json({ error: "Access denied" });
    }
    await deleteFileFromBlob(blobName);
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete file"
    });
  }
};
var generateFileAccessUrl = async (req, res) => {
  try {
    const { blobName } = req.params;
    const { expiresInMinutes = 60 } = req.body;
    const username = req.body.username || req.headers["x-user-email"];
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!blobName.startsWith(username.replace(/[^a-zA-Z0-9]/g, "_"))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const sasUrl = await generateSasUrl(blobName, expiresInMinutes);
    res.json({
      sasUrl,
      expiresInMinutes,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1e3).toISOString()
    });
  } catch (error) {
    console.error("Generate file access URL error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate file access URL"
    });
  }
};
var getFileMetadata = async (req, res) => {
  try {
    const { blobName } = req.params;
    const username = req.query.username || req.headers["x-user-email"] || req.body.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!blobName.startsWith(username.replace(/[^a-zA-Z0-9]/g, "_"))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const files = await listUserFiles(username);
    const file = files.find((f) => f.blobName === blobName);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json({
      blobName: file.blobName,
      blobUrl: file.blobUrl,
      lastModified: file.lastModified,
      size: file.size,
      metadata: file.metadata
    });
  } catch (error) {
    console.error("Get file metadata error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get file metadata"
    });
  }
};

// server/routes/blobStorage.ts
var router4 = Router4();
router4.get("/files/user/:username", getUserFiles);
router4.get("/files/user", getUserFiles);
router4.get("/files/:blobName/metadata", getFileMetadata);
router4.get("/files/:blobName/download", downloadFile);
router4.post("/files/:blobName/access-url", generateFileAccessUrl);
router4.delete("/files/:blobName", deleteFile);
var blobStorage_default = router4;

// server/routes/sessions.ts
import { Router as Router5 } from "express";

// server/controllers/sessionController.ts
init_cosmosDB();
var getAllSessionsEndpoint = async (req, res) => {
  try {
    const username = req.headers["x-user-email"] || req.query.username;
    if (!username) {
      return res.status(400).json({
        error: "Username is required. Please ensure you are logged in."
      });
    }
    const sessions = await getAllSessions(username);
    const sessionList = sessions.map((session) => ({
      id: session.id,
      username: session.username,
      fileName: session.fileName,
      uploadedAt: session.uploadedAt,
      createdAt: session.createdAt,
      lastUpdatedAt: session.lastUpdatedAt,
      messageCount: session.messages.length,
      chartCount: session.charts.length,
      sessionId: session.sessionId
    }));
    res.json({
      sessions: sessionList,
      count: sessionList.length,
      message: `Retrieved ${sessionList.length} sessions for user: ${username}`
    });
  } catch (error) {
    console.error("Get all sessions error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch all sessions"
    });
  }
};
var getSessionsPaginatedEndpoint = async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 10;
    const continuationToken = req.query.continuationToken;
    const username = req.headers["x-user-email"] || req.query.username;
    if (!username) {
      return res.status(400).json({
        error: "Username is required. Please ensure you are logged in."
      });
    }
    const result = await getAllSessionsPaginated(pageSize, continuationToken, username);
    const sessionList = result.sessions.map((session) => ({
      id: session.id,
      username: session.username,
      fileName: session.fileName,
      uploadedAt: session.uploadedAt,
      createdAt: session.createdAt,
      lastUpdatedAt: session.lastUpdatedAt,
      messageCount: session.messages.length,
      chartCount: session.charts.length,
      sessionId: session.sessionId
    }));
    res.json({
      sessions: sessionList,
      count: sessionList.length,
      continuationToken: result.continuationToken,
      hasMoreResults: result.hasMoreResults,
      pageSize,
      message: `Retrieved ${sessionList.length} sessions (page size: ${pageSize}) for user: ${username}`
    });
  } catch (error) {
    console.error("Get paginated sessions error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch paginated sessions"
    });
  }
};
var getSessionsFilteredEndpoint = async (req, res) => {
  try {
    const {
      username,
      fileName,
      dateFrom,
      dateTo,
      limit,
      orderBy,
      orderDirection
    } = req.query;
    const options = {};
    if (username) options.username = username;
    if (fileName) options.fileName = fileName;
    if (dateFrom) options.dateFrom = parseInt(dateFrom);
    if (dateTo) options.dateTo = parseInt(dateTo);
    if (limit) options.limit = parseInt(limit);
    if (orderBy) options.orderBy = orderBy;
    if (orderDirection) options.orderDirection = orderDirection;
    const sessions = await getSessionsWithFilters(options);
    const sessionList = sessions.map((session) => ({
      id: session.id,
      username: session.username,
      fileName: session.fileName,
      uploadedAt: session.uploadedAt,
      createdAt: session.createdAt,
      lastUpdatedAt: session.lastUpdatedAt,
      messageCount: session.messages.length,
      chartCount: session.charts.length,
      sessionId: session.sessionId
    }));
    res.json({
      sessions: sessionList,
      count: sessionList.length,
      filters: options,
      message: `Retrieved ${sessionList.length} sessions with filters`
    });
  } catch (error) {
    console.error("Get filtered sessions error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch filtered sessions"
    });
  }
};
var getSessionStatisticsEndpoint = async (req, res) => {
  try {
    const stats = await getSessionStatistics();
    res.json({
      statistics: stats,
      message: `Generated statistics for ${stats.totalSessions} sessions`
    });
  } catch (error) {
    console.error("Get session statistics error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch session statistics"
    });
  }
};
var getSessionDetailsEndpoint = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    const session = await getChatBySessionIdEfficient(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({
      session,
      message: `Retrieved session details for ${sessionId}`
    });
  } catch (error) {
    console.error("Get session details error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch session details"
    });
  }
};
var getSessionsByUserEndpoint = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const sessions = await getSessionsWithFilters({ username });
    const sessionList = sessions.map((session) => ({
      id: session.id,
      username: session.username,
      fileName: session.fileName,
      uploadedAt: session.uploadedAt,
      createdAt: session.createdAt,
      lastUpdatedAt: session.lastUpdatedAt,
      messageCount: session.messages.length,
      chartCount: session.charts.length,
      sessionId: session.sessionId
    }));
    res.json({
      sessions: sessionList,
      count: sessionList.length,
      username,
      message: `Retrieved ${sessionList.length} sessions for user ${username}`
    });
  } catch (error) {
    console.error("Get sessions by user error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch sessions by user"
    });
  }
};

// server/routes/sessions.ts
var router5 = Router5();
router5.get("/sessions", getAllSessionsEndpoint);
router5.get("/sessions/paginated", getSessionsPaginatedEndpoint);
router5.get("/sessions/filtered", getSessionsFilteredEndpoint);
router5.get("/sessions/statistics", getSessionStatisticsEndpoint);
router5.get("/sessions/details/:sessionId", getSessionDetailsEndpoint);
router5.get("/sessions/user/:username", getSessionsByUserEndpoint);
var sessions_default = router5;

// server/routes/dataRetrieval.ts
import { Router as Router6 } from "express";

// server/controllers/dataRetrievalController.ts
init_cosmosDB();
var getUserAnalysisSessions = async (req, res) => {
  try {
    const username = req.params.username || req.headers["x-user-email"] || req.query.username;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chats = await getUserChats(username);
    const sessions = chats.map((chat) => ({
      id: chat.id,
      fileName: chat.fileName,
      uploadedAt: chat.uploadedAt,
      createdAt: chat.createdAt,
      lastUpdatedAt: chat.lastUpdatedAt,
      dataSummary: chat.dataSummary,
      chartsCount: chat.charts.length,
      insightsCount: chat.insights?.length || 0,
      messagesCount: chat.messages.length,
      blobInfo: chat.blobInfo,
      analysisMetadata: chat.analysisMetadata,
      sessionId: chat.sessionId
    }));
    res.json({
      sessions,
      totalCount: sessions.length
    });
  } catch (error) {
    console.error("Error getting user analysis sessions:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve analysis sessions"
    });
  }
};
var getAnalysisData = async (req, res) => {
  try {
    const { chatId } = req.params;
    const username = req.query.username || req.headers["x-user-email"];
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chatDocument = await getChatDocument(chatId, username);
    if (!chatDocument) {
      return res.status(404).json({ error: "Analysis data not found" });
    }
    res.json({
      id: chatDocument.id,
      fileName: chatDocument.fileName,
      uploadedAt: chatDocument.uploadedAt,
      createdAt: chatDocument.createdAt,
      lastUpdatedAt: chatDocument.lastUpdatedAt,
      dataSummary: chatDocument.dataSummary,
      rawData: chatDocument.rawData,
      sampleRows: chatDocument.sampleRows,
      columnStatistics: chatDocument.columnStatistics,
      charts: chatDocument.charts,
      insights: chatDocument.insights || [],
      messages: chatDocument.messages,
      blobInfo: chatDocument.blobInfo,
      analysisMetadata: chatDocument.analysisMetadata,
      sessionId: chatDocument.sessionId
    });
  } catch (error) {
    console.error("Error getting analysis data:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve analysis data"
    });
  }
};
var getAnalysisDataBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chatDocument = await getChatBySessionIdEfficient(sessionId);
    if (!chatDocument) {
      return res.status(404).json({ error: "Analysis data not found for this session" });
    }
    res.json({
      id: chatDocument.id,
      fileName: chatDocument.fileName,
      uploadedAt: chatDocument.uploadedAt,
      createdAt: chatDocument.createdAt,
      lastUpdatedAt: chatDocument.lastUpdatedAt,
      dataSummary: chatDocument.dataSummary,
      rawData: chatDocument.rawData,
      sampleRows: chatDocument.sampleRows,
      columnStatistics: chatDocument.columnStatistics,
      charts: chatDocument.charts,
      insights: chatDocument.insights || [],
      messages: chatDocument.messages,
      blobInfo: chatDocument.blobInfo,
      analysisMetadata: chatDocument.analysisMetadata,
      sessionId: chatDocument.sessionId
    });
  } catch (error) {
    console.error("Error getting analysis data by session:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve analysis data"
    });
  }
};
var getColumnStatistics = async (req, res) => {
  try {
    const { chatId } = req.params;
    const username = req.query.username || req.headers["x-user-email"];
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chatDocument = await getChatDocument(chatId, username);
    if (!chatDocument) {
      return res.status(404).json({ error: "Analysis data not found" });
    }
    res.json({
      chatId: chatDocument.id,
      fileName: chatDocument.fileName,
      columnStatistics: chatDocument.columnStatistics,
      numericColumns: chatDocument.dataSummary.numericColumns,
      totalNumericColumns: Object.keys(chatDocument.columnStatistics).length
    });
  } catch (error) {
    console.error("Error getting column statistics:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve column statistics"
    });
  }
};
var getRawData = async (req, res) => {
  try {
    const { chatId } = req.params;
    const username = req.query.username || req.headers["x-user-email"];
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const chatDocument = await getChatDocument(chatId, username);
    if (!chatDocument) {
      return res.status(404).json({ error: "Analysis data not found" });
    }
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = chatDocument.rawData.slice(startIndex, endIndex);
    res.json({
      chatId: chatDocument.id,
      fileName: chatDocument.fileName,
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalRows: chatDocument.rawData.length,
        totalPages: Math.ceil(chatDocument.rawData.length / limit),
        hasNextPage: endIndex < chatDocument.rawData.length,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Error getting raw data:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve raw data"
    });
  }
};

// server/routes/dataRetrieval.ts
var router6 = Router6();
router6.get("/user/:username/sessions", getUserAnalysisSessions);
router6.get("/chat/:chatId", getAnalysisData);
router6.get("/session/:sessionId", getAnalysisDataBySession);
router6.get("/chat/:chatId/statistics", getColumnStatistics);
router6.get("/chat/:chatId/raw-data", getRawData);
var dataRetrieval_default = router6;

// server/routes/dashboards.ts
import { Router as Router7 } from "express";

// server/controllers/dashboardController.ts
init_cosmosDB();
var createDashboardController = async (req, res) => {
  try {
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    const parsed = createDashboardRequestSchema.parse(req.body);
    const dashboard = await createDashboard(username, parsed.name, parsed.charts || []);
    res.status(201).json(dashboard);
  } catch (error) {
    res.status(400).json({ error: error?.message || "Failed to create dashboard" });
  }
};
var listDashboardsController = async (req, res) => {
  try {
    const username = req.query.username || req.headers["x-user-email"] || "anonymous@example.com";
    const dashboards = await getUserDashboards(username);
    res.json({ dashboards });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to fetch dashboards" });
  }
};
var deleteDashboardController = async (req, res) => {
  try {
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    const { dashboardId } = req.params;
    const existing = await getDashboardById(dashboardId, username);
    if (!existing) return res.status(404).json({ error: "Dashboard not found" });
    await deleteDashboard(dashboardId, username);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to delete dashboard" });
  }
};
var addChartToDashboardController = async (req, res) => {
  try {
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    const { dashboardId } = req.params;
    const parsed = addChartToDashboardRequestSchema.parse(req.body);
    const updated = await addChartToDashboard(dashboardId, username, parsed.chart);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error?.message || "Failed to add chart" });
  }
};
var removeChartFromDashboardController = async (req, res) => {
  try {
    const username = req.body.username || req.headers["x-user-email"] || "anonymous@example.com";
    const { dashboardId } = req.params;
    const parsed = removeChartFromDashboardRequestSchema.parse(req.body);
    const updated = await removeChartFromDashboard(dashboardId, username, parsed);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error?.message || "Failed to remove chart" });
  }
};

// server/routes/dashboards.ts
var router7 = Router7();
router7.post("/dashboards", createDashboardController);
router7.get("/dashboards", listDashboardsController);
router7.delete("/dashboards/:dashboardId", deleteDashboardController);
router7.post("/dashboards/:dashboardId/charts", addChartToDashboardController);
router7.delete("/dashboards/:dashboardId/charts", removeChartFromDashboardController);
var dashboards_default = router7;

// server/routes/index.ts
function registerRoutes(app) {
  app.use("/api", upload_default);
  app.use("/api", chat_default);
  app.use("/api", chatManagement_default);
  app.use("/api", blobStorage_default);
  app.use("/api", sessions_default);
  app.use("/api/data", dataRetrieval_default);
  app.use("/api", dashboards_default);
  if (process.env.VERCEL) {
    return;
  }
  const httpServer = createServer(app);
  return httpServer;
}

// server/index.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: false, limit: "20mb" }));
  app.options("*", corsConfig);
  app.use(corsConfig);
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "Server is running" });
  });
  registerRoutes(app);
  Promise.all([
    Promise.resolve().then(() => (init_cosmosDB(), cosmosDB_exports)).then((m) => m.initializeCosmosDB()).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("\u26A0\uFE0F CosmosDB initialization failed, continuing without it:", errorMessage);
    }),
    Promise.resolve().then(() => (init_blobStorage(), blobStorage_exports)).then((m) => m.initializeBlobStorage()).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("\u26A0\uFE0F Azure Blob Storage initialization failed, continuing without it:", errorMessage);
    })
  ]).catch(() => {
  });
  return app;
}
if (!process.env.VERCEL) {
  (async () => {
    try {
      const app = createApp();
      const { createServer: createServer2 } = await import("http");
      const server = createServer2(app);
      const port = process.env.PORT || 3003;
      server.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}
export {
  createApp
};
