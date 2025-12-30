/**
 * ULYSSES-LLM
 *
 * Offline Large Language Model Runtime with Hive Mind Integration
 * A drop-in replacement for Ollama with distributed AI agent orchestration
 *
 * @author ULYSSES-OS Team
 * @license MIT
 */

// Core exports
export { LLMRuntime, ModelConfig, GenerationConfig, InferenceResult } from './core/LLMRuntime';
export { ModelManager, ModelManifest, InstalledModel } from './models/ModelManager';
export { UlyssesServer } from './server';

// Hive Mind exports
export { HiveMindOrchestrator, Agent, Task, CollectiveResponse } from './hive-mind/HiveMindOrchestrator';

// Neural Mapping exports
export { NeuralMapper, NeuralNode, NeuralGraph, QueryResult } from './neural/NeuralMapper';

// Prometheus Engine exports
export { PrometheusEngine, Insight, SynthesisResult } from './prometheus/PrometheusEngine';

// Version info
export const VERSION = '1.0.0';
export const NAME = 'ULYSSES-LLM';

/**
 * Quick start function
 */
export async function quickStart(port: number = 11434): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██╗   ██╗██╗  ██╗   ██╗███████╗███████╗███████╗███████╗                    ║
║   ██║   ██║██║  ╚██╗ ██╔╝██╔════╝██╔════╝██╔════╝██╔════╝                    ║
║   ██║   ██║██║   ╚████╔╝ ███████╗███████╗█████╗  ███████╗                    ║
║   ██║   ██║██║    ╚██╔╝  ╚════██║╚════██║██╔══╝  ╚════██║                    ║
║   ╚██████╔╝███████╗██║   ███████║███████║███████╗███████║                    ║
║    ╚═════╝ ╚══════╝╚═╝   ╚══════╝╚══════╝╚══════╝╚══════╝                    ║
║                                                                              ║
║                    ██╗     ██╗     ███╗   ███╗                               ║
║                    ██║     ██║     ████╗ ████║                               ║
║                    ██║     ██║     ██╔████╔██║                               ║
║                    ██║     ██║     ██║╚██╔╝██║                               ║
║                    ███████╗███████╗██║ ╚═╝ ██║                               ║
║                    ╚══════╝╚══════╝╚═╝     ╚═╝                               ║
║                                                                              ║
║           Offline LLM Runtime with Hive Mind Integration                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
  `);

  const { UlyssesServer } = await import('./server');
  const server = new UlyssesServer(port);
  server.start();
}

// Auto-start if run directly
if (require.main === module) {
  quickStart();
}
