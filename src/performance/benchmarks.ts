// src/performance/benchmarks.ts
import { UserError } from "fastmcp";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { 
  PerformanceTimer, 
  PerformanceMetric, 
  PerformanceAnalyzer, 
  PerformanceStats,
  measureAsync 
} from "./metrics.js";
import { validatePath } from "../utils/security.js";

/**
 * CONTRACT: Benchmark configuration with comprehensive validation
 * 
 * Preconditions:
 * - Benchmark parameters must be realistic and safe
 * - File sizes must not exceed system capabilities
 * - Iteration counts must be reasonable for testing
 * 
 * Postconditions:
 * - Returns validated benchmark configuration
 * - All parameters within safe operational bounds
 * 
 * Invariants:
 * - Configuration immutability preserved
 * - Parameter relationships maintained (e.g., min < max)
 */

/**
 * TYPE-DRIVEN DEVELOPMENT: Branded types for benchmark parameters
 */
export type FileSize = number & { readonly __fileSize: unique symbol };
export type IterationCount = number & { readonly __iterationCount: unique symbol };
export type ConcurrencyLevel = number & { readonly __concurrencyLevel: unique symbol };

export interface BenchmarkConfig {
  readonly operationName: string;
  readonly iterations: IterationCount;
  readonly concurrency: ConcurrencyLevel;
  readonly fileSizes: readonly FileSize[];
  readonly warmupIterations: IterationCount;
  readonly cooldownDelayMs: number;
  readonly timeoutMs: number;
  readonly cleanup: boolean;
}

/**
 * DEFENSIVE PROGRAMMING: Comprehensive benchmark configuration validation
 */
const BenchmarkConfigSchema = z.object({
  operationName: z.string().min(1).max(100),
  iterations: z.number().int().min(1).max(10000),
  concurrency: z.number().int().min(1).max(50),
  fileSizes: z.array(z.number().int().min(0).max(100 * 1024 * 1024)).min(1), // Max 100MB files
  warmupIterations: z.number().int().min(0).max(100),
  cooldownDelayMs: z.number().min(0).max(10000),
  timeoutMs: z.number().min(1000).max(300000), // 1s to 5min
  cleanup: z.boolean(),
}).refine(data => data.warmupIterations <= data.iterations, {
  message: "Warmup iterations cannot exceed total iterations"
});

/**
 * CONTRACT: Benchmark result aggregation with statistical analysis
 */
export interface BenchmarkResult {
  readonly config: BenchmarkConfig;
  readonly stats: PerformanceStats;
  readonly rawMetrics: readonly PerformanceMetric[];
  readonly throughput: {
    readonly operationsPerSecond: number;
    readonly bytesPerSecond: number;
    readonly filesPerSecond: number;
  };
  readonly reliability: {
    readonly successRate: number;
    readonly errorTypes: ReadonlyMap<string, number>;
  };
  readonly scalability: {
    readonly concurrencyEfficiency: number;
    readonly memoryScalingFactor: number;
  };
}

/**
 * CONTRACT: File operation benchmark suite with advanced programming techniques
 * 
 * Preconditions:
 * - Target directory must exist and be writable
 * - System must have sufficient resources for benchmark
 * - Benchmark configuration must be valid
 * 
 * Postconditions:
 * - Returns comprehensive benchmark results
 * - Cleanup performed if requested
 * - System state restored after benchmark
 * 
 * Invariants:
 * - File system integrity maintained
 * - No memory leaks during benchmark execution
 * - Accurate timing measurement throughout
 */
export class FilesystemBenchmark {
  private readonly _benchmarkDir: string;
  private readonly _testFiles: Set<string> = new Set();

  constructor(benchmarkDirectory: string) {
    this._benchmarkDir = benchmarkDirectory;
  }

  /**
   * CONTRACT: Write operation benchmark with comprehensive measurement
   * 
   * Preconditions:
   * - Benchmark directory must be accessible and writable
   * - Configuration must be valid and within system limits
   * 
   * Postconditions:
   * - Returns detailed benchmark results with statistical analysis
   * - All test files cleaned up if requested
   * 
   * Invariants:
   * - File system state consistency maintained
   * - Memory usage tracked accurately throughout
   */
  async benchmarkWriteOperations(config: Partial<BenchmarkConfig> = {}): Promise<BenchmarkResult> {
    const validatedConfig = this._validateConfig({
      operationName: "file_write",
      iterations: 100 as IterationCount,
      concurrency: 1 as ConcurrencyLevel,
      fileSizes: [1024, 10240, 102400] as FileSize[], // 1KB, 10KB, 100KB
      warmupIterations: 10 as IterationCount,
      cooldownDelayMs: 100,
      timeoutMs: 30000,
      cleanup: true,
      ...config
    });

    const validBenchmarkDir = await validatePath(this._benchmarkDir);
    
    // DEFENSIVE PROGRAMMING: Ensure benchmark directory exists
    try {
      await fs.mkdir(validBenchmarkDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw new UserError(`Failed to create benchmark directory: ${error.message}`);
      }
    }

    const allMetrics: PerformanceMetric[] = [];
    let totalBytes = 0;
    let totalFiles = 0;

    try {
      // Warmup phase
      if (validatedConfig.warmupIterations > 0) {
        await this._runWarmup(validatedConfig, validBenchmarkDir);
        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      // Main benchmark execution
      for (const fileSize of validatedConfig.fileSizes) {
        const fileContent = this._generateTestContent(fileSize);
        totalBytes += fileSize * validatedConfig.iterations;

        if (validatedConfig.concurrency === 1) {
          // Sequential execution
          for (let i = 0; i < validatedConfig.iterations; i++) {
            const metric = await this._measureSingleWrite(
              validBenchmarkDir,
              `test_${fileSize}_${i}.txt`,
              fileContent,
              validatedConfig.timeoutMs
            );
            allMetrics.push(metric);
            totalFiles++;
          }
        } else {
          // Concurrent execution
          const concurrentMetrics = await this._measureConcurrentWrites(
            validBenchmarkDir,
            fileSize,
            fileContent,
            validatedConfig.iterations,
            validatedConfig.concurrency,
            validatedConfig.timeoutMs
          );
          allMetrics.push(...concurrentMetrics);
          totalFiles += validatedConfig.iterations;
        }

        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      // IMMUTABILITY: Calculate comprehensive results
      const result = this._calculateBenchmarkResult(
        validatedConfig,
        allMetrics,
        totalBytes,
        totalFiles
      );

      return result;

    } finally {
      // Cleanup if requested
      if (validatedConfig.cleanup) {
        await this._cleanup();
      }
    }
  }

  /**
   * CONTRACT: Read operation benchmark with performance analysis
   */
  async benchmarkReadOperations(config: Partial<BenchmarkConfig> = {}): Promise<BenchmarkResult> {
    const validatedConfig = this._validateConfig({
      operationName: "file_read",
      iterations: 100 as IterationCount,
      concurrency: 1 as ConcurrencyLevel,
      fileSizes: [1024, 10240, 102400] as FileSize[],
      warmupIterations: 10 as IterationCount,
      cooldownDelayMs: 100,
      timeoutMs: 30000,
      cleanup: true,
      ...config
    });

    const validBenchmarkDir = await validatePath(this._benchmarkDir);
    
    // Prepare test files for reading
    await this._prepareTestFiles(validBenchmarkDir, validatedConfig.fileSizes);

    const allMetrics: PerformanceMetric[] = [];
    let totalBytes = 0;
    let totalFiles = 0;

    try {
      // Warmup phase
      if (validatedConfig.warmupIterations > 0) {
        await this._runReadWarmup(validatedConfig, validBenchmarkDir);
        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      // Main benchmark execution
      for (const fileSize of validatedConfig.fileSizes) {
        const filePath = path.join(validBenchmarkDir, `read_test_${fileSize}.txt`);
        totalBytes += fileSize * validatedConfig.iterations;

        if (validatedConfig.concurrency === 1) {
          // Sequential execution
          for (let i = 0; i < validatedConfig.iterations; i++) {
            const metric = await this._measureSingleRead(
              filePath,
              validatedConfig.timeoutMs
            );
            allMetrics.push(metric);
            totalFiles++;
          }
        } else {
          // Concurrent execution
          const concurrentMetrics = await this._measureConcurrentReads(
            filePath,
            validatedConfig.iterations,
            validatedConfig.concurrency,
            validatedConfig.timeoutMs
          );
          allMetrics.push(...concurrentMetrics);
          totalFiles += validatedConfig.iterations;
        }

        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      const result = this._calculateBenchmarkResult(
        validatedConfig,
        allMetrics,
        totalBytes,
        totalFiles
      );

      return result;

    } finally {
      if (validatedConfig.cleanup) {
        await this._cleanup();
      }
    }
  }

  /**
   * CONTRACT: Search operation benchmark
   */
  async benchmarkSearchOperations(config: Partial<BenchmarkConfig> = {}): Promise<BenchmarkResult> {
    const validatedConfig = this._validateConfig({
      operationName: "file_search",
      iterations: 50 as IterationCount,
      concurrency: 1 as ConcurrencyLevel,
      fileSizes: [1024] as FileSize[], // Search doesn't depend on file size as much
      warmupIterations: 5 as IterationCount,
      cooldownDelayMs: 200,
      timeoutMs: 60000,
      cleanup: true,
      ...config
    });

    const validBenchmarkDir = await validatePath(this._benchmarkDir);
    
    // Create diverse test directory structure for searching
    await this._createSearchTestStructure(validBenchmarkDir);

    const allMetrics: PerformanceMetric[] = [];
    const searchPatterns = ['*.txt', '**/*.log', 'test_*', '**/config.*'];

    try {
      // Warmup
      if (validatedConfig.warmupIterations > 0) {
        await this._runSearchWarmup(validatedConfig, validBenchmarkDir, searchPatterns[0]);
        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      // Main benchmark execution
      for (const pattern of searchPatterns) {
        for (let i = 0; i < validatedConfig.iterations; i++) {
          const metric = await this._measureSearch(
            validBenchmarkDir,
            pattern,
            validatedConfig.timeoutMs
          );
          allMetrics.push(metric);
        }

        await this._cooldown(validatedConfig.cooldownDelayMs);
      }

      const result = this._calculateBenchmarkResult(
        validatedConfig,
        allMetrics,
        0, // Search doesn't process bytes in the same way
        allMetrics.length
      );

      return result;

    } finally {
      if (validatedConfig.cleanup) {
        await this._cleanup();
      }
    }
  }

  /**
   * DEFENSIVE PROGRAMMING: Configuration validation with comprehensive checks
   */
  private _validateConfig(config: BenchmarkConfig): BenchmarkConfig {
    const validationResult = BenchmarkConfigSchema.safeParse(config);
    if (!validationResult.success) {
      throw new UserError(`Invalid benchmark configuration: ${validationResult.error.message}`);
    }

    // Additional business logic validation
    const totalOperations = config.iterations * config.fileSizes.length * config.concurrency;
    if (totalOperations > 100000) {
      throw new UserError("Total operations exceed safety limit (100,000)");
    }

    const maxFileSize = Math.max(...config.fileSizes);
    const totalMemoryEstimate = maxFileSize * config.concurrency * 2; // Rough estimate
    if (totalMemoryEstimate > 1024 * 1024 * 1024) { // 1GB limit
      throw new UserError("Estimated memory usage exceeds safety limit (1GB)");
    }

    // DEFENSIVE PROGRAMMING: Safe type conversion preserving branded types
    const validatedData = validationResult.data;
    return {
      operationName: validatedData.operationName,
      iterations: validatedData.iterations as IterationCount,
      concurrency: validatedData.concurrency as ConcurrencyLevel,
      fileSizes: validatedData.fileSizes as unknown as readonly FileSize[],
      warmupIterations: validatedData.warmupIterations as IterationCount,
      cooldownDelayMs: validatedData.cooldownDelayMs,
      timeoutMs: validatedData.timeoutMs,
      cleanup: validatedData.cleanup,
    };
  }

  /**
   * PURE FUNCTION: Generate test content of specified size
   */
  private _generateTestContent(size: FileSize): string {
    if (size <= 0) return "";
    
    const pattern = "abcdefghijklmnopqrstuvwxyz0123456789\n";
    const fullRepeats = Math.floor(size / pattern.length);
    const remainder = size % pattern.length;
    
    return pattern.repeat(fullRepeats) + pattern.slice(0, remainder);
  }

  /**
   * CONTRACT: Single write operation measurement
   */
  private async _measureSingleWrite(
    directory: string,
    filename: string,
    content: string,
    timeoutMs: number
  ): Promise<PerformanceMetric> {
    const filePath = path.join(directory, filename);
    
    const { metric } = await measureAsync(
      "single_write",
      async () => {
        await Promise.race([
          fs.writeFile(filePath, content, 'utf-8'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Write operation timeout")), timeoutMs)
          )
        ]);
      },
      {
        filePath,
        contentSize: content.length,
        operation: "write"
      }
    );

    this._testFiles.add(filePath);
    return metric;
  }

  /**
   * CONTRACT: Single read operation measurement
   */
  private async _measureSingleRead(
    filePath: string,
    timeoutMs: number
  ): Promise<PerformanceMetric> {
    const { metric } = await measureAsync(
      "single_read",
      async () => {
        await Promise.race([
          fs.readFile(filePath, 'utf-8'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Read operation timeout")), timeoutMs)
          )
        ]);
      },
      {
        filePath,
        operation: "read"
      }
    );

    return metric;
  }

  /**
   * CONTRACT: Concurrent write operations measurement
   */
  private async _measureConcurrentWrites(
    directory: string,
    fileSize: FileSize,
    content: string,
    iterations: IterationCount,
    concurrency: ConcurrencyLevel,
    timeoutMs: number
  ): Promise<PerformanceMetric[]> {
    const batches = Math.ceil(iterations / concurrency);
    const allMetrics: PerformanceMetric[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      const batchPromises: Promise<PerformanceMetric>[] = [];

      for (let i = 0; i < batchSize; i++) {
        const filename = `concurrent_${fileSize}_${batch}_${i}.txt`;
        batchPromises.push(
          this._measureSingleWrite(directory, filename, content, timeoutMs)
        );
      }

      const batchMetrics = await Promise.all(batchPromises);
      allMetrics.push(...batchMetrics);
    }

    return allMetrics;
  }

  /**
   * CONTRACT: Concurrent read operations measurement
   */
  private async _measureConcurrentReads(
    filePath: string,
    iterations: IterationCount,
    concurrency: ConcurrencyLevel,
    timeoutMs: number
  ): Promise<PerformanceMetric[]> {
    const batches = Math.ceil(iterations / concurrency);
    const allMetrics: PerformanceMetric[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      const batchPromises: Promise<PerformanceMetric>[] = [];

      for (let i = 0; i < batchSize; i++) {
        batchPromises.push(
          this._measureSingleRead(filePath, timeoutMs)
        );
      }

      const batchMetrics = await Promise.all(batchPromises);
      allMetrics.push(...batchMetrics);
    }

    return allMetrics;
  }

  /**
   * CONTRACT: Search operation measurement
   */
  private async _measureSearch(
    directory: string,
    pattern: string,
    timeoutMs: number
  ): Promise<PerformanceMetric> {
    const { glob } = await import('glob');
    
    const { metric } = await measureAsync(
      "search_operation",
      async () => {
        await Promise.race([
          glob(pattern, { cwd: directory }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Search operation timeout")), timeoutMs)
          )
        ]);
      },
      {
        directory,
        pattern,
        operation: "search"
      }
    );

    return metric;
  }

  /**
   * IMMUTABILITY: Calculate comprehensive benchmark results
   */
  private _calculateBenchmarkResult(
    config: BenchmarkConfig,
    metrics: PerformanceMetric[],
    totalBytes: number,
    totalFiles: number
  ): BenchmarkResult {
    if (metrics.length === 0) {
      throw new UserError("Cannot calculate results with empty metrics");
    }

    const stats = PerformanceAnalyzer.calculateStats(metrics);
    const totalDurationSeconds = metrics.reduce((sum, m) => sum + m.duration, 0) / 1000;
    
    // Calculate throughput metrics
    const throughput = {
      operationsPerSecond: totalFiles / (totalDurationSeconds || 1),
      bytesPerSecond: totalBytes / (totalDurationSeconds || 1),
      filesPerSecond: totalFiles / (totalDurationSeconds || 1),
    };

    // Analyze error patterns
    const errorTypes = new Map<string, number>();
    for (const metric of metrics) {
      if (!metric.success && metric.errorMessage) {
        const errorType = this._categorizeError(metric.errorMessage);
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
      }
    }

    // Calculate scalability metrics
    const scalability = {
      concurrencyEfficiency: this._calculateConcurrencyEfficiency(metrics, config.concurrency),
      memoryScalingFactor: this._calculateMemoryScalingFactor(metrics),
    };

    return Object.freeze({
      config,
      stats,
      rawMetrics: Object.freeze([...metrics]),
      throughput: Object.freeze(throughput),
      reliability: Object.freeze({
        successRate: stats.successRate,
        errorTypes: Object.freeze(errorTypes),
      }),
      scalability: Object.freeze(scalability),
    });
  }

  /**
   * PURE FUNCTION: Categorize error messages
   */
  private _categorizeError(errorMessage: string): string {
    if (errorMessage.includes("timeout")) return "timeout";
    if (errorMessage.includes("ENOENT")) return "file_not_found";
    if (errorMessage.includes("EACCES")) return "permission_denied";
    if (errorMessage.includes("EMFILE") || errorMessage.includes("ENFILE")) return "too_many_files";
    if (errorMessage.includes("ENOSPC")) return "no_space";
    return "unknown";
  }

  /**
   * PURE FUNCTION: Calculate concurrency efficiency
   */
  private _calculateConcurrencyEfficiency(
    metrics: PerformanceMetric[],
    concurrency: ConcurrencyLevel
  ): number {
    if (concurrency === 1) return 1.0;
    
    // Simple efficiency calculation based on expected vs actual performance
    const averageDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    const expectedConcurrentDuration = averageDuration / concurrency;
    const actualConcurrentDuration = Math.max(...metrics.map(m => m.duration));
    
    return Math.min(1.0, expectedConcurrentDuration / actualConcurrentDuration);
  }

  /**
   * PURE FUNCTION: Calculate memory scaling factor
   */
  private _calculateMemoryScalingFactor(metrics: PerformanceMetric[]): number {
    if (metrics.length <= 1) return 1.0;
    
    const memoryGrowths = metrics.map(m => Math.max(0, m.memoryDelta.heapUsed));
    const averageGrowth = memoryGrowths.reduce((sum, growth) => sum + growth, 0) / memoryGrowths.length;
    const maxGrowth = Math.max(...memoryGrowths);
    
    return maxGrowth / (averageGrowth || 1);
  }

  /**
   * Support methods for benchmark setup and cleanup
   */

  private async _runWarmup(config: BenchmarkConfig, directory: string): Promise<void> {
    const warmupContent = this._generateTestContent(1024 as FileSize);
    
    for (let i = 0; i < config.warmupIterations; i++) {
      const warmupFile = path.join(directory, `warmup_${i}.txt`);
      await fs.writeFile(warmupFile, warmupContent);
      this._testFiles.add(warmupFile);
    }
  }

  private async _runReadWarmup(config: BenchmarkConfig, directory: string): Promise<void> {
    const warmupFile = path.join(directory, 'warmup_read.txt');
    const warmupContent = this._generateTestContent(1024 as FileSize);
    
    await fs.writeFile(warmupFile, warmupContent);
    this._testFiles.add(warmupFile);
    
    for (let i = 0; i < config.warmupIterations; i++) {
      await fs.readFile(warmupFile, 'utf-8');
    }
  }

  private async _runSearchWarmup(
    config: BenchmarkConfig, 
    directory: string, 
    pattern: string
  ): Promise<void> {
    const { glob } = await import('glob');
    
    for (let i = 0; i < config.warmupIterations; i++) {
      await glob(pattern, { cwd: directory });
    }
  }

  private async _prepareTestFiles(directory: string, fileSizes: readonly FileSize[]): Promise<void> {
    for (const size of fileSizes) {
      const content = this._generateTestContent(size);
      const filePath = path.join(directory, `read_test_${size}.txt`);
      await fs.writeFile(filePath, content);
      this._testFiles.add(filePath);
    }
  }

  private async _createSearchTestStructure(directory: string): Promise<void> {
    const structure = [
      'test_file1.txt',
      'test_file2.log',
      'config.json',
      'subdir/test_file3.txt',
      'subdir/config.yaml',
      'subdir/nested/test_file4.log',
      'another/config.ini',
    ];

    for (const filePath of structure) {
      const fullPath = path.join(directory, filePath);
      const dirPath = path.dirname(fullPath);
      
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(fullPath, `Content for ${filePath}`);
      this._testFiles.add(fullPath);
    }
  }

  private async _cooldown(delayMs: number): Promise<void> {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  private async _cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this._testFiles).map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    await Promise.all(cleanupPromises);
    this._testFiles.clear();
  }
}
