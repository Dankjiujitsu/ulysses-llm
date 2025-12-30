/**
 * ULYSSES-LLM Model Manager
 *
 * Manages model downloads, storage, and lifecycle:
 * - Pull models from Hugging Face or custom registries
 * - List available and downloaded models
 * - Remove models
 * - Model versioning and updates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import * as https from 'https';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ModelManifest {
  name: string;
  family: string;
  parameters: string;
  quantization: string;
  format: 'gguf' | 'ggml' | 'safetensors' | 'pytorch';
  size: number;
  sha256: string;
  downloadUrl: string;
  description: string;
  license: string;
  contextLength: number;
  capabilities: string[];
  releaseDate: string;
}

export interface DownloadProgress {
  modelName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
}

export interface InstalledModel {
  name: string;
  path: string;
  size: number;
  format: string;
  quantization: string;
  family: string;
  installedAt: Date;
  lastUsed: Date | null;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

const MODEL_REGISTRY: ModelManifest[] = [
  {
    name: 'llama3:8b',
    family: 'llama',
    parameters: '8B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_700_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/Llama-3-8B-GGUF/resolve/main/llama-3-8b.Q4_K_M.gguf',
    description: 'Meta Llama 3 8B - High quality open source LLM',
    license: 'Llama 3 Community License',
    contextLength: 8192,
    capabilities: ['chat', 'code', 'reasoning'],
    releaseDate: '2024-04-18'
  },
  {
    name: 'llama3:70b',
    family: 'llama',
    parameters: '70B',
    quantization: '4bit',
    format: 'gguf',
    size: 40_000_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/Llama-3-70B-GGUF/resolve/main/llama-3-70b.Q4_K_M.gguf',
    description: 'Meta Llama 3 70B - Largest open source model',
    license: 'Llama 3 Community License',
    contextLength: 8192,
    capabilities: ['chat', 'code', 'reasoning', 'analysis'],
    releaseDate: '2024-04-18'
  },
  {
    name: 'mistral:7b',
    family: 'mistral',
    parameters: '7B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_100_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    description: 'Mistral 7B Instruct - Efficient and capable',
    license: 'Apache 2.0',
    contextLength: 32768,
    capabilities: ['chat', 'code', 'instruction-following'],
    releaseDate: '2024-01-15'
  },
  {
    name: 'mixtral:8x7b',
    family: 'mixtral',
    parameters: '8x7B',
    quantization: '4bit',
    format: 'gguf',
    size: 26_000_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF/resolve/main/mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf',
    description: 'Mixtral 8x7B MoE - Sparse mixture of experts',
    license: 'Apache 2.0',
    contextLength: 32768,
    capabilities: ['chat', 'code', 'reasoning', 'multilingual'],
    releaseDate: '2023-12-11'
  },
  {
    name: 'phi3:mini',
    family: 'phi',
    parameters: '3.8B',
    quantization: '4bit',
    format: 'gguf',
    size: 2_300_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    description: 'Microsoft Phi-3 Mini - Small but powerful',
    license: 'MIT',
    contextLength: 4096,
    capabilities: ['chat', 'code', 'reasoning'],
    releaseDate: '2024-04-23'
  },
  {
    name: 'codellama:7b',
    family: 'codellama',
    parameters: '7B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_000_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf',
    description: 'Code Llama 7B - Specialized for code generation',
    license: 'Llama 2 Community License',
    contextLength: 16384,
    capabilities: ['code', 'debugging', 'explanation'],
    releaseDate: '2023-08-24'
  },
  {
    name: 'deepseek-coder:6.7b',
    family: 'deepseek',
    parameters: '6.7B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_000_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf',
    description: 'DeepSeek Coder - Expert code model',
    license: 'DeepSeek License',
    contextLength: 16384,
    capabilities: ['code', 'debugging', 'completion'],
    releaseDate: '2023-11-02'
  },
  {
    name: 'qwen2:7b',
    family: 'qwen',
    parameters: '7B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_500_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2-7B-Instruct-GGUF/resolve/main/qwen2-7b-instruct-q4_k_m.gguf',
    description: 'Qwen2 7B - Alibaba multilingual model',
    license: 'Qwen License',
    contextLength: 32768,
    capabilities: ['chat', 'code', 'multilingual', 'reasoning'],
    releaseDate: '2024-06-07'
  },
  {
    name: 'gemma:7b',
    family: 'gemma',
    parameters: '7B',
    quantization: '4bit',
    format: 'gguf',
    size: 5_000_000_000,
    sha256: '',
    downloadUrl: 'https://huggingface.co/google/gemma-7b-it-GGUF/resolve/main/gemma-7b-it.Q4_K_M.gguf',
    description: 'Google Gemma 7B - Lightweight and efficient',
    license: 'Gemma Terms of Use',
    contextLength: 8192,
    capabilities: ['chat', 'code', 'reasoning'],
    releaseDate: '2024-02-21'
  },
  {
    name: 'ulysses:hive',
    family: 'ulysses',
    parameters: '7B',
    quantization: '4bit',
    format: 'gguf',
    size: 4_500_000_000,
    sha256: '',
    downloadUrl: '',
    description: 'ULYSSES Hive Mind - Custom fine-tuned model with neural mapping',
    license: 'ULYSSES-OS License',
    contextLength: 16384,
    capabilities: ['chat', 'code', 'reasoning', 'hive-mind', 'neural-mapping', 'cross-domain-synthesis'],
    releaseDate: '2024-12-30'
  }
];

// ============================================================================
// MODEL MANAGER CLASS
// ============================================================================

export class ModelManager extends EventEmitter {
  private static instance: ModelManager;

  private modelsDirectory: string;
  private installedModels: Map<string, InstalledModel> = new Map();
  private downloads: Map<string, { controller: AbortController; progress: DownloadProgress }> = new Map();

  private constructor() {
    super();
    this.modelsDirectory = path.join(os.homedir(), '.ulysses-llm', 'models');
    this.ensureDirectories();
    this.scanInstalledModels();
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  // ============================================================================
  // MODEL LISTING
  // ============================================================================

  public listAvailable(): ModelManifest[] {
    return MODEL_REGISTRY;
  }

  public listInstalled(): InstalledModel[] {
    return Array.from(this.installedModels.values());
  }

  public searchModels(query: string): ModelManifest[] {
    const lowerQuery = query.toLowerCase();
    return MODEL_REGISTRY.filter(m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.family.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.capabilities.some(c => c.toLowerCase().includes(lowerQuery))
    );
  }

  public getModel(name: string): ModelManifest | undefined {
    return MODEL_REGISTRY.find(m => m.name === name);
  }

  public isInstalled(name: string): boolean {
    return this.installedModels.has(name);
  }

  // ============================================================================
  // MODEL DOWNLOAD
  // ============================================================================

  public async pull(modelName: string): Promise<void> {
    const manifest = this.getModel(modelName);
    if (!manifest) {
      throw new Error(`Model not found: ${modelName}`);
    }

    if (this.isInstalled(modelName)) {
      this.emit('pull:exists', { name: modelName });
      return;
    }

    if (!manifest.downloadUrl) {
      // For custom models like ulysses:hive, create a placeholder
      await this.createCustomModel(manifest);
      return;
    }

    this.emit('pull:start', { name: modelName, size: manifest.size });

    const controller = new AbortController();
    const progress: DownloadProgress = {
      modelName,
      bytesDownloaded: 0,
      totalBytes: manifest.size,
      percentage: 0,
      speed: 0,
      eta: 0
    };

    this.downloads.set(modelName, { controller, progress });

    try {
      const outputPath = path.join(this.modelsDirectory, `${modelName.replace(':', '-')}.gguf`);
      await this.downloadFile(manifest.downloadUrl, outputPath, progress);

      // Register installed model
      const installed: InstalledModel = {
        name: modelName,
        path: outputPath,
        size: manifest.size,
        format: manifest.format,
        quantization: manifest.quantization,
        family: manifest.family,
        installedAt: new Date(),
        lastUsed: null
      };

      this.installedModels.set(modelName, installed);
      this.saveManifest();

      this.emit('pull:complete', { name: modelName, path: outputPath });

    } catch (error) {
      this.emit('pull:error', { name: modelName, error });
      throw error;
    } finally {
      this.downloads.delete(modelName);
    }
  }

  private async downloadFile(url: string, outputPath: string, progress: DownloadProgress): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      const startTime = Date.now();

      https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          file.close();
          fs.unlinkSync(outputPath);
          this.downloadFile(response.headers.location!, outputPath, progress)
            .then(resolve)
            .catch(reject);
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        progress.totalBytes = totalBytes || progress.totalBytes;

        response.on('data', (chunk: Buffer) => {
          progress.bytesDownloaded += chunk.length;
          progress.percentage = (progress.bytesDownloaded / progress.totalBytes) * 100;

          const elapsed = (Date.now() - startTime) / 1000;
          progress.speed = progress.bytesDownloaded / elapsed;
          progress.eta = (progress.totalBytes - progress.bytesDownloaded) / progress.speed;

          this.emit('pull:progress', progress);
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

      }).on('error', (err) => {
        file.close();
        fs.unlinkSync(outputPath);
        reject(err);
      });
    });
  }

  private async createCustomModel(manifest: ModelManifest): Promise<void> {
    // Create a custom model configuration
    const modelDir = path.join(this.modelsDirectory, manifest.name.replace(':', '-'));
    fs.mkdirSync(modelDir, { recursive: true });

    const configPath = path.join(modelDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      name: manifest.name,
      family: manifest.family,
      description: manifest.description,
      capabilities: manifest.capabilities,
      contextLength: manifest.contextLength,
      type: 'hive-mind-enhanced',
      created: new Date().toISOString()
    }, null, 2));

    const installed: InstalledModel = {
      name: manifest.name,
      path: modelDir,
      size: 0,
      format: manifest.format,
      quantization: manifest.quantization,
      family: manifest.family,
      installedAt: new Date(),
      lastUsed: null
    };

    this.installedModels.set(manifest.name, installed);
    this.saveManifest();

    this.emit('pull:complete', { name: manifest.name, path: modelDir });
  }

  // ============================================================================
  // MODEL REMOVAL
  // ============================================================================

  public async remove(modelName: string): Promise<void> {
    const installed = this.installedModels.get(modelName);
    if (!installed) {
      throw new Error(`Model not installed: ${modelName}`);
    }

    this.emit('remove:start', { name: modelName });

    try {
      // Remove model files
      if (fs.existsSync(installed.path)) {
        if (fs.statSync(installed.path).isDirectory()) {
          fs.rmSync(installed.path, { recursive: true });
        } else {
          fs.unlinkSync(installed.path);
        }
      }

      this.installedModels.delete(modelName);
      this.saveManifest();

      this.emit('remove:complete', { name: modelName });

    } catch (error) {
      this.emit('remove:error', { name: modelName, error });
      throw error;
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private ensureDirectories(): void {
    if (!fs.existsSync(this.modelsDirectory)) {
      fs.mkdirSync(this.modelsDirectory, { recursive: true });
    }
  }

  private scanInstalledModels(): void {
    const manifestPath = path.join(this.modelsDirectory, 'manifest.json');

    if (fs.existsSync(manifestPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        for (const model of data.models || []) {
          this.installedModels.set(model.name, {
            ...model,
            installedAt: new Date(model.installedAt),
            lastUsed: model.lastUsed ? new Date(model.lastUsed) : null
          });
        }
      } catch {}
    }
  }

  private saveManifest(): void {
    const manifestPath = path.join(this.modelsDirectory, 'manifest.json');
    const data = {
      version: '1.0.0',
      models: Array.from(this.installedModels.values())
    };
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
  }

  public cancelDownload(modelName: string): void {
    const download = this.downloads.get(modelName);
    if (download) {
      download.controller.abort();
      this.downloads.delete(modelName);
      this.emit('pull:cancelled', { name: modelName });
    }
  }

  public getDownloadProgress(modelName: string): DownloadProgress | null {
    return this.downloads.get(modelName)?.progress || null;
  }

  public formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export default ModelManager;
