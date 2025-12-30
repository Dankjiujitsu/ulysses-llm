/**
 * ULYSSES-LLM Neural Mapper
 *
 * Builds and maintains a dynamic knowledge graph from interactions.
 * Enables semantic search, relationship discovery, and context retrieval.
 *
 * Features:
 * - Semantic embedding-based node similarity
 * - Automatic relationship inference
 * - Temporal knowledge decay
 * - Cross-domain linking
 * - Query expansion
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NeuralNode {
  id: string;
  concept: string;
  domain: string;
  embedding: number[];
  connections: Connection[];
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    confidence: number;
    source: string;
  };
  content: string;
  tags: string[];
}

export interface Connection {
  targetId: string;
  weight: number;
  relation: string;
  bidirectional: boolean;
}

export interface NeuralGraph {
  nodes: NeuralNode[];
  stats: {
    totalNodes: number;
    totalConnections: number;
    domains: string[];
    averageConnections: number;
  };
}

export interface QueryResult {
  node: NeuralNode;
  score: number;
  path: string[];
}

// ============================================================================
// NEURAL MAPPER CLASS
// ============================================================================

export class NeuralMapper extends EventEmitter {
  private static instance: NeuralMapper;

  private nodes: Map<string, NeuralNode> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private dataPath: string;
  private embeddingDim: number = 768;

  private constructor() {
    super();
    this.dataPath = path.join(os.homedir(), '.ulysses-llm', 'neural');
    this.ensureDirectories();
    this.loadGraph();
  }

  public static getInstance(): NeuralMapper {
    if (!NeuralMapper.instance) {
      NeuralMapper.instance = new NeuralMapper();
    }
    return NeuralMapper.instance;
  }

  // ============================================================================
  // NODE MANAGEMENT
  // ============================================================================

  public async addNode(
    concept: string,
    domain: string,
    content: string,
    tags: string[] = [],
    source: string = 'user'
  ): Promise<NeuralNode> {
    const id = this.generateId(concept, domain);

    // Check if node exists
    if (this.nodes.has(id)) {
      const existing = this.nodes.get(id)!;
      existing.metadata.accessCount++;
      existing.metadata.lastAccessed = new Date();
      return existing;
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(content);

    const node: NeuralNode = {
      id,
      concept,
      domain,
      embedding,
      connections: [],
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        confidence: 0.8,
        source
      },
      content,
      tags
    };

    this.nodes.set(id, node);
    this.embeddings.set(id, embedding);

    // Find and create connections
    await this.findConnections(node);

    this.emit('node:added', node);
    this.saveGraph();

    return node;
  }

  public async removeNode(id: string): Promise<void> {
    if (!this.nodes.has(id)) return;

    // Remove connections to this node
    for (const node of this.nodes.values()) {
      node.connections = node.connections.filter(c => c.targetId !== id);
    }

    this.nodes.delete(id);
    this.embeddings.delete(id);

    this.emit('node:removed', { id });
    this.saveGraph();
  }

  public getNode(id: string): NeuralNode | undefined {
    return this.nodes.get(id);
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  private async findConnections(node: NeuralNode): Promise<void> {
    const similarNodes = await this.findSimilarNodes(node.embedding, 10, node.id);

    for (const { node: similar, score } of similarNodes) {
      if (score > 0.7) {
        // Strong connection
        this.addConnection(node.id, similar.id, score, 'semantic_similarity', true);
      } else if (score > 0.5) {
        // Weak connection
        this.addConnection(node.id, similar.id, score, 'related', false);
      }
    }

    // Domain-based connections
    const samedomainNodes = Array.from(this.nodes.values())
      .filter(n => n.id !== node.id && n.domain === node.domain);

    for (const domainNode of samedomainNodes.slice(0, 5)) {
      if (!node.connections.find(c => c.targetId === domainNode.id)) {
        this.addConnection(node.id, domainNode.id, 0.6, 'same_domain', true);
      }
    }
  }

  private addConnection(
    sourceId: string,
    targetId: string,
    weight: number,
    relation: string,
    bidirectional: boolean
  ): void {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);

    if (!source || !target) return;

    // Add to source
    if (!source.connections.find(c => c.targetId === targetId)) {
      source.connections.push({ targetId, weight, relation, bidirectional });
    }

    // Add to target if bidirectional
    if (bidirectional && !target.connections.find(c => c.targetId === sourceId)) {
      target.connections.push({
        targetId: sourceId,
        weight,
        relation,
        bidirectional: true
      });
    }
  }

  // ============================================================================
  // QUERY & SEARCH
  // ============================================================================

  public async query(queryText: string, limit: number = 10): Promise<QueryResult[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);
    return this.findSimilarNodes(queryEmbedding, limit);
  }

  public async getRelevantContext(text: string, maxTokens: number = 500): Promise<string | null> {
    const results = await this.query(text, 5);

    if (results.length === 0) return null;

    // Build context from top results
    const contextParts: string[] = [];
    let tokenCount = 0;

    for (const result of results) {
      const content = result.node.content;
      const tokens = Math.ceil(content.length / 4);

      if (tokenCount + tokens > maxTokens) break;

      contextParts.push(`[${result.node.domain}] ${content}`);
      tokenCount += tokens;
    }

    return contextParts.join('\n\n');
  }

  private async findSimilarNodes(
    embedding: number[],
    limit: number,
    excludeId?: string
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];

    for (const [id, node] of this.nodes) {
      if (id === excludeId) continue;

      const score = this.cosineSimilarity(embedding, node.embedding);
      results.push({ node, score, path: [id] });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ============================================================================
  // GRAPH OPERATIONS
  // ============================================================================

  public async getGraph(): Promise<NeuralGraph> {
    const nodes = Array.from(this.nodes.values());
    const totalConnections = nodes.reduce((sum, n) => sum + n.connections.length, 0);
    const domains = [...new Set(nodes.map(n => n.domain))];

    return {
      nodes,
      stats: {
        totalNodes: nodes.length,
        totalConnections,
        domains,
        averageConnections: nodes.length > 0 ? totalConnections / nodes.length : 0
      }
    };
  }

  public async traversePath(startId: string, endId: string, maxDepth: number = 5): Promise<string[][]> {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], depth: number): void => {
      if (depth > maxDepth) return;
      if (currentId === endId) {
        paths.push([...path]);
        return;
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);

      if (node) {
        for (const conn of node.connections) {
          if (!visited.has(conn.targetId)) {
            dfs(conn.targetId, [...path, conn.targetId], depth + 1);
          }
        }
      }

      visited.delete(currentId);
    };

    dfs(startId, [startId], 0);
    return paths;
  }

  public getDomainNodes(domain: string): NeuralNode[] {
    return Array.from(this.nodes.values()).filter(n => n.domain === domain);
  }

  public getRelatedNodes(nodeId: string, depth: number = 1): NeuralNode[] {
    const related = new Set<NeuralNode>();
    const visited = new Set<string>();

    const explore = (id: string, currentDepth: number): void => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) return;

      for (const conn of node.connections) {
        const target = this.nodes.get(conn.targetId);
        if (target) {
          related.add(target);
          explore(conn.targetId, currentDepth + 1);
        }
      }
    };

    explore(nodeId, 0);
    return Array.from(related);
  }

  // ============================================================================
  // EMBEDDINGS
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based pseudo-embedding (in production, use actual model)
    const embedding = new Array(this.embeddingDim).fill(0);

    // Use character codes and positions to create deterministic embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const pos = i % this.embeddingDim;
      embedding[pos] += (charCode / 128 - 1) / Math.sqrt(text.length);
    }

    // Add word-level features
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.hashString(word);
      const pos = hash % this.embeddingDim;
      embedding[pos] += 0.1 / Math.sqrt(words.length);
    }

    // Normalize
    return this.normalizeVector(embedding);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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

  private normalizeVector(v: number[]): number[] {
    const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? v : v.map(val => val / magnitude);
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private loadGraph(): void {
    const graphPath = path.join(this.dataPath, 'graph.json');

    if (fs.existsSync(graphPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

        for (const nodeData of data.nodes || []) {
          const node: NeuralNode = {
            ...nodeData,
            metadata: {
              ...nodeData.metadata,
              createdAt: new Date(nodeData.metadata.createdAt),
              lastAccessed: new Date(nodeData.metadata.lastAccessed)
            }
          };
          this.nodes.set(node.id, node);
          this.embeddings.set(node.id, node.embedding);
        }

        console.log(`[NeuralMapper] Loaded ${this.nodes.size} nodes from disk`);
      } catch (error) {
        console.error('[NeuralMapper] Error loading graph:', error);
      }
    }
  }

  private saveGraph(): void {
    const graphPath = path.join(this.dataPath, 'graph.json');
    const data = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      nodes: Array.from(this.nodes.values())
    };

    fs.writeFileSync(graphPath, JSON.stringify(data, null, 2));
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateId(concept: string, domain: string): string {
    const base = `${domain}:${concept}`.toLowerCase().replace(/\s+/g, '_');
    return base.slice(0, 64);
  }

  public getStats(): object {
    const nodes = Array.from(this.nodes.values());
    const domains = [...new Set(nodes.map(n => n.domain))];

    return {
      totalNodes: nodes.length,
      totalConnections: nodes.reduce((sum, n) => sum + n.connections.length, 0),
      domains,
      averageConfidence: nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.metadata.confidence, 0) / nodes.length
        : 0
    };
  }
}

export default NeuralMapper;
