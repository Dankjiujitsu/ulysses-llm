# ULYSSES-LLM

> Offline Large Language Model Runtime with Hive Mind Integration

**ULYSSES-LLM** is a powerful offline LLM inference engine that goes beyond traditional local model runners. Built with a distributed AI agent architecture, it features neural mapping, cross-domain synthesis, and collective intelligence capabilities.

## Features

- **🧠 Hive Mind Architecture**: 8 specialized AI agents work together for enhanced responses
- **🔗 Neural Mapping**: Dynamic knowledge graph for context-aware generation
- **🔥 Prometheus Engine**: Cross-domain pattern discovery and insight generation
- **🚀 High Performance**: GPU acceleration (CUDA, Metal, ROCm) and CPU optimization
- **🔌 API Compatible**: Drop-in replacement for Ollama and OpenAI APIs
- **📦 Multiple Formats**: GGUF, GGML, Safetensors, PyTorch support
- **🎯 Quantization**: 4-bit, 8-bit, 16-bit, and FP32 models

## Installation

```bash
# Clone the repository
git clone https://github.com/Dankjiujitsu/ulysses-llm.git
cd ulysses-llm

# Install dependencies
npm install

# Build
npm run build

# Install globally (optional)
npm link
```

## Quick Start

### Pull a Model

```bash
ulysses pull llama3:8b
```

### Chat with a Model

```bash
ulysses run llama3:8b
```

### Enable Hive Mind

```bash
ulysses run llama3:8b --hive
```

### Start API Server

```bash
ulysses serve
# Server runs on http://localhost:11434
```

## API Endpoints

### Ollama-Compatible

```bash
# Generate
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3:8b", "prompt": "Hello!"}'

# Chat
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3:8b", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### OpenAI-Compatible

```bash
# Chat completions
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3:8b", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### Hive Mind & Neural Mapping

```bash
# Hive mind status
curl http://localhost:11434/hive

# Neural graph
curl http://localhost:11434/neural/graph

# Prometheus insights
curl http://localhost:11434/prometheus/insights
```

## Available Models

| Model | Parameters | Size | Capabilities |
|-------|-----------|------|--------------|
| llama3:8b | 8B | 4.7 GB | chat, code, reasoning |
| llama3:70b | 70B | 40 GB | chat, code, reasoning, analysis |
| mistral:7b | 7B | 4.1 GB | chat, code, instruction-following |
| mixtral:8x7b | 8x7B | 26 GB | chat, code, multilingual |
| phi3:mini | 3.8B | 2.3 GB | chat, code, reasoning |
| codellama:7b | 7B | 4 GB | code, debugging |
| ulysses:hive | 7B | 4.5 GB | hive-mind, neural-mapping |

## Hive Mind Agents

| Agent | Role | Specialization |
|-------|------|----------------|
| ANALYST | Data Analyst | quantitative analysis, trend detection |
| CODER | Software Developer | algorithms, system design |
| WRITER | Content Creator | technical writing, documentation |
| REASONER | Logic Engine | critical thinking, decision making |
| RESEARCHER | Knowledge Explorer | research, source verification |
| CRITIC | Quality Evaluator | quality control, error detection |
| SYNTHESIZER | Knowledge Integrator | knowledge fusion, insight generation |
| ORACLE | Strategic Advisor | trend forecasting, risk assessment |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ULYSSES-LLM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  LLM Core   │  │   Model     │  │    HTTP     │  │    CLI      │        │
│  │  Runtime    │  │   Manager   │  │   Server    │  │  Interface  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                    HIVE MIND ORCHESTRATOR                        │      │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │      │
│  │  │ANALYST │ │ CODER  │ │ WRITER │ │REASONER│ │ORACLE  │         │      │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│  ┌─────────────────────┐           ┌─────────────────────┐                 │
│  │    NEURAL MAPPER    │◄─────────►│  PROMETHEUS ENGINE  │                 │
│  │   Knowledge Graph   │           │  Cross-Domain AI    │                 │
│  └─────────────────────┘           └─────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## License

MIT License

---

**Part of the ULYSSES-OS ecosystem** - [github.com/ULY-OS-V420/ULYSSES-OS-](https://github.com/ULY-OS-V420/ULYSSES-OS-)
