/**
 * CodeMyPicture V4 — Resource-Aware Generation Scheduler
 *
 * Manages prioritization and concurrency across generation tasks:
 * - Priority 1: User active mode + active quality (Foreground - immediate display)
 * - Priority 2: User active mode + alternate quality (Background High - instant quality toggle)
 * - Priority 3: Secondary mode + primary quality (Background Normal - instant mode switch)
 * - Priority 4: Secondary mode + alternate quality (Background Low)
 *
 * Adaptive Concurrency:
 * - Desktop (multi-core): Allows up to 2 concurrent workers
 * - Mobile / Memory-constrained: Strictly 1 worker at a time (sequential)
 */

import { QualitySetting } from '../../engine/v4/tiers';

export type TaskPriority = 1 | 2 | 3 | 4;

export interface GenerationTask {
  id: string;
  imageKey: string;
  mode: 'painting' | 'recreation';
  quality: QualitySetting;
  priority: TaskPriority;
  status: 'queued' | 'running' | 'completed' | 'cancelled';
  execute: (signal: AbortSignal) => Promise<any>;
  abortController: AbortController;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
}

export class GenerationScheduler {
  private queue: GenerationTask[] = [];
  private runningTasks: Map<string, GenerationTask> = new Map();
  private maxConcurrency: number;
  private isMobile: boolean;

  constructor() {
    this.isMobile = typeof window !== 'undefined' && (
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    );
    // Desktop: 2 workers max. Mobile: 1 worker max (memory-safe sequential).
    this.maxConcurrency = this.isMobile ? 1 : 2;
  }

  public getIsMobile(): boolean {
    return this.isMobile;
  }

  public getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  public getActiveTaskCount(): number {
    return this.runningTasks.size;
  }

  public isTaskRunning(mode: 'painting' | 'recreation', quality: QualitySetting): boolean {
    for (const task of this.runningTasks.values()) {
      if (task.mode === mode && task.quality === quality) return true;
    }
    return false;
  }

  public isTaskQueued(mode: 'painting' | 'recreation', quality: QualitySetting): boolean {
    return this.queue.some((t) => t.mode === mode && t.quality === quality && t.status === 'queued');
  }

  /**
   * Enqueue a new generation task with specified priority.
   * If a task for the same image, mode, and quality is already queued or running, it is not duplicated.
   */
  public enqueue(task: GenerationTask): void {
    // Check if task is already running
    for (const running of this.runningTasks.values()) {
      if (running.imageKey === task.imageKey && running.mode === task.mode && running.quality === task.quality) {
        // If incoming has higher priority (e.g. user selected it), promote priority
        if (task.priority < running.priority) {
          running.priority = task.priority;
        }
        return;
      }
    }

    // Check if task is already in queue
    const existingIdx = this.queue.findIndex(
      (t) => t.imageKey === task.imageKey && t.mode === task.mode && t.quality === task.quality
    );
    if (existingIdx !== -1) {
      if (task.priority < this.queue[existingIdx].priority) {
        this.queue[existingIdx].priority = task.priority;
        this.sortQueue();
      }
      return;
    }

    this.queue.push(task);
    this.sortQueue();
    this.processNext();
  }

  /**
   * Promotes a mode and quality task to Priority 1 (Foreground) immediately.
   */
  public promote(mode: 'painting' | 'recreation', quality: QualitySetting): void {
    for (const task of this.queue) {
      if (task.mode === mode && task.quality === quality) {
        task.priority = 1;
      }
    }
    this.sortQueue();
    this.processNext();
  }

  /**
   * Cancel all tasks for an obsolete imageKey or all running tasks.
   */
  public cancelAll(forImageKeyOnly?: string, reason: string = 'Cancelled'): void {
    // Cancel queued tasks
    this.queue = this.queue.filter((task) => {
      if (!forImageKeyOnly || task.imageKey === forImageKeyOnly) {
        task.status = 'cancelled';
        task.abortController.abort(new Error(reason));
        return false;
      }
      return true;
    });

    // Cancel running tasks
    for (const [id, task] of this.runningTasks.entries()) {
      if (!forImageKeyOnly || task.imageKey === forImageKeyOnly) {
        task.status = 'cancelled';
        task.abortController.abort(new Error(reason));
        this.runningTasks.delete(id);
      }
    }
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  private async processNext(): Promise<void> {
    if (this.runningTasks.size >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task || task.status === 'cancelled') {
      return;
    }

    task.status = 'running';
    this.runningTasks.set(task.id, task);

    try {
      const result = await task.execute(task.abortController.signal);
      if (!task.abortController.signal.aborted) {
        task.status = 'completed';
        task.onSuccess?.(result);
      }
    } catch (err: any) {
      if (!task.abortController.signal.aborted) {
        task.status = 'cancelled';
        task.onError?.(err);
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.processNext();
    }
  }
}
