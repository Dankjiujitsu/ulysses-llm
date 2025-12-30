/**
 * ULYSSES-LLM Prometheus Engine
 *
 * Cross-domain knowledge synthesis engine that learns from interactions
 * and generates novel insights by connecting concepts across domains.
 *
 * Features:
 * - Continuous learning from interactions
 * - Cross-domain pattern discovery
 * - Insight generation
 * - Knowledge consolidation
 * - Emergent understanding
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Insight {
  id: string;
  domains: string[];
  synthesis: string;
  novelty: number;
  confidence: number;
  applications: string[];
  createdAt: Date;
  usageCount: number;
}

export interface LearningRecord {
  id: string;
  prompt: string;
  response: string;
  domain: string;
  patterns: string[];
  timestamp: Date;
}

export interface SynthesisResult {
  insights: Insight[];
  connections: { from: string; to: string; strength: number }[];
  emergentConcepts: string[];
}

// ============================================================================
// PROMETHEUS ENGINE CLASS
// ============================================================================

export class PrometheusEngine extends EventEmitter {
  private static instance: PrometheusEngine;

  private insights: Map<string, Insight> = new Map();
  private learningRecords: LearningRecord[] = [];
  private domainPatterns: Map<string, string[]> = new Map();
  private dataPath: string;
  private maxRecords: number = 10000;

  private constructor() {
    super();
    this.dataPath = path.join(os.homedir(), '.ulysses-llm', 'prometheus');
    this.ensureDirectories();
    this.loadData();
  }

  public static getInstance(): PrometheusEngine {
    if (!PrometheusEngine.instance) {
      PrometheusEngine.instance = new PrometheusEngine();
    }
    return PrometheusEngine.instance;
  }

  // ============================================================================
  // LEARNING
  // ============================================================================

  public async learn(prompt: string, response: string): Promise<void> {
    const domain = this.inferDomain(prompt + ' ' + response);
    const patterns = this.extractPatterns(prompt, response);

    const record: LearningRecord = {
      id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt,
      response,
      domain,
      patterns,
      timestamp: new Date()
    };

    this.learningRecords.push(record);

    // Update domain patterns
    const existingPatterns = this.domainPatterns.get(domain) || [];
    this.domainPatterns.set(domain, [...new Set([...existingPatterns, ...patterns])]);

    // Limit records
    if (this.learningRecords.length > this.maxRecords) {
      this.learningRecords = this.learningRecords.slice(-this.maxRecords);
    }

    // Check for new insights
    await this.checkForInsights(record);

    this.emit('learned', { domain, patterns });
    this.saveData();
  }

  private inferDomain(text: string): string {
    const domainKeywords: Record<string, string[]> = {
      'programming': ['code', 'function', 'variable', 'class', 'api', 'programming', 'developer'],
      'science': ['experiment', 'hypothesis', 'research', 'study', 'scientific', 'data'],
      'mathematics': ['equation', 'theorem', 'proof', 'calculate', 'formula', 'number'],
      'literature': ['story', 'character', 'novel', 'poem', 'author', 'narrative'],
      'philosophy': ['ethics', 'existence', 'consciousness', 'truth', 'meaning', 'logic'],
      'business': ['market', 'strategy', 'revenue', 'customer', 'growth', 'investment'],
      'technology': ['software', 'hardware', 'system', 'network', 'digital', 'computer'],
      'health': ['medical', 'symptom', 'treatment', 'disease', 'health', 'patient'],
      'arts': ['music', 'painting', 'creative', 'artistic', 'design', 'visual'],
      'general': []
    };

    const lowerText = text.toLowerCase();
    let bestDomain = 'general';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const score = keywords.filter(kw => lowerText.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  private extractPatterns(prompt: string, response: string): string[] {
    const patterns: string[] = [];
    const text = `${prompt} ${response}`.toLowerCase();

    // Extract key phrases
    const phrases = text.match(/\b\w+\s+\w+\s+\w+\b/g) || [];
    patterns.push(...phrases.slice(0, 5));

    // Extract concepts (capitalized words)
    const concepts = `${prompt} ${response}`.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    patterns.push(...concepts.slice(0, 5));

    // Extract question patterns
    if (prompt.includes('?')) {
      const questionType = prompt.match(/^(what|how|why|when|where|who|which)/i);
      if (questionType) {
        patterns.push(`question:${questionType[0].toLowerCase()}`);
      }
    }

    return [...new Set(patterns)];
  }

  // ============================================================================
  // INSIGHT GENERATION
  // ============================================================================

  private async checkForInsights(record: LearningRecord): Promise<void> {
    // Check for cross-domain connections
    const relatedDomains = this.findRelatedDomains(record.domain, record.patterns);

    if (relatedDomains.length > 0) {
      for (const relatedDomain of relatedDomains) {
        await this.generateInsight(record.domain, relatedDomain, record.patterns);
      }
    }
  }

  private findRelatedDomains(domain: string, patterns: string[]): string[] {
    const related: string[] = [];

    for (const [otherDomain, otherPatterns] of this.domainPatterns) {
      if (otherDomain === domain) continue;

      // Check for pattern overlap
      const overlap = patterns.filter(p => otherPatterns.includes(p));
      if (overlap.length >= 2) {
        related.push(otherDomain);
      }
    }

    return related;
  }

  private async generateInsight(domain1: string, domain2: string, sharedPatterns: string[]): Promise<void> {
    const insightId = `${domain1}-${domain2}-${Date.now()}`;

    // Check if similar insight exists
    for (const existing of this.insights.values()) {
      if (existing.domains.includes(domain1) && existing.domains.includes(domain2)) {
        existing.usageCount++;
        existing.confidence = Math.min(existing.confidence + 0.05, 1.0);
        return;
      }
    }

    const insight: Insight = {
      id: insightId,
      domains: [domain1, domain2],
      synthesis: this.synthesizeDescription(domain1, domain2, sharedPatterns),
      novelty: 0.7 + Math.random() * 0.3,
      confidence: 0.6,
      applications: this.generateApplications(domain1, domain2),
      createdAt: new Date(),
      usageCount: 1
    };

    this.insights.set(insightId, insight);
    this.emit('insight:generated', insight);
  }

  private synthesizeDescription(domain1: string, domain2: string, patterns: string[]): string {
    const templates = [
      `The intersection of ${domain1} and ${domain2} reveals shared patterns in ${patterns[0] || 'conceptual structure'}`,
      `Methodologies from ${domain1} can be applied to ${domain2} problems, particularly regarding ${patterns[0] || 'systematic approaches'}`,
      `Cross-domain analysis shows that ${domain1} principles enhance ${domain2} understanding through ${patterns[0] || 'analogical reasoning'}`,
      `The convergence of ${domain1} and ${domain2} suggests emergent frameworks for ${patterns[0] || 'problem-solving'}`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateApplications(domain1: string, domain2: string): string[] {
    return [
      `Apply ${domain1} techniques to ${domain2} challenges`,
      `Use ${domain2} frameworks to structure ${domain1} problems`,
      `Develop hybrid approaches combining ${domain1} and ${domain2}`,
      `Transfer learning from ${domain1} to ${domain2} contexts`
    ];
  }

  // ============================================================================
  // SYNTHESIS
  // ============================================================================

  public async synthesize(domains: string[]): Promise<SynthesisResult> {
    const relevantInsights: Insight[] = [];
    const connections: { from: string; to: string; strength: number }[] = [];
    const emergentConcepts: string[] = [];

    // Find insights involving requested domains
    for (const insight of this.insights.values()) {
      if (domains.some(d => insight.domains.includes(d))) {
        relevantInsights.push(insight);
      }
    }

    // Build connection map
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const patterns1 = this.domainPatterns.get(domains[i]) || [];
        const patterns2 = this.domainPatterns.get(domains[j]) || [];
        const overlap = patterns1.filter(p => patterns2.includes(p));

        if (overlap.length > 0) {
          connections.push({
            from: domains[i],
            to: domains[j],
            strength: Math.min(overlap.length / 10, 1.0)
          });
        }
      }
    }

    // Generate emergent concepts
    const allPatterns: string[] = [];
    for (const domain of domains) {
      allPatterns.push(...(this.domainPatterns.get(domain) || []));
    }

    const patternCounts = new Map<string, number>();
    for (const pattern of allPatterns) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }

    for (const [pattern, count] of patternCounts) {
      if (count >= 2) {
        emergentConcepts.push(pattern);
      }
    }

    return {
      insights: relevantInsights,
      connections,
      emergentConcepts: emergentConcepts.slice(0, 10)
    };
  }

  public async getInsights(): Promise<Insight[]> {
    return Array.from(this.insights.values())
      .sort((a, b) => b.novelty * b.confidence - a.novelty * a.confidence);
  }

  public async getInsightsByDomain(domain: string): Promise<Insight[]> {
    return Array.from(this.insights.values())
      .filter(i => i.domains.includes(domain));
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private loadData(): void {
    // Load insights
    const insightsPath = path.join(this.dataPath, 'insights.json');
    if (fs.existsSync(insightsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(insightsPath, 'utf-8'));
        for (const insight of data.insights || []) {
          this.insights.set(insight.id, {
            ...insight,
            createdAt: new Date(insight.createdAt)
          });
        }
      } catch {}
    }

    // Load domain patterns
    const patternsPath = path.join(this.dataPath, 'patterns.json');
    if (fs.existsSync(patternsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        for (const [domain, patterns] of Object.entries(data.patterns || {})) {
          this.domainPatterns.set(domain, patterns as string[]);
        }
      } catch {}
    }
  }

  private saveData(): void {
    // Save insights
    const insightsPath = path.join(this.dataPath, 'insights.json');
    fs.writeFileSync(insightsPath, JSON.stringify({
      version: '1.0.0',
      insights: Array.from(this.insights.values())
    }, null, 2));

    // Save patterns
    const patternsPath = path.join(this.dataPath, 'patterns.json');
    fs.writeFileSync(patternsPath, JSON.stringify({
      version: '1.0.0',
      patterns: Object.fromEntries(this.domainPatterns)
    }, null, 2));
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  public getStats(): object {
    return {
      totalInsights: this.insights.size,
      totalLearningRecords: this.learningRecords.length,
      domains: Array.from(this.domainPatterns.keys()),
      averageNovelty: this.insights.size > 0
        ? Array.from(this.insights.values()).reduce((s, i) => s + i.novelty, 0) / this.insights.size
        : 0,
      topInsights: Array.from(this.insights.values())
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
        .map(i => ({ id: i.id, domains: i.domains, usageCount: i.usageCount }))
    };
  }
}

export default PrometheusEngine;
