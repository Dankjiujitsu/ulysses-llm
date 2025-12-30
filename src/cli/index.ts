#!/usr/bin/env node
/**
 * ULYSSES-LLM Command Line Interface
 *
 * Usage:
 *   ulysses run <model>              - Chat with a model
 *   ulysses pull <model>             - Download a model
 *   ulysses list                     - List installed models
 *   ulysses rm <model>               - Remove a model
 *   ulysses serve                    - Start API server
 *   ulysses hive                     - Show hive mind status
 *   ulysses neural                   - Show neural graph stats
 *   ulysses prometheus               - Show Prometheus insights
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { LLMRuntime } from '../core/LLMRuntime';
import { ModelManager } from '../models/ModelManager';
import { HiveMindOrchestrator } from '../hive-mind/HiveMindOrchestrator';
import { NeuralMapper } from '../neural/NeuralMapper';
import { PrometheusEngine } from '../prometheus/PrometheusEngine';
import { UlyssesServer } from '../server';

const program = new Command();

// ============================================================================
// CLI CONFIGURATION
// ============================================================================

program
  .name('ulysses')
  .description('ULYSSES-LLM: Offline Large Language Model with Hive Mind')
  .version('1.0.0');

// ============================================================================
// RUN COMMAND - Interactive Chat
// ============================================================================

program
  .command('run <model>')
  .description('Start interactive chat with a model')
  .option('-t, --temperature <number>', 'Sampling temperature', '0.7')
  .option('-m, --max-tokens <number>', 'Maximum tokens to generate', '2048')
  .option('--hive', 'Enable hive mind enhancement')
  .action(async (model: string, options) => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           ULYSSES-LLM                                        ║
║                    Offline LLM with Hive Mind                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

Model: ${model}
Temperature: ${options.temperature}
Hive Mind: ${options.hive ? 'Enabled' : 'Disabled'}

Type your message and press Enter. Type 'exit' to quit.
────────────────────────────────────────────────────────────────────────────────
`);

    const runtime = LLMRuntime.getInstance();
    const hiveMind = options.hive ? HiveMindOrchestrator.getInstance() : null;
    const neuralMapper = NeuralMapper.getInstance();
    const prometheus = PrometheusEngine.getInstance();

    // Load model if not loaded
    const modelManager = ModelManager.getInstance();
    if (!modelManager.isInstalled(model)) {
      console.log(`Model ${model} not installed. Run 'ulysses pull ${model}' first.`);
      console.log('\nAvailable models:');
      const available = modelManager.listAvailable();
      for (const m of available.slice(0, 5)) {
        console.log(`  - ${m.name} (${m.parameters})`);
      }
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const chat = async (prompt: string): Promise<string> => {
      try {
        // Enhance with hive mind if enabled
        let enhancedPrompt = prompt;
        if (hiveMind) {
          enhancedPrompt = await hiveMind.enhancePrompt(prompt);
        }

        // Get neural context
        const context = await neuralMapper.getRelevantContext(prompt);
        if (context) {
          enhancedPrompt = `Context: ${context}\n\n${enhancedPrompt}`;
        }

        // Generate response
        const result = await runtime.generate(model, enhancedPrompt, {
          temperature: parseFloat(options.temperature),
          maxTokens: parseInt(options.maxTokens)
        });

        // Learn from interaction
        await prometheus.learn(prompt, result.text);

        // Add to neural map
        await neuralMapper.addNode(
          prompt.slice(0, 50),
          'conversation',
          prompt + '\n' + result.text,
          [],
          'chat'
        );

        return result.text;
      } catch (error) {
        return `Error: ${error}`;
      }
    };

    const askQuestion = (): void => {
      rl.question('\n>>> ', async (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'exit') {
          console.log('\nGoodbye!');
          rl.close();
          process.exit(0);
        }

        if (!trimmed) {
          askQuestion();
          return;
        }

        process.stdout.write('\n');
        const response = await chat(trimmed);
        console.log(response);

        askQuestion();
      });
    };

    askQuestion();
  });

// ============================================================================
// PULL COMMAND - Download Model
// ============================================================================

program
  .command('pull <model>')
  .description('Download a model')
  .action(async (model: string) => {
    console.log(`\nPulling model: ${model}\n`);

    const modelManager = ModelManager.getInstance();

    // Check if model exists
    const manifest = modelManager.getModel(model);
    if (!manifest) {
      console.log(`Model '${model}' not found in registry.\n`);
      console.log('Available models:');
      const available = modelManager.listAvailable();
      for (const m of available) {
        console.log(`  - ${m.name.padEnd(25)} ${m.parameters.padEnd(8)} ${modelManager.formatSize(m.size)}`);
      }
      return;
    }

    console.log(`Name:        ${manifest.name}`);
    console.log(`Family:      ${manifest.family}`);
    console.log(`Parameters:  ${manifest.parameters}`);
    console.log(`Size:        ${modelManager.formatSize(manifest.size)}`);
    console.log(`Format:      ${manifest.format}`);
    console.log(`Description: ${manifest.description}\n`);

    // Progress handler
    modelManager.on('pull:progress', (progress) => {
      const pct = progress.percentage.toFixed(1);
      const downloaded = modelManager.formatSize(progress.bytesDownloaded);
      const total = modelManager.formatSize(progress.totalBytes);
      const speed = modelManager.formatSize(progress.speed) + '/s';

      process.stdout.write(`\rDownloading: ${pct}% (${downloaded}/${total}) - ${speed}    `);
    });

    modelManager.on('pull:complete', () => {
      console.log('\n\n✓ Model downloaded successfully!');
    });

    modelManager.on('pull:exists', () => {
      console.log('✓ Model already installed.');
    });

    try {
      await modelManager.pull(model);
    } catch (error) {
      console.error(`\nError: ${error}`);
    }
  });

// ============================================================================
// LIST COMMAND - List Models
// ============================================================================

program
  .command('list')
  .alias('ls')
  .description('List installed models')
  .option('-a, --available', 'Show all available models')
  .action(async (options) => {
    const modelManager = ModelManager.getInstance();

    if (options.available) {
      console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                         AVAILABLE MODELS                                     ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

      const available = modelManager.listAvailable();
      console.log('  NAME                      PARAMS    SIZE         CAPABILITIES');
      console.log('  ─────────────────────────────────────────────────────────────────────────────');

      for (const m of available) {
        const installed = modelManager.isInstalled(m.name) ? '✓' : ' ';
        console.log(
          `${installed} ${m.name.padEnd(25)} ${m.parameters.padEnd(9)} ${modelManager.formatSize(m.size).padEnd(12)} ${m.capabilities.slice(0, 3).join(', ')}`
        );
      }
    } else {
      console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                         INSTALLED MODELS                                     ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

      const installed = modelManager.listInstalled();

      if (installed.length === 0) {
        console.log('  No models installed. Run \'ulysses pull <model>\' to download a model.\n');
        return;
      }

      console.log('  NAME                      SIZE         FORMAT      INSTALLED');
      console.log('  ─────────────────────────────────────────────────────────────────────────────');

      for (const m of installed) {
        console.log(
          `  ${m.name.padEnd(25)} ${modelManager.formatSize(m.size).padEnd(12)} ${m.format.padEnd(11)} ${m.installedAt.toLocaleDateString()}`
        );
      }
    }

    console.log();
  });

// ============================================================================
// REMOVE COMMAND - Remove Model
// ============================================================================

program
  .command('rm <model>')
  .description('Remove an installed model')
  .action(async (model: string) => {
    const modelManager = ModelManager.getInstance();

    if (!modelManager.isInstalled(model)) {
      console.log(`Model '${model}' is not installed.`);
      return;
    }

    console.log(`Removing model: ${model}`);

    try {
      await modelManager.remove(model);
      console.log('✓ Model removed successfully.');
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  });

// ============================================================================
// SERVE COMMAND - Start API Server
// ============================================================================

program
  .command('serve')
  .description('Start the API server')
  .option('-p, --port <number>', 'Port to listen on', '11434')
  .action(async (options) => {
    const port = parseInt(options.port);
    const server = new UlyssesServer(port);
    server.start();
  });

// ============================================================================
// HIVE COMMAND - Hive Mind Status
// ============================================================================

program
  .command('hive')
  .description('Show hive mind status')
  .action(async () => {
    const hiveMind = HiveMindOrchestrator.getInstance();
    const status = await hiveMind.getStatus();

    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           HIVE MIND STATUS                                   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('  AGENTS:');
    console.log('  ─────────────────────────────────────────────────────────────────────────────');

    for (const agent of status.agents) {
      const statusIcon = agent.status === 'active' ? '✓' : agent.status === 'busy' ? '●' : '○';
      console.log(
        `  ${statusIcon} ${agent.name.padEnd(15)} ${agent.role.padEnd(20)} ${(agent.performanceScore * 100).toFixed(0)}%`
      );
    }

    console.log('\n  STATISTICS:');
    console.log('  ─────────────────────────────────────────────────────────────────────────────');
    console.log(`  Active Tasks:     ${status.activeTasks}`);
    console.log(`  Completed Tasks:  ${status.completedTasks}`);
    console.log(`  Knowledge Base:   ${status.collectiveKnowledge} entries`);
    console.log();
  });

// ============================================================================
// NEURAL COMMAND - Neural Graph Status
// ============================================================================

program
  .command('neural')
  .description('Show neural mapping statistics')
  .action(async () => {
    const neuralMapper = NeuralMapper.getInstance();
    const stats = neuralMapper.getStats() as any;

    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         NEURAL MAPPING STATUS                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log(`  Total Nodes:        ${stats.totalNodes}`);
    console.log(`  Total Connections:  ${stats.totalConnections}`);
    console.log(`  Domains:            ${stats.domains.join(', ') || 'None'}`);
    console.log(`  Avg Confidence:     ${(stats.averageConfidence * 100).toFixed(1)}%`);
    console.log();
  });

// ============================================================================
// PROMETHEUS COMMAND - Prometheus Insights
// ============================================================================

program
  .command('prometheus')
  .alias('insights')
  .description('Show Prometheus Engine insights')
  .action(async () => {
    const prometheus = PrometheusEngine.getInstance();
    const stats = prometheus.getStats() as any;
    const insights = await prometheus.getInsights();

    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        PROMETHEUS ENGINE STATUS                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('  STATISTICS:');
    console.log('  ─────────────────────────────────────────────────────────────────────────────');
    console.log(`  Total Insights:     ${stats.totalInsights}`);
    console.log(`  Learning Records:   ${stats.totalLearningRecords}`);
    console.log(`  Domains:            ${stats.domains.join(', ') || 'None'}`);
    console.log(`  Average Novelty:    ${(stats.averageNovelty * 100).toFixed(1)}%`);

    if (insights.length > 0) {
      console.log('\n  TOP INSIGHTS:');
      console.log('  ─────────────────────────────────────────────────────────────────────────────');

      for (const insight of insights.slice(0, 5)) {
        console.log(`  • [${insight.domains.join(' ↔ ')}] ${insight.synthesis.slice(0, 60)}...`);
      }
    }

    console.log();
  });

// ============================================================================
// HELP TEXT
// ============================================================================

program.addHelpText('after', `
Examples:
  $ ulysses pull llama3:8b              # Download Llama 3 8B
  $ ulysses run llama3:8b               # Chat with Llama 3
  $ ulysses run llama3:8b --hive        # Chat with Hive Mind enabled
  $ ulysses serve                       # Start API server on port 11434
  $ ulysses list -a                     # Show all available models
  $ ulysses hive                        # Show hive mind agents
  $ ulysses neural                      # Show knowledge graph stats
  $ ulysses prometheus                  # Show AI insights

More info: https://github.com/Dankjiujitsu/ulysses-llm
`);

// Parse arguments
program.parse();
