/**
 * ULYSSES-LLM HTTP API Server
 *
 * OpenAI-compatible REST API for local LLM inference
 * Also supports Ollama API format for drop-in replacement
 *
 * Endpoints:
 * - POST /api/generate      - Ollama-style generation
 * - POST /api/chat          - Ollama-style chat
 * - POST /v1/completions    - OpenAI-style completions
 * - POST /v1/chat/completions - OpenAI-style chat
 * - POST /v1/embeddings     - OpenAI-style embeddings
 * - GET  /api/tags          - List models (Ollama)
 * - POST /api/pull          - Pull model (Ollama)
 * - GET  /api/version       - API version info
 * - GET  /health            - Health check
 * - GET  /hive              - Hive Mind status
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { LLMRuntime } from '../core/LLMRuntime';
import { ModelManager } from '../models/ModelManager';
import { HiveMindOrchestrator } from '../hive-mind/HiveMindOrchestrator';
import { NeuralMapper } from '../neural/NeuralMapper';
import { PrometheusEngine } from '../prometheus/PrometheusEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
  };
}

interface OpenAICompletionRequest {
  model: string;
  prompt: string | string[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

interface OpenAIChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

// ============================================================================
// SERVER CLASS
// ============================================================================

export class UlyssesServer {
  private app: express.Application;
  private runtime: LLMRuntime;
  private modelManager: ModelManager;
  private hiveMind: HiveMindOrchestrator;
  private neuralMapper: NeuralMapper;
  private prometheus: PrometheusEngine;
  private port: number;
  private startTime: Date;

  constructor(port: number = 11434) {
    this.app = express();
    this.port = port;
    this.startTime = new Date();

    // Initialize components
    this.runtime = LLMRuntime.getInstance();
    this.modelManager = ModelManager.getInstance();
    this.hiveMind = HiveMindOrchestrator.getInstance();
    this.neuralMapper = NeuralMapper.getInstance();
    this.prometheus = PrometheusEngine.getInstance();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(this.requestLogger.bind(this));
  }

  private requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  }

  private setupRoutes(): void {
    // ========================================================================
    // HEALTH & INFO
    // ========================================================================

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: Date.now() - this.startTime.getTime(),
        version: '1.0.0'
      });
    });

    this.app.get('/api/version', (req, res) => {
      res.json({
        version: '1.0.0',
        name: 'ULYSSES-LLM',
        features: ['hive-mind', 'neural-mapping', 'prometheus-engine', 'multi-model']
      });
    });

    // ========================================================================
    // OLLAMA-COMPATIBLE API
    // ========================================================================

    // List models
    this.app.get('/api/tags', async (req, res) => {
      try {
        const installed = this.modelManager.listInstalled();
        const models = installed.map(m => ({
          name: m.name,
          modified_at: m.installedAt.toISOString(),
          size: m.size,
          details: {
            format: m.format,
            family: m.family,
            quantization_level: m.quantization
          }
        }));

        res.json({ models });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Pull model
    this.app.post('/api/pull', async (req, res) => {
      try {
        const { name, stream = true } = req.body;

        if (stream) {
          res.setHeader('Content-Type', 'application/x-ndjson');

          this.modelManager.on('pull:progress', (progress) => {
            res.write(JSON.stringify({
              status: 'downloading',
              completed: progress.bytesDownloaded,
              total: progress.totalBytes
            }) + '\n');
          });

          this.modelManager.on('pull:complete', () => {
            res.write(JSON.stringify({ status: 'success' }) + '\n');
            res.end();
          });

          await this.modelManager.pull(name);
        } else {
          await this.modelManager.pull(name);
          res.json({ status: 'success' });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Generate
    this.app.post('/api/generate', async (req, res) => {
      try {
        const { model, prompt, stream = false, options = {} }: OllamaGenerateRequest = req.body;

        // Enhance prompt with Hive Mind if available
        const enhancedPrompt = await this.hiveMind.enhancePrompt(prompt);
        const neuralContext = await this.neuralMapper.getRelevantContext(prompt);

        const finalPrompt = neuralContext
          ? `Context: ${neuralContext}\n\n${enhancedPrompt}`
          : enhancedPrompt;

        if (stream) {
          res.setHeader('Content-Type', 'application/x-ndjson');

          const generator = this.runtime.generateStream(model, finalPrompt, {
            temperature: options.temperature,
            topP: options.top_p,
            topK: options.top_k,
            maxTokens: options.num_predict || 2048,
            stopSequences: options.stop || []
          });

          for await (const token of generator) {
            res.write(JSON.stringify({
              model,
              response: token,
              done: false
            }) + '\n');
          }

          res.write(JSON.stringify({
            model,
            response: '',
            done: true
          }) + '\n');
          res.end();

        } else {
          const result = await this.runtime.generate(model, finalPrompt, {
            temperature: options.temperature,
            topP: options.top_p,
            topK: options.top_k,
            maxTokens: options.num_predict || 2048,
            stopSequences: options.stop || []
          });

          // Learn from interaction
          await this.prometheus.learn(prompt, result.text);

          res.json({
            model,
            response: result.text,
            done: true,
            context: [],
            total_duration: result.timeMs * 1000000,
            load_duration: 0,
            prompt_eval_count: result.promptTokens,
            eval_count: result.completionTokens
          });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Chat
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { model, messages, stream = false, options = {} }: OllamaChatRequest = req.body;

        // Build prompt from messages
        const prompt = this.buildChatPrompt(messages);

        // Use generate internally
        req.body = { model, prompt, stream, options };
        return this.app._router.handle(
          { ...req, path: '/api/generate' },
          res,
          () => {}
        );
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ========================================================================
    // OPENAI-COMPATIBLE API
    // ========================================================================

    // Completions
    this.app.post('/v1/completions', async (req, res) => {
      try {
        const request: OpenAICompletionRequest = req.body;
        const prompt = Array.isArray(request.prompt) ? request.prompt[0] : request.prompt;

        const result = await this.runtime.generate(request.model, prompt, {
          temperature: request.temperature ?? 0.7,
          topP: request.top_p ?? 1,
          maxTokens: request.max_tokens ?? 2048,
          stopSequences: Array.isArray(request.stop)
            ? request.stop
            : request.stop ? [request.stop] : [],
          stream: false
        });

        res.json({
          id: `cmpl-${Date.now()}`,
          object: 'text_completion',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [{
            text: result.text,
            index: 0,
            finish_reason: result.finishReason
          }],
          usage: {
            prompt_tokens: result.promptTokens,
            completion_tokens: result.completionTokens,
            total_tokens: result.tokens
          }
        });
      } catch (error) {
        res.status(500).json({ error: { message: String(error) } });
      }
    });

    // Chat Completions
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const request: OpenAIChatRequest = req.body;
        const prompt = this.buildChatPrompt(request.messages);

        // Enhance with Hive Mind
        const enhancedPrompt = await this.hiveMind.enhancePrompt(prompt);

        if (request.stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const generator = this.runtime.generateStream(request.model, enhancedPrompt, {
            temperature: request.temperature ?? 0.7,
            topP: request.top_p ?? 1,
            maxTokens: request.max_tokens ?? 2048,
            stopSequences: Array.isArray(request.stop)
              ? request.stop
              : request.stop ? [request.stop] : []
          });

          for await (const token of generator) {
            const chunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: request.model,
              choices: [{
                index: 0,
                delta: { content: token },
                finish_reason: null
              }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          res.write('data: [DONE]\n\n');
          res.end();

        } else {
          const result = await this.runtime.generate(request.model, enhancedPrompt, {
            temperature: request.temperature ?? 0.7,
            topP: request.top_p ?? 1,
            maxTokens: request.max_tokens ?? 2048,
            stopSequences: Array.isArray(request.stop)
              ? request.stop
              : request.stop ? [request.stop] : []
          });

          res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: result.text
              },
              finish_reason: result.finishReason
            }],
            usage: {
              prompt_tokens: result.promptTokens,
              completion_tokens: result.completionTokens,
              total_tokens: result.tokens
            }
          });
        }
      } catch (error) {
        res.status(500).json({ error: { message: String(error) } });
      }
    });

    // Embeddings
    this.app.post('/v1/embeddings', async (req, res) => {
      try {
        const { model, input } = req.body;
        const texts = Array.isArray(input) ? input : [input];

        const embeddings = await this.runtime.embedBatch(model, texts);

        res.json({
          object: 'list',
          data: embeddings.map((embedding, index) => ({
            object: 'embedding',
            embedding,
            index
          })),
          model,
          usage: {
            prompt_tokens: texts.join(' ').split(' ').length,
            total_tokens: texts.join(' ').split(' ').length
          }
        });
      } catch (error) {
        res.status(500).json({ error: { message: String(error) } });
      }
    });

    // List models (OpenAI)
    this.app.get('/v1/models', async (req, res) => {
      const installed = this.modelManager.listInstalled();
      res.json({
        object: 'list',
        data: installed.map(m => ({
          id: m.name,
          object: 'model',
          created: Math.floor(m.installedAt.getTime() / 1000),
          owned_by: 'ulysses-llm'
        }))
      });
    });

    // ========================================================================
    // HIVE MIND ENDPOINTS
    // ========================================================================

    this.app.get('/hive', async (req, res) => {
      try {
        const status = await this.hiveMind.getStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/hive/agents', async (req, res) => {
      try {
        const agents = await this.hiveMind.getAgents();
        res.json({ agents });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.post('/hive/broadcast', async (req, res) => {
      try {
        const { message } = req.body;
        await this.hiveMind.broadcast(message);
        res.json({ status: 'broadcasted' });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ========================================================================
    // NEURAL MAPPING ENDPOINTS
    // ========================================================================

    this.app.get('/neural/graph', async (req, res) => {
      try {
        const graph = await this.neuralMapper.getGraph();
        res.json(graph);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.post('/neural/query', async (req, res) => {
      try {
        const { query, limit = 10 } = req.body;
        const results = await this.neuralMapper.query(query, limit);
        res.json({ results });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ========================================================================
    // PROMETHEUS ENGINE ENDPOINTS
    // ========================================================================

    this.app.get('/prometheus/insights', async (req, res) => {
      try {
        const insights = await this.prometheus.getInsights();
        res.json({ insights });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.post('/prometheus/synthesize', async (req, res) => {
      try {
        const { domains } = req.body;
        const synthesis = await this.prometheus.synthesize(domains);
        res.json(synthesis);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  private buildChatPrompt(messages: { role: string; content: string }[]): string {
    return messages.map(m => {
      switch (m.role) {
        case 'system':
          return `System: ${m.content}`;
        case 'user':
          return `User: ${m.content}`;
        case 'assistant':
          return `Assistant: ${m.content}`;
        default:
          return m.content;
      }
    }).join('\n\n') + '\n\nAssistant:';
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         ULYSSES-LLM SERVER                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${this.port}                                 ║
║                                                                              ║
║  API Endpoints:                                                              ║
║    Ollama Compatible:                                                        ║
║      POST /api/generate     - Text generation                                ║
║      POST /api/chat         - Chat completion                                ║
║      GET  /api/tags         - List models                                    ║
║      POST /api/pull         - Download model                                 ║
║                                                                              ║
║    OpenAI Compatible:                                                        ║
║      POST /v1/completions        - Text completion                           ║
║      POST /v1/chat/completions   - Chat completion                           ║
║      POST /v1/embeddings         - Generate embeddings                       ║
║      GET  /v1/models             - List models                               ║
║                                                                              ║
║    Hive Mind:                                                                ║
║      GET  /hive             - Hive Mind status                               ║
║      GET  /hive/agents      - List agents                                    ║
║      POST /hive/broadcast   - Broadcast message                              ║
║                                                                              ║
║    Neural Mapping:                                                           ║
║      GET  /neural/graph     - Knowledge graph                                ║
║      POST /neural/query     - Query neural map                               ║
║                                                                              ║
║    Prometheus Engine:                                                        ║
║      GET  /prometheus/insights   - Get insights                              ║
║      POST /prometheus/synthesize - Cross-domain synthesis                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
      `);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '11434', 10);
  const server = new UlyssesServer(port);
  server.start();
}

export default UlyssesServer;
