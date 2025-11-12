import { ChartSpec } from '../../shared/schema.js';
import { findMatchingColumn } from './agents/utils/columnMatcher.js';

// Helper to clean numeric values (strip %, commas, etc.)
function toNumber(value: any): number {
  if (value === null || value === undefined || value === '') return NaN;
  const cleaned = String(value).replace(/[%,]/g, '').trim();
  return Number(cleaned);
}

// Helper to parse date strings in various formats
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Try common date formats
  // Format: "MMM-YY" or "MMM YY" or "MMM-YYYY" (e.g., "Apr-24", "Apr 24", "Apr-2024")
  const mmmYyMatch = str.match(/^([A-Za-z]{3})[-/]?(\d{2,4})$/);
  if (mmmYyMatch) {
    const monthNames: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    const month = monthNames[mmmYyMatch[1].toLowerCase().substring(0, 3)];
    if (month !== undefined) {
      let year = parseInt(mmmYyMatch[2]);
      // If year is 2 digits, convert to 4 digits
      // Common convention: 00-30 = 2000-2030, 31-99 = 1931-1999
      if (year < 100) {
        year = year <= 30 ? 2000 + year : 1900 + year;
      }
      return new Date(year, month, 1);
    }
  }
  
  // Try ISO format or standard date formats
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

// Helper to compare values for sorting - handles dates properly
function compareValues(a: any, b: any): number {
  const aStr = String(a);
  const bStr = String(b);
  
  // Try to parse as dates
  const aDate = parseDate(aStr);
  const bDate = parseDate(bStr);
  
  if (aDate && bDate) {
    // Both are dates, compare chronologically
    return aDate.getTime() - bDate.getTime();
  }
  
  // Fall back to string comparison
  return aStr.localeCompare(bStr);
}

export function processChartData(
  data: Record<string, any>[],
  chartSpec: ChartSpec
): Record<string, any>[] {
  const { type, x, y, y2, aggregate = 'none' } = chartSpec;
  
  console.log(`🔍 Processing chart: "${chartSpec.title}"`);
  console.log(`   Type: ${type}, X: "${x}", Y: "${y}", Aggregate: ${aggregate}`);
  
  // Check if data is empty
  if (!data || data.length === 0) {
    console.warn(`❌ No data provided for chart: ${chartSpec.title}`);
    return [];
  }
  
  console.log(`   Data rows available: ${data.length}`);
  
  // Check if columns exist in data
  const firstRow = data[0];
  if (!firstRow) {
    console.warn(`❌ No rows in data for chart: ${chartSpec.title}`);
    return [];
  }
  
  const availableColumns = Object.keys(firstRow);
  console.log(`   Available columns: [${availableColumns.join(', ')}]`);
  
  // Use flexible column matching instead of exact hasOwnProperty checks
  // This handles whitespace differences, case variations, and other imperfections
  const matchedX = findMatchingColumn(x, availableColumns);
  const matchedY = findMatchingColumn(y, availableColumns);
  const matchedY2 = y2 ? findMatchingColumn(y2, availableColumns) : null;
  
  if (!matchedX) {
    console.warn(`❌ Column "${x}" not found in data for chart: ${chartSpec.title}`);
    console.log(`   Available columns: [${availableColumns.join(', ')}]`);
    return [];
  }
  
  if (!matchedY) {
    console.warn(`❌ Column "${y}" not found in data for chart: ${chartSpec.title}`);
    console.log(`   Available columns: [${availableColumns.join(', ')}]`);
    return [];
  }
  
  // Optional secondary series existence check (for dual-axis line charts)
  if (y2 && !matchedY2) {
    console.warn(`❌ Column "${y2}" not found in data for secondary series of chart: ${chartSpec.title}`);
    console.log(`   Available columns: [${availableColumns.join(', ')}]`);
  }
  
  // Update chart spec with matched column names to ensure consistency
  chartSpec.x = matchedX;
  chartSpec.y = matchedY;
  if (y2 && matchedY2) {
    chartSpec.y2 = matchedY2;
  }
  
  // Use matched column names for data access
  const xCol = matchedX;
  const yCol = matchedY;
  const y2Col = matchedY2;
  
  // Check for valid data in the columns (using matched column names)
  const xValues = data.map(row => row[xCol]).filter(v => v !== null && v !== undefined && v !== '');
  const yValues = data.map(row => row[yCol]).filter(v => v !== null && v !== undefined && v !== '');
  
  console.log(`   X column "${xCol}" (matched from "${x}"): ${xValues.length} valid values (sample: ${xValues.slice(0, 3).join(', ')})`);
  console.log(`   Y column "${yCol}" (matched from "${y}"): ${yValues.length} valid values (sample: ${yValues.slice(0, 3).join(', ')})`);
  
  if (xValues.length === 0) {
    console.warn(`❌ No valid X values in column "${xCol}" for chart: ${chartSpec.title}`);
    return [];
  }
  
  if (yValues.length === 0) {
    console.warn(`❌ No valid Y values in column "${yCol}" for chart: ${chartSpec.title}`);
    return [];
  }

  if (type === 'scatter') {
    // For scatter plots, filter numeric values and sample if needed
    let scatterData = data
      .map((row) => ({
        [xCol]: toNumber(row[xCol]),
        [yCol]: toNumber(row[yCol]),
      }))
      .filter((row) => !isNaN(row[xCol]) && !isNaN(row[yCol]));

    console.log(`   Scatter plot: ${scatterData.length} valid numeric points`);

    // Sample to 1000 points if dataset is large
    if (scatterData.length > 1000) {
      const step = Math.floor(scatterData.length / 1000);
      scatterData = scatterData.filter((_, idx) => idx % step === 0).slice(0, 1000);
      console.log(`   Sampled to ${scatterData.length} points for performance`);
    }

    return scatterData;
  }

  if (type === 'pie') {
    // Check if data is already aggregated (if number of unique x values equals number of rows)
    const uniqueXValues = new Set(data.map(row => String(row[xCol])));
    const isAlreadyAggregated = uniqueXValues.size === data.length;
    
    let allData: Record<string, any>[];
    
    if (isAlreadyAggregated) {
      // Data is already aggregated, use it directly
      console.log(`   Pie chart: Data is already aggregated (${data.length} unique groups), using as-is`);
      allData = data
        .map(row => ({
          [xCol]: row[xCol],
          [yCol]: toNumber(row[yCol]),
        }))
        .filter(row => !isNaN(row[yCol]))
        .sort((a, b) => toNumber(b[yCol]) - toNumber(a[yCol]));
    } else {
      // Need to aggregate
      console.log(`   Processing pie chart with aggregation: ${aggregate || 'sum'}`);
      const aggregated = aggregateData(data, xCol, yCol, aggregate || 'sum');
      console.log(`   Aggregated data points: ${aggregated.length}`);
      
      allData = aggregated
        .sort((a, b) => toNumber(b[yCol]) - toNumber(a[yCol]));
    }
    
    // Calculate total of all items to ensure percentages add up to 100%
    const total = allData.reduce((sum, row) => sum + toNumber(row[yCol]), 0);
    console.log(`   Total value for all categories: ${total}`);
    
    // Take top 5 items
    const top5 = allData.slice(0, 5);
    const remaining = allData.slice(5);
    
    // Calculate sum of remaining items
    const remainingSum = remaining.reduce((sum, row) => sum + toNumber(row[yCol]), 0);
    
    // Build result: top 5 + "Others" category if there are remaining items
    const result = [...top5];
    
    if (remaining.length > 0 && remainingSum > 0) {
      // Create "Others" category with the sum of remaining items
      const othersLabel = `Other ${remaining.length > 1 ? `${remaining.length} items` : 'item'}`;
      result.push({
        [xCol]: othersLabel,
        [yCol]: remainingSum,
      });
      console.log(`   Added "Others" category with ${remaining.length} items, sum: ${remainingSum}`);
    }
    
    // Verify total (should be 100% of original total)
    const resultTotal = result.reduce((sum, row) => sum + toNumber(row[yCol]), 0);
    console.log(`   Pie chart result: ${result.length} segments (top 5 + ${remaining.length > 0 ? 'Others' : 'none'})`);
    console.log(`   Result total: ${resultTotal}, Original total: ${total}, Match: ${Math.abs(resultTotal - total) < 0.01 ? '✅' : '⚠️'}`);
    
    return result;
  }

  if (type === 'bar') {
    // Check if this is a correlation bar chart (has 'variable' and 'correlation' columns)
    // Correlation bar charts already have processed data and shouldn't be aggregated
    const isCorrelationBarChart = (xCol === 'variable' && yCol === 'correlation') ||
                                   (data.length > 0 && data[0].hasOwnProperty('variable') && data[0].hasOwnProperty('correlation'));
    
    if (isCorrelationBarChart) {
      // Correlation bar chart - data is already processed, just sort and return
      console.log(`   Processing correlation bar chart (data already processed)`);
      const result = data
        .map(row => ({
          variable: row.variable || row[xCol],
          correlation: toNumber(row.correlation || row[yCol]),
        }))
        .filter(row => !isNaN(row.correlation))
        .sort((a, b) => {
          // Sort by absolute correlation value (descending) to show strongest correlations first
          return Math.abs(b.correlation) - Math.abs(a.correlation);
        });
      
      console.log(`   Correlation bar chart result: ${result.length} bars`);
      return result;
    }
    
    // Regular bar chart - aggregate and get top 10
    console.log(`   Processing bar chart with aggregation: ${aggregate || 'sum'}`);
    const aggregated = aggregateData(data, xCol, yCol, aggregate || 'sum');
    console.log(`   Aggregated data points: ${aggregated.length}`);
    
    const result = aggregated
      .sort((a, b) => toNumber(b[yCol]) - toNumber(a[yCol]))
      .slice(0, 10);
    
    console.log(`   Bar chart result: ${result.length} bars`);
    return result;
  }

  if (type === 'line' || type === 'area') {
    console.log(`   Processing ${type} chart`);
    
    // Sort by x and optionally aggregate
    if (aggregate && aggregate !== 'none') {
      console.log(`   Using aggregation: ${aggregate}`);
      const aggregated = aggregateData(data, xCol, yCol, aggregate);
      console.log(`   Aggregated data points: ${aggregated.length}`);
      // Use date-aware sorting
      const result = aggregated.sort((a, b) => compareValues(a[xCol], b[xCol]));
      console.log(`   ${type} chart result: ${result.length} points (sorted chronologically)`);
      return result;
    }

    const result = data
      .map((row) => ({
        [xCol]: row[xCol],
        [yCol]: toNumber(row[yCol]),
        ...(y2Col ? { [y2Col]: toNumber(row[y2Col]) } : {}),
      }))
      .filter((row) => !isNaN(row[yCol]) && (!y2Col || !isNaN(row[y2Col])))
      // Use date-aware sorting for chronological order
      .sort((a, b) => compareValues(a[xCol], b[xCol]));
    
    console.log(`   ${type} chart result: ${result.length} points (sorted chronologically)`);
    return result;
  }

  console.warn(`❌ Unknown chart type: ${type} for chart: ${chartSpec.title}`);
  return [];
}

function aggregateData(
  data: Record<string, any>[],
  groupBy: string,
  valueColumn: string,
  aggregateType: string
): Record<string, any>[] {
  console.log(`     Aggregating by "${groupBy}" with "${aggregateType}" of "${valueColumn}"`);
  
  const grouped = new Map<string, number[]>();
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
      grouped.get(key)!.push(value);
    } else {
      invalidValues++;
    }
  }

  console.log(`     Valid values: ${validValues}, Invalid values: ${invalidValues}`);
  console.log(`     Unique groups: ${grouped.size}`);

  const result: Record<string, any>[] = [];

  for (const [key, values] of Array.from(grouped.entries())) {
    let aggregatedValue: number;

    switch (aggregateType) {
      case 'sum':
        aggregatedValue = values.reduce((a: number, b: number) => a + b, 0);
        break;
      case 'mean':
        aggregatedValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      default:
        aggregatedValue = values[0];
    }

    result.push({
      [groupBy]: key,
      [valueColumn]: aggregatedValue,
    });
  }

  console.log(`     Aggregation result: ${result.length} groups`);
  return result;
}
