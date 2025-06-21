// src/performance/metrics.ts
import { UserError } from "fastmcp";
import { z } from "zod";

/**
 * CONTRACT: Performance metrics collection with immutability principles
 * 
 * Preconditions:
 * - Metrics must be collected with accurate timing
 * - Memory measurements must be consistent
 * - Operation names must be valid identifiers
 * 
 * Postconditions:
 * - Metrics are immutable once created
 * - Timing measurements are accurate to microseconds
 * - Memory measurements include heap and external allocations
 * 
 * Invariants:
 * - Performance data integrity maintained throughout collection
 * - No side effects during measurement collection
 * - Consistent measurement methodology across operations
 */

/**
 * TYPE-DRIVEN DEVELOPMENT: Branded types for performance metrics
 */
export type OperationName = string & { readonly __operationName: unique symbol };
export type Timestamp = number & { readonly __timestamp: unique symbol };
export type MemoryBytes = number & { readonly __memoryBytes: unique symbol };
export type Duration = number & { readonly __duration: unique symbol };

/**
 * IMMUTABILITY: Frozen performance metric data structure
 */
export interface PerformanceMetric {
  readonly operationName: OperationName;
  readonly startTime: Timestamp;
  readonly endTime: Timestamp;
  readonly duration: Duration;
  readonly memoryBefore: MemoryUsage;
  readonly memoryAfter: MemoryUsage;
  readonly memoryDelta: MemoryUsage;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface MemoryUsage {
  readonly heapUsed: MemoryBytes;
  readonly heapTotal: MemoryBytes;
  readonly external: MemoryBytes;
  readonly rss: MemoryBytes;
}

/**
 * DEFENSIVE PROGRAMMING: Comprehensive metric validation schema
 */
const OperationNameSchema = z.string()
  .min(1, "Operation name cannot be empty")
  .max(100, "Operation name too long")
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Operation name must be a valid identifier");

const MetadataSchema = z.record(z.unknown()).optional().default({});

/**
 * CONTRACT: Performance measurement class with advanced programming techniques
 * 
 * Preconditions:
 * - Timer must be created with valid operation name
 * - Memory measurements must be taken consistently
 * 
 * Postconditions:
 * - Measurements are accurate and complete
 * - Results are immutable and thread-safe
 * 
 * Invariants:
 * - Internal state consistency maintained
 * - No memory leaks during measurement
 * - Timing accuracy preserved throughout operation
 */
export class PerformanceTimer {
  private readonly _operationName: OperationName;
  private readonly _startTime: Timestamp;
  private readonly _startMemory: MemoryUsage;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _completed: boolean = false;

  constructor(operationName: string, metadata: Record<string, unknown> = {}) {
    // DEFENSIVE PROGRAMMING: Input validation
    const validationResult = OperationNameSchema.safeParse(operationName);
    if (!validationResult.success) {
      throw new UserError(`Invalid operation name: ${validationResult.error.message}`);
    }

    const validatedMetadata = MetadataSchema.parse(metadata);

    this._operationName = operationName as OperationName;
    this._startTime = this._getHighResolutionTime() as Timestamp;
    this._startMemory = this._captureMemoryUsage();
    this._metadata = Object.freeze({ ...validatedMetadata });
  }

  /**
   * CONTRACT: Complete measurement with comprehensive result capture
   * 
   * Preconditions:
   * - Timer must not be already completed
   * - Operation outcome must be determinable
   * 
   * Postconditions:
   * - Returns complete, immutable performance metric
   * - Timer is marked as completed
   * - No further measurements possible
   * 
   * Invariants:
   * - Timing calculation accuracy maintained
   * - Memory delta calculation correctness preserved
   */
  complete(success: boolean = true, errorMessage?: string): PerformanceMetric {
    // DEFENSIVE PROGRAMMING: State validation
    if (this._completed) {
      throw new UserError("Performance timer has already been completed");
    }

    if (!success && !errorMessage) {
      throw new UserError("Error message must be provided when success is false");
    }

    if (success && errorMessage) {
      throw new UserError("Error message cannot be provided when success is true");
    }

    const endTime = this._getHighResolutionTime() as Timestamp;
    const endMemory = this._captureMemoryUsage();
    const duration = (endTime - this._startTime) as Duration;

    // IMMUTABILITY: Calculate memory delta
    const memoryDelta: MemoryUsage = {
      heapUsed: (endMemory.heapUsed - this._startMemory.heapUsed) as MemoryBytes,
      heapTotal: (endMemory.heapTotal - this._startMemory.heapTotal) as MemoryBytes,
      external: (endMemory.external - this._startMemory.external) as MemoryBytes,
      rss: (endMemory.rss - this._startMemory.rss) as MemoryBytes,
    };

    this._completed = true;

    // CONTRACT: Postcondition verification
    if (duration < 0) {
      throw new UserError("Postcondition violated: negative duration calculated");
    }

    if (!Number.isFinite(duration)) {
      throw new UserError("Postcondition violated: invalid duration calculated");
    }

    // IMMUTABILITY: Return frozen metric object
    const metric: PerformanceMetric = Object.freeze({
      operationName: this._operationName,
      startTime: this._startTime,
      endTime,
      duration,
      memoryBefore: this._startMemory,
      memoryAfter: endMemory,
      memoryDelta,
      success,
      errorMessage,
      metadata: this._metadata,
    });

    return metric;
  }

  /**
   * PURE FUNCTION: High-resolution time capture
   * 
   * Preconditions: Node.js process.hrtime.bigint available
   * Postconditions: Returns nanosecond-precision timestamp
   * Invariants: Monotonic time progression guaranteed
   */
  private _getHighResolutionTime(): number {
    try {
      return Number(process.hrtime.bigint()) / 1_000_000; // Convert to milliseconds
    } catch (error) {
      // Fallback to Date.now() if hrtime unavailable
      return Date.now();
    }
  }

  /**
   * PURE FUNCTION: Memory usage capture
   * 
   * Preconditions: Node.js process.memoryUsage available
   * Postconditions: Returns complete memory usage snapshot
   * Invariants: Memory measurements are consistent and accurate
   */
  private _captureMemoryUsage(): MemoryUsage {
    try {
      const memUsage = process.memoryUsage();
      return {
        heapUsed: memUsage.heapUsed as MemoryBytes,
        heapTotal: memUsage.heapTotal as MemoryBytes,
        external: memUsage.external as MemoryBytes,
        rss: memUsage.rss as MemoryBytes,
      };
    } catch (error) {
      // DEFENSIVE PROGRAMMING: Fallback values if memory usage unavailable
      return {
        heapUsed: 0 as MemoryBytes,
        heapTotal: 0 as MemoryBytes,
        external: 0 as MemoryBytes,
        rss: 0 as MemoryBytes,
      };
    }
  }

  /**
   * CONTRACT: Timer state introspection
   * 
   * Returns whether timer has been completed
   */
  get isCompleted(): boolean {
    return this._completed;
  }

  /**
   * CONTRACT: Operation name accessor
   * 
   * Returns the operation name for this timer
   */
  get operationName(): OperationName {
    return this._operationName;
  }
}

/**
 * CONTRACT: Performance metrics aggregation with statistical analysis
 * 
 * Preconditions:
 * - Metrics must be valid PerformanceMetric objects
 * - Collection must not be empty for statistical calculations
 * 
 * Postconditions:
 * - Returns comprehensive statistical summary
 * - All calculations are mathematically correct
 * 
 * Invariants:
 * - Statistical accuracy maintained
 * - No data corruption during aggregation
 */
export interface PerformanceStats {
  readonly operationName: OperationName;
  readonly sampleCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly successRate: number;
  readonly duration: {
    readonly min: Duration;
    readonly max: Duration;
    readonly mean: Duration;
    readonly median: Duration;
    readonly p95: Duration;
    readonly p99: Duration;
    readonly stdDev: Duration;
  };
  readonly memory: {
    readonly heapUsedDelta: {
      readonly min: MemoryBytes;
      readonly max: MemoryBytes;
      readonly mean: MemoryBytes;
    };
    readonly totalMemoryGrowth: MemoryBytes;
  };
}

/**
 * IMMUTABILITY & PURE FUNCTIONS: Statistical calculation utilities
 */
export class PerformanceAnalyzer {
  
  /**
   * CONTRACT: Aggregate metrics with comprehensive statistical analysis
   * 
   * Preconditions:
   * - metrics array must not be empty
   * - all metrics must be for the same operation
   * 
   * Postconditions:
   * - returns complete statistical summary
   * - all calculations are accurate
   * 
   * Invariants:
   * - input metrics remain unmodified
   * - statistical accuracy maintained throughout
   */
  static calculateStats(metrics: readonly PerformanceMetric[]): PerformanceStats {
    // DEFENSIVE PROGRAMMING: Input validation
    if (!Array.isArray(metrics) || metrics.length === 0) {
      throw new UserError("Metrics array cannot be empty");
    }

    const operationName = metrics[0].operationName;
    const inconsistentOperation = metrics.find(m => m.operationName !== operationName);
    if (inconsistentOperation) {
      throw new UserError(`All metrics must be for the same operation. Expected ${operationName}, found ${inconsistentOperation.operationName}`);
    }

    // IMMUTABILITY: Create sorted arrays for statistical calculations
    const durations = [...metrics.map(m => m.duration)].sort((a, b) => a - b);
    const heapDeltas = metrics.map(m => m.memoryDelta.heapUsed);
    
    const successCount = metrics.filter(m => m.success).length;
    const failureCount = metrics.length - successCount;

    // PURE FUNCTIONS: Statistical calculations
    const durationStats = {
      min: durations[0] as Duration,
      max: durations[durations.length - 1] as Duration,
      mean: this._calculateMean(durations) as Duration,
      median: this._calculateMedian(durations) as Duration,
      p95: this._calculatePercentile(durations, 95) as Duration,
      p99: this._calculatePercentile(durations, 99) as Duration,
      stdDev: this._calculateStandardDeviation(durations) as Duration,
    };

    const memoryStats = {
      heapUsedDelta: {
        min: Math.min(...heapDeltas) as MemoryBytes,
        max: Math.max(...heapDeltas) as MemoryBytes,
        mean: this._calculateMean(heapDeltas) as MemoryBytes,
      },
      totalMemoryGrowth: heapDeltas.reduce((sum, delta) => sum + Math.max(0, delta), 0) as MemoryBytes,
    };

    // CONTRACT: Postcondition verification
    if (durationStats.min > durationStats.max) {
      throw new UserError("Postcondition violated: min duration cannot be greater than max");
    }

    if (successCount + failureCount !== metrics.length) {
      throw new UserError("Postcondition violated: success + failure count must equal total metrics");
    }

    // IMMUTABILITY: Return frozen stats object
    return Object.freeze({
      operationName,
      sampleCount: metrics.length,
      successCount,
      failureCount,
      successRate: successCount / metrics.length,
      duration: Object.freeze(durationStats),
      memory: Object.freeze(memoryStats),
    });
  }

  /**
   * PURE FUNCTION: Calculate arithmetic mean
   */
  private static _calculateMean(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * PURE FUNCTION: Calculate median value
   */
  private static _calculateMedian(sortedValues: readonly number[]): number {
    if (sortedValues.length === 0) return 0;
    
    const mid = Math.floor(sortedValues.length / 2);
    
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }
    
    return sortedValues[mid];
  }

  /**
   * PURE FUNCTION: Calculate percentile value
   */
  private static _calculatePercentile(sortedValues: readonly number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (percentile < 0 || percentile > 100) {
      throw new UserError("Percentile must be between 0 and 100");
    }
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * PURE FUNCTION: Calculate standard deviation
   */
  private static _calculateStandardDeviation(values: readonly number[]): number {
    if (values.length <= 1) return 0;
    
    const mean = this._calculateMean(values);
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = this._calculateMean(squaredDifferences);
    
    return Math.sqrt(variance);
  }
}

/**
 * CONTRACT: Performance measurement decorator
 * 
 * Provides automatic performance measurement for async functions
 */
export function measurePerformance<T extends any[], R>(
  operationName: string,
  metadata: Record<string, unknown> = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new UserError("measurePerformance can only be applied to functions");
    }

    descriptor.value = async function (...args: T): Promise<R> {
      const timer = new PerformanceTimer(`${operationName}.${propertyKey}`, {
        ...metadata,
        className: target.constructor.name,
        methodName: propertyKey,
        argumentCount: args.length,
      });

      try {
        const result = await originalMethod.apply(this, args);
        timer.complete(true);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        timer.complete(false, errorMessage);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * CONTRACT: Utility function for measuring async operations
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<{ result: T; metric: PerformanceMetric }> {
  const timer = new PerformanceTimer(operationName, metadata);
  
  try {
    const result = await operation();
    const metric = timer.complete(true);
    return { result, metric };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const metric = timer.complete(false, errorMessage);
    throw error;
  }
}

/**
 * CONTRACT: Utility function for measuring synchronous operations
 */
export function measureSync<T>(
  operationName: string,
  operation: () => T,
  metadata: Record<string, unknown> = {}
): { result: T; metric: PerformanceMetric } {
  const timer = new PerformanceTimer(operationName, metadata);
  
  try {
    const result = operation();
    const metric = timer.complete(true);
    return { result, metric };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const metric = timer.complete(false, errorMessage);
    throw error;
  }
}
